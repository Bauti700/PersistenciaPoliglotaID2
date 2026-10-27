import { pgPool } from '../config/database.js';
import { ActorRepository } from './actorRepository.js';

export class CuentaCorrienteRepository {
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
        const { MongoTelemetryRepository } = await import('./telemetriaRepository.js');
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
}

export { CuentaCorrienteRepository as cuentaCorrienteRepository };
