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
import { LogisticsService } from '../services/logisticsService.js';

import { menuABMEntidad } from './entityMenu.js';
import { parsearIdsContenedores } from './cliHelpers.js';

export async function handleOption6({ ask, currentUser }) {
  let salirIncidentes = false;
  while (!salirIncidentes) {
    console.log('\n--- GESTIÓN DE INCIDENTES (MongoDB) ---');
    console.log('1. Listar incidentes con filtros');
    console.log('2. Registrar incidente manual (genera alerta)');
    console.log('3. Cerrar incidente y sus alertas');
    console.log('4. Incidentes agrupados por envío');
    console.log('0. Volver');
    const optIncidente = (await ask('Opción (0-4): ')).trim();

    if (optIncidente === '0') {
      salirIncidentes = true;
    } else if (optIncidente === '1') {
      const estado = (await ask(
        `Estado (${ESTADOS_INCIDENTE.join('/')}, ENTER todos): `
      )).trim() || null;
      const tipo = (await ask(
        `Tipo (${TIPOS_INCIDENTE.join('/')}, ENTER todos): `
      )).trim() || null;
      const id_envio = (await ask('ID Envío (opcional): ')).trim() || null;
      const id_sensor = (await ask('ID Sensor (opcional): ')).trim() || null;
      const id_contenedor = (await ask('ID Contenedor (opcional): ')).trim() || null;
      const limite = (await ask('Cantidad máxima [100]: ')).trim() || '100';

      const incidentes = await IncidenteRepository.listarIncidentes({
        estado,
        tipo,
        id_envio,
        id_sensor,
        id_contenedor,
        limite
      });
      if (incidentes.length === 0) {
        console.log('No se encontraron incidentes con esos filtros.');
      } else {
        console.table(incidentes.map(i => ({
          ID: i.id_incidente,
          Envio: i.id_envio || '-',
          Sensor: i.id_sensor || '-',
          Contenedor: i.id_contenedor || '-',
          Tipo: i.tipo,
          Severidad: i.severidad,
          Estado: i.estado,
          Descripcion: i.descripcion || '-',
          Fecha: i.fecha
        })));
      }
    } else if (optIncidente === '2') {
      const id_incidente = (await ask(
        'ID Incidente (ENTER para generar automáticamente): '
      )).trim() || undefined;
      const id_envio = (await ask('ID Envío asociado (opcional): ')).trim() || null;
      const id_sensor = (await ask('ID Sensor asociado (opcional): ')).trim() || null;
      const id_contenedor = (await ask('ID Contenedor asociado (opcional): ')).trim() || null;
      const tipo = (await ask(
        `Tipo (${TIPOS_INCIDENTE.join('/')}) [OTRO]: `
      )).trim() || 'OTRO';
      const severidad = (await ask('Severidad (BAJA/MEDIA/ALTA/CRITICA) [MEDIA]: ')).trim() || 'MEDIA';
      const descripcion = (await ask('Descripción del incidente: ')).trim() || 'Incidente registrado por operador';
      const ubicacion = (await ask('Ubicación (opcional): ')).trim() || null;

      const resultado = await LogisticsService.registrarIncidenteManual({
        id_incidente,
        id_envio,
        id_sensor,
        id_contenedor,
        tipo,
        severidad,
        descripcion,
        ubicacion
      });
      console.log('\nIncidente registrado:', resultado.incidente);
      console.log(
        resultado.alerta
          ? `Alerta ${resultado.alerta.id_alerta} generada para el incidente.`
          : 'El incidente no generó una alerta nueva (ya existía una alerta abierta).'
      );
    } else if (optIncidente === '3') {
      const abiertos = await IncidenteRepository.listarIncidentes({
        estado: 'ABIERTO',
        limite: 100
      });
      if (abiertos.length > 0) {
        console.table(abiertos.map(i => ({
          ID: i.id_incidente,
          Tipo: i.tipo,
          Severidad: i.severidad,
          Envio: i.id_envio || '-',
          Sensor: i.id_sensor || '-',
          Fecha: i.fecha
        })));
      }
      const id_incidente = await ask('ID Incidente a cerrar: ');
      const resultado = await LogisticsService.cerrarIncidente(id_incidente);
      if (!resultado) {
        console.log('Incidente no encontrado o ya estaba cerrado.');
      } else {
        console.log('\nIncidente cerrado:', resultado.incidente);
        console.log(`Alertas cerradas: ${resultado.alertas_cerradas}`);
      }
    } else if (optIncidente === '4') {
      const agrupados = await IncidenteRepository.obtenerIncidentesPorEnvio();
      if (agrupados.length === 0) {
        console.log('No hay incidentes registrados.');
      } else {
        console.table(agrupados.map(g => ({
          Envio: g._id || 'Sin envío',
          Total: g.total_incidentes,
          Criticos: g.criticos,
          Leves: g.leves,
          Abiertos: g.abiertos,
          Tipos: (g.tipos || []).join(', ')
        })));
      }
    } else {
      console.log('Opción inválida.');
    }
  }
}
