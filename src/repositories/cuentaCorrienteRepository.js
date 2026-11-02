import { pgPool } from '../config/database.js';
import { ActorRepository } from './actorRepository.js';
import { ReporteMongoRepository } from './reporteMongoRepository.js';
import {
  enteroPositivo,
  periodoMensual,
  errorValidacion
} from '../utils/validation.js';

const ACTORES_UNION = `
  SELECT id_cliente AS id_actor, razon_social, 'CLIENTE' AS tipo_actor, cuit, pais FROM clientes
  UNION ALL
  SELECT id_proveedor AS id_actor, razon_social, 'PROVEEDOR' AS tipo_actor, cuit, pais FROM proveedores
  UNION ALL
  SELECT id_operador AS id_actor, razon_social, 'OPERADOR' AS tipo_actor, cuit, pais FROM operadores
`;

function redondear(valor) {
  return Math.round(Number(valor) * 100) / 100;
}

function rangoPeriodo(periodo) {
  const [anio, mes] = periodo.split('-').map(Number);
  const inicio = `${periodo}-01`;
  const siguiente = mes === 12
    ? `${anio + 1}-01-01`
    : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  return { inicio, siguiente };
}

export class CuentaCorrienteRepository {
  /**
   * Aplica un movimiento (débito/crédito) a la cuenta corriente dentro de una
   * transacción abierta. Es un upsert: crea la cuenta si el actor no la tenía.
   */
  static async aplicarMovimiento(client, { id_actor, tipo_actor, delta }) {
    const res = await client.query(`
      INSERT INTO cuentas_corrientes (id_actor, tipo_actor, saldo)
      VALUES ($1, $2, $3)
      ON CONFLICT (tipo_actor, id_actor) DO UPDATE
      SET saldo = cuentas_corrientes.saldo + EXCLUDED.saldo,
          fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING saldo;
    `, [id_actor, tipo_actor, delta]);

    if (res.rowCount !== 1) {
      throw new Error(`No se pudo actualizar la cuenta corriente de ${tipo_actor} ${id_actor}.`);
    }
    return Number(res.rows[0].saldo);
  }

  static async asegurarCuentaCorriente(id_actor, tipo_actor) {
    await pgPool.query(`
      INSERT INTO cuentas_corrientes (id_actor, tipo_actor, saldo)
      VALUES ($1, $2, 0.00)
      ON CONFLICT (tipo_actor, id_actor) DO NOTHING;
    `, [id_actor, tipo_actor]);
  }

