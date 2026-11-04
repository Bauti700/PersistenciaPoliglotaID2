import { EnvioOrchestratorService } from './envioOrchestratorService.js';

export class EnvioCreationService {
  static crearEnvioPoliglota(params) {
    return EnvioOrchestratorService.crearEnvioPoliglota(params);
  }

  static crearEnvioSincronizado(params) {
    return EnvioOrchestratorService.crearEnvioSincronizado(params);
  }
}
