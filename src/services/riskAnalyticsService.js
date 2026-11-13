import { LogisticsService } from './logisticsService.js';

// Servicio para manejar la predicción de riesgo de envíos, actuando como una capa de abstracción que delega la lógica al LogisticsService.
export class RiskAnalyticsService {
  static predecirRiesgo(id_envio, usuario = 'sistema') {
    return LogisticsService.obtenerOPredicirRiesgo(id_envio, usuario);
  }
}
