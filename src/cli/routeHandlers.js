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
import { Neo4jRouteRepository } from '../repositories/rutaRepository.js';

import { menuABMEntidad } from './entityMenu.js';
import { parsearIdsContenedores } from './cliHelpers.js';
import { formatTableRows } from './cliFormatters.js';

export async function handleOption8({ ask, currentUser }) {
  console.log('\n--- CONSULTA DE RUTA ---');
  console.log('1. Ruta completa de un envío');
  console.log('2. Reconstrucción del recorrido de un contenedor');
  console.log('3. Historial completo de movimientos de un contenedor');
  console.log('4. Volver');
  const subRuta = (await ask('Opción (1-4): ')).trim();

  if (subRuta === '1') {
    const id_envio = await ask('ID del Envío a rastrear (ej: ENV-1001): ') || 'ENV-1001';
    const ruta = await Neo4jRouteRepository.obtenerRutaCompletaEnvio(id_envio);
    if (ruta) {
      console.log(`\nEnvío: ${ruta.envio} | Cliente: ${ruta.cliente}`);
      console.log(`Origen: ${ruta.origen} ===> Destino: ${ruta.destino}`);
      console.log(`Operador Asignado: ${ruta.operador || 'Sin asignar'} | Vehículo: ${ruta.vehiculo || 'Sin asignar'}`);
      console.log('\nTramos del recorrido:');
      console.table(formatTableRows(ruta.tramos));
    } else {
      console.log(`No se encontró el envío ${id_envio} en la base de datos de grafos.`);
    }
  } else if (subRuta === '2') {
    const id_contenedor = await ask('ID Contenedor: ');
    const recorrido = await Neo4jRouteRepository.reconstruirRecorridoContenedor(id_contenedor);
    console.log('\nRecorrido reconstruido:');
    console.table(formatTableRows(recorrido));
  } else if (subRuta === '3') {
    const id_contenedor = await ask('ID Contenedor: ');
    const movimientos = await Neo4jRouteRepository.historialMovimientosContenedor(id_contenedor);
    console.table(formatTableRows(movimientos));
  }
}
