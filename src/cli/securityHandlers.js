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

import { menuABMEntidad } from './entityMenu.js';
import { parsearIdsContenedores } from './cliHelpers.js';
import { formatDate, formatTableRows } from './cliFormatters.js';

export async function handleOption17({ ask, currentUser }) {
  if (!AuthenticationService.esAdministrador(currentUser)) {
    console.log('\n[ACCESO DENEGADO] Solo usuarios administradores pueden acceder a Gestión de Usuarios, Roles y Sesiones.');
    return;
  }

  let salirSeguridad = false;
  while (!salirSeguridad) {
    console.log('\n--- SEGURIDAD: ABM USUARIOS, ROLES Y SESIONES ---');
    console.log('1. Gestionar Roles');
    console.log('2. Gestionar Usuarios');
    console.log('3. Gestionar Sesiones e Historial');
    console.log('0. Volver');
    const segOpt = (await ask('Opción (0-3): ')).trim();

    if (segOpt === '0') {
      salirSeguridad = true;
    } else if (segOpt === '1') {
      let salirRoles = false;
      while (!salirRoles) {
        console.log('\n--- GESTIÓN DE ROLES ---');
        console.log('1. Crear Rol');
        console.log('2. Listar Roles');
        console.log('3. Editar Rol (descripción, nivel y permisos)');
        console.log('4. Activar Rol');
        console.log('5. Desactivar Rol');
        console.log('6. Eliminar Rol');
        console.log('0. Volver');
        const rolOpt = (await ask('Opción (0-6): ')).trim();

        if (rolOpt === '0') {
          salirRoles = true;
        } else if (rolOpt === '1') {
          const descripcion = await ask('Descripción del Rol: ');
          const nivel = await ask('Nivel de permisos (1-10) [1]: ') || '1';
          const permisosStr = await ask('Permisos JSON (ej: {"envios":true,"alertas":true}) [ {} ]: ') || '{}';
          const rol = await UsuarioRepository.crearRol({
            descripcion,
            nivel_permisos: Number(nivel),
            permisos: permisosStr
          });
          console.log('\nRol creado:', rol);
        } else if (rolOpt === '2') {
          const roles = await UsuarioRepository.listarRoles();
          console.table(roles.map(r => ({
            ID: r.id_rol,
            Descripcion: r.descripcion,
            Nivel: r.nivel_permisos,
            Estado: r.estado,
            Usuarios: r.cantidad_usuarios,
            Permisos: JSON.stringify(r.permisos || {})
          })));
        } else if (rolOpt === '3') {
          const id_rol = await ask('ID Rol a editar: ');
          const actual = await UsuarioRepository.obtenerRolPorId(Number(id_rol));
          if (!actual) {
            console.log('Rol no encontrado.');
            continue;
          }
          console.log('Presione ENTER para mantener el valor actual:');
          const descripcion = (await ask(`Descripción [${actual.descripcion}]: `)).trim();
          const nivel = (await ask(`Nivel de permisos [${actual.nivel_permisos}]: `)).trim();
          const permisosStr = (await ask(`Permisos JSON [${JSON.stringify(actual.permisos || {})}]: `)).trim();
          const datos = {};
          if (descripcion) datos.descripcion = descripcion;
          if (nivel) datos.nivel_permisos = Number(nivel);
          if (permisosStr) datos.permisos = permisosStr;
          const rol = await UsuarioRepository.actualizarRol(Number(id_rol), datos);
          console.log(rol ? '\nRol actualizado:' : '\nRol no encontrado', rol || '');
        } else if (rolOpt === '4') {
          const id_rol = await ask('ID Rol a activar: ');
          const rol = await UsuarioRepository.activarRol(Number(id_rol));
          console.log(rol ? '\nRol activado:' : '\nRol no encontrado', rol || '');
        } else if (rolOpt === '5') {
          const id_rol = await ask('ID Rol a desactivar: ');
          const rol = await UsuarioRepository.desactivarRol(Number(id_rol));
          console.log(rol ? '\nRol desactivado:' : '\nRol no encontrado', rol || '');
        } else if (rolOpt === '6') {
          const id_rol = await ask('ID Rol a eliminar DEFINITIVAMENTE: ');
          const conf = (await ask(`¿Eliminar el rol "${id_rol}"? No debe tener usuarios asignados. (s/n): `)).trim().toLowerCase();
          if (conf === 's') {
            try {
              const rol = await UsuarioRepository.eliminarRol(Number(id_rol));
              console.log(rol ? '\nRol eliminado:' : '\nRol no encontrado', rol || '');
            } catch (error) {
              console.log(`\n[No se pudo eliminar] ${error.message}`);
            }
          } else {
            console.log('Operación cancelada.');
          }
        } else {
          console.log('Opción inválida.');
        }
      }
    } else if (segOpt === '2') {
      let salirUsuarios = false;
      while (!salirUsuarios) {
        console.log('\n--- GESTIÓN DE USUARIOS ---');
        console.log('1. Crear Usuario');
        console.log('2. Listar Usuarios');
        console.log('3. Editar Usuario (datos, rol, estado y contraseña)');
        console.log('4. Cambiar Rol');
        console.log('5. Bloquear Usuario');
        console.log('6. Activar Usuario');
        console.log('7. Eliminar Usuario');
        console.log('0. Volver');
        const usrOpt = (await ask('Opción (0-7): ')).trim();

        if (usrOpt === '0') {
          salirUsuarios = true;
        } else if (usrOpt === '1') {
          const roles = await UsuarioRepository.listarRoles({ soloActivos: true });
          console.table(formatTableRows(roles));
          const nombre = await ask('Nombre: ');
          const apellido = await ask('Apellido: ');
          const email = await ask('Email: ');
          const password = await ask('Contraseña (mínimo 6 caracteres): ');
          const id_rol = await ask('ID Rol: ');
          const id_cliente = await ask('ID Cliente (opcional, ENTER para omitir): ') || null;
          const user = await UsuarioRepository.crearUsuario({
            nombre, apellido, email, password,
            id_rol: Number(id_rol),
            id_cliente: id_cliente ? Number(id_cliente) : null
          });
          console.log('\nUsuario creado:', user);
        } else if (usrOpt === '2') {
          const usuarios = await UsuarioRepository.listarUsuarios();
          console.table(usuarios.map(u => ({
            ID: u.id_usuario,
            Nombre: `${u.nombre} ${u.apellido}`,
            Email: u.email,
            ID_Cliente: u.id_cliente || '-',
            Rol: u.rol_descripcion,
            Nivel: u.nivel_permisos,
            Estado: u.estado,
            Sesion_Activa: u.sesion_activa ? 'SI' : 'NO',
            Ultimo_Acceso: formatDate(u.fecha_ultimo_acceso)
          })));
        } else if (usrOpt === '3') {
          const id_usuario = await ask('ID Usuario a editar: ');
          const user = await UsuarioRepository.obtenerUsuarioPorId(Number(id_usuario));
          if (!user) {
            console.log('Usuario no encontrado.');
            continue;
          }
          console.log('Presione ENTER para mantener el valor actual:');
          const nombre = (await ask(`Nombre [${user.nombre}]: `)).trim();
          const apellido = (await ask(`Apellido [${user.apellido}]: `)).trim();
          const email = (await ask(`Email [${user.email}]: `)).trim();
          const id_rol = (await ask(`ID Rol [${user.id_rol}]: `)).trim();
          const id_cliente = (await ask(`ID Cliente [${user.id_cliente || '-'}] ("-" limpia): `)).trim();
          const estado = (await ask(`Estado (ACTIVO/INACTIVO/BLOQUEADO) [${user.estado}]: `)).trim();
          const password = (await ask('Nueva contraseña (ENTER para mantener): ')).trim();

          const datos = {};
          if (nombre) datos.nombre = nombre;
          if (apellido) datos.apellido = apellido;
          if (email) datos.email = email;
          if (id_rol) datos.id_rol = Number(id_rol);
          if (id_cliente === '-') datos.id_cliente = null;
          else if (id_cliente) datos.id_cliente = Number(id_cliente);
          if (estado) datos.estado = estado;
          if (password) datos.password = password;

          const actualizado = await UsuarioRepository.actualizarUsuario(Number(id_usuario), datos);
          console.log(actualizado ? '\nUsuario actualizado:' : '\nUsuario no encontrado', actualizado || '');
        } else if (usrOpt === '4') {
          const id_usuario = await ask('ID Usuario: ');
          const roles = await UsuarioRepository.listarRoles({ soloActivos: true });
          console.table(formatTableRows(roles));
          const id_rol = await ask('Nuevo ID Rol: ');
          const user = await UsuarioRepository.cambiarRol(Number(id_usuario), Number(id_rol));
          console.log(user ? '\nRol actualizado:' : '\nUsuario no encontrado', user || '');
        } else if (usrOpt === '5') {
          const id_usuario = await ask('ID Usuario a bloquear: ');
          const user = await UsuarioRepository.bloquearUsuario(Number(id_usuario));
          console.log(user ? '\nUsuario bloqueado:' : '\nUsuario no encontrado', user || '');
        } else if (usrOpt === '6') {
          const id_usuario = await ask('ID Usuario a activar: ');
          const user = await UsuarioRepository.activarUsuario(Number(id_usuario));
          console.log(user ? '\nUsuario activado:' : '\nUsuario no encontrado', user || '');
        } else if (usrOpt === '7') {
          const id_usuario = await ask('ID Usuario a eliminar DEFINITIVAMENTE: ');
          const conf = (await ask(
            `¿Eliminar el usuario "${id_usuario}"? Se eliminará también su historial de sesiones por cascada. (s/n): `
          )).trim().toLowerCase();
          if (conf === 's') {
            try {
              if (currentUser && Number(currentUser.id_usuario) === Number(id_usuario)) {
                throw new Error('No puede eliminar el usuario con el que está autenticado.');
              }
              const user = await UsuarioRepository.eliminarUsuario(Number(id_usuario));
              console.log(user ? '\nUsuario eliminado:' : '\nUsuario no encontrado', user || '');
            } catch (error) {
              console.log(`\n[No se pudo eliminar] ${error.message}`);
            }
          } else {
            console.log('Operación cancelada.');
          }
        } else {
          console.log('Opción inválida.');
        }
      }
    } else if (segOpt === '3') {
      let salirSesiones = false;
      while (!salirSesiones) {
        console.log('\n--- SESIONES E HISTORIAL ---');
        console.log('1. Listar sesiones activas');
        console.log('2. Cerrar sesión específica');
        console.log('3. Cerrar todas las sesiones de un usuario');
        console.log('4. Cerrar todas las sesiones activas');
        console.log('5. Consultar historial de sesiones');
        console.log('0. Volver');
        const sesOpt = (await ask('Opción (0-5): ')).trim();

        if (sesOpt === '0') {
          salirSesiones = true;
        } else if (sesOpt === '1') {
          const sesiones = await SesionRepository.listarSesionesActivas();
          console.log(`\nSesiones activas: ${sesiones.length}`);
          if (sesiones.length > 0) {
            console.table(sesiones.map(s => ({
              Token: s.token.substring(0, 8) + '...',
              ID_Usuario: s.id_usuario,
              Email: s.email,
              ID_Rol: s.id_rol,
              IP: s.ip || '-',
              Inicio: formatDate(s.fecha_inicio),
              Ultimo_Acceso: s.ultimo_acceso,
              TTL_seg: s.ttl_segundos
            })));
          }
        } else if (sesOpt === '2') {
          const token = (await ask('Token completo o prefijo: ')).trim();
          if (!token) {
            console.log('Token requerido.');
            continue;
          }
          const sesiones = await SesionRepository.listarSesionesActivas();
          const encontrada = sesiones.find(s => s.token.startsWith(token) || s.token === token);
          if (!encontrada) {
            console.log('Sesión no encontrada.');
            continue;
          }
          const res = await SesionRepository.cerrarSesion(encontrada.token);
          console.log(res ? '\nSesión cerrada correctamente' : '\nNo se pudo cerrar la sesión');
        } else if (sesOpt === '3') {
          const id_usuario = await ask('ID Usuario: ');
          const cantidad = await SesionRepository.cerrarSesionesUsuario(Number(id_usuario));
          console.log(`\nSesiones cerradas: ${cantidad}`);
        } else if (sesOpt === '4') {
          const conf = (await ask('¿Confirma cerrar TODAS las sesiones activas? (s/n): ')).toLowerCase();
          if (conf === 's') {
            const cantidad = await SesionRepository.cerrarTodas();
            console.log(`\nSesiones cerradas: ${cantidad}`);
          } else {
            console.log('Operación cancelada');
          }
        } else if (sesOpt === '5') {
          const id_usuario = (await ask('ID Usuario (opcional): ')).trim() || null;
          const estado = (await ask('Estado (ACTIVA/CERRADA/EXPIRADA, ENTER todos): ')).trim() || null;
          const limite = (await ask('Cantidad máxima de registros [50]: ')).trim() || '50';
          const historial = await SesionRepository.listarHistorialSesiones({
            id_usuario,
            estado,
            limite: Number(limite)
          });
          if (historial.length === 0) {
            console.log('No se encontraron registros en el historial.');
          } else {
            console.table(historial.map(h => ({
              ID: h.id_sesion,
              Usuario: `${h.nombre} ${h.apellido}`,
              Email: h.email,
              Rol: h.rol_descripcion || '-',
              Token: h.token ? h.token.substring(0, 8) + '...' : '-',
              Inicio: formatDate(h.fecha_inicio),
              Fin: formatDate(h.fecha_fin),
              Ultima_Actividad: formatDate(h.fecha_ultima_actividad),
              Estado: h.estado
            })));
          }
        } else {
          console.log('Opción inválida.');
        }
      }
    } else {
      console.log('Opción inválida.');
    }
  }
}
