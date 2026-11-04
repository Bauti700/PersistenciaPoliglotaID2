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

export async function handleOption16({ ask, currentUser }) {
  console.log('\n--- ANÁLISIS HISTÓRICO DE DESEMPEÑO LOGÍSTICO ---');
  const id_cliente = (await ask('Filtrar por ID Cliente específico (opcional, ENTER para global): ')).trim() || null;
  console.log('\nProcesando análisis de tiempos, puntualidad y costos...');
  const res = await AnalyticsService.analisisHistoricoDesempeno({ id_cliente });

  console.log(`\n[Origen de datos: ${res.origen_datos}]`);
  console.log('\n=== RESUMEN GENERAL DE ENVÍOS ===');
  console.table([res.resumen_general]);

  console.log('\n=== MÉTRICAS DE TIEMPOS DE ENTREGA Y PUNTUALIDAD ===');
  console.table([res.metricas_tiempos_entrega]);

  console.log('\n=== DESEMPEÑO Y TIEMPOS DE ENTREGA POR CLIENTE ===');
  console.table(res.desempeno_por_cliente.map(c => ({
    ID_Cliente: c.id_cliente,
    Cliente: c.cliente,
    Pais: c.pais,
    Envios_Totales: c.total_envios,
    Entregados: c.envios_entregados,
    'Tiempo Prom (días)': c.tiempo_promedio_dias,
    'Tiempo Mín (días)': c.tiempo_minimo_dias,
    'Tiempo Máx (días)': c.tiempo_maximo_dias
  })));

  console.log('\n=== COSTOS Y VOLÚMENES POR MEDIO DE TRANSPORTE ===');
  console.table(res.costos_por_tipo_transporte);

  console.log('\n=== CONFIABILIDAD OPERATIVA POR OPERADOR LOGÍSTICO ===');
  console.table(res.confiabilidad_operadores);

  console.log('\nInforme analítico histórico guardado correctamente.');
}
