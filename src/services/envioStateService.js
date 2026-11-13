import { EnvioOrchestratorService } from './envioOrchestratorService.js';

// Servicio para manejar la actualización de estados de envíos, delegando la lógica de negocio al EnvioOrchestratorService.
export class EnvioStateService {
  // Actualiza los detalles de un envío específico, aplicando los cambios proporcionados y asegurando la integridad de los datos.
  static actualizarEnvio(id_envio, cambios) {
    return EnvioOrchestratorService.actualizarEnvio(id_envio, cambios);
  }

  // Cambia el estado de un envío específico, validando la transición de estado y registrando el evento en la base de datos de telemetría.
  static cambiarEstadoEnvio(id_envio, estado) {
    return EnvioOrchestratorService.cambiarEstadoEnvio(id_envio, estado);
  }

  // Cancela un envío específico, asegurando que el envío esté en un estado que permita la cancelación y registrando el evento en la base de datos de telemetría.
  static cancelarEnvio(id_envio) {
    return EnvioOrchestratorService.cancelarEnvio(id_envio);
  }

  // Elimina un envío específico, asegurando que el envío exista y esté en un estado que permita la eliminación, y registrando el evento en la base de datos de telemetría.
  static eliminarEnvio(id_envio) {
    return EnvioOrchestratorService.eliminarEnvio(id_envio);
  }
}
