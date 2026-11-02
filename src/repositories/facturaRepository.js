import { randomUUID } from 'crypto';
import { pgPool } from '../config/database.js';
import { ActorRepository } from './actorRepository.js';
import { CuentaCorrienteRepository } from './cuentaCorrienteRepository.js';
import { MongoTelemetryRepository } from './telemetriaRepository.js';
import {
  textoRequerido,
  textoOpcional,
  enteroPositivo,
  montoPositivo,
  unoDe,
  errorValidacion,
  TIPOS_ACTOR_FINANCIERO
} from '../utils/validation.js';

async function verificarComprobanteUnico(client, { tipo_actor, tipo_factura, numero_comprobante }) {
  const res = await client.query(`
    SELECT id_factura
    FROM facturas
    WHERE tipo_actor = $1 AND tipo_factura = $2 AND numero_comprobante = $3
    LIMIT 1;
  `, [tipo_actor, tipo_factura, numero_comprobante]);

  if (res.rowCount > 0) {
    throw errorValidacion(
      `Ya existe una factura ${tipo_factura} para ${tipo_actor} con el comprobante ${numero_comprobante}.`,
      409
    );
  }
}

async function verificarEnvio(client, id_envio, { id_cliente = null, marcar_entregado = false } = {}) {
  if (!id_envio) return null;

  const res = await client.query(
    'SELECT id_envio, id_cliente, estado FROM envios WHERE id_envio = $1',
    [id_envio]
  );
  if (res.rowCount === 0) {
    throw errorValidacion(`El envío ${id_envio} no existe.`, 404);
  }

  const envio = res.rows[0];
  if (id_cliente !== null && Number(envio.id_cliente) !== Number(id_cliente)) {
    throw errorValidacion(`El envío ${id_envio} no pertenece al cliente ${id_cliente}.`, 409);
  }
  if (envio.estado === 'CANCELADO') {
    throw errorValidacion(`El envío ${id_envio} está CANCELADO y no puede facturarse.`, 409);
  }
  if (marcar_entregado && envio.estado !== 'ENTREGADO') {
    await client.query(`
      UPDATE envios
      SET estado = 'ENTREGADO',
          fecha_entrega = COALESCE(fecha_entrega, CURRENT_TIMESTAMP)
      WHERE id_envio = $1;
    `, [id_envio]);
  }
  return envio;
}

