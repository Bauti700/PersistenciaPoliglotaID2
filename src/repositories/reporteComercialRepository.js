import { pgPool } from '../config/database.js';
import { MongoTelemetryRepository } from './telemetriaRepository.js';

export class ReporteComercialRepository {
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

export { ReporteComercialRepository as reporteComercialRepository };