  /**
   * Obtiene el estado de cuenta corriente completo de un actor (Cliente, Proveedor u Operador)
   */
  static async obtenerEstadoCuenta(id_actor, tipo_actor = null) {
    const actor = await ActorRepository.resolverActor(id_actor, tipo_actor);

    await this.asegurarCuentaCorriente(actor.id_actor, actor.tipo_actor);

    const cc = await pgPool.query(
      `SELECT * FROM cuentas_corrientes WHERE id_actor = $1 AND tipo_actor = $2;`,
      [actor.id_actor, actor.tipo_actor]
    );
    if (cc.rows.length === 0) {
      throw errorValidacion(
        `No se pudo obtener la cuenta corriente de ${actor.tipo_actor} ${actor.id_actor}.`,
        500
      );
    }

    const facturas = await pgPool.query(`
      SELECT f.*,
             COALESCE((SELECT SUM(monto) FROM pagos p WHERE p.id_factura = f.id_factura), 0) AS total_pagado,
             f.importe_total - COALESCE((SELECT SUM(monto) FROM pagos p WHERE p.id_factura = f.id_factura), 0) AS saldo_pendiente
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
      cuenta_corriente: cc.rows[0],
      facturas: facturas.rows,
      pagos: pagos.rows
    };
  }

  /**
   * Cierre mensual de Cuentas Corrientes.
   *
   * El saldo final del período se reconstruye restando al saldo actual todos los
   * movimientos posteriores al cierre. Así el cálculo también es correcto para
   * períodos pasados, no solo para el mes en curso.
   */
  static async ejecutarCierreMensual({
    periodo,
    id_actor = null,
    tipo_actor = null,
    forzar = false,
    usuario = null
  }) {
    const per = periodoMensual(periodo);
    const periodoActual = new Date().toISOString().slice(0, 7);
    if (per > periodoActual) {
      throw errorValidacion(`No se puede cerrar el período futuro ${per}.`);
    }

    // Se resuelve antes de abrir la transacción: si el ID es ambiguo, se corta acá.
    const actorFiltro = id_actor ? await ActorRepository.resolverActor(id_actor, tipo_actor) : null;
    const { inicio, siguiente } = rangoPeriodo(per);

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // Completar cuentas faltantes y bloquear las existentes para que el cierre
      // no se cruce con una factura o un pago concurrente.
      await client.query(`
        INSERT INTO cuentas_corrientes (id_actor, tipo_actor, saldo)
        SELECT id_cliente, 'CLIENTE', 0.00 FROM clientes
        UNION ALL
        SELECT id_proveedor, 'PROVEEDOR', 0.00 FROM proveedores
        UNION ALL
        SELECT id_operador, 'OPERADOR', 0.00 FROM operadores
        ON CONFLICT (tipo_actor, id_actor) DO NOTHING;
      `);
      await client.query('SELECT id_cuenta FROM cuentas_corrientes FOR UPDATE;');

      const filtroCierre = actorFiltro
        ? 'WHERE periodo = $1 AND id_actor = $2 AND tipo_actor = $3'
        : 'WHERE periodo = $1';
      const paramsCierre = actorFiltro
        ? [per, actorFiltro.id_actor, actorFiltro.tipo_actor]
        : [per];

      const existente = await client.query(
        `SELECT 1 FROM cierres_cuentas_corrientes ${filtroCierre} LIMIT 1;`,
        paramsCierre
      );
      if (existente.rowCount > 0 && !forzar) {
        throw errorValidacion(
          `El período ${per} ya tiene cierres registrados. Confirme el recálculo para reemplazarlos.`,
          409
        );
      }

      const filtroPosterior = actorFiltro
        ? 'WHERE periodo > $1 AND id_actor = $2 AND tipo_actor = $3'
        : 'WHERE periodo > $1';
      const paramsPosterior = actorFiltro
        ? [per, actorFiltro.id_actor, actorFiltro.tipo_actor]
        : [per];
      const posterior = await client.query(
        `SELECT periodo FROM cierres_cuentas_corrientes ${filtroPosterior} ORDER BY periodo ASC LIMIT 1;`,
        paramsPosterior
      );
      if (posterior.rowCount > 0) {
        throw errorValidacion(
          `No se puede cerrar ${per}: existe un cierre posterior (${posterior.rows[0].periodo}). Cierre los períodos en orden cronológico.`,
          409
        );
      }

      const params = [];
      let whereActor = '';
      if (actorFiltro) {
        params.push(actorFiltro.id_actor, actorFiltro.tipo_actor);
        whereActor = 'WHERE a.id_actor = $1 AND a.tipo_actor = $2';
      }

      const resActores = await client.query(`
        SELECT a.id_actor, a.razon_social, a.tipo_actor, COALESCE(cc.saldo, 0.00) AS saldo_actual
        FROM (
          ${ACTORES_UNION}
        ) a
        LEFT JOIN cuentas_corrientes cc ON a.id_actor = cc.id_actor AND a.tipo_actor = cc.tipo_actor
        ${whereActor}
        ORDER BY a.tipo_actor, a.id_actor ASC;
      `, params);

      const resumenCierres = [];

      for (const act of resActores.rows) {
        const resFacs = await client.query(`
          SELECT
            COALESCE(SUM(CASE WHEN tipo_factura = 'EMITIDA' THEN importe_total ELSE 0 END), 0) AS total_emitidas,
            COALESCE(SUM(CASE WHEN tipo_factura = 'RECIBIDA' THEN importe_total ELSE 0 END), 0) AS total_recibidas
          FROM facturas
          WHERE id_cliente = $1 AND tipo_actor = $2
            AND fecha_emision >= $3::date AND fecha_emision < $4::date;
        `, [act.id_actor, act.tipo_actor, inicio, siguiente]);

        const resPagos = await client.query(`
          SELECT COALESCE(SUM(p.monto), 0) AS total_pagos
          FROM pagos p
          JOIN facturas f ON p.id_factura = f.id_factura
          WHERE f.id_cliente = $1 AND f.tipo_actor = $2
            AND p.fecha >= $3::date AND p.fecha < $4::date;
        `, [act.id_actor, act.tipo_actor, inicio, siguiente]);

        // Movimientos posteriores al período: se descuentan del saldo actual
        // para obtener el saldo real al cierre del período.
        const resPosteriores = await client.query(`
          SELECT
            COALESCE((
              SELECT SUM(CASE WHEN tipo_factura = 'EMITIDA' THEN -importe_total ELSE importe_total END)
              FROM facturas
              WHERE id_cliente = $1 AND tipo_actor = $2 AND fecha_emision >= $3::date
            ), 0)
            +
            COALESCE((
              SELECT SUM(CASE WHEN f.tipo_factura = 'EMITIDA' THEN p.monto ELSE -p.monto END)
              FROM pagos p
              JOIN facturas f ON p.id_factura = f.id_factura
              WHERE f.id_cliente = $1 AND f.tipo_actor = $2 AND p.fecha >= $3::date
            ), 0) AS delta_posterior;
        `, [act.id_actor, act.tipo_actor, siguiente]);

        const totalEmitidas = Number(resFacs.rows[0].total_emitidas);
        const totalRecibidas = Number(resFacs.rows[0].total_recibidas);
        const totalFacturadoMes = totalEmitidas + totalRecibidas;
        const totalPagadoMes = Number(resPagos.rows[0].total_pagos);

        const signo = act.tipo_actor === 'CLIENTE' ? -1 : 1;
        const deltaPeriodo = signo * (totalFacturadoMes - totalPagadoMes);
        const deltaPosterior = Number(resPosteriores.rows[0].delta_posterior);

        const saldoFinal = redondear(Number(act.saldo_actual) - deltaPosterior);
        const saldoInicial = redondear(saldoFinal - deltaPeriodo);

        const totalDebe = redondear(act.tipo_actor === 'CLIENTE' ? totalFacturadoMes : totalPagadoMes);
        const totalHaber = redondear(act.tipo_actor === 'CLIENTE' ? totalPagadoMes : totalFacturadoMes);

        await client.query(`
          INSERT INTO cierres_cuentas_corrientes
            (periodo, id_actor, tipo_actor, saldo_inicial, total_debe, total_haber, saldo_final, fecha_cierre, estado)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, 'CERRADO')
          ON CONFLICT (periodo, tipo_actor, id_actor) DO UPDATE
          SET saldo_inicial = EXCLUDED.saldo_inicial,
              total_debe = EXCLUDED.total_debe,
              total_haber = EXCLUDED.total_haber,
              saldo_final = EXCLUDED.saldo_final,
              fecha_cierre = CURRENT_TIMESTAMP,
              estado = 'CERRADO';
        `, [per, act.id_actor, act.tipo_actor, saldoInicial, totalDebe, totalHaber, saldoFinal]);

        resumenCierres.push({
          id_actor: act.id_actor,
          razon_social: act.razon_social,
          tipo_actor: act.tipo_actor,
          saldo_inicial: saldoInicial,
          total_facturado: redondear(totalFacturadoMes),
          total_pagado: redondear(totalPagadoMes),
          total_debe: totalDebe,
          total_haber: totalHaber,
          saldo_final: saldoFinal
        });
      }

      await client.query('COMMIT');

      // Auditar en MongoDB (colección documental de reportes)
      try {
        await ReporteMongoRepository.registrarReporte({
          id_reporte: `CIERRE-CC-${per}-${Date.now()}`,
          usuario: usuario || 'sistema',
          tipo: 'CIERRE_MENSUAL_CUENTAS_CORRIENTES',
          categoria: 'CONTABLE',
          parametros: {
            periodo: per,
            id_actor: actorFiltro ? actorFiltro.id_actor : null,
            tipo_actor: actorFiltro ? actorFiltro.tipo_actor : null,
            recalculado: Boolean(forzar)
          },
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
        periodo: per,
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
      params.push(periodoMensual(periodo));
      whereClause = 'WHERE c.periodo = $1';
    }
    const query = `
      SELECT c.*, a.razon_social, a.tipo_actor, a.cuit, a.pais
      FROM cierres_cuentas_corrientes c
      JOIN (
        ${ACTORES_UNION}
      ) a ON c.id_actor = a.id_actor AND c.tipo_actor = a.tipo_actor
      ${whereClause}
      ORDER BY c.periodo DESC, a.tipo_actor, a.razon_social;
    `;
    const res = await pgPool.query(query, params);
    return res.rows;
  }
}

export { CuentaCorrienteRepository as cuentaCorrienteRepository };
