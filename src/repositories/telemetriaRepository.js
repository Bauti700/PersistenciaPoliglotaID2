import { SensorRepository } from './sensorRepository.js';
import { LecturaRepository } from './lecturaRepository.js';
import { IncidenteRepository } from './incidenteRepository.js';
import { AlertaRepository } from './alertaRepository.js';
import { MensajeRepository } from './mensajeRepository.js';
import { ReporteMongoRepository } from './reporteMongoRepository.js';

export class MongoTelemetryRepository {
  // --- SENSORES ---
  static registrarSensor = SensorRepository.registrarSensor;
  static listarSensores = SensorRepository.listarSensores;
  static obtenerSensorPorId = SensorRepository.obtenerSensorPorId;
  static listarSensoresPorContenedor = SensorRepository.listarSensoresPorContenedor;
  static asignarSensorAContenedor = SensorRepository.asignarSensorAContenedor;
  static actualizarSensor = SensorRepository.actualizarSensor;
  static darDeBajaSensor = SensorRepository.darDeBajaSensor;
  static activarSensor = SensorRepository.activarSensor;
  static eliminarSensor = SensorRepository.eliminarSensor;

  // --- LECTURAS ---
  static registrarLecturaSensor = LecturaRepository.registrarLecturaSensor;
  static consultarHistoricoLecturas = LecturaRepository.consultarHistoricoLecturas;
  static consultarHistoricoPorContenedor = LecturaRepository.consultarHistoricoPorContenedor;
  static detectarAnomaliasTemperatura = LecturaRepository.detectarAnomaliasTemperatura;

  // --- INCIDENTES ---
  static registrarIncidente = IncidenteRepository.registrarIncidente;
  static listarIncidentesAbiertos = IncidenteRepository.listarIncidentesAbiertos;
  static listarIncidentesPorEnvio = IncidenteRepository.listarIncidentesPorEnvio;
  static cerrarIncidente = IncidenteRepository.cerrarIncidente;
  static obtenerIncidentesPorEnvio = IncidenteRepository.obtenerIncidentesPorEnvio;

  // --- ALERTAS Y REGLAS ---
  static crearRegla = AlertaRepository.crearRegla;
  static listarReglas = AlertaRepository.listarReglas;
  static actualizarRegla = AlertaRepository.actualizarRegla;
  static desactivarRegla = AlertaRepository.desactivarRegla;
  static crearAlerta = AlertaRepository.crearAlerta;
  static listarAlertasAbiertas = AlertaRepository.listarAlertasAbiertas;
  static listarAlertasPorTipo = AlertaRepository.listarAlertasPorTipo;
  static cerrarAlerta = AlertaRepository.cerrarAlerta;
  static detectarAlertasEstadoSensores = AlertaRepository.detectarAlertasEstadoSensores;

  // --- MENSAJERÍA ---
  static enviarMensaje = MensajeRepository.enviarMensaje;
  static obtenerMensajes = MensajeRepository.obtenerMensajes;
  static listarMensajesPorGrupo = MensajeRepository.listarMensajesPorGrupo;

  // --- REPORTES ---
  static registrarReporte = ReporteMongoRepository.registrarReporte;
  static listarReportes = ReporteMongoRepository.listarReportes;
  static obtenerReportePorId = ReporteMongoRepository.obtenerReportePorId;
}

export { MongoTelemetryRepository as MongoRepository };
