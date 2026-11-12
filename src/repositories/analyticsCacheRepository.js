import { RedisCacheRepository } from './cacheRepository.js';

// 5. Fachada de compatibilidad AnalyticsCacheRepository (consulta polimórfica)
export class AnalyticsCacheRepository {
  static cachearAnalitica(...args) {
    return RedisCacheRepository.cachearAnalitica(...args);
  }

  static obtenerAnaliticaCacheada(...args) {
    return RedisCacheRepository.obtenerAnaliticaCacheada(...args);
  }
}
