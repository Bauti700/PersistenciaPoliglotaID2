import { EnvioOrchestratorService } from './envioOrchestratorService.js';

export class EnvioStateService {
  static actualizarEnvio(id_envio, cambios) {
    return EnvioOrchestratorService.actualizarEnvio(id_envio, cambios);
  }

  static cambiarEstadoEnvio(id_envio, estado) {
    return EnvioOrchestratorService.cambiarEstadoEnvio(id_envio, estado);
  }

  static cancelarEnvio(id_envio) {
    return EnvioOrchestratorService.cancelarEnvio(id_envio);
  }

  static eliminarEnvio(id_envio) {
    return EnvioOrchestratorService.eliminarEnvio(id_envio);
  }
}
