import { pgPool } from '../config/database.js';
import { RiskCacheRepository } from '../repositories/riskCacheRepository.js';
import { IncidenteRepository } from '../repositories/incidenteRepository.js';
import { ReporteMongoRepository } from '../repositories/reporteMongoRepository.js';
import { calcularRiesgoEnvio } from './riskCalculator.js';

export class RiesgoService {
  static async obtenerOPredicirRiesgo(id_envio, usuario = 'sistema') {
    try {
      const cached = await RiskCacheRepository.obtenerPrediccionRiesgo(id_envio);
      if (cached) {
        return { ...cached, origen: 'REDIS_CACHE', ttl_restante: '24h' };
      }
    } catch (error) {
      console.warn(`[Riesgo] No se pudo consultar la caché: ${error.message}`);
    }

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

    const riesgo = calcularRiesgoEnvio({
      id_envio,
      estado: envio.estado,
      prioridad: envio.prioridad,
      fecha_entrega: envio.fecha_entrega,
      fecha_entrega_estimada: envio.fecha_entrega_estimada,
      incidentes
    });

    try {
      await RiskCacheRepository.cachearPrediccionRiesgo(id_envio, riesgo, 86400); // 24 horas
    } catch (error) {
      console.warn(`[Riesgo] No se pudo guardar la predicción en caché: ${error.message}`);
    }

    // Dejar trazabilidad del análisis predictivo en la colección documental de
    // reportes. Es best-effort: la predicción se devuelve aunque Mongo falle.
    try {
      await ReporteMongoRepository.registrarReporte({
        usuario: usuario || 'sistema',
        tipo: 'PREDICCION_RIESGO_ENVIO',
        categoria: 'PREDICTIVO',
        parametros: { id_envio },
        resumen: {
          probabilidad_demora: riesgo.probabilidad_demora,
          nivel_riesgo: riesgo.nivel_riesgo,
          factores: riesgo.factores
        }
      });
    } catch (eMongo) {
      console.warn(`[Riesgo] No se pudo auditar la predicción en MongoDB: ${eMongo.message}`);
    }

    return riesgo;
  }
}

export { RiesgoService as riesgoService };
