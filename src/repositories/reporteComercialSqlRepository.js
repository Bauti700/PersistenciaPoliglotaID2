import { pgPool } from '../config/database.js';
import { IncidenteRepository } from './incidenteRepository.js';

export class ReporteComercialSqlRepository {
  // Los incidentes viven en MongoDB, no en PostgreSQL. Este helper devuelve un
  // mapa id_envio -> agregados para combinarlos con las filas relacionales.
  static async _mapaIncidentesPorEnvio() {
    try {
      const agrupados = await IncidenteRepository.obtenerIncidentesPorEnvio();
      return new Map(agrupados.map(a => [a._id, a]));
    } catch (err) {
      console.warn(`[Reporte SQL] No se pudieron leer incidentes desde MongoDB: ${err.message}`);
      return new Map();
    }
  }

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
      if (!tipo_actor || tipo_actor === 'TODOS') {
        throw new Error('Para filtrar por ID de actor debe indicar también el tipo (CLIENTE / PROVEEDOR / OPERADOR).');
      }
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
      JOIN (
        SELECT id_cliente AS id_actor, 'CLIENTE' AS tipo_actor, razon_social, cuit, pais FROM clientes
        UNION ALL
        SELECT id_proveedor AS id_actor, 'PROVEEDOR' AS tipo_actor, razon_social, cuit, pais FROM proveedores
        UNION ALL
        SELECT id_operador AS id_actor, 'OPERADOR' AS tipo_actor, razon_social, cuit, pais FROM operadores
      ) a ON f.id_cliente = a.id_actor AND f.tipo_actor = a.tipo_actor
      ${whereSQL}
      ORDER BY f.fecha_emision DESC, f.id_factura DESC;
    `;

    const res = await pgPool.query(query, params);
    const facturas = res.rows;

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

    return { parametros: { fecha_desde, fecha_hasta, tipo_actor, estado_factura, tipo_factura, id_actor }, metricas, facturas };
  }

  static async rankingClientesPorVolumen() {
    const query = `
      SELECT c.id_cliente AS id_actor, c.razon_social, c.pais,
             COUNT(DISTINCT e.id_envio) AS total_envios,
             COALESCE(SUM(f.importe_total), 0.00) AS volumen_facturado
      FROM clientes c
      LEFT JOIN envios e ON c.id_cliente = e.id_cliente
      LEFT JOIN facturas f
        ON c.id_cliente = f.id_cliente
       AND f.tipo_factura = 'EMITIDA'
       AND f.tipo_actor = 'CLIENTE'
      GROUP BY c.id_cliente, c.razon_social, c.pais
      ORDER BY total_envios DESC, volumen_facturado DESC;
    `;
    const res = await pgPool.query(query);
    return res.rows;
  }

  static async reporteOperativoEnvios(filtros = {}) {
    const {
      pais = null,
      estado = null,
      id_cliente = null,
      solo_demorados = false,
      solo_incidentes_abiertos = false
    } = filtros;

    // La fecha estimada de entrega surge del último tramo planificado y la real
    // es envios.fecha_entrega. Los incidentes se agregan luego desde MongoDB.
    const params = [];
    const filtrosSQL = [];

    if (pais) {
      params.push(pais);
      filtrosSQL.push(`LOWER(c.pais) = LOWER($${params.length})`);
    }
    if (estado) {
      params.push(estado);
      filtrosSQL.push(`UPPER(e.estado) = UPPER($${params.length})`);
    }
    if (id_cliente) {
      params.push(Number(id_cliente));
      filtrosSQL.push(`e.id_cliente = $${params.length}`);
    }

    const whereFiltros = filtrosSQL.length > 0 ? `WHERE ${filtrosSQL.join(' AND ')}` : '';
    const whereDemorados = solo_demorados
      ? `WHERE b.fecha_entrega IS NULL
           AND b.fecha_entrega_estimada < CURRENT_DATE
           AND b.estado <> 'ENTREGADO'`
      : '';

    const query = `
      WITH base AS (
        SELECT e.id_envio, e.id_cliente, c.razon_social, c.pais,
               e.origen, e.destino, e.estado, e.prioridad, e.fecha_creacion, e.fecha_entrega,
               (SELECT MAX(t.fecha_llegada_estimada)
                  FROM tramos t
                 WHERE t.id_envio = e.id_envio) AS fecha_entrega_estimada
        FROM envios e
        LEFT JOIN clientes c ON c.id_cliente = e.id_cliente
        ${whereFiltros}
      )
      SELECT b.*,
             b.fecha_entrega AS fecha_entrega_real,
             CASE
               WHEN b.fecha_entrega IS NULL
                AND b.fecha_entrega_estimada < CURRENT_DATE
                AND b.estado <> 'ENTREGADO'
               THEN 'SI' ELSE 'NO'
             END AS demorado
      FROM base b
      ${whereDemorados}
      ORDER BY b.fecha_creacion DESC;
    `;

    const result = await pgPool.query(query, params);
    const incidentesPorEnvio = await this._mapaIncidentesPorEnvio();

    const filas = result.rows.map(row => {
      const incidentes = incidentesPorEnvio.get(row.id_envio);
      return {
        ...row,
        incidentes_totales: incidentes?.total_incidentes || 0,
        incidentes_abiertos: incidentes?.abiertos || 0
      };
    });

    if (!solo_incidentes_abiertos) return filas;
    return filas.filter(fila => Number(fila.incidentes_abiertos) > 0);
  }

  static async tiemposEnvioPorCliente() {
    const query = `
      SELECT c.id_cliente, c.razon_social, c.pais,
             COUNT(e.id_envio) AS total_envios,
             COUNT(CASE WHEN e.estado = 'ENTREGADO' THEN 1 END) AS entregados,
             ROUND(MIN(EXTRACT(EPOCH FROM (COALESCE(e.fecha_entrega, CURRENT_TIMESTAMP) - e.fecha_creacion)) / 86400)::numeric, 2) AS min_dias,
             ROUND(MAX(EXTRACT(EPOCH FROM (COALESCE(e.fecha_entrega, CURRENT_TIMESTAMP) - e.fecha_creacion)) / 86400)::numeric, 2) AS max_dias,
             ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(e.fecha_entrega, CURRENT_TIMESTAMP) - e.fecha_creacion)) / 86400)::numeric, 2) AS promedio_dias
      FROM clientes c
      LEFT JOIN envios e ON e.id_cliente = c.id_cliente
      GROUP BY c.id_cliente, c.razon_social, c.pais
      HAVING COUNT(e.id_envio) > 0
      ORDER BY total_envios DESC
    `;
    const result = await pgPool.query(query);
    return result.rows;
  }

  static async promedioIncidentesPorPaisEstadoCliente(filtros = {}) {
    const { pais = null, estado = null, id_cliente = null } = filtros;
    const params = [];
    const conditions = [];

    if (pais) {
      params.push(pais);
      conditions.push(`LOWER(c.pais) = LOWER($${params.length})`);
    }
    if (estado) {
      params.push(estado);
      conditions.push(`UPPER(e.estado) = UPPER($${params.length})`);
    }
    if (id_cliente) {
      params.push(Number(id_cliente));
      conditions.push(`c.id_cliente = $${params.length}`);
    }

    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const gruposQuery = `
      SELECT c.pais, e.estado, c.id_cliente, c.razon_social,
             COUNT(DISTINCT e.id_envio) AS total_envios
      FROM envios e
      LEFT JOIN clientes c ON c.id_cliente = e.id_cliente
      ${whereSQL}
      GROUP BY c.pais, e.estado, c.id_cliente, c.razon_social
    `;

    // Se necesita el detalle por envío para sumar los incidentes de MongoDB.
    const enviosQuery = `
      SELECT e.id_envio, e.estado, e.id_cliente, c.pais
      FROM envios e
      LEFT JOIN clientes c ON c.id_cliente = e.id_cliente
      ${whereSQL}
    `;

    const [gruposRes, enviosRes, incidentesPorEnvio] = await Promise.all([
      pgPool.query(gruposQuery, params),
      pgPool.query(enviosQuery, params),
      this._mapaIncidentesPorEnvio()
    ]);

    const incidentesPorGrupo = new Map();
    for (const envio of enviosRes.rows) {
      const key = `${envio.pais}|${envio.estado}|${envio.id_cliente}`;
      const total = incidentesPorEnvio.get(envio.id_envio)?.total_incidentes || 0;
      incidentesPorGrupo.set(key, (incidentesPorGrupo.get(key) || 0) + total);
    }

    return gruposRes.rows
      .map(grupo => {
        const key = `${grupo.pais}|${grupo.estado}|${grupo.id_cliente}`;
        const totalIncidentes = incidentesPorGrupo.get(key) || 0;
        const totalEnvios = Number(grupo.total_envios);
        return {
          ...grupo,
          total_incidentes: totalIncidentes,
          promedio_incidentes_por_envio: totalEnvios > 0
            ? Math.round((totalIncidentes / totalEnvios) * 100) / 100
            : 0
        };
      })
      .sort((a, b) =>
        b.total_incidentes - a.total_incidentes ||
        b.promedio_incidentes_por_envio - a.promedio_incidentes_por_envio
      );
  }

  static async tiemposPromedioEntrega() {
    const query = `
      SELECT c.pais,
             COUNT(CASE WHEN e.estado = 'ENTREGADO' THEN 1 END) AS entregados,
             ROUND(AVG(EXTRACT(EPOCH FROM (e.fecha_entrega - e.fecha_creacion)) / 86400)::numeric, 2) AS promedio_dias_entrega,
             ROUND(MIN(EXTRACT(EPOCH FROM (e.fecha_entrega - e.fecha_creacion)) / 86400)::numeric, 2) AS min_dias,
             ROUND(MAX(EXTRACT(EPOCH FROM (e.fecha_entrega - e.fecha_creacion)) / 86400)::numeric, 2) AS max_dias
      FROM envios e
      LEFT JOIN clientes c ON c.id_cliente = e.id_cliente
      WHERE e.estado = 'ENTREGADO' AND e.fecha_entrega IS NOT NULL
      GROUP BY c.pais
      ORDER BY promedio_dias_entrega ASC
    `;
    const result = await pgPool.query(query);
    return result.rows;
  }

  static async costosPorTipoTransporte() {
    const query = `
      SELECT t.medio_transporte AS medio,
             COUNT(DISTINCT t.id_envio) AS total_envios,
             COUNT(t.id_tramo) AS total_tramos,
             COALESCE(SUM(t.costo), 0) AS costo_total_estimado,
             COALESCE(ROUND(AVG(t.costo)::numeric, 2), 0) AS costo_promedio_por_tramo
      FROM tramos t
      GROUP BY t.medio_transporte
      ORDER BY costo_total_estimado DESC
    `;
    const result = await pgPool.query(query);
    return result.rows;
  }
}

export { ReporteComercialSqlRepository as reporteComercialSqlRepository };
