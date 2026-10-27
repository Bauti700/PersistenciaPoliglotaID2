import { pgPool } from '../config/database.js';
import { ActorRepository } from './actorRepository.js';
import { MongoTelemetryRepository } from './telemetriaRepository.js';

export class FacturaRepository {
  /**
   * Emite factura a un CLIENTE (Facturación de venta emitida por el sistema)
   */
  static async emitirFactura({ id_cliente, importe_total, concepto = 'Servicio de logística internacional', id_envio = null, numero_comprobante = null }) {
    const actor = await ActorRepository.obtenerPorId(id_cliente);
    if (!actor) throw new Error(`El actor con ID ${id_cliente} no existe.`);
    if (actor.tipo_actor !== 'CLIENTE') {
      throw new Error(`El actor ${actor.razon_social} es de tipo ${actor.tipo_actor}. La emisión de facturas corresponde a CLIENTES. Para proveedores y operadores use registrarFacturaRecibida.`);
    }

    const nroComp = numero_comprobante || `FC-CLI-${Date.now().toString().slice(-8)}`;

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const insertFactura = `
        INSERT INTO facturas (id_cliente, tipo_factura, numero_comprobante, concepto, id_envio, importe_total, estado)
        VALUES ($1, 'EMITIDA', $2, $3, $4, $5, 'PENDIENTE')
        RETURNING *;
      `;
      const resFactura = await client.query(insertFactura, [id_cliente, nroComp, concepto, id_envio, importe_total]);
      const factura = resFactura.rows[0];

      // Impactar Cuenta Corriente del cliente: debita el importe (deuda del cliente hacia la empresa)
      await client.query(`
        UPDATE cuentas_corrientes
        SET saldo = saldo - $1, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_actor = $2;
      `, [importe_total, id_cliente]);

      await client.query('COMMIT');
      return factura;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Registra una FACTURA RECIBIDA ya confeccionada por un PROVEEDOR u OPERADOR LOGÍSTICO
   * (El sistema NO las genera, sino que recibe las facturas externas ya hechas por ellos)
   */
  static async registrarFacturaRecibida({ id_actor, importe_total, numero_comprobante, concepto = 'Factura de servicios/insumos recibida', id_envio = null }) {
    if (!numero_comprobante || !numero_comprobante.trim()) {
      throw new Error('Debe especificar el número de comprobante externo provisto por el proveedor u operador.');
    }

    const actor = await ActorRepository.obtenerPorId(id_actor);
    if (!actor) throw new Error(`El actor con ID ${id_actor} no existe.`);
    if (actor.tipo_actor !== 'PROVEEDOR' && actor.tipo_actor !== 'OPERADOR') {
      throw new Error(`El actor ${actor.razon_social} es de tipo ${actor.tipo_actor}. Solo se registran facturas recibidas de PROVEEDORES y OPERADORES.`);
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const insertFactura = `
        INSERT INTO facturas (id_cliente, tipo_factura, numero_comprobante, concepto, id_envio, importe_total, estado)
        VALUES ($1, 'RECIBIDA', $2, $3, $4, $5, 'PENDIENTE')
        RETURNING *;
      `;
      const resFactura = await client.query(insertFactura, [id_actor, numero_comprobante.trim(), concepto, id_envio, importe_total]);
      const factura = resFactura.rows[0];

      // Impactar Cuenta Corriente de proveedor/operador: se reconoce la deuda contraída con el tercero (saldo acreedor a su favor)
      await client.query(`
        UPDATE cuentas_corrientes
        SET saldo = saldo + $1, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_actor = $2;
      `, [importe_total, id_actor]);

      await client.query('COMMIT');
      return factura;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Facturación automática de un envío (calcula tarifa base + tramos + prioridad)
   */
  static async facturacionAutomaticaPorEnvio(id_envio) {
    const resEnvio = await pgPool.query(`
      SELECT e.*, a.razon_social, a.tipo_actor 
      FROM envios e 
      JOIN actores a ON e.id_cliente = a.id_actor 
      WHERE e.id_envio = $1;
    `, [id_envio]);

    if (resEnvio.rows.length === 0) {
      throw new Error(`Envío ${id_envio} no encontrado.`);
    }

    const envio = resEnvio.rows[0];

    // Verificar si ya fue facturado
    const resFacturada = await pgPool.query(`
      SELECT * FROM facturas 
      WHERE id_envio = $1 AND tipo_factura = 'EMITIDA';
    `, [id_envio]);

    if (resFacturada.rows.length > 0) {
      return {
        ya_facturado: true,
        factura: resFacturada.rows[0],
        mensaje: `El envío ${id_envio} ya fue facturado previamente (Factura N° ${resFacturada.rows[0].id_factura}).`
      };
    }

    // Contar tramos para cálculo
    const resTramos = await pgPool.query(`SELECT COUNT(*) AS total_tramos FROM tramos WHERE id_envio = $1;`, [id_envio]);
    const cantTramos = Math.max(1, parseInt(resTramos.rows[0].total_tramos, 10));

    // Regla de cálculo comercial:
    // Tarifa base: $50,000 + $15,000 por tramo
    const baseTarifa = 50000;
    const costoTramos = cantTramos * 15000;
    let factorPrioridad = 1.0;
    if (envio.prioridad === 'ALTA') factorPrioridad = 1.25;
    if (envio.prioridad === 'URGENTE') factorPrioridad = 1.5;

    const importeTotal = Math.round((baseTarifa + costoTramos) * factorPrioridad * 100) / 100;
    const concepto = `Facturación automática de servicio logístico [${envio.id_envio}] (${envio.origen} -> ${envio.destino}) con ${cantTramos} tramo(s) - Prioridad ${envio.prioridad}`;

    const factura = await FacturaRepository.emitirFactura({
      id_cliente: envio.id_cliente,
      importe_total: importeTotal,
      concepto,
      id_envio: envio.id_envio,
      numero_comprobante: `AUTO-${envio.id_envio}`
    });

    // Actualizar estado del envío a ENTREGADO si no estaba finalizado
    await pgPool.query(`UPDATE envios SET estado = 'ENTREGADO' WHERE id_envio = $1 AND estado <> 'ENTREGADO';`, [id_envio]);

    // Registrar evento de auditoría en MongoDB
    try {
      await MongoTelemetryRepository.registrarEventoLogistico({
        id_evento: `EVT-FAC-${Date.now()}`,
        id_envio: envio.id_envio,
        tipo_evento: 'Facturación Automática',
        ubicacion: envio.destino,
        descripcion: `Generada factura automática N° ${factura.id_factura} por $${importeTotal} al cliente ${envio.razon_social}.`
      });
    } catch (e) {
      console.warn(`[Sync Mongo Warning]: ${e.message}`);
    }

    return {
      ya_facturado: false,
      factura,
      calculo: {
        base: baseTarifa,
        tramos: cantTramos,
        costo_tramos: costoTramos,
        factor_prioridad: factorPrioridad,
        total: importeTotal
      }
    };
  }

  /**
   * Ejecución por lote de Facturación Automática
   */
  static async ejecutarFacturacionAutomaticaMasiva() {
    // Buscar envíos que no tengan factura emitida
    const res = await pgPool.query(`
      SELECT e.id_envio 
      FROM envios e
      WHERE NOT EXISTS (
        SELECT 1 FROM facturas f WHERE f.id_envio = e.id_envio AND f.tipo_factura = 'EMITIDA'
      );
    `);

    const resultados = [];
    for (const row of res.rows) {
      try {
        const facRes = await FacturaRepository.facturacionAutomaticaPorEnvio(row.id_envio);
        resultados.push({ id_envio: row.id_envio, exito: true, factura: facRes.factura });
      } catch (err) {
        resultados.push({ id_envio: row.id_envio, exito: false, error: err.message });
      }
    }
    return resultados;
  }
}

export { FacturaRepository as facturaRepository };
