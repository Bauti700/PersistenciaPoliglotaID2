import { EnvioOrchestratorService } from './envioOrchestratorService.js';

export class EnvioAssignmentService {
  static asignarContenedorAEnvio(params) {
    return EnvioOrchestratorService.asignarContenedorAEnvio(params);
  }

  static asignarSensorAContenedorEnvio(params) {
    return EnvioOrchestratorService.asignarSensorAContenedorEnvio(params);
  }
}
