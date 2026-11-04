import { LogisticsService } from './logisticsService.js';

export class RiskAnalyticsService {
  static predecirRiesgo(id_envio, usuario = 'sistema') {
    return LogisticsService.obtenerOPredicirRiesgo(id_envio, usuario);
  }
}
