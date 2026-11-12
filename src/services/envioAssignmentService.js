import { EnvioOrchestratorService } from './envioOrchestratorService.js';

// Servicio para manejar la asignación de contenedores y sensores a envíos, delegando la lógica de negocio al EnvioOrchestratorService.
export class EnvioAssignmentService {
  // Asigna un contenedor a un envío específico, realizando validaciones de existencia y estado, y registrando el evento en la base de datos de telemetría.
  static asignarContenedorAEnvio(params) {
    return EnvioOrchestratorService.asignarContenedorAEnvio(params);
  }

  // Asigna un sensor a un contenedor dentro de un envío específico, asegurando que el sensor y el contenedor existan y estén disponibles para la asignación.
  static asignarSensorAContenedorEnvio(params) {
    return EnvioOrchestratorService.asignarSensorAContenedorEnvio(params);
  }
}
