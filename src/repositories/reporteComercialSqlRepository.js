import { pgPool } from '../config/database.js';
import { ReporteMongoRepository } from './reporteMongoRepository.js';

export class ReporteComercialSqlRepository {
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

  static async reporteOperativoEnvios(filtros = {}) {
    const {
      pais = null,
      estado = null,
      id_cliente = null,
      solo_demorados = false,
      solo_incidentes_abiertos = false
    } = filtros;

    let query = `
      SELECT e.id_envio, e.id_cliente, c.razon_social, c.pais, e.origen, e.destino, 
             e.estado, e.prioridad, e.fecha_creacion, e.fecha_entrega_estimada, e.fecha_entrega_real,
             CASE 
               WHEN e.fecha_entrega_real IS NULL AND e.fecha_entrega_estimada < CURRENT_DATE AND e.estado <> 'ENTREGADO' 
               THEN 'SI' ELSE 'NO' 
             END AS demorado,
             COUNT(DISTINCT i.id_incidente) AS incidentes_totales,
             COUNT(DISTINCT CASE WHEN i.estado = 'ABIERTO' THEN i.id_incidente END) AS incidentes_abiertos
      FROM envios e
      LEFT JOIN clientes c ON c.id_cliente = e.id_cliente
      LEFT JOIN incidentes i ON i.id_envio = e.id_envio
      WHERE 1=1
    `;
    const params = [];

    if (pais) {
      params.push(pais);
      query += ` AND LOWER(c.pais) = LOWER($${params.length})`;
    }
    if (estado) {
      params.push(estado);
      query += ` AND UPPER(e.estado) = UPPER($${params.length})`;
    }
    if (id_cliente) {
      params.push(Number(id_cliente));
      query += ` AND e.id_cliente = $${params.length}`;
    }

    query += ` GROUP BY e.id_envio, e.id_cliente, c.razon_social, c.pais, e.origen, e.destino, 
               e.estado, e.prioridad, e.fecha_creacion, e.fecha_entrega_estimada, e.fecha_entrega_real`;

    if (solo_demorados) {
      query += ` HAVING (e.fecha_entrega_real IS NULL AND e.fecha_entrega_estimada < CURRENT_DATE AND e.estado <> 'ENTREGADO')`;
    }
    if (solo_incidentes_abiertos) {
      if (solo_demorados) {
        query += ` AND COUNT(DISTINCT CASE WHEN i.estado = 'ABIERTO' THEN i.id_incidente END) > 0`;
      } else {
        query += ` HAVING COUNT(DISTINCT CASE WHEN i.estado = 'ABIERTO' THEN i.id_incidente END) > 0`;
      }
    }

    query += ` ORDER BY e.fecha_creacion DESC`;

    const result = await pgPool.query(query, params);
    return result.rows;
  }

  static async tiemposEnvioPorCliente() {
    const query = `
      SELECT c.id_cliente, c.razon_social, c.pais,
             COUNT(e.id_envio) AS total_envios,
             COUNT(CASE WHEN e.estado = 'ENTREGADO' THEN 1 END) AS entregados,
             MIN(EXTRACT(DAY FROM (COALESCE(e.fecha_entrega_real, CURRENT_DATE) - e.fecha_creacion))) AS min_dias,
             MAX(EXTRACT(DAY FROM (COALESCE(e.fecha_entrega_real, CURRENT_DATE) - e.fecha_creacion))) AS max_dias,
             ROUND(AVG(EXTRACT(DAY FROM (COALESCE(e.fecha_entrega_real, CURRENT_DATE) - e.fecha_creacion)))::numeric, 2) AS promedio_dias
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
    let query = `
      SELECT c.pais, e.estado, c.id_cliente, c.razon_social,
             COUNT(DISTINCT e.id_envio) AS total_envios,
             COUNT(i.id_incidente) AS total_incidentes,
             ROUND((COUNT(i.id_incidente)::numeric / NULLIF(COUNT(DISTINCT e.id_envio), 0)), 2) AS promedio_incidentes_por_envio
      FROM envios e
      LEFT JOIN clientes c ON c.id_cliente = e.id_cliente
      LEFT JOIN incidentes i ON i.id_envio = e.id_envio
      WHERE 1=1
    `;
    const params = [];
    if (pais) {
      params.push(pais);
      query += ` AND LOWER(c.pais) = LOWER($${params.length})`;
    }
    if (estado) {
      params.push(estado);
      query += ` AND UPPER(e.estado) = UPPER($${params.length})`;
    }
    if (id_cliente) {
      params.push(Number(id_cliente));
      query += ` AND c.id_cliente = $${params.length}`;
    }
    query += ` GROUP BY c.pais, e.estado, c.id_cliente, c.razon_social
               ORDER BY total_incidentes DESC, promedio_incidentes_por_envio DESC`;
    const result = await pgPool.query(query, params);
    return result.rows;
  }

  static async tiemposPromedioEntrega() {
    const query = `
      SELECT c.pais,
             COUNT(CASE WHEN e.estado = 'ENTREGADO' THEN 1 END) AS entregados,
             ROUND(AVG(EXTRACT(EPOCH FROM (e.fecha_entrega_real - e.fecha_creacion)) / 86400)::numeric, 2) AS promedio_dias_entrega,
             ROUND(MIN(EXTRACT(EPOCH FROM (e.fecha_entrega_real - e.fecha_creacion)) / 86400)::numeric, 2) AS min_dias,
             ROUND(MAX(EXTRACT(EPOCH FROM (e.fecha_entrega_real - e.fecha_creacion)) / 86400)::numeric, 2) AS max_dias
      FROM envios e
      LEFT JOIN clientes c ON c.id_cliente = e.id_cliente
      WHERE e.estado = 'ENTREGADO' AND e.fecha_entrega_real IS NOT NULL
      GROUP BY c.pais
      ORDER BY promedio_dias_entrega ASC
    `;
    const result = await pgPool.query(query);
    return result.rows;
  }

  static async costosPorTipoTransporte() {
    const query = `
      SELECT t.medio,
             COUNT(DISTINCT t.id_envio) AS total_envios,
             COUNT(t.id_tramo) AS total_tramos,
             COALESCE(SUM(t.costo_estimado), 0) AS costo_total_estimado,
             COALESCE(AVG(t.costo_estimado), 0) AS costo_promedio_por_tramo
      FROM tramos t
      GROUP BY t.medio
      ORDER BY costo_total_estimado DESC
    `;
    const result = await pgPool.query(query);
    return result.rows;
  }
}

export { ReporteComercialSqlRepository as reporteComercialSqlRepository };
