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

export async function handleOption5({ ask, currentUser }) {
  console.log('\n--- HISTÓRICO Y DETECCIÓN DE ANOMALÍAS (MongoDB) ---');
  console.log('1. Histórico por sensor');
  console.log('2. Histórico por contenedor');
  const modo = (await ask('Opción (1-2) [1]: ')).trim() || '1';
  const identificador = modo === '2'
    ? (await ask('ID Contenedor (ej: CONT-001): ')).trim()
    : (await ask('ID Sensor (ej: SENS-101): ')).trim();
  const desde = (await ask('Desde (YYYY-MM-DD, ENTER sin límite): ')).trim() || null;
  const hasta = (await ask('Hasta (YYYY-MM-DD, ENTER sin límite): ')).trim() || null;
  const limite = (await ask('Cantidad máxima de lecturas [10]: ')).trim() || '10';

  const lecturas = modo === '2'
    ? await LecturaRepository.consultarHistoricoPorContenedor(
        identificador,
        limite,
        { desde, hasta }
      )
    : await LecturaRepository.consultarHistoricoLecturas(
        identificador,
        limite,
        { desde, hasta }
      );

  console.log(`\nSe encontraron ${lecturas.length} lecturas:`);
  if (lecturas.length === 0) {
    console.log('No hay lecturas para los filtros indicados.');
  } else {
    console.table(lecturas.map(l => ({
      Sensor: l.id_sensor,
      Contenedor: l.id_contenedor || '-',
      Fecha: l.fecha_hora,
      Temperatura: l.temperatura !== null && l.temperatura !== undefined ? `${l.temperatura} °C` : '-',
      Humedad: l.humedad !== null && l.humedad !== undefined ? `${l.humedad} %` : '-',
      Bateria: l.nivel_bateria !== null && l.nivel_bateria !== undefined ? `${l.nivel_bateria} %` : '-',
      Coords: l.posicion_gps?.coordinates
        ? l.posicion_gps.coordinates.join(', ')
        : '-'
    })));
  }

  const reglaTemperatura = await AlertaRepository.obtenerReglaAplicable('TEMPERATURA');
  if (!reglaTemperatura) {
    console.log(
      '\nLa detección de anomalías de temperatura está desactivada: ' +
      'no hay una regla activa para ese tipo.'
    );
  } else {
    console.log(
      `\nBuscando anomalías de temperatura (${reglaTemperatura.condicion} ` +
      `${reglaTemperatura.umbral}°C según regla ${reglaTemperatura.id_regla})...`
    );
    const anomalias = await LecturaRepository.detectarAnomaliasTemperatura(
      reglaTemperatura.umbral,
      reglaTemperatura.condicion,
      { desde, hasta, limite }
    );
    console.log(`Se detectaron ${anomalias.length} lecturas anómalas:`);
    console.table(anomalias.map(a => ({
      Sensor: a.id_sensor,
      Fecha: a.fecha_hora,
      Temperatura: `${a.temperatura} °C (Alerta)`,
      Contenedor: a.id_contenedor || a.sensor_info?.id_contenedor || 'N/A'
    })));
  }
}

