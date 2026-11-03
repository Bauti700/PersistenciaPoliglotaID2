import { pgPool } from '../config/database.js';
import { IncidenteRepository } from './incidenteRepository.js';
import { ESTADOS_ENVIO } from './envioRepository.js';
import {
  fechaValida,
  unoDe,
  enteroPositivo,
  errorValidacion,
  TIPOS_ACTOR_FINANCIERO,
  TIPOS_FACTURA,
  ESTADOS_FACTURA
} from '../utils/validation.js';

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
    const parametros = {
      fecha_desde: fecha_desde ? fechaValida(fecha_desde, 'fecha_desde') : null,
      fecha_hasta: fecha_hasta ? fechaValida(fecha_hasta, 'fecha_hasta') : null,
      tipo_actor: null,
      estado_factura: null,
      tipo_factura: null,
      id_actor: null
    };

    if (
      parametros.fecha_desde &&
      parametros.fecha_hasta &&
      parametros.fecha_desde > parametros.fecha_hasta
    ) {
      throw errorValidacion('La fecha desde no puede ser posterior a la fecha hasta.');
    }

    if (tipo_actor && String(tipo_actor).trim().toUpperCase() !== 'TODOS') {
      parametros.tipo_actor = unoDe(tipo_actor, TIPOS_ACTOR_FINANCIERO, 'tipo_actor');
    }
    if (estado_factura && String(estado_factura).trim().toUpperCase() !== 'TODAS') {
      parametros.estado_factura = unoDe(estado_factura, ESTADOS_FACTURA, 'estado_factura');
    }
    if (tipo_factura && String(tipo_factura).trim().toUpperCase() !== 'TODAS') {
      parametros.tipo_factura = unoDe(tipo_factura, TIPOS_FACTURA, 'tipo_factura');
    }
    if (id_actor !== null && id_actor !== undefined && id_actor !== '') {
      if (!parametros.tipo_actor) {
        throw errorValidacion('Para filtrar por ID de actor debe indicar también el tipo (CLIENTE / PROVEEDOR / OPERADOR).');
      }
      parametros.id_actor = enteroPositivo(id_actor, 'id_actor');
    }

    const conditions = [];
    const params = [];

    if (parametros.fecha_desde) {
      params.push(parametros.fecha_desde);
      conditions.push(`f.fecha_emision >= $${params.length}::date`);
    }
    if (parametros.fecha_hasta) {
      params.push(parametros.fecha_hasta);
      conditions.push(`f.fecha_emision < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (parametros.tipo_actor) {
      params.push(parametros.tipo_actor);
      conditions.push(`a.tipo_actor = $${params.length}`);
    }
    if (parametros.estado_factura) {
      params.push(parametros.estado_factura);
      conditions.push(`f.estado = $${params.length}`);
    }
    if (parametros.tipo_factura) {
      params.push(parametros.tipo_factura);
      conditions.push(`f.tipo_factura = $${params.length}`);
    }
    if (parametros.id_actor) {
      params.push(parametros.id_actor);
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

    let facturadoEmitido = 0;
    let cobradoEmitido = 0;
    let facturadoRecibido = 0;
    let pagadoRecibido = 0;

    for (const factura of facturas) {
      const importe = Number(factura.importe_total);
      const pagado = Number(factura.total_pagado);
      if (factura.tipo_factura === 'EMITIDA') {
        facturadoEmitido += importe;
        cobradoEmitido += pagado;
      } else {
        facturadoRecibido += importe;
        pagadoRecibido += pagado;
      }
    }

    const totalFacturado = facturadoEmitido + facturadoRecibido;
    const totalPagado = cobradoEmitido + pagadoRecibido;
    const pendienteCobro = facturadoEmitido - cobradoEmitido;
    const pendientePago = facturadoRecibido - pagadoRecibido;

    const metricas = {
      total_facturas: facturas.length,
      facturas_pagadas: facturas.filter(f => f.estado === 'PAGADA').length,
      facturas_pendientes: facturas.filter(f => f.estado === 'PENDIENTE').length,
      facturas_anuladas: facturas.filter(f => f.estado === 'ANULADA').length,
      importe_total_facturado: Math.round(totalFacturado * 100) / 100,
      importe_total_pagado: Math.round(totalPagado * 100) / 100,
      facturado_emitido: Math.round(facturadoEmitido * 100) / 100,
      cobrado_emitido: Math.round(cobradoEmitido * 100) / 100,
      pendiente_cobro: Math.round(pendienteCobro * 100) / 100,
      facturado_recibido: Math.round(facturadoRecibido * 100) / 100,
      pagado_recibido: Math.round(pagadoRecibido * 100) / 100,
      pendiente_pago: Math.round(pendientePago * 100) / 100,
      saldo_pendiente_total: Math.round((pendienteCobro - pendientePago) * 100) / 100
    };

    return { parametros, metricas, facturas };
  }

  static async rankingClientesPorVolumen() {
    // Los envíos y las facturas se agregan en subconsultas separadas para evitar
    // el producto cartesiano que duplicaba los importes facturados.
    const query = `
      SELECT c.id_cliente AS id_actor, c.razon_social, c.pais,
             COALESCE(env.total_envios, 0) AS total_envios,
             COALESCE(fac.total_facturas, 0) AS total_facturas,
             COALESCE(fac.volumen_facturado, 0.00) AS volumen_facturado
      FROM clientes c
      LEFT JOIN (
        SELECT id_cliente, COUNT(*) AS total_envios
        FROM envios
        GROUP BY id_cliente
      ) env ON env.id_cliente = c.id_cliente
      LEFT JOIN (
        SELECT id_cliente,
               COUNT(*) AS total_facturas,
               SUM(importe_total) AS volumen_facturado
        FROM facturas
        WHERE tipo_factura = 'EMITIDA'
          AND tipo_actor = 'CLIENTE'
        GROUP BY id_cliente
      ) fac ON fac.id_cliente = c.id_cliente
      ORDER BY total_envios DESC, volumen_facturado DESC, c.razon_social ASC;
    `;
    const res = await pgPool.query(query);
    return res.rows.map(fila => ({
      ...fila,
      id_actor: Number(fila.id_actor),
      total_envios: Number(fila.total_envios),
      total_facturas: Number(fila.total_facturas),
      volumen_facturado: Number(fila.volumen_facturado)
    }));
  }

  static async reporteOperativoEnvios(filtros = {}) {
    const {
      pais = null,
      estado = null,
      id_cliente = null,
      solo_demorados = false,
      solo_incidentes_abiertos = false
    } = filtros;

    const estadoNormalizado = estado ? unoDe(estado, ESTADOS_ENVIO, 'estado') : null;
    const idCliente = id_cliente !== null && id_cliente !== undefined && id_cliente !== ''
      ? enteroPositivo(id_cliente, 'id_cliente')
      : null;

    // La fecha estimada de entrega surge del último tramo planificado y la real
    // es envios.fecha_entrega. Los incidentes se agregan luego desde MongoDB.
    const params = [];
    const filtrosSQL = [];

    if (pais) {
      const paisFiltro = String(pais).trim();
      if (paisFiltro) {
        params.push(paisFiltro);
        // "País" puede referirse al país del cliente o al de origen/destino del
        // trayecto. Se admiten las tres variantes para no limitar el reporte.
        filtrosSQL.push(`(
          LOWER(c.pais) = LOWER($${params.length})
          OR LOWER(e.origen) LIKE '%' || LOWER($${params.length}) || '%'
          OR LOWER(e.destino) LIKE '%' || LOWER($${params.length}) || '%'
        )`);
      }
    }
    if (estadoNormalizado) {
      params.push(estadoNormalizado);
      filtrosSQL.push(`UPPER(e.estado) = UPPER($${params.length})`);
    }
    if (idCliente) {
      params.push(idCliente);
      filtrosSQL.push(`e.id_cliente = $${params.length}`);
    }

    const whereFiltros = filtrosSQL.length > 0 ? `WHERE ${filtrosSQL.join(' AND ')}` : '';
    const whereDemorados = solo_demorados
      ? `WHERE b.fecha_entrega IS NULL
           AND b.fecha_entrega_estimada < CURRENT_DATE
           AND b.estado NOT IN ('ENTREGADO', 'CANCELADO')`
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
                AND b.estado NOT IN ('ENTREGADO', 'CANCELADO')
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
    // Solo los envíos ENTREGADO tienen un tiempo de entrega definitivo. Los que
    // están en curso se informan por separado para no mezclar tiempos cerrados
    // con el tiempo transcurrido hasta hoy ni con envíos cancelados.
    const query = `
      SELECT c.id_cliente, c.razon_social, c.pais,
             COUNT(e.id_envio) AS total_envios,
             COUNT(*) FILTER (WHERE e.estado = 'ENTREGADO') AS entregados,
             COUNT(*) FILTER (WHERE e.estado NOT IN ('ENTREGADO', 'CANCELADO')) AS en_curso,
             COUNT(*) FILTER (WHERE e.estado = 'CANCELADO') AS cancelados,
             ROUND((
               MIN(EXTRACT(EPOCH FROM (e.fecha_entrega - e.fecha_creacion)) / 86400)
               FILTER (WHERE e.estado = 'ENTREGADO' AND e.fecha_entrega IS NOT NULL)
             )::numeric, 2) AS min_dias,
             ROUND((
               MAX(EXTRACT(EPOCH FROM (e.fecha_entrega - e.fecha_creacion)) / 86400)
               FILTER (WHERE e.estado = 'ENTREGADO' AND e.fecha_entrega IS NOT NULL)
             )::numeric, 2) AS max_dias,
             ROUND((
               AVG(EXTRACT(EPOCH FROM (e.fecha_entrega - e.fecha_creacion)) / 86400)
               FILTER (WHERE e.estado = 'ENTREGADO' AND e.fecha_entrega IS NOT NULL)
             )::numeric, 2) AS promedio_dias
      FROM clientes c
      LEFT JOIN envios e ON e.id_cliente = c.id_cliente
      GROUP BY c.id_cliente, c.razon_social, c.pais
      HAVING COUNT(e.id_envio) > 0
      ORDER BY total_envios DESC, c.razon_social ASC
    `;
    const result = await pgPool.query(query);
    return result.rows;
  }

  static async promedioIncidentesPorPaisEstadoCliente(filtros = {}) {
    const { pais = null, estado = null, id_cliente = null } = filtros;
    const estadoNormalizado = estado ? unoDe(estado, ESTADOS_ENVIO, 'estado') : null;
    const idCliente = id_cliente !== null && id_cliente !== undefined && id_cliente !== ''
      ? enteroPositivo(id_cliente, 'id_cliente')
      : null;
    const params = [];
    const conditions = [];

    if (pais) {
      const paisFiltro = String(pais).trim();
      if (paisFiltro) {
        params.push(paisFiltro);
        conditions.push(`LOWER(c.pais) = LOWER($${params.length})`);
      }
    }
    if (estadoNormalizado) {
      params.push(estadoNormalizado);
      conditions.push(`UPPER(e.estado) = UPPER($${params.length})`);
    }
    if (idCliente) {
      params.push(idCliente);
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
