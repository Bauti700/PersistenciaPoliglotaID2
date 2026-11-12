import { Neo4jRouteRepository } from '../repositories/rutaRepository.js';

// Servicio para manejar la obtención de la red de relaciones en la base de datos Neo4j, delegando la lógica de negocio al Neo4jRouteRepository.
export class NetworkAnalyticsService {
  static obtenerRedRelaciones() {
    return Neo4jRouteRepository.obtenerRedRelaciones();
  }
}
