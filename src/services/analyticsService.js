import { pgPool } from '../config/database.js';
import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { RedisCacheRepository } from '../repositories/cacheRepository.js';
import { Neo4jRouteRepository } from '../repositories/rutaRepository.js';
import { ReporteComercialRepository } from '../repositories/reporteComercialRepository.js';
import { LogisticsService } from './logisticsService.js';

function normalizarNombre(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export class AnalyticsService {
  /**
   * 1. Ranking de rutas con mayor cantidad de incidentes (MongoDB + PostgreSQL + Redis)
   * Correlaciona incidentes IoT (Mongo) con topología de rutas (PostgreSQL/Neo4j).
   * Almacena en caché de Redis para respuestas de baja latencia.
   */
  static async rankingRutasConMasIncidentes({ forzarRecalculo = false } = {}) {
    const cacheKey = 'ranking:rutas_incidentes';

    // 1. Verificar si existe en caché de Redis
    if (!forzarRecalculo) {
      const cacheado = await RedisCacheRepository.obtenerAnaliticaCacheada(cacheKey);
      if (cacheado) {
        return { origen_datos: 'REDIS_CACHE', ...cacheado };
      }
    }

    // 2. Obtener agregación de incidentes por envío desde MongoDB
    const incidentesPorEnvio = await MongoTelemetryRepository.obtenerIncidentesPorEnvio();
    const mapIncidentes = new Map();
    for (const inc of incidentesPorEnvio) {
      mapIncidentes.set(inc._id, inc);
    }

    // 3. Consultar envíos y rutas en PostgreSQL
    const resEnvios = await pgPool.query(`
      SELECT e.id_envio, e.id_cliente, a.razon_social AS cliente_nombre,
             e.origen, e.destino, e.estado, e.prioridad
      FROM envios e
      JOIN clientes a ON e.id_cliente = a.id_cliente;
    `);

    // 4. Agrupar incidentes por ruta (Origen ➔ Destino)
    const mapaRutas = new Map();

    for (const envio of resEnvios.rows) {
      const claveRuta = `${envio.origen} ➔ ${envio.destino}`;
      if (!mapaRutas.has(claveRuta)) {
        mapaRutas.set(claveRuta, {
          ruta: claveRuta,
          origen: envio.origen,
          destino: envio.destino,
          total_viajes: 0,
          envios_asociados: [],
          total_incidentes: 0,
          incidentes_criticos: 0,
          incidentes_leves: 0,
          incidentes_abiertos: 0,
          tipos_incidentes: new Set()
        });
      }

      const rutaData = mapaRutas.get(claveRuta);
      rutaData.total_viajes += 1;
      rutaData.envios_asociados.push(envio.id_envio);

      // Si este envío tuvo incidentes registrados en MongoDB
      const incEnvio = mapIncidentes.get(envio.id_envio);
      if (incEnvio) {
        rutaData.total_incidentes += incEnvio.total_incidentes || 0;
        rutaData.incidentes_criticos += incEnvio.criticos || 0;
        rutaData.incidentes_leves += incEnvio.leves || 0;
        rutaData.incidentes_abiertos += incEnvio.abiertos || 0;
        if (Array.isArray(incEnvio.tipos)) {
          incEnvio.tipos.forEach(t => rutaData.tipos_incidentes.add(t));
        }
      }
    }

    // 5. Construir y calcular métricas de riesgo para cada ruta
    const ranking = Array.from(mapaRutas.values()).map(r => {
      const tasaIncidentes = r.total_viajes > 0
        ? Number((r.total_incidentes / r.total_viajes).toFixed(2))
        : 0;

      let nivelRiesgo = 'BAJO';
      let recomendacion = 'Ruta estable. Parámetros operativos estándar.';

      if (r.incidentes_criticos >= 2 || tasaIncidentes >= 1.5) {
        nivelRiesgo = 'CRÍTICO';
        recomendacion = 'Inspección urgente de flota y protocolo de contingencia en ruta.';
      } else if (r.total_incidentes >= 2 || r.incidentes_criticos >= 1) {
        nivelRiesgo = 'ALTO';
        recomendacion = 'Reforzar monitoreo de telemetría y verificación aduanera previa.';
      } else if (r.total_incidentes === 1) {
        nivelRiesgo = 'MODERADO';
        recomendacion = 'Monitoreo preventivo y seguimiento de alertas climáticas.';
      }

      return {
        ruta: r.ruta,
        total_viajes: r.total_viajes,
        total_incidentes: r.total_incidentes,
        tasa_incidentes_por_viaje: tasaIncidentes,
        incidentes_criticos: r.incidentes_criticos,
        incidentes_leves: r.incidentes_leves,
        incidentes_abiertos: r.incidentes_abiertos,
        nivel_riesgo: nivelRiesgo,
        tipos_recurrentes: Array.from(r.tipos_incidentes).join(', ') || 'Ninguno',
        recomendacion
      };
    });

    // 6. Ordenar ranking: mayor cantidad de incidentes y criticidad primero
    ranking.sort((a, b) => {
      if (b.total_incidentes !== a.total_incidentes) {
        return b.total_incidentes - a.total_incidentes;
      }
      return b.incidentes_criticos - a.incidentes_criticos;
    });

    const resultado = {
      fecha_calculo: new Date().toISOString(),
      total_rutas_evaluadas: ranking.length,
      ranking
    };

    // 7. Guardar en memoria de Redis con TTL de 1 hora
    await RedisCacheRepository.cachearAnalitica(cacheKey, resultado, 3600);

    return { origen_datos: 'CALCULADO_NUEVO', ...resultado };
  }

  /**
   * 2. Análisis histórico de desempeño
   * Incluye: Tiempos promedio, máximos y mínimos de entrega por cliente y global,
   * puntualidad (On-Time Delivery), desglose de costos por medio de transporte y confiabilidad de operadores.
   */
  static async analisisHistoricoDesempeno({ id_cliente = null, forzarRecalculo = false } = {}) {
    // La versión forma parte de la clave para no reutilizar cachés con el
    // esquema anterior de métricas mientras conviven durante una actualización.
    const cacheKey = `desempeno_historico:v2:${id_cliente || 'general'}`;

    if (!forzarRecalculo) {
      const cacheado = await RedisCacheRepository.obtenerAnaliticaCacheada(cacheKey);
      if (cacheado) {
        return { origen_datos: 'REDIS_CACHE', ...cacheado };
      }
    }

    // A. Envíos y tiempos de entrega en PostgreSQL
    const params = [];
    let filterCliente = '';
    if (id_cliente) {
      params.push(Number(id_cliente));
      filterCliente = 'WHERE e.id_cliente = $1';
    }

    const queryEnvios = `
      SELECT e.id_envio, e.id_cliente, a.razon_social AS cliente_nombre, a.pais AS cliente_pais,
             e.origen, e.destino, e.estado, e.prioridad, e.fecha_creacion, e.fecha_entrega,
             CASE 
               WHEN e.fecha_entrega IS NOT NULL THEN 
                 ROUND(EXTRACT(EPOCH FROM (e.fecha_entrega - e.fecha_creacion)) / 86400, 1)
               ELSE NULL 
             END AS dias_entrega,
             (
               SELECT MAX(t.fecha_llegada_estimada) 
               FROM tramos t 
               WHERE t.id_envio = e.id_envio
             ) AS fecha_estimada_fin
      FROM envios e
      JOIN clientes a ON e.id_cliente = a.id_cliente
      ${filterCliente}
      ORDER BY e.fecha_creacion DESC;
    `;
    const resEnvios = await pgPool.query(queryEnvios, params);
    const envios = resEnvios.rows;

    const totalEnvios = envios.length;
    const entregados = envios.filter(e => e.estado === 'ENTREGADO');
    const enTransito = envios.filter(e => e.estado === 'EN_TRANSITO');

    // Cálculo de tiempos de entrega
    const duraciones = entregados
      .map(e => Number(e.dias_entrega))
      .filter(d => !isNaN(d) && d > 0);

    const tiempoPromedioDias = duraciones.length > 0
      ? Number((duraciones.reduce((acc, v) => acc + v, 0) / duraciones.length).toFixed(1))
      : 0;
    const tiempoMinimoDias = duraciones.length > 0 ? Math.min(...duraciones) : 0;
    const tiempoMaximoDias = duraciones.length > 0 ? Math.max(...duraciones) : 0;

    // Puntualidad (On-Time Delivery). Solo se evalúan entregas con fecha
    // estimada; los envíos sin estimación se informan por separado y no inflan
    // artificialmente la tasa.
    let aTiempo = 0;
    let conDemora = 0;
    let sinEstimacion = 0;

    for (const e of entregados) {
      if (e.fecha_entrega && e.fecha_estimada_fin) {
        if (new Date(e.fecha_entrega) <= new Date(e.fecha_estimada_fin)) {
          aTiempo += 1;
        } else {
          conDemora += 1;
        }
      } else {
        sinEstimacion += 1;
      }
    }

    const entregasEvaluadas = aTiempo + conDemora;
    const tasaPuntualidad = entregasEvaluadas > 0
      ? `${((aTiempo / entregasEvaluadas) * 100).toFixed(1)}%`
      : 'N/A';

    // B. Desempeño por Cliente (tiempos mín, máx y promedio por cliente)
    const clientesMap = new Map();
    for (const e of envios) {
      if (!clientesMap.has(e.id_cliente)) {
        clientesMap.set(e.id_cliente, {
          id_cliente: e.id_cliente,
          cliente: e.cliente_nombre,
          pais: e.cliente_pais,
          total_envios: 0,
          entregados: 0,
          duraciones: []
        });
      }
      const cData = clientesMap.get(e.id_cliente);
      cData.total_envios += 1;
      if (e.estado === 'ENTREGADO' && e.dias_entrega !== null) {
        cData.entregados += 1;
        cData.duraciones.push(Number(e.dias_entrega));
      }
    }

    const desempenoPorCliente = Array.from(clientesMap.values()).map(c => {
      const cProm = c.duraciones.length > 0
        ? Number((c.duraciones.reduce((a, b) => a + b, 0) / c.duraciones.length).toFixed(1))
        : 0;
      const cMin = c.duraciones.length > 0 ? Math.min(...c.duraciones) : 0;
      const cMax = c.duraciones.length > 0 ? Math.max(...c.duraciones) : 0;

      return {
        id_cliente: c.id_cliente,
        cliente: c.cliente,
        pais: c.pais,
        total_envios: c.total_envios,
        envios_entregados: c.entregados,
        tiempo_promedio_dias: cProm,
        tiempo_minimo_dias: cMin,
        tiempo_maximo_dias: cMax
      };
    });

    // C. Costos y Volúmenes por Medio de Transporte (Tramos)
    // El filtro por cliente también aplica a los costos para que el informe sea
    // coherente cuando la opción 16 se ejecuta para un cliente específico.
    const paramsCostos = [];
    let filtroCostos = '';
    if (id_cliente) {
      paramsCostos.push(Number(id_cliente));
      filtroCostos = 'WHERE e.id_cliente = $1';
    }

    const resTramos = await pgPool.query(`
      SELECT t.medio_transporte,
             COUNT(*) AS total_tramos,
             COALESCE(ROUND(AVG(t.costo), 2), 0) AS costo_promedio,
             COALESCE(ROUND(SUM(t.costo), 2), 0) AS costo_total
      FROM tramos t
      JOIN envios e ON e.id_envio = t.id_envio
      ${filtroCostos}
      GROUP BY t.medio_transporte
      ORDER BY total_tramos DESC;
    `, paramsCostos);

    // D. Confiabilidad Operativa por Operador Logístico
    // La relación envío -> operador vive en Neo4j (ASIGNADO_A). Se cruza esa
    // asignación con los incidentes de MongoDB y se enriquece con los datos
    // maestros de PostgreSQL.
    const incidentesMongo = await MongoTelemetryRepository.obtenerIncidentesPorEnvio();
    const mapIncidentes = new Map(incidentesMongo.map(i => [i._id, i.total_incidentes]));

    const resOperadores = await pgPool.query(`
      SELECT o.id_operador AS id_actor, o.razon_social AS operador, o.pais
      FROM operadores o
      ORDER BY o.id_operador;
    `);

    let asignaciones = [];
    try {
      asignaciones = await Neo4jRouteRepository.obtenerEnviosPorOperador();
    } catch (error) {
      console.warn(`[Analytics] No se pudieron leer las asignaciones de operadores desde Neo4j: ${error.message}`);
    }

    const idsEnviosFiltrados = id_cliente
      ? new Set(envios.map(e => e.id_envio))
      : null;

    const calcularConfiabilidad = ({ id_actor = null, operador, pais = null, enviosAsignados = [] }) => {
      const viajes = enviosAsignados.filter(id => !idsEnviosFiltrados || idsEnviosFiltrados.has(id));
      const viajesConIncidentes = viajes.filter(id => (mapIncidentes.get(id) || 0) > 0);
      const incidentesRegistrados = viajes.reduce(
        (total, id) => total + (mapIncidentes.get(id) || 0),
        0
      );
      const indice = viajes.length > 0
        ? `${(((viajes.length - viajesConIncidentes.length) / viajes.length) * 100).toFixed(1)}%`
        : 'N/A';

      return {
        id_operador: id_actor,
        operador,
        pais,
        viajes_operados: viajes.length,
        viajes_con_incidentes: viajesConIncidentes.length,
        incidentes_registrados: incidentesRegistrados,
        indice_confiabilidad: indice
      };
    };

    const operadoresPgPorId = new Map(
      resOperadores.rows.map(op => [Number(op.id_actor), op])
    );
    const operadoresPgPorNombre = new Map(
      resOperadores.rows.map(op => [normalizarNombre(op.operador), op])
    );

    const confiabilidadOperadores = [];
    const operadoresProcesados = new Set();

    for (const asignacion of asignaciones) {
      const pg = (asignacion.id_actor !== null && asignacion.id_actor !== undefined
        ? operadoresPgPorId.get(Number(asignacion.id_actor))
        : null) || operadoresPgPorNombre.get(normalizarNombre(asignacion.operador));

      const clave = pg ? `pg:${pg.id_actor}` : `neo4j:${normalizarNombre(asignacion.operador)}`;
      if (operadoresProcesados.has(clave)) continue;
      operadoresProcesados.add(clave);

      confiabilidadOperadores.push(calcularConfiabilidad({
        id_actor: pg?.id_actor ?? asignacion.id_actor ?? null,
        operador: pg?.operador || asignacion.operador || 'Operador sin nombre',
        pais: pg?.pais || null,
        enviosAsignados: asignacion.envios || []
      }));
    }

    // Operadores dados de alta en PostgreSQL que todavía no tienen envíos
    // asignados en el grafo, para que el informe no los omita.
    for (const op of resOperadores.rows) {
      if (operadoresProcesados.has(`pg:${op.id_actor}`)) continue;
      confiabilidadOperadores.push(calcularConfiabilidad({
        id_actor: op.id_actor,
        operador: op.operador,
        pais: op.pais,
        enviosAsignados: []
      }));
    }

    const resultado = {
      fecha_calculo: new Date().toISOString(),
      resumen_general: {
        total_envios: totalEnvios,
        envios_entregados: entregados.length,
        envios_en_transito: enTransito.length,
        tasa_efectividad_entrega: totalEnvios > 0 ? `${((entregados.length / totalEnvios) * 100).toFixed(1)}%` : '0%'
      },
      metricas_tiempos_entrega: {
        tiempo_promedio_dias: tiempoPromedioDias,
        tiempo_minimo_dias: tiempoMinimoDias,
        tiempo_maximo_dias: tiempoMaximoDias,
        tasa_puntualidad_on_time: tasaPuntualidad,
        entregas_evaluadas: entregasEvaluadas,
        entregados_a_tiempo: aTiempo,
        entregados_con_demora: conDemora,
        entregados_sin_estimacion: sinEstimacion
      },
      desempeno_por_cliente: desempenoPorCliente,
      costos_por_tipo_transporte: resTramos.rows.map(r => ({
        medio_transporte: r.medio_transporte,
        total_tramos: Number(r.total_tramos),
        costo_promedio: `$ ${Number(r.costo_promedio).toLocaleString()}`,
        costo_total: `$ ${Number(r.costo_total).toLocaleString()}`
      })),
      confiabilidad_operadores: confiabilidadOperadores
    };

    // Guardar en Redis
    await RedisCacheRepository.cachearAnalitica(cacheKey, resultado, 3600);

    // Auditar en MongoDB (Colección reportes)
    try {
      await MongoTelemetryRepository.registrarReporte({
        tipo: 'ANALISIS_HISTORICO_DESEMPENO',
        categoria: 'INTELIGENCIA_ANALITICA',
        parametros: { id_cliente },
        resumen: {
          metricas_tiempos: resultado.metricas_tiempos_entrega,
          resumen_general: resultado.resumen_general
        }
      });
    } catch (eMongo) {
      console.warn(`[Sync Mongo Report]: ${eMongo.message}`);
    }

    return { origen_datos: 'CALCULADO_NUEVO', ...resultado };
  }

  /**
   * 3. Ranking de clientes por volumen transportado
   */
  static async rankingClientesPorVolumen() {
    return ReporteComercialRepository.rankingClientesPorVolumen();
  }

  /**
   * 4. Predicción de atrasos / riesgos (con caché Redis 24h)
   */
  static async predecirRiesgo(id_envio) {
    return LogisticsService.obtenerOPredicirRiesgo(id_envio);
  }

  /**
   * 5. Red de relaciones entre clientes, operadores y envíos (Neo4j)
   */
  static async obtenerRedRelaciones() {
    return Neo4jRouteRepository.obtenerRedRelaciones();
  }

  /**
   * 6. Detección de anomalías de temperatura (MongoDB)
   */
  static async detectarAnomaliasTemperatura(umbral = 8.0) {
    return MongoTelemetryRepository.detectarAnomaliasTemperatura(umbral);
  }
}
