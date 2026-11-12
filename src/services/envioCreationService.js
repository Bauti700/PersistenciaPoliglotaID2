import { EnvioOrchestratorService } from './envioOrchestratorService.js';

//Service que se encarga de crear envíos, delegando la lógica a EnvioOrchestratorService.
export class EnvioCreationService {
  // Crea un envío poliglota, delegando la lógica a EnvioOrchestratorService.
  static crearEnvioPoliglota(params) {
    return EnvioOrchestratorService.crearEnvioPoliglota(params);
  }

  // Crea un envío sincronizado, delegando la lógica a EnvioOrchestratorService.
  static crearEnvioSincronizado(params) {
    return EnvioOrchestratorService.crearEnvioSincronizado(params);
  }
}