export class FacturaRepository {
  /**
   * Emite factura a un CLIENTE (Facturación de venta emitida por el sistema)
   */
  static async emitirFactura({
    id_cliente,
    importe_total,
    concepto = 'Servicio de logística internacional',
    id_envio = null,
    numero_comprobante = null,
    marcar_entregado = false
  }) {
    const idCliente = enteroPositivo(id_cliente, 'id_cliente');
    const importe = montoPositivo(importe_total, 'importe_total');
    const conceptoFinal = textoOpcional(concepto, 'concepto', { max: 255 })
      || 'Servicio de logística internacional';
    const envioFinal = textoOpcional(id_envio, 'id_envio', { max: 50 });
    const comprobante = textoOpcional(numero_comprobante, 'numero_comprobante', { max: 50 });

    await ActorRepository.resolverActor(idCliente, 'CLIENTE');

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      await verificarEnvio(client, envioFinal, { id_cliente: idCliente, marcar_entregado });

      const nroComp = comprobante || `FC-CLI-${Date.now()}-${randomUUID().slice(0, 8)}`;
      await verificarComprobanteUnico(client, {
        tipo_actor: 'CLIENTE',
        tipo_factura: 'EMITIDA',
        numero_comprobante: nroComp
      });

      const resFactura = await client.query(`
        INSERT INTO facturas (id_cliente, tipo_factura, tipo_actor, numero_comprobante, concepto, id_envio, importe_total, estado)
        VALUES ($1, 'EMITIDA', 'CLIENTE', $2, $3, $4, $5, 'PENDIENTE')
        RETURNING *;
      `, [idCliente, nroComp, conceptoFinal, envioFinal, importe]);

      const factura = resFactura.rows[0];

      // Factura emitida: el cliente contrae una deuda (saldo más negativo).
      const saldo = await CuentaCorrienteRepository.aplicarMovimiento(client, {
        id_actor: idCliente,
        tipo_actor: 'CLIENTE',
        delta: -importe
      });

      await client.query('COMMIT');
      return { ...factura, saldo_cuenta_corriente: saldo };
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23505') {
        throw errorValidacion('Ya existe una factura con el mismo comprobante para ese actor.', 409);
      }
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Registra una FACTURA RECIBIDA ya confeccionada por un PROVEEDOR u OPERADOR LOGÍSTICO
   * (El sistema NO las genera, sino que recibe las facturas externas ya hechas por ellos)
   */
  static async registrarFacturaRecibida({
    id_actor,
    tipo_actor,
    importe_total,
    numero_comprobante,
    concepto = 'Factura de servicios/insumos recibida',
    id_envio = null
  }) {
    const tipo = unoDe(tipo_actor, TIPOS_ACTOR_FINANCIERO, 'tipo_actor');
    if (tipo !== 'PROVEEDOR' && tipo !== 'OPERADOR') {
      throw errorValidacion(
        `Solo se registran facturas recibidas de PROVEEDORES y OPERADORES (recibido: ${tipo}).`
      );
    }

    const idActor = enteroPositivo(id_actor, 'id_actor');
    const importe = montoPositivo(importe_total, 'importe_total');
    const comprobante = textoRequerido(numero_comprobante, 'numero_comprobante', { max: 50 });
    const conceptoFinal = textoOpcional(concepto, 'concepto', { max: 255 })
      || 'Factura de servicios/insumos recibida';
    const envioFinal = textoOpcional(id_envio, 'id_envio', { max: 50 });

    const actor = await ActorRepository.resolverActor(idActor, tipo);

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      await verificarEnvio(client, envioFinal);
      await verificarComprobanteUnico(client, {
        tipo_actor: tipo,
        tipo_factura: 'RECIBIDA',
        numero_comprobante: comprobante
      });

      const resFactura = await client.query(`
        INSERT INTO facturas (id_cliente, tipo_factura, tipo_actor, numero_comprobante, concepto, id_envio, importe_total, estado)
        VALUES ($1, 'RECIBIDA', $2, $3, $4, $5, $6, 'PENDIENTE')
        RETURNING *;
      `, [actor.id_actor, tipo, comprobante, conceptoFinal, envioFinal, importe]);

      const factura = resFactura.rows[0];

      // Factura recibida: se reconoce la deuda con el proveedor/operador.
      const saldo = await CuentaCorrienteRepository.aplicarMovimiento(client, {
        id_actor: actor.id_actor,
        tipo_actor: tipo,
        delta: importe
      });

      await client.query('COMMIT');
      return { ...factura, saldo_cuenta_corriente: saldo };
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23505') {
        throw errorValidacion('Ya existe una factura recibida con ese comprobante para el actor.', 409);
      }
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Facturación automática de un envío (calcula tarifa base + tramos + prioridad)
   */
  static async facturacionAutomaticaPorEnvio(id_envio) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });

    const resEnvio = await pgPool.query(`
      SELECT e.*, c.razon_social
      FROM envios e
      JOIN clientes c ON e.id_cliente = c.id_cliente
      WHERE e.id_envio = $1;
    `, [id]);

    if (resEnvio.rows.length === 0) {
      throw errorValidacion(`Envío ${id} no encontrado.`, 404);
    }

    const envio = resEnvio.rows[0];
    if (envio.estado === 'CANCELADO') {
      throw errorValidacion(`El envío ${id} está CANCELADO y no puede facturarse.`, 409);
    }

    // Verificar si ya fue facturado
    const resFacturada = await pgPool.query(`
      SELECT * FROM facturas
      WHERE id_envio = $1 AND tipo_factura = 'EMITIDA';
    `, [id]);

    if (resFacturada.rows.length > 0) {
      return {
        ya_facturado: true,
        factura: resFacturada.rows[0],
        mensaje: `El envío ${id} ya fue facturado previamente (Factura N° ${resFacturada.rows[0].id_factura}).`
      };
    }

    // Contar tramos para cálculo (un envío sin tramos no inventa uno).
    const resTramos = await pgPool.query(
      'SELECT COUNT(*) AS total_tramos FROM tramos WHERE id_envio = $1;',
      [id]
    );
    const cantTramos = parseInt(resTramos.rows[0].total_tramos, 10) || 0;

    // Regla de cálculo comercial:
    // Tarifa base: $50,000 + $15,000 por tramo
    const baseTarifa = 50000;
    const costoTramos = cantTramos * 15000;
    let factorPrioridad = 1.0;
    if (envio.prioridad === 'ALTA') factorPrioridad = 1.25;
    if (envio.prioridad === 'URGENTE') factorPrioridad = 1.5;

    const importeTotal = Math.round((baseTarifa + costoTramos) * factorPrioridad * 100) / 100;
    const concepto = `Facturación automática de servicio logístico [${envio.id_envio}] (${envio.origen} -> ${envio.destino}) con ${cantTramos} tramo(s) - Prioridad ${envio.prioridad}`;

    // El comprobante AUTO-<envio> es el candado de idempotencia: la restricción
    // única impide que dos ejecuciones simultáneas facturen el mismo envío.
    const factura = await FacturaRepository.emitirFactura({
      id_cliente: envio.id_cliente,
      importe_total: importeTotal,
      concepto,
      id_envio: envio.id_envio,
      numero_comprobante: `AUTO-${envio.id_envio}`,
      marcar_entregado: true
    });

    // Registrar evento de auditoría en MongoDB
    try {
      await MongoTelemetryRepository.registrarEventoLogistico({
        id_evento: `EVT-FAC-${factura.id_factura}`,
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
   * Ejecución por lote de Facturación Automática.
   * Solo toma envíos efectivamente entregados y sin factura emitida.
   */
  static async ejecutarFacturacionAutomaticaMasiva() {
    const res = await pgPool.query(`
      SELECT e.id_envio
      FROM envios e
      WHERE e.estado = 'ENTREGADO'
        AND NOT EXISTS (
          SELECT 1 FROM facturas f
          WHERE f.id_envio = e.id_envio AND f.tipo_factura = 'EMITIDA'
        )
      ORDER BY e.id_envio ASC;
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
