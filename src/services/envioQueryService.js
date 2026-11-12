import { EnvioOrchestratorService } from './envioOrchestratorService.js';

// Servicio para manejar consultas de envíos, delegando la lógica de negocio al EnvioOrchestratorService.
export class EnvioQueryService {
  static listarEnvios(filtro = {}) {
    return EnvioOrchestratorService.listarEnvios(filtro);
  }
}
