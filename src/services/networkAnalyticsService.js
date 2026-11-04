import { Neo4jRouteRepository } from '../repositories/rutaRepository.js';

export class NetworkAnalyticsService {
  static obtenerRedRelaciones() {
    return Neo4jRouteRepository.obtenerRedRelaciones();
  }
}
