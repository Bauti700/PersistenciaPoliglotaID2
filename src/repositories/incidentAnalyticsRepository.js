import { IncidenteRepository } from './incidenteRepository.js';

// Repositorio para manejar la analítica de incidentes, delegando la obtención de datos al IncidenteRepository
export class IncidentAnalyticsRepository {
  static obtenerIncidentesPorEnvio(...args) {
    return IncidenteRepository.obtenerIncidentesPorEnvio(...args);
  }
}
