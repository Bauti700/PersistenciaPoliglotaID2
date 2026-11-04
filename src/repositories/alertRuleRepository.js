import { AlertaRepository } from './alertaRepository.js';

export class AlertRuleRepository {
  static crear(...args) { return AlertaRepository.crearRegla(...args); }
  static actualizar(...args) { return AlertaRepository.actualizarRegla(...args); }
  static activar(...args) { return AlertaRepository.activarRegla(...args); }
  static desactivar(...args) { return AlertaRepository.desactivarRegla(...args); }
  static eliminar(...args) { return AlertaRepository.eliminarRegla(...args); }
  static listar(...args) { return AlertaRepository.listarReglas(...args); }
  static obtenerActivas(...args) { return AlertaRepository.obtenerReglasActivas(...args); }
  static obtenerAplicable(...args) { return AlertaRepository.obtenerReglaAplicable(...args); }
}
