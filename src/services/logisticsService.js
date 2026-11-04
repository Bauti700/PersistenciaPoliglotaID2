import { EnvioCreationService } from './envioCreationService.js';
import { EnvioAssignmentService } from './envioAssignmentService.js';
import { EnvioStateService } from './envioStateService.js';
import { EnvioQueryService } from './envioQueryService.js';
import { MonitoreoService } from './monitoreoService.js';
import { RiesgoService } from './riesgoService.js';

export class LogisticsService {
  static async crearEnvioPoliglota(params) {
    return EnvioCreationService.crearEnvioPoliglota(params);
  }

  static async crearEnvioSincronizado(params) {
    return EnvioCreationService.crearEnvioSincronizado(params);
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

  static async obtenerOPredicirRiesgo(id_envio, usuario = 'sistema') {
    return RiesgoService.obtenerOPredicirRiesgo(id_envio, usuario);
  }

  static async listarEnvios(filtro = {}) {
    return EnvioQueryService.listarEnvios(filtro);
  }

  static async actualizarEnvio(id_envio, cambios) {
    return EnvioStateService.actualizarEnvio(id_envio, cambios);
  }

  static async cambiarEstadoEnvio(id_envio, estado) {
    return EnvioStateService.cambiarEstadoEnvio(id_envio, estado);
  }

  static async cancelarEnvio(id_envio) {
    return EnvioStateService.cancelarEnvio(id_envio);
  }

  static async eliminarEnvio(id_envio) {
    return EnvioStateService.eliminarEnvio(id_envio);
  }

  static async asignarContenedorAEnvio(params) {
    return EnvioAssignmentService.asignarContenedorAEnvio(params);
  }

  static async asignarSensorAContenedorEnvio(params) {
    return EnvioAssignmentService.asignarSensorAContenedorEnvio(params);
  }
}
