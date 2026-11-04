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
import { AnalyticsService } from '../services/analyticsService.js';

import { menuABMEntidad } from './entityMenu.js';
import { parsearIdsContenedores } from './cliHelpers.js';

export async function handleOption15({ ask, currentUser }) {
  console.log('\n--- RANKING DE RUTAS CON MAYOR CANTIDAD DE INCIDENTES ---');
  const forzar = (await ask('¿Desea forzar el recálculo? (s/n) [n]: ')).toLowerCase() === 's';
  console.log('\nCalculando correlación políglota de rutas e incidentes...');
  const res = await AnalyticsService.rankingRutasConMasIncidentes({ forzarRecalculo: forzar });
  console.log(`[Origen de datos: ${res.origen_datos}] | Rutas evaluadas: ${res.total_rutas_evaluadas}`);

  console.table(res.ranking.map(r => ({
    Ruta: r.ruta,
    Viajes: r.total_viajes,
    Incidentes: r.total_incidentes,
    'Tasa (Inc/Viaje)': r.tasa_incidentes_por_viaje,
    Criticos: r.incidentes_criticos,
    Leves: r.incidentes_leves,
    Abiertos: r.incidentes_abiertos,
    Riesgo: r.nivel_riesgo,
    'Tipos Frecuentes': r.tipos_recurrentes
  })));

  console.log('\nRecomendaciones Operativas por Ruta:');
  res.ranking.forEach(r => {
    console.log(`* [${r.nivel_riesgo}] ${r.ruta}: ${r.recomendacion}`);
  });
}
