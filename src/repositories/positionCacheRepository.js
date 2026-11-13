import { RedisCacheRepository } from './cacheRepository.js';

// Repositorio para manejar la caché de posiciones de envíos en Redis, delegando la lógica a RedisCacheRepository
export class PositionCacheRepository {
  // Actualiza la última posición conocida de un envío en la caché
  static actualizarUltimaPosicion(...args) {
    return RedisCacheRepository.actualizarUltimaPosicion(...args);
  }

  // Actualiza todas las posiciones conocidas de un envío en la caché
  static obtenerUltimaPosicion(...args) {
    return RedisCacheRepository.obtenerUltimaPosicion(...args);
  }

  // Obtiene todas las posiciones conocidas de un envío en la caché
  static obtenerTodasPosiciones(...args) {
    return RedisCacheRepository.obtenerTodasPosiciones(...args);
  }

  // Obtiene las posiciones cercanas a una ubicación específica, delegando la lógica a RedisCacheRepository
  static obtenerPosicionesCercanas(...args) {
    return RedisCacheRepository.obtenerPosicionesCercanas(...args);
  }
}
