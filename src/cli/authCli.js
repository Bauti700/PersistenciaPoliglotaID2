import { ActorRepository, ClienteRepository, ProveedorRepository, OperadorRepository } from '../repositories/actorRepository.js';
import { FacturaRepository } from '../repositories/facturaRepository.js';
import { PagoRepository } from '../repositories/pagoRepository.js';
import { CuentaCorrienteRepository } from '../repositories/cuentaCorrienteRepository.js';
import { ReporteComercialRepository } from '../repositories/reporteComercialRepository.js';
import { ContenedorRepository } from '../repositories/contenedorRepository.js';
import { ContenedorAssignmentService } from '../services/contenedorAssignmentService.js';
import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { SensorRepository } from '../repositories/sensorRepository.js';
import { LecturaRepository } from '../repositories/lecturaRepository.js';
import { IncidenteRepository, TIPOS_INCIDENTE, ESTADOS_INCIDENTE } from '../repositories/incidenteRepository.js';
import { AlertaRepository } from '../repositories/alertaRepository.js';
import { MensajeRepository } from '../repositories/mensajeRepository.js';
import { UsuarioRepository } from '../repositories/usuarioRepository.js';
import { SesionRepository } from '../repositories/sesionRepository.js';
import { EnvioRepository } from '../repositories/envioRepository.js';
import { AuthenticationService } from '../services/authenticationService.js';

export async function login(context) {
  console.log('\n==================== AUTENTICACIÓN ====================');
  console.log('Ingrese sus credenciales para acceder al sistema');
  console.log('====================================================\n');
  let intentos = 0;
  while (!context.currentUser && intentos < 3) {
    const email = (await context.ask('Email: ')).trim();
    if (!email) {
      console.log('Email requerido\n');
      intentos++;
      continue;
    }
    const password = (await context.ask('Contraseña: ')).trim();
    if (!password) {
      console.log('Contraseña requerida\n');
      intentos++;
      continue;
    }
    
    try {
      const user = await AuthenticationService.autenticar(email, password);
      if (!user) {
        console.log('Credenciales inválidas o usuario bloqueado.\n');
        intentos++;
        continue;
      }
      
      context.currentUser = user;
      
      try {
        const sesion = await SesionRepository.crearSesion({
          id_usuario: user.id_usuario,
          email: user.email,
          id_rol: user.id_rol,
          ip: '127.0.0.1',
          ttl: 3600
        });
        context.currentUser = { ...user, token: sesion.token };
      } catch (e) {
        console.warn(`[Aviso] No se pudo registrar la sesión en Redis/PostgreSQL: ${e.message}`);
      }
      
      console.log(`\nBienvenido/a: ${user.nombre} ${user.apellido} | Rol: ${user.rol_descripcion || 'N/A'} | Estado: ${user.estado}`);
      console.log('====================================================\n');
    } catch (e) {
      console.log(`Error de autenticación: ${e.message}\n`);
      intentos++;
    }
  }
  
  if (!context.currentUser) {
    console.log('Demasiados intentos fallidos. Cerrando aplicación...');
    process.exit(0);
  }
}
