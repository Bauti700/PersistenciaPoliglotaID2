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
import { RedisCacheRepository } from '../repositories/cacheRepository.js';

import { menuABMEntidad } from './entityMenu.js';
import { parsearIdsContenedores } from './cliHelpers.js';

export async function handleOption10({ ask, currentUser }) {
  console.log('\n--- CONSULTA DE POSICIONES GPS EN TIEMPO REAL ---');
  console.log('1. Última posición de un contenedor');
  console.log('2. Listar todas las posiciones cacheadas');
  console.log('3. Contenedores cercanos a una coordenada');
  console.log('0. Volver');
  const optGps = (await ask('Opción (0-3): ')).trim();

  if (optGps === '0') {
    return;
  } else if (optGps === '1') {
    const id_contenedor = await ask('ID Contenedor (ej: CONT-001): ') || 'CONT-001';
    const pos = await RedisCacheRepository.obtenerUltimaPosicion(id_contenedor);
    if (pos) {
      console.log(`\nDatos en memoria caché para ${id_contenedor}:`);
      console.log(pos);
    } else {
      console.log(`No hay información de posición para el contenedor ${id_contenedor}.`);
    }
  } else if (optGps === '2') {
    const posiciones = await RedisCacheRepository.obtenerTodasPosiciones();
    if (posiciones.length === 0) {
      console.log('No hay posiciones de contenedores en caché.');
    } else {
      console.table(posiciones.map(p => ({
        Contenedor: p.id_contenedor,
        Latitud: p.latitud,
        Longitud: p.longitud,
        Envio: p.id_envio || '-',
        Sensor: p.id_sensor || '-',
        Actualizado: p.actualizado_en || '-'
      })));
    }
  } else if (optGps === '3') {
    const longitud = (await ask('Longitud de referencia (ej: -58.3816): ')).trim();
    const latitud = (await ask('Latitud de referencia (ej: -34.6037): ')).trim();
    const radioKm = (await ask('Radio en km [100]: ')).trim() || '100';
    const cercanos = await RedisCacheRepository.obtenerPosicionesCercanas(
      longitud,
      latitud,
      radioKm
    );
    if (cercanos.length === 0) {
      console.log('No se encontraron contenedores dentro del radio indicado.');
    } else {
      console.log(`\nContenedores a menos de ${radioKm} km:`);
      console.table(cercanos.map(p => ({
        Contenedor: p.id_contenedor,
        Latitud: p.latitud,
        Longitud: p.longitud,
        Envio: p.id_envio || '-',
        Sensor: p.id_sensor || '-',
        Actualizado: p.actualizado_en || '-'
      })));
    }
  } else {
    console.log('Opción inválida.');
  }
}
