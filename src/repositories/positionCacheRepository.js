import { RedisCacheRepository } from './cacheRepository.js';

export class PositionCacheRepository {
  static actualizarUltimaPosicion(...args) {
    return RedisCacheRepository.actualizarUltimaPosicion(...args);
  }

  static obtenerUltimaPosicion(...args) {
    return RedisCacheRepository.obtenerUltimaPosicion(...args);
  }

  static obtenerTodasPosiciones(...args) {
    return RedisCacheRepository.obtenerTodasPosiciones(...args);
  }

  static obtenerPosicionesCercanas(...args) {
    return RedisCacheRepository.obtenerPosicionesCercanas(...args);
  }
}
