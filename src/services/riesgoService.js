import { pgPool } from '../config/database.js';
import { RedisCacheRepository } from '../repositories/cacheRepository.js';
import { IncidenteRepository } from '../repositories/incidenteRepository.js';

export class RiesgoService {
  static async obtenerOPredicirRiesgo(id_envio) {
    const cacheKey = `prediccion:riesgo:${id_envio}`;
    try {
      const cached = await RedisCacheRepository.getCache(cacheKey);
      if (cached) {
        return { ...cached, origen: 'REDIS_CACHE', ttl_restante: '24h' };
      }
    } catch (e) {}

    // Histórico relacional: estado/prioridad del envío y fecha estimada del
    // último tramo planificado. Los incidentes se consultan en MongoDB.
    const res = await pgPool.query(`
      SELECT e.id_envio, e.estado, e.prioridad, e.fecha_creacion, e.fecha_entrega,
             (SELECT MAX(t.fecha_llegada_estimada)
                FROM tramos t
               WHERE t.id_envio = e.id_envio) AS fecha_entrega_estimada
      FROM envios e
      WHERE e.id_envio = $1
    `, [id_envio]);

    const envio = res.rows[0];
    if (!envio) return { error: 'Envío no encontrado' };

    let incidentes = [];
    try {
      incidentes = await IncidenteRepository.listarIncidentesPorEnvio(id_envio);
    } catch (e) {
      console.warn(`[Riesgo] No se pudieron leer incidentes desde MongoDB: ${e.message}`);
    }

    const totalIncidentes = incidentes.length;
    const incidentesCriticos = incidentes.filter(i => ['ALTA', 'CRITICA'].includes(i.severidad)).length;
    const fechaEstimada = envio.fecha_entrega_estimada ? new Date(envio.fecha_entrega_estimada) : null;
    const demoraEstimada = Boolean(
      fechaEstimada &&
      !envio.fecha_entrega &&
      envio.estado !== 'ENTREGADO' &&
      fechaEstimada < new Date()
    );

    let probabilidad = 10;
    if (totalIncidentes > 0) probabilidad += totalIncidentes * 15;
    if (incidentesCriticos > 0) probabilidad += incidentesCriticos * 20;
    if (envio.prioridad === 'ALTA') probabilidad += 10;
    if (envio.estado === 'EN_TRANSITO') probabilidad += 5;
    if (demoraEstimada) probabilidad += 15;
    if (probabilidad > 95) probabilidad = 95;

    const riesgo = {
      id_envio,
      probabilidad_demora: `${probabilidad}%`,
      nivel_riesgo: probabilidad > 70 ? 'ALTO' : probabilidad > 40 ? 'MEDIO' : 'BAJO',
      factores: {
        incidentes_totales: totalIncidentes,
        incidentes_criticos: incidentesCriticos,
        prioridad: envio.prioridad,
        estado: envio.estado,
        demora_estimada: demoraEstimada ? 'SI' : 'NO'
      },
      fecha_calculo: new Date().toISOString(),
      origen: 'CALCULADO'
    };

    try {
      await RedisCacheRepository.setCache(cacheKey, riesgo, 86400); // 24 horas
    } catch (e) {}

    return riesgo;
  }
}

export { RiesgoService as riesgoService };
