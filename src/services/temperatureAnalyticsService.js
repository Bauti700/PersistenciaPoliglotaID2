import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';

// Servicio para manejar la detección de anomalías de temperatura en los envíos, delegando la lógica de negocio al repositorio documental de telemetría.
export class TemperatureAnalyticsService {
  static detectarAnomaliasTemperatura(umbral = 8.0) {
    return MongoTelemetryRepository.detectarAnomaliasTemperatura(umbral);
  }
}
