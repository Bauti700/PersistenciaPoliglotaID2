import { UsuarioRepository } from '../repositories/usuarioRepository.js';

export class AuthenticationService {
  static autenticar(email, password) {
    return UsuarioRepository.autenticar(email, password);
  }

  static esAdministrador(usuario) {
    return UsuarioRepository.esAdministrador(usuario);
  }
}
