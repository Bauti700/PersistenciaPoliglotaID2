import { pgPool } from '../config/database.js';
import { RedisCacheRepository } from '../repositories/cacheRepository.js';

export class RiesgoService {
  static async obtenerOPredicirRiesgo(id_envio) {
    const cacheKey = `prediccion:riesgo:${id_envio}`;
    try {
      const cached = await RedisCacheRepository.getCache(cacheKey);
      if (cached) {
        return { ...cached, origen: 'REDIS_CACHE', ttl_restante: '24h' };
      }
    } catch (e) {}

    // Consulta de histórico en PostgreSQL + análisis
    const res = await pgPool.query(`
      SELECT e.id_envio, e.estado, e.prioridad, e.fecha_creacion, e.fecha_entrega_estimada,
             COUNT(i.id_incidente) as total_incidentes,
             COUNT(CASE WHEN i.severidad IN ('ALTA','CRITICA') THEN 1 END) as incidentes_criticos
      FROM envios e
      LEFT JOIN incidentes i ON i.id_envio = e.id_envio
      WHERE e.id_envio = $1
      GROUP BY e.id_envio, e.estado, e.prioridad, e.fecha_creacion, e.fecha_entrega_estimada
    `, [id_envio]);

    const envio = res.rows[0];
    if (!envio) return { error: 'Envío no encontrado' };

    let probabilidad = 10;
    if (envio.total_incidentes > 0) probabilidad += envio.total_incidentes * 15;
    if (envio.incidentes_criticos > 0) probabilidad += envio.incidentes_criticos * 20;
    if (envio.prioridad === 'ALTA') probabilidad += 10;
    if (envio.estado === 'EN_TRANSITO') probabilidad += 5;
    if (probabilidad > 95) probabilidad = 95;

    const riesgo = {
      id_envio,
      probabilidad_demora: `${probabilidad}%`,
      nivel_riesgo: probabilidad > 70 ? 'ALTO' : probabilidad > 40 ? 'MEDIO' : 'BAJO',
      factores: {
        incidentes_totales: Number(envio.total_incidentes),
        incidentes_criticos: Number(envio.incidentes_criticos),
        prioridad: envio.prioridad,
        estado: envio.estado
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
