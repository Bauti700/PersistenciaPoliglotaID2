import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';

export class TemperatureAnalyticsService {
  static detectarAnomaliasTemperatura(umbral = 8.0) {
    return MongoTelemetryRepository.detectarAnomaliasTemperatura(umbral);
  }
}
