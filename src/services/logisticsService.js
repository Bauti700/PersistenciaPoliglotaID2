import { EnvioOrchestratorService } from './envioOrchestratorService.js';
import { MonitoreoService } from './monitoreoService.js';
import { RiesgoService } from './riesgoService.js';

export class LogisticsService {
  static async crearEnvioPoliglota(params) {
    return EnvioOrchestratorService.crearEnvioPoliglota(params);
  }

  static async crearEnvioSincronizado(params) {
    return EnvioOrchestratorService.crearEnvioSincronizado(params);
  }

  static async procesarLecturaSensor(params) {
    return MonitoreoService.procesarLecturaSensor(params);
  }

  static async ejecutarMonitoreoSensores() {
    return MonitoreoService.ejecutarMonitoreoSensores();
  }

  static async obtenerOPredicirRiesgo(id_envio) {
    return RiesgoService.obtenerOPredicirRiesgo(id_envio);
  }
}
