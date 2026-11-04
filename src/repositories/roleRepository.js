import { UsuarioRepository } from './usuarioRepository.js';

export class RoleRepository {
  static crear(...args) { return UsuarioRepository.crearRol(...args); }
  static listar(...args) { return UsuarioRepository.listarRoles(...args); }
  static obtenerPorId(...args) { return UsuarioRepository.obtenerRolPorId(...args); }
  static actualizar(...args) { return UsuarioRepository.actualizarRol(...args); }
  static activar(...args) { return UsuarioRepository.activarRol(...args); }
  static desactivar(...args) { return UsuarioRepository.desactivarRol(...args); }
  static eliminar(...args) { return UsuarioRepository.eliminarRol(...args); }
}
