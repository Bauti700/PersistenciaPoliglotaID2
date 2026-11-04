import { RedisCacheRepository } from './cacheRepository.js';

export class SessionCacheRepository {
  static guardarSesion(...args) {
    return RedisCacheRepository.guardarSesion(...args);
  }

  static obtenerSesion(...args) {
    return RedisCacheRepository.obtenerSesion(...args);
  }

  static cerrarSesion(...args) {
    return RedisCacheRepository.cerrarSesion(...args);
  }
}
