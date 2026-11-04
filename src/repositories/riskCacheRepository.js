import { RedisCacheRepository } from './cacheRepository.js';

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
