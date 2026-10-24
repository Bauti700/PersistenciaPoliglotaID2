import { pgPool } from '../config/database.js';
import { MongoTelemetryRepository } from './mongoRepository.js';

const ESTADOS_CONTENEDOR = new Set(['DISPONIBLE', 'EN_TRANSITO', 'FUERA_SERVICIO']);

function errorContenedor(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validarContenedor(data, parcial = false) {
  const campos = parcial
    ? ['codigo_internacional', 'tipo', 'capacidad', 'estado']
    : ['id_contenedor', 'codigo_internacional', 'tipo', 'capacidad', 'estado'];
  const valores = { ...data };

  if (Object.keys(valores).some(campo => !campos.includes(campo))) {
    throw errorContenedor('La solicitud contiene campos no permitidos.');
  }

  for (const campo of campos) {
    if (valores[campo] === undefined) continue;
    if (['id_contenedor', 'codigo_internacional', 'tipo', 'estado'].includes(campo)) {
      if (typeof valores[campo] !== 'string') {
        throw errorContenedor(`El campo ${campo} debe ser texto.`);
      }
      valores[campo] = valores[campo].trim();
    }
  }

  const requeridos = parcial ? Object.keys(valores) : ['id_contenedor', 'codigo_internacional', 'tipo', 'capacidad'];
  for (const campo of requeridos) {
    if (valores[campo] === undefined || valores[campo] === null || valores[campo] === '') {
      throw errorContenedor(`El campo ${campo} es obligatorio.`);
    }
  }

  const longitudes = { id_contenedor: 50, codigo_internacional: 100, tipo: 50 };
  for (const [campo, maximo] of Object.entries(longitudes)) {
    if (valores[campo] !== undefined && valores[campo].length > maximo) {
      throw errorContenedor(`El campo ${campo} no puede superar los ${maximo} caracteres.`);
    }
  }

  if (valores.capacidad !== undefined) {
    valores.capacidad = Number(valores.capacidad);
    if (!Number.isFinite(valores.capacidad) || valores.capacidad <= 0 || valores.capacidad > 99999999.99) {
      throw errorContenedor('La capacidad debe ser mayor a cero y no superar 99.999.999,99 kg.');
    }
  }

  if (valores.estado !== undefined && !ESTADOS_CONTENEDOR.has(valores.estado)) {
    throw errorContenedor(`Estado inválido. Valores permitidos: ${[...ESTADOS_CONTENEDOR].join(', ')}.`);
  }

  return valores;
}

export class ContenedorRepository {
  static async listarTodos() {
    const res = await pgPool.query(`
      SELECT * FROM contenedores
      ORDER BY id_contenedor ASC;
    `);
    return res.rows;
  }

  static async obtenerPorId(id) {
    const res = await pgPool.query(
      'SELECT * FROM contenedores WHERE id_contenedor = $1;',
      [id]
    );
    return res.rows[0] || null;
  }

  static async crear(data) {
    const contenedor = validarContenedor(data);
    const res = await pgPool.query(`
      INSERT INTO contenedores (id_contenedor, codigo_internacional, tipo, capacidad, estado)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [
      contenedor.id_contenedor,
      contenedor.codigo_internacional,
      contenedor.tipo,
      contenedor.capacidad,
      contenedor.estado || 'DISPONIBLE'
    ]);
    return res.rows[0];
  }

  static async actualizar(id, data) {
    const contenedor = validarContenedor(data, true);
    delete contenedor.id_contenedor;
    const entries = Object.entries(contenedor);
    if (entries.length === 0) {
      throw errorContenedor('Debe indicar al menos un campo para actualizar.');
    }

    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([field], index) => `${field} = $${index + 2}`);
    const statusGuard = contenedor.estado === 'FUERA_SERVICIO' ? "AND estado <> 'EN_TRANSITO'" : '';
    const res = await pgPool.query(`
      UPDATE contenedores
      SET ${assignments.join(', ')}
      WHERE id_contenedor = $1 ${statusGuard}
      RETURNING *;
    `, [id, ...values]);

    if (res.rows[0]) return res.rows[0];
    const existente = await this.obtenerPorId(id);
    if (existente?.estado === 'EN_TRANSITO' && contenedor.estado === 'FUERA_SERVICIO') {
      throw errorContenedor('No se puede dar de baja un contenedor que está en tránsito.', 409);
    }
    return null;
  }

  static async darDeBaja(id) {
    const res = await pgPool.query(`
      UPDATE contenedores
      SET estado = 'FUERA_SERVICIO'
      WHERE id_contenedor = $1 AND estado <> 'EN_TRANSITO'
      RETURNING *;
    `, [id]);
    if (res.rows[0]) return res.rows[0];

    const existente = await this.obtenerPorId(id);
    if (!existente) return null;
    if (existente.estado === 'EN_TRANSITO') {
      throw errorContenedor('No se puede dar de baja un contenedor que está en tránsito.', 409);
    }
    return existente;
  }
}

export class ActorRepository {
  static async crear({ tipo_actor = 'CLIENTE', razon_social, cuit, email, telefono, direccion, pais }) {
    const tiposPermitidos = ['CLIENTE', 'PROVEEDOR', 'OPERADOR'];
    const tipo = tipo_actor.toUpperCase();
    if (!tiposPermitidos.includes(tipo)) {
      throw new Error(`Tipo de actor inválido. Valores permitidos: ${tiposPermitidos.join(', ')}`);
    }

    const query = `
      INSERT INTO actores (tipo_actor, razon_social, cuit, email, telefono, direccion, pais)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const res = await pgPool.query(query, [tipo, razon_social, cuit, email, telefono, direccion, pais]);
    // Inicializar cuenta corriente en 0.00
    await pgPool.query(`INSERT INTO cuentas_corrientes (id_actor, saldo) VALUES ($1, 0.00) ON CONFLICT DO NOTHING;`, [res.rows[0].id_actor]);
    return res.rows[0];
  }

  static async listarTodos(tipo_actor = null) {
    const params = [];
    let filter = '';
    if (tipo_actor) {
      params.push(tipo_actor.toUpperCase());
      filter = 'WHERE a.tipo_actor = $1';
    }
    const query = `
      SELECT a.*, COALESCE(c.saldo, 0.00) as saldo, c.fecha_actualizacion as cc_actualizacion
      FROM actores a
      LEFT JOIN cuentas_corrientes c ON a.id_actor = c.id_actor
      ${filter}
      ORDER BY a.tipo_actor, a.id_actor ASC;
    `;
    const res = await pgPool.query(query, params);
    return res.rows;
  }

  static async obtenerPorId(id) {
    const query = `
      SELECT a.*, COALESCE(c.saldo, 0.00) as saldo, c.fecha_actualizacion as cc_actualizacion
      FROM actores a
      LEFT JOIN cuentas_corrientes c ON a.id_actor = c.id_actor
      WHERE a.id_actor = $1;
    `;
    const res = await pgPool.query(query, [id]);
    return res.rows[0] || null;
  }

  static async actualizar(id, { razon_social, email, telefono, direccion, pais, estado }) {
    const query = `
      UPDATE actores
      SET razon_social = COALESCE($2, razon_social),
          email = COALESCE($3, email),
          telefono = COALESCE($4, telefono),
          direccion = COALESCE($5, direccion),
          pais = COALESCE($6, pais),
          estado = COALESCE($7, estado)
      WHERE id_actor = $1
      RETURNING *;
    `;
    const res = await pgPool.query(query, [id, razon_social, email, telefono, direccion, pais, estado]);
    return res.rows[0];
  }

  static async eliminar(id) {
    const res = await pgPool.query(`DELETE FROM actores WHERE id_actor = $1 RETURNING *;`, [id]);
    return res.rows[0];
  }
}

export class ClienteRepository {
  static async crear(data) {
    return ActorRepository.crear({ ...data, tipo_actor: 'CLIENTE' });
  }

  static async listarTodos() {
    return ActorRepository.listarTodos('CLIENTE');
  }

  static async obtenerPorId(id) {
    return ActorRepository.obtenerPorId(id);
  }

  static async actualizar(id, data) {
    return ActorRepository.actualizar(id, data);
  }

  static async eliminar(id) {
    return ActorRepository.eliminar(id);
  }
}

export class ComercialRepository {
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
   * Registra un pago (cobro a cliente o pago a proveedor/operador)
   */
  static async registrarPago({ id_factura, monto, medio_pago, referencia_comprobante = null }) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const resFac = await client.query(`
        SELECT f.*, a.tipo_actor, a.razon_social 
        FROM facturas f 
        JOIN actores a ON f.id_cliente = a.id_actor 
        WHERE f.id_factura = $1;
      `, [id_factura]);

      if (resFac.rows.length === 0) throw new Error(`Factura con ID ${id_factura} no encontrada.`);

      const factura = resFac.rows[0];
      const montoNum = Number(monto);
      if (montoNum <= 0) throw new Error('El monto del pago debe ser mayor a cero.');

      let tipo_pago = 'COBRO_CLIENTE';
      if (factura.tipo_factura === 'RECIBIDA') {
        tipo_pago = factura.tipo_actor === 'PROVEEDOR' ? 'PAGO_PROVEEDOR' : 'PAGO_OPERADOR';
      }

      const resPago = await client.query(`
        INSERT INTO pagos (id_factura, tipo_pago, monto, medio_pago, referencia_comprobante)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `, [id_factura, tipo_pago, montoNum, medio_pago, referencia_comprobante || `REF-${Date.now().toString().slice(-6)}`]);

      // Verificar total acumulado de pagos para esta factura
      const sumRes = await client.query(`SELECT COALESCE(SUM(monto), 0) AS total_pagado FROM pagos WHERE id_factura = $1;`, [id_factura]);
      const totalPagado = Number(sumRes.rows[0].total_pagado);

      let estadoActualizado = factura.estado;
      if (totalPagado >= Number(factura.importe_total)) {
        await client.query(`UPDATE facturas SET estado = 'PAGADA' WHERE id_factura = $1;`, [id_factura]);
        estadoActualizado = 'PAGADA';
      }

      // Actualizar cuenta corriente según tipo de actor y factura:
      // - Si es factura emitida a cliente: el cobro cancela la deuda (+ monto en CC)
      // - Si es factura recibida de proveedor/operador: el pago disminuye la deuda con el tercero (- monto en CC)
      if (factura.tipo_factura === 'EMITIDA') {
        await client.query(`
          UPDATE cuentas_corrientes
          SET saldo = saldo + $1, fecha_actualizacion = CURRENT_TIMESTAMP
          WHERE id_actor = $2;
        `, [montoNum, factura.id_cliente]);
      } else {
        await client.query(`
          UPDATE cuentas_corrientes
          SET saldo = saldo - $1, fecha_actualizacion = CURRENT_TIMESTAMP
          WHERE id_actor = $2;
        `, [montoNum, factura.id_cliente]);
      }

      await client.query('COMMIT');
      return {
        pago: resPago.rows[0],
        factura_id: factura.id_factura,
        estado_factura: estadoActualizado,
        actor: factura.razon_social,
        tipo_actor: factura.tipo_actor,
        total_pagado: totalPagado
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene el estado de cuenta corriente completo de un actor (Cliente, Proveedor u Operador)
   */
  static async obtenerEstadoCuenta(id_actor) {
    const actor = await ActorRepository.obtenerPorId(id_actor);
    if (!actor) throw new Error(`Actor con ID ${id_actor} no encontrado.`);

    const cc = await pgPool.query(`SELECT * FROM cuentas_corrientes WHERE id_actor = $1;`, [id_actor]);
    const facturas = await pgPool.query(`
      SELECT f.*, 
             COALESCE((SELECT SUM(monto) FROM pagos p WHERE p.id_factura = f.id_factura), 0) AS total_pagado
      FROM facturas f 
      WHERE f.id_cliente = $1 
      ORDER BY f.id_factura DESC;
    `, [id_actor]);

    const pagos = await pgPool.query(`
      SELECT p.*, f.numero_comprobante, f.tipo_factura 
      FROM pagos p 
      JOIN facturas f ON p.id_factura = f.id_factura 
      WHERE f.id_cliente = $1 
      ORDER BY p.fecha DESC;
    `, [id_actor]);

    return {
      actor,
      cuenta_corriente: cc.rows[0] || { saldo: 0.00 },
      facturas: facturas.rows,
      pagos: pagos.rows
    };
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

    const factura = await this.emitirFactura({
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
        const facRes = await this.facturacionAutomaticaPorEnvio(row.id_envio);
        resultados.push({ id_envio: row.id_envio, exito: true, factura: facRes.factura });
      } catch (err) {
        resultados.push({ id_envio: row.id_envio, exito: false, error: err.message });
      }
    }
    return resultados;
  }

  /**
   * Cierre mensual de Cuentas Corrientes
   */
  static async ejecutarCierreMensual({ periodo, id_actor = null }) {
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      throw new Error("El período debe tener formato 'YYYY-MM' (ej: '2026-10').");
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const params = [];
      let whereActor = '';
      if (id_actor) {
        params.push(id_actor);
        whereActor = 'WHERE a.id_actor = $1';
      }

      const resActores = await client.query(`
        SELECT a.id_actor, a.razon_social, a.tipo_actor, COALESCE(cc.saldo, 0.00) as saldo_actual
        FROM actores a
        LEFT JOIN cuentas_corrientes cc ON a.id_actor = cc.id_actor
        ${whereActor}
        ORDER BY a.id_actor ASC;
      `, params);

      const resumenCierres = [];

      for (const act of resActores.rows) {
        // Débitos y Créditos del mes
        const resFacs = await client.query(`
          SELECT 
            COALESCE(SUM(CASE WHEN tipo_factura = 'EMITIDA' THEN importe_total ELSE 0 END), 0) AS total_emitidas,
            COALESCE(SUM(CASE WHEN tipo_factura = 'RECIBIDA' THEN importe_total ELSE 0 END), 0) AS total_recibidas
          FROM facturas
          WHERE id_cliente = $1 AND TO_CHAR(fecha_emision, 'YYYY-MM') = $2;
        `, [act.id_actor, periodo]);

        const resPagos = await client.query(`
          SELECT 
            COALESCE(SUM(CASE WHEN p.tipo_pago = 'COBRO_CLIENTE' THEN p.monto ELSE 0 END), 0) AS total_cobros,
            COALESCE(SUM(CASE WHEN p.tipo_pago IN ('PAGO_PROVEEDOR', 'PAGO_OPERADOR') THEN p.monto ELSE 0 END), 0) AS total_pagos_realizados
          FROM pagos p
          JOIN facturas f ON p.id_factura = f.id_factura
          WHERE f.id_cliente = $1 AND TO_CHAR(p.fecha, 'YYYY-MM') = $2;
        `, [act.id_actor, periodo]);

        const totalFacturadoMes = Number(resFacs.rows[0].total_emitidas) + Number(resFacs.rows[0].total_recibidas);
        const totalPagadoMes = Number(resPagos.rows[0].total_cobros) + Number(resPagos.rows[0].total_pagos_realizados);
        const saldoCierre = Number(act.saldo_actual);
        const saldoInicialAprox = saldoCierre + (act.tipo_actor === 'CLIENTE' ? (totalFacturadoMes - totalPagadoMes) : (totalPagadoMes - totalFacturadoMes));

        await client.query(`
          INSERT INTO cierres_cuentas_corrientes (periodo, id_actor, saldo_inicial, total_debe, total_haber, saldo_final, fecha_cierre, estado)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 'CERRADO')
          ON CONFLICT (periodo, id_actor) DO UPDATE
          SET saldo_inicial = EXCLUDED.saldo_inicial,
              total_debe = EXCLUDED.total_debe,
              total_haber = EXCLUDED.total_haber,
              saldo_final = EXCLUDED.saldo_final,
              fecha_cierre = CURRENT_TIMESTAMP,
              estado = 'CERRADO';
        `, [periodo, act.id_actor, saldoInicialAprox, totalFacturadoMes, totalPagadoMes, saldoCierre]);

        resumenCierres.push({
          id_actor: act.id_actor,
          razon_social: act.razon_social,
          tipo_actor: act.tipo_actor,
          saldo_inicial: Math.round(saldoInicialAprox * 100) / 100,
          total_facturado: Math.round(totalFacturadoMes * 100) / 100,
          total_pagado: Math.round(totalPagadoMes * 100) / 100,
          saldo_final: Math.round(saldoCierre * 100) / 100
        });
      }

      await client.query('COMMIT');

      // Auditar en MongoDB (Colección Documental de Reportes)
      try {
        await MongoTelemetryRepository.registrarReporte({
          id_reporte: `CIERRE-CC-${periodo}`,
          tipo: 'CIERRE_MENSUAL_CUENTAS_CORRIENTES',
          categoria: 'CONTABLE',
          parametros: { periodo, id_actor },
          resumen: {
            total_actores_procesados: resumenCierres.length,
            fecha_cierre: new Date().toISOString(),
            actores: resumenCierres
          }
        });
      } catch (errMongo) {
        console.warn(`[Sync Mongo Report Warning]: ${errMongo.message}`);
      }

      return {
        periodo,
        total_procesados: resumenCierres.length,
        cierres: resumenCierres
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Consulta cierres mensuales históricos
   */
  static async consultarCierresMensuales(periodo = null) {
    const params = [];
    let whereClause = '';
    if (periodo) {
      params.push(periodo);
      whereClause = 'WHERE c.periodo = $1';
    }
    const query = `
      SELECT c.*, a.razon_social, a.tipo_actor, a.cuit, a.pais
      FROM cierres_cuentas_corrientes c
      JOIN actores a ON c.id_actor = a.id_actor
      ${whereClause}
      ORDER BY c.periodo DESC, a.tipo_actor, a.razon_social;
    `;
    const res = await pgPool.query(query, params);
    return res.rows;
  }

  /**
   * Reporte Comercial Parametrizado:
   * Permite filtrar facturas por fecha, tipo de actor, estado, tipo de factura y actor específico.
   * Genera métricas agregadas y persiste el informe en MongoDB.
   */
  static async reporteComercialParametrizado({
    fecha_desde = null,
    fecha_hasta = null,
    tipo_actor = null,
    estado_factura = null,
    tipo_factura = null,
    id_actor = null
  } = {}) {
    const conditions = [];
    const params = [];

    if (fecha_desde) {
      params.push(fecha_desde);
      conditions.push(`f.fecha_emision >= $${params.length}`);
    }
    if (fecha_hasta) {
      params.push(fecha_hasta);
      conditions.push(`f.fecha_emision <= $${params.length}::TIMESTAMP + INTERVAL '1 day'`);
    }
    if (tipo_actor && tipo_actor !== 'TODOS') {
      params.push(tipo_actor.toUpperCase());
      conditions.push(`a.tipo_actor = $${params.length}`);
    }
    if (estado_factura && estado_factura !== 'TODAS') {
      params.push(estado_factura.toUpperCase());
      conditions.push(`f.estado = $${params.length}`);
    }
    if (tipo_factura && tipo_factura !== 'TODAS') {
      params.push(tipo_factura.toUpperCase());
      conditions.push(`f.tipo_factura = $${params.length}`);
    }
    if (id_actor) {
      params.push(id_actor);
      conditions.push(`f.id_cliente = $${params.length}`);
    }

    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT f.id_factura, f.tipo_factura, f.numero_comprobante, f.concepto, f.id_envio,
             f.importe_total, f.estado, f.fecha_emision,
             a.id_actor, a.razon_social, a.tipo_actor, a.cuit, a.pais,
             COALESCE((SELECT SUM(monto) FROM pagos p WHERE p.id_factura = f.id_factura), 0) AS total_pagado
      FROM facturas f
      JOIN actores a ON f.id_cliente = a.id_actor
      ${whereSQL}
      ORDER BY f.fecha_emision DESC, f.id_factura DESC;
    `;

    const res = await pgPool.query(query, params);
    const facturas = res.rows;

    // Métricas del reporte
    const totalFacturado = facturas.reduce((acc, f) => acc + Number(f.importe_total), 0);
    const totalPagado = facturas.reduce((acc, f) => acc + Number(f.total_pagado), 0);
    const totalPendiente = totalFacturado - totalPagado;
    const totalFacturas = facturas.length;
    const facturasPagadas = facturas.filter(f => f.estado === 'PAGADA').length;
    const facturasPendientes = facturas.filter(f => f.estado === 'PENDIENTE').length;

    const metricas = {
      total_facturas: totalFacturas,
      facturas_pagadas: facturasPagadas,
      facturas_pendientes: facturasPendientes,
      importe_total_facturado: Math.round(totalFacturado * 100) / 100,
      importe_total_pagado: Math.round(totalPagado * 100) / 100,
      saldo_pendiente_total: Math.round(totalPendiente * 100) / 100
    };

    // Guardar en MongoDB
    let reporteDoc = null;
    try {
      reporteDoc = await MongoTelemetryRepository.registrarReporte({
        tipo: 'REPORTE_COMERCIAL_PARAMETRIZADO',
        categoria: 'FACTURACION_Y_COBROS',
        parametros: { fecha_desde, fecha_hasta, tipo_actor, estado_factura, tipo_factura, id_actor },
        resumen: metricas
      });
    } catch (eMongo) {
      console.warn(`[Sync Mongo Warning en Reporte]: ${eMongo.message}`);
    }

    return {
      parametros: { fecha_desde, fecha_hasta, tipo_actor, estado_factura, tipo_factura, id_actor },
      metricas,
      facturas,
      id_reporte_mongo: reporteDoc?.id_reporte || null
    };
  }

  /**
   * Ranking de clientes por volumen transportado y facturado
   */
  static async rankingClientesPorVolumen() {
    const query = `
      SELECT a.id_actor, a.razon_social, a.pais,
             COUNT(DISTINCT e.id_envio) AS total_envios,
             COALESCE(SUM(f.importe_total), 0.00) AS volumen_facturado
      FROM actores a
      LEFT JOIN envios e ON a.id_actor = e.id_cliente
      LEFT JOIN facturas f ON a.id_actor = f.id_cliente AND f.tipo_factura = 'EMITIDA'
      WHERE a.tipo_actor = 'CLIENTE'
      GROUP BY a.id_actor, a.razon_social, a.pais
      ORDER BY total_envios DESC, volumen_facturado DESC;
    `;
    const res = await pgPool.query(query);
    return res.rows;
  }
}

