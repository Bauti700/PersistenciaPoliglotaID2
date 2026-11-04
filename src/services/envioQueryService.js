import { EnvioOrchestratorService } from './envioOrchestratorService.js';

export class EnvioQueryService {
  static listarEnvios(filtro = {}) {
    return EnvioOrchestratorService.listarEnvios(filtro);
  }
}
