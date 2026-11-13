import { RedisCacheRepository } from './cacheRepository.js';

// Repositorio de cache de predicciones de riesgo. Proporciona métodos para cachear, obtener e invalidar predicciones de riesgo utilizando Redis.
export class RiskCacheRepository {
  static cachearPrediccionRiesgo(...args) {
    return RedisCacheRepository.cachearPrediccionRiesgo(...args);
  }

  static obtenerPrediccionRiesgo(...args) {
    return RedisCacheRepository.obtenerPrediccionRiesgo(...args);
  }

  static invalidarPrediccionRiesgo(...args) {
    return RedisCacheRepository.invalidarPrediccionRiesgo(...args);
  }
}
