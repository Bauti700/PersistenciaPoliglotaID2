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

export async function handleOption11({ ask, currentUser }) {
  let salirEnvios = false;
  while (!salirEnvios) {
    console.log('\n--- ABM DE ENVÍOS (PostgreSQL + Neo4j + MongoDB + Redis) ---');
    console.log('1. Listar envíos (con filtros)');
    console.log('2. Consultar envío por ID');
    console.log('3. Crear envío políglota');
    console.log('4. Modificar datos del envío');
    console.log('5. Cambiar estado del envío');
    console.log('6. Cancelar envío');
    console.log('7. Eliminar envío definitivamente');
    console.log('8. Asignar contenedor a envío');
    console.log('9. Asignar sensor a contenedor/envío');
    console.log('10. Ver eventos logísticos del envío (MongoDB)');
    console.log('0. Volver');
    const opEnv = (await ask('Opción (0-10): ')).trim();

    if (opEnv === '0') {
      salirEnvios = true;
    } else if (opEnv === '1') {
      const estado = (await ask('Estado (CREADO/EN_TRANSITO/ENTREGADO/RETRASADO/CANCELADO, ENTER todos): ')).trim() || null;
      const id_cliente = (await ask('ID Cliente (opcional): ')).trim() || null;
      const prioridad = (await ask('Prioridad (BAJA/MEDIA/ALTA/URGENTE, ENTER todas): ')).trim() || null;
      const envios = await EnvioRepository.listarTodos({
        estado,
        id_cliente: id_cliente ? Number(id_cliente) : null,
        prioridad
      });
      if (envios.length === 0) {
        console.log('No se encontraron envíos con esos filtros.');
      } else {
        console.table(envios.map(e => ({
          ID: e.id_envio,
          Cliente: e.cliente,
          Origen: e.origen,
          Destino: e.destino,
          Estado: e.estado,
          Prioridad: e.prioridad,
          Tramos: e.cantidad_tramos,
          Contenedores: `${e.cantidad_contenedores} (${e.contenedores_activos} activos)`,
          Creacion: e.fecha_creacion,
          Entrega: e.fecha_entrega || '-'
        })));
      }
    } else if (opEnv === '2') {
      const id_envio = await ask('ID Envío: ');
      const envio = await EnvioRepository.obtenerPorId(id_envio);
      if (!envio) {
        console.log('Envío no encontrado.');
      } else {
        console.log('\nDatos del envío:');
        console.table([{
          ID: envio.id_envio,
          Cliente: envio.cliente,
          Origen: envio.origen,
          Destino: envio.destino,
          Estado: envio.estado,
          Prioridad: envio.prioridad,
          Creacion: envio.fecha_creacion,
          Entrega: envio.fecha_entrega || '-'
        }]);
        if (envio.tramos.length > 0) {
          console.log('\nTramos:');
          console.table(envio.tramos);
        }
        if (envio.contenedores.length > 0) {
          console.log('\nContenedores del envío:');
          console.table(envio.contenedores.map(c => ({
            ID: c.id_contenedor,
            Tipo: c.tipo,
            Estado: c.estado,
            Asignado: c.fecha_asignacion,
            Liberado: c.fecha_liberacion || '-'
          })));
        } else {
          console.log('\n[AVISO] El envío no tiene contenedores asociados.');
        }
      }
    } else if (opEnv === '3') {
      const id_envio = await ask('Código Envío (ej: ENV-2005): ') || `ENV-${Date.now().toString().slice(-6)}`;
      const id_cliente = await ask('ID Cliente (ej: 1): ') || '1';
      const origen = await ask('Ciudad Origen: ') || 'Buenos Aires';
      const destino = await ask('Ciudad Destino: ') || 'Montevideo';
      const prioridad = (await ask('Prioridad (BAJA/MEDIA/ALTA/URGENTE) [MEDIA]: ')).trim() || 'MEDIA';
      const operador = (await ask('Empresa Operadora (opcional): ')).trim() || null;
      const vehiculo = (await ask('Vehículo Patente (opcional): ')).trim() || null;
      const medio = (await ask('Medio de transporte del tramo principal [Terrestre]: ')).trim() || 'Terrestre';

      const contenedoresRegistrados = await ContenedorRepository.listarTodos();
      const contenedoresElegibles = contenedoresRegistrados
        .filter(c => c.estado === 'DISPONIBLE');
      if (contenedoresElegibles.length === 0) {
        console.log('\n[No se pudo crear el envío] No hay contenedores disponibles.');
        continue;
      }
      console.log('\nContenedores elegibles (el envío requiere al menos uno):');
      console.table(contenedoresElegibles.map(c => ({
        ID: c.id_contenedor,
        Tipo: c.tipo,
        Capacidad: c.capacidad,
        Estado: c.estado
      })));
      const contenedores = parsearIdsContenedores(
        await ask('IDs de contenedores separados por coma: ')
      );
      if (contenedores.length === 0) {
        console.log('\n[No se pudo crear el envío] Debe indicar al menos un contenedor.');
        continue;
      }

      try {
        const res = await LogisticsService.crearEnvioPoliglota({
          id_envio,
          id_cliente: Number(id_cliente),
          origen,
          destino,
          prioridad,
          operador,
          vehiculo,
          contenedores,
          tramos: [{ desde: origen, hasta: destino, medio }]
        });
        console.log('\nEnvío creado y propagado exitosamente:');
        console.log(res);
      } catch (error) {
        console.log(`\n[No se pudo crear el envío] ${error.message}`);
      }
    } else if (opEnv === '4') {
      const id_envio = await ask('ID Envío a modificar: ');
      const envio = await EnvioRepository.obtenerPorId(id_envio);
      if (!envio) {
        console.log('Envío no encontrado.');
        continue;
      }
      console.log('Presione ENTER para mantener el valor actual (el estado se cambia en la opción 5):');
      const origen = (await ask(`Origen [${envio.origen}]: `)).trim();
      const destino = (await ask(`Destino [${envio.destino}]: `)).trim();
      const prioridad = (await ask(`Prioridad [${envio.prioridad}]: `)).trim();
      const fecha_entrega = (await ask(`Fecha entrega [${envio.fecha_entrega || '-'}] (YYYY-MM-DD, "-" limpia): `)).trim();

      const cambios = {};
      if (origen) cambios.origen = origen;
      if (destino) cambios.destino = destino;
      if (prioridad) cambios.prioridad = prioridad;
      if (fecha_entrega === '-') cambios.fecha_entrega = null;
      else if (fecha_entrega) cambios.fecha_entrega = fecha_entrega;

      if (Object.keys(cambios).length === 0) {
        console.log('No se indicaron cambios.');
        continue;
      }
      try {
        const res = await LogisticsService.actualizarEnvio(id_envio, cambios);
        console.log('\nEnvío actualizado:', res);
      } catch (error) {
        console.log(`\n[No se pudo actualizar] ${error.message}`);
      }
    } else if (opEnv === '5') {
      const id_envio = await ask('ID Envío: ');
      console.log('Estados válidos: CREADO, EN_TRANSITO, ENTREGADO, RETRASADO, CANCELADO');
      const estado = await ask('Nuevo estado: ');
      try {
        const res = await LogisticsService.cambiarEstadoEnvio(id_envio, estado);
        console.log('\nEstado actualizado:', res);
      } catch (error) {
        console.log(`\n[No se pudo cambiar el estado] ${error.message}`);
      }
    } else if (opEnv === '6') {
      const id_envio = await ask('ID Envío a cancelar: ');
      const conf = (await ask(
        `¿Cancelar el envío "${id_envio}"? Se liberarán sus contenedores. (s/n): `
      )).trim().toLowerCase();
      if (conf === 's') {
        try {
          const res = await LogisticsService.cancelarEnvio(id_envio);
          console.log('\nEnvío cancelado:', res);
        } catch (error) {
          console.log(`\n[No se pudo cancelar] ${error.message}`);
        }
      } else {
        console.log('Operación cancelada.');
      }
    } else if (opEnv === '7') {
      const id_envio = await ask('ID Envío a eliminar DEFINITIVAMENTE: ');
      const conf = (await ask(
        `¿Eliminar físicamente el envío "${id_envio}"? No se permite si tiene facturas emitidas. (s/n): `
      )).trim().toLowerCase();
      if (conf === 's') {
        try {
          const res = await LogisticsService.eliminarEnvio(id_envio);
          console.log('\nEnvío eliminado:', res);
        } catch (error) {
          console.log(`\n[No se pudo eliminar] ${error.message}`);
        }
      } else {
        console.log('Operación cancelada.');
      }
    } else if (opEnv === '8') {
      const id_envio = await ask('ID Envío: ');
      const contenedoresRegistrados = await ContenedorRepository.listarTodos();
      const contenedoresElegibles = contenedoresRegistrados
        .filter(c => c.estado === 'DISPONIBLE');
      if (contenedoresElegibles.length === 0) {
        console.log('\nNo hay contenedores DISPONIBLES para asignar.');
        continue;
      }
      console.log('\nContenedores elegibles:');
      console.table(contenedoresElegibles.map(c => ({
        ID: c.id_contenedor,
        Tipo: c.tipo,
        Capacidad: c.capacidad
      })));
      const id_contenedor = await ask('ID Contenedor: ');
      try {
        const res = await LogisticsService.asignarContenedorAEnvio({ id_envio, id_contenedor });
        console.log('\nContenedor asignado al envío:', res);
      } catch (error) {
        console.log(`\n[No se pudo asignar] ${error.message}`);
      }
    } else if (opEnv === '9') {
      const id_envio = await ask('ID Envío: ');
      const id_contenedor = await ask('ID Contenedor: ');
      const id_sensor = await ask('ID Sensor: ');
      try {
        const res = await LogisticsService.asignarSensorAContenedorEnvio({
          id_envio,
          id_contenedor,
          id_sensor
        });
        console.log('\nSensor asignado a contenedor/envío:', res);
      } catch (error) {
        console.log(`\n[No se pudo asignar] ${error.message}`);
      }
    } else if (opEnv === '10') {
      const id_envio = await ask('ID Envío: ');
      const eventos = await MongoTelemetryRepository.listarEventosPorEnvio(id_envio, 100);
      if (eventos.length === 0) {
        console.log('No hay eventos logísticos registrados para ese envío.');
      } else {
        console.table(eventos.map(e => ({
          ID: e.id_evento,
          Fecha: e.fecha_hora,
          Tipo: e.tipo_evento,
          Ubicacion: e.ubicacion || '-',
          Descripcion: e.descripcion || '-'
        })));
      }
    } else {
      console.log('Opción inválida.');
    }
  }
}
