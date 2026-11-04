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

import { menuABMEntidad } from './entityMenu.js';
import { parsearIdsContenedores } from './cliHelpers.js';
import { formatDate } from './cliFormatters.js';

export async function handleOption7({ ask, currentUser }) {
            let volverMensajeria = false;
            while (!volverMensajeria) {
              console.log(`
  --- MENSAJERÍA Y CHAT ---
  Usuario autenticado: ${currentUser.email}
    1. Ver historial de conversación privada
    2. Enviar mensaje privado
    3. Ver grupos de trabajo disponibles
    4. Ver historial de un grupo
    5. Enviar mensaje a un grupo
    0. Volver al menú principal
  `);
              const optMensaje = (await ask('Opción (0-5): ')).trim();

              try {
                if (optMensaje === '0') {
                  volverMensajeria = true;
                } else if (optMensaje === '1') {
                  const otro = (await ask('Email del otro participante: ')).trim();
                  const mensajes = await MensajeRepository.obtenerMensajes(currentUser.email, otro);
                  console.log(`\nHistorial de mensajes entre ${currentUser.email} y ${otro}:`);
                  if (mensajes.length === 0) {
                    console.log('No hay mensajes previos.');
                  } else {
                    console.table(mensajes.map(m => ({
                      De: m.remitente,
                      Para: m.destinatario,
                      Fecha: formatDate(m.fecha),
                      Mensaje: m.contenido
                    })));
                  }
                } else if (optMensaje === '2') {
                  const destinatario = (await ask('Email del destinatario: ')).trim();
                  const contenido = await ask('Mensaje a enviar: ');
                  const res = await MensajeRepository.enviarMensajePrivado({
                    remitente: currentUser.email,
                    destinatario,
                    contenido
                  });
                  console.log(`\nMensaje privado enviado correctamente. ID: ${res.id_mensaje}`);
                } else if (optMensaje === '3') {
                  const grupos = await MensajeRepository.listarGrupos(currentUser.email);
                  if (grupos.length === 0) {
                    console.log('No pertenecés a ningún grupo de trabajo.');
                  } else {
                    console.log('\nGrupos de trabajo disponibles:');
                    console.table(grupos.map(g => ({
                      ID: g.id_grupo,
                      Nombre: g.nombre,
                      Integrantes: (g.integrantes || []).join(', ')
                    })));
                  }
                } else if (optMensaje === '4') {
                  const id_grupo = (await ask('ID del grupo (ej: GRP-01): ')).trim();
                  const mensajes = await MensajeRepository.obtenerMensajesGrupales(id_grupo);
                  console.log(`\nHistorial del grupo ${id_grupo.toUpperCase()}:`);
                  if (mensajes.length === 0) {
                    console.log('No hay mensajes previos en el grupo.');
                  } else {
                    console.table(mensajes.map(m => ({
                      De: m.remitente,
                      Fecha: formatDate(m.fecha),
                      Mensaje: m.contenido
                    })));
                  }
                } else if (optMensaje === '5') {
                  const grupos = await MensajeRepository.listarGrupos(currentUser.email);
                  if (grupos.length === 0) {
                    console.log('No pertenecés a ningún grupo de trabajo.');
                  } else {
                    console.log('\nGrupos de trabajo disponibles:');
                    console.table(grupos.map(g => ({
                      ID: g.id_grupo,
                      Nombre: g.nombre,
                      Integrantes: (g.integrantes || []).join(', ')
                    })));
                    const id_grupo = (await ask('ID del grupo destinatario: ')).trim();
                    const contenido = await ask('Mensaje a enviar: ');
                    const res = await MensajeRepository.enviarMensajeGrupal({
                      remitente: currentUser.email,
                      id_grupo,
                      contenido
                    });
                    console.log(`\nMensaje grupal enviado al grupo ${res.id_grupo}. ID: ${res.id_mensaje}`);
                  }
                } else {
                  console.log('Opción inválida.');
                }
              } catch (error) {
                console.error(`\n[Error de mensajería]: ${error.message}`);
              }
            }
}
