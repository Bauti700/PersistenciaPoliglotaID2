import { RedisCacheRepository } from './cacheRepository.js';

export class AnalyticsCacheRepository {
  static cachearAnalitica(...args) {
    return RedisCacheRepository.cachearAnalitica(...args);
  }

  static obtenerAnaliticaCacheada(...args) {
    return RedisCacheRepository.obtenerAnaliticaCacheada(...args);
  }
}
