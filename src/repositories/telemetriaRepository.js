import { SensorRepository } from './sensorRepository.js';
import { LecturaRepository } from './lecturaRepository.js';
import { IncidenteRepository } from './incidenteRepository.js';
import { AlertaRepository } from './alertaRepository.js';
import { MensajeRepository } from './mensajeRepository.js';
import { ReporteMongoRepository } from './reporteMongoRepository.js';
import { EventoLogisticoRepository } from './eventoLogisticoRepository.js';

export class MongoTelemetryRepository {
  // --- SENSORES ---
  static registrarSensor = SensorRepository.registrarSensor;
  static listarSensores = SensorRepository.listarSensores;
  static obtenerSensorPorId = SensorRepository.obtenerSensorPorId;
  static listarSensoresPorContenedor = SensorRepository.listarSensoresPorContenedor;
  static asignarSensorAContenedor = SensorRepository.asignarSensorAContenedor;
  static desasignarSensorDeContenedor = SensorRepository.desasignarSensorDeContenedor;
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
  static actualizarIncidente = IncidenteRepository.actualizarIncidente;
  static listarIncidentes = IncidenteRepository.listarIncidentes;
  static listarIncidentesAbiertos = IncidenteRepository.listarIncidentesAbiertos;
  static listarIncidentesPorEnvio = IncidenteRepository.listarIncidentesPorEnvio;
  static cerrarIncidente = IncidenteRepository.cerrarIncidente;
  static existeIncidenteAbierto = IncidenteRepository.existeIncidenteAbierto;
  static obtenerIncidentesPorEnvio = IncidenteRepository.obtenerIncidentesPorEnvio;

  // --- ALERTAS Y REGLAS ---
  static crearRegla = AlertaRepository.crearRegla;
  static listarReglas = AlertaRepository.listarReglas;
  static listarReglasEfectivas = AlertaRepository.listarReglasEfectivas;
  static obtenerReglaPorId = AlertaRepository.obtenerReglaPorId;
  static actualizarRegla = AlertaRepository.actualizarRegla;
  static activarRegla = AlertaRepository.activarRegla;
  static desactivarRegla = AlertaRepository.desactivarRegla;
  static eliminarRegla = AlertaRepository.eliminarRegla;
  static crearAlerta = AlertaRepository.crearAlerta;
  static listarAlertasAbiertas = AlertaRepository.listarAlertasAbiertas;
  static listarAlertas = AlertaRepository.listarAlertas;
  static listarAlertasPorTipo = AlertaRepository.listarAlertasPorTipo;
  static cerrarAlerta = AlertaRepository.cerrarAlerta;
  static detectarAlertasEstadoSensores = AlertaRepository.detectarAlertasEstadoSensores;

  // --- EVENTOS LOGÍSTICOS ---
  static registrarEventoLogistico = EventoLogisticoRepository.registrarEventoLogistico;
  static listarEventosPorEnvio = EventoLogisticoRepository.listarEventosPorEnvio;
  static listarEventos = EventoLogisticoRepository.listarEventos;
  static obtenerEventoPorId = EventoLogisticoRepository.obtenerEventoPorId;
  static eliminarEventoLogistico = EventoLogisticoRepository.eliminarEventoLogistico;

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
