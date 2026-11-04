import { IncidenteRepository } from './incidenteRepository.js';

export class IncidentAnalyticsRepository {
  static obtenerIncidentesPorEnvio(...args) {
    return IncidenteRepository.obtenerIncidentesPorEnvio(...args);
  }
}
