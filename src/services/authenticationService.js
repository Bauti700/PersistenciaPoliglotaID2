import { UsuarioRepository } from '../repositories/usuarioRepository.js';

// Servicio para manejar la autenticación y autorización de usuarios, incluyendo verificación de credenciales y roles.
export class AuthenticationService {
  static autenticar(email, password) {
    return UsuarioRepository.autenticar(email, password);
  }

  // Verifica si un usuario tiene un permiso específico, devolviendo true si lo tiene o si es administrador.
  static esAdministrador(usuario) {
    return UsuarioRepository.esAdministrador(usuario);
  }
}
