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

  static async registrarIncidenteManual(data) {
    return MonitoreoService.registrarIncidenteManual(data);
  }

  static async cerrarIncidente(id_incidente) {
    return MonitoreoService.cerrarIncidente(id_incidente);
  }

  static async obtenerOPredicirRiesgo(id_envio) {
    return RiesgoService.obtenerOPredicirRiesgo(id_envio);
  }

  static async listarEnvios(filtro = {}) {
    return EnvioOrchestratorService.listarEnvios(filtro);
  }

  static async actualizarEnvio(id_envio, cambios) {
    return EnvioOrchestratorService.actualizarEnvio(id_envio, cambios);
  }

  static async cambiarEstadoEnvio(id_envio, estado) {
    return EnvioOrchestratorService.cambiarEstadoEnvio(id_envio, estado);
  }

  static async cancelarEnvio(id_envio) {
    return EnvioOrchestratorService.cancelarEnvio(id_envio);
  }

  static async eliminarEnvio(id_envio) {
    return EnvioOrchestratorService.eliminarEnvio(id_envio);
  }

  static async asignarContenedorAEnvio(params) {
    return EnvioOrchestratorService.asignarContenedorAEnvio(params);
  }

  static async asignarSensorAContenedorEnvio(params) {
    return EnvioOrchestratorService.asignarSensorAContenedorEnvio(params);
  }
}
