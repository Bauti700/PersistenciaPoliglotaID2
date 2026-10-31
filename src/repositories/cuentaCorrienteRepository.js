import { pgPool } from '../config/database.js';
import { ActorRepository } from './actorRepository.js';

export class CuentaCorrienteRepository {
  /**
   * Obtiene el estado de cuenta corriente completo de un actor (Cliente, Proveedor u Operador)
   */
  static async obtenerEstadoCuenta(id_actor, tipo_actor = null) {
    const actor = await ActorRepository.resolverActor(id_actor, tipo_actor);

    const cc = await pgPool.query(
      `SELECT * FROM cuentas_corrientes WHERE id_actor = $1 AND tipo_actor = $2;`,
      [actor.id_actor, actor.tipo_actor]
    );
    const facturas = await pgPool.query(`
      SELECT f.*, 
             COALESCE((SELECT SUM(monto) FROM pagos p WHERE p.id_factura = f.id_factura), 0) AS total_pagado
      FROM facturas f 
      WHERE f.id_cliente = $1 AND f.tipo_actor = $2
      ORDER BY f.id_factura DESC;
    `, [actor.id_actor, actor.tipo_actor]);

    const pagos = await pgPool.query(`
      SELECT p.*, f.numero_comprobante, f.tipo_factura 
      FROM pagos p 
      JOIN facturas f ON p.id_factura = f.id_factura 
      WHERE f.id_cliente = $1 AND f.tipo_actor = $2
      ORDER BY p.fecha DESC;
    `, [actor.id_actor, actor.tipo_actor]);

    return {
      actor,
      cuenta_corriente: cc.rows[0] || { saldo: 0.00 },
      facturas: facturas.rows,
      pagos: pagos.rows
    };
  }

  /**
   * Cierre mensual de Cuentas Corrientes
   */
  static async ejecutarCierreMensual({ periodo, id_actor = null, tipo_actor = null }) {
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
      throw new Error("El período debe tener formato 'YYYY-MM' (ej: '2026-10').");
    }

    // Se resuelve antes de abrir la transacción: si el ID es ambiguo, se corta acá.
    const actorFiltro = id_actor ? await ActorRepository.resolverActor(id_actor, tipo_actor) : null;

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const params = [];
      let whereActor = '';
      if (actorFiltro) {
        params.push(actorFiltro.id_actor, actorFiltro.tipo_actor);
        whereActor = 'WHERE a.id_actor = $1 AND a.tipo_actor = $2';
      }

      const resActores = await client.query(`
        SELECT a.id_actor, a.razon_social, a.tipo_actor, COALESCE(cc.saldo, 0.00) as saldo_actual
        FROM (
          SELECT id_cliente AS id_actor, razon_social, 'CLIENTE' AS tipo_actor FROM clientes
          UNION ALL
          SELECT id_proveedor AS id_actor, razon_social, 'PROVEEDOR' AS tipo_actor FROM proveedores
          UNION ALL
          SELECT id_operador AS id_actor, razon_social, 'OPERADOR' AS tipo_actor FROM operadores
        ) a
        LEFT JOIN cuentas_corrientes cc ON a.id_actor = cc.id_actor AND a.tipo_actor = cc.tipo_actor
        ${whereActor}
        ORDER BY a.tipo_actor, a.id_actor ASC;
      `, params);

      const resumenCierres = [];

      for (const act of resActores.rows) {
        // Débitos y Créditos del mes
        const resFacs = await client.query(`
          SELECT 
            COALESCE(SUM(CASE WHEN tipo_factura = 'EMITIDA' THEN importe_total ELSE 0 END), 0) AS total_emitidas,
            COALESCE(SUM(CASE WHEN tipo_factura = 'RECIBIDA' THEN importe_total ELSE 0 END), 0) AS total_recibidas
          FROM facturas
          WHERE id_cliente = $1 AND tipo_actor = $2 AND TO_CHAR(fecha_emision, 'YYYY-MM') = $3;
        `, [act.id_actor, act.tipo_actor, periodo]);

        const resPagos = await client.query(`
          SELECT 
            COALESCE(SUM(CASE WHEN p.tipo_pago = 'COBRO_CLIENTE' THEN p.monto ELSE 0 END), 0) AS total_cobros,
            COALESCE(SUM(CASE WHEN p.tipo_pago IN ('PAGO_PROVEEDOR', 'PAGO_OPERADOR') THEN p.monto ELSE 0 END), 0) AS total_pagos_realizados
          FROM pagos p
          JOIN facturas f ON p.id_factura = f.id_factura
          WHERE f.id_cliente = $1 AND f.tipo_actor = $2 AND TO_CHAR(p.fecha, 'YYYY-MM') = $3;
        `, [act.id_actor, act.tipo_actor, periodo]);

        const totalFacturadoMes = Number(resFacs.rows[0].total_emitidas) + Number(resFacs.rows[0].total_recibidas);
        const totalPagadoMes = Number(resPagos.rows[0].total_cobros) + Number(resPagos.rows[0].total_pagos_realizados);
        const saldoCierre = Number(act.saldo_actual);
        const saldoInicialAprox = saldoCierre + (act.tipo_actor === 'CLIENTE' ? (totalFacturadoMes - totalPagadoMes) : (totalPagadoMes - totalFacturadoMes));

        await client.query(`
          INSERT INTO cierres_cuentas_corrientes (periodo, id_actor, tipo_actor, saldo_inicial, total_debe, total_haber, saldo_final, fecha_cierre, estado)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, 'CERRADO')
          ON CONFLICT (periodo, tipo_actor, id_actor) DO UPDATE
          SET saldo_inicial = EXCLUDED.saldo_inicial,
              total_debe = EXCLUDED.total_debe,
              total_haber = EXCLUDED.total_haber,
              saldo_final = EXCLUDED.saldo_final,
              fecha_cierre = CURRENT_TIMESTAMP,
              estado = 'CERRADO';
        `, [periodo, act.id_actor, act.tipo_actor, saldoInicialAprox, totalFacturadoMes, totalPagadoMes, saldoCierre]);

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
        const { MongoTelemetryRepository } = await import('./telemetriaRepository.js');
        await MongoTelemetryRepository.registrarReporte({
          id_reporte: `CIERRE-CC-${periodo}`,
          tipo: 'CIERRE_MENSUAL_CUENTAS_CORRIENTES',
          categoria: 'CONTABLE',
          parametros: { periodo, id_actor: actorFiltro ? actorFiltro.id_actor : null, tipo_actor: actorFiltro ? actorFiltro.tipo_actor : null },
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
      JOIN (
        SELECT id_cliente AS id_actor, razon_social, 'CLIENTE' AS tipo_actor, cuit, pais FROM clientes
        UNION ALL
        SELECT id_proveedor AS id_actor, razon_social, 'PROVEEDOR' AS tipo_actor, cuit, pais FROM proveedores
        UNION ALL
        SELECT id_operador AS id_actor, razon_social, 'OPERADOR' AS tipo_actor, cuit, pais FROM operadores
      ) a ON c.id_actor = a.id_actor AND c.tipo_actor = a.tipo_actor
      ${whereClause}
      ORDER BY c.periodo DESC, a.tipo_actor, a.razon_social;
    `;
    const res = await pgPool.query(query, params);
    return res.rows;
  }
}

export { CuentaCorrienteRepository as cuentaCorrienteRepository };
