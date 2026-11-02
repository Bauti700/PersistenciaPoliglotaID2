import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { RedisCacheRepository } from '../repositories/cacheRepository.js';
import { AlertaRepository } from '../repositories/alertaRepository.js';
import { IncidenteRepository } from '../repositories/incidenteRepository.js';
import { SensorRepository } from '../repositories/sensorRepository.js';
import { ContenedorRepository } from '../repositories/contenedorRepository.js';
import {
  textoRequerido,
  numeroPositivo,
  errorValidacion
} from '../utils/validation.js';

export class MonitoreoService {
  static async validarLectura(data) {
    const id_sensor = textoRequerido(data.id_sensor, 'id_sensor', { max: 50 });
    const id_contenedor = textoRequerido(data.id_contenedor, 'id_contenedor', { max: 50 });
    const id_envio = data.id_envio
      ? textoRequerido(data.id_envio, 'id_envio', { max: 50 })
      : null;

    const sensor = await SensorRepository.obtenerSensorPorId(id_sensor);
    if (!sensor) {
      throw errorValidacion(`El sensor ${id_sensor} no existe en MongoDB.`, 404);
    }
    if (sensor.estado !== 'ACTIVO') {
      throw errorValidacion(`El sensor ${id_sensor} está inactivo y no puede transmitir lecturas.`, 409);
    }
    if (sensor.id_contenedor && sensor.id_contenedor !== id_contenedor) {
      throw errorValidacion(
        `El sensor ${id_sensor} está asignado al contenedor ${sensor.id_contenedor}, no a ${id_contenedor}.`,
        409
      );
    }

    const contenedor = await ContenedorRepository.obtenerPorId(id_contenedor);
    if (!contenedor) {
      throw errorValidacion(`El contenedor ${id_contenedor} no existe en PostgreSQL.`, 404);
    }

    return {
      id_sensor,
      id_contenedor,
      id_envio,
      temperatura: numeroPositivo(data.temperatura, 'temperatura', { min: -100, max: 100 }),
      humedad: numeroPositivo(data.humedad, 'humedad', { min: 0, max: 100 }),
      vibracion: data.vibracion !== undefined
        ? numeroPositivo(data.vibracion, 'vibracion', { min: 0, max: 1000 })
        : 0,
      latitud: data.latitud !== undefined && data.latitud !== null && data.latitud !== ''
        ? numeroPositivo(data.latitud, 'latitud', { min: -90, max: 90 })
        : null,
      longitud: data.longitud !== undefined && data.longitud !== null && data.longitud !== ''
        ? numeroPositivo(data.longitud, 'longitud', { min: -180, max: 180 })
        : null,
      nivel_bateria: data.nivel_bateria !== undefined
        ? numeroPositivo(data.nivel_bateria, 'nivel_bateria', { min: 0, max: 100 })
        : 100
    };
  }

  static async procesarLecturaSensor(data) {
    const lecturaValidada = await this.validarLectura(data);

    // 1. Guardar lectura en MongoDB (Documental)
    const lectura = await MongoTelemetryRepository.registrarLecturaSensor(lecturaValidada);

    // 2. Actualizar última posición GPS en Redis (Clave-Valor)
    if (lecturaValidada.latitud !== null && lecturaValidada.longitud !== null) {
      try {
        await RedisCacheRepository.actualizarUltimaPosicion(
          lecturaValidada.id_contenedor,
          lecturaValidada.latitud,
          lecturaValidada.longitud,
          {
            id_envio: lecturaValidada.id_envio,
            id_sensor: lecturaValidada.id_sensor,
            ultima_lectura: new Date().toISOString()
          }
        );
      } catch (error) {
        console.warn(`[Monitoreo] No se pudo actualizar la posición en Redis: ${error.message}`);
      }
    }

    // 3. Evaluar reglas configurables contra la lectura recién ingresada
    const reglas = await AlertaRepository.obtenerReglasActivas();
    const disparos = AlertaRepository.evaluarLectura(lecturaValidada, reglas);
    const alertas = [];
    const incidentes = [];

    for (const disparo of disparos) {
      const alerta = await AlertaRepository.crearAlertaDesdeRegla({
        tipo: disparo.tipo,
        regla: disparo.regla,
        valor: disparo.valor,
        id_sensor: lecturaValidada.id_sensor,
        id_contenedor: lecturaValidada.id_contenedor,
        id_envio: lecturaValidada.id_envio,
        motivo: `UMBRAL_${disparo.tipo}`
      });
      if (alerta) alertas.push(alerta);

      if (disparo.tipo === 'TEMPERATURA') {
        const tipoIncidente = 'EXCESO_TEMPERATURA';
        const yaExiste = await IncidenteRepository.existeIncidenteAbierto({
          id_sensor: lecturaValidada.id_sensor,
          tipo: tipoIncidente
        });
        if (!yaExiste) {
          const incidente = await IncidenteRepository.registrarIncidente({
            id_incidente: `INC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            id_envio: lecturaValidada.id_envio,
            id_sensor: lecturaValidada.id_sensor,
            id_contenedor: lecturaValidada.id_contenedor,
            tipo: tipoIncidente,
            severidad: disparo.regla.severidad === 'CRITICA' ? 'CRITICA' : 'ALTA',
            descripcion:
              `Temperatura ${disparo.valor} °C fuera del umbral configurado ` +
              `(${disparo.regla.condicion} ${disparo.regla.umbral} °C) en contenedor ${lecturaValidada.id_contenedor}.`,
            estado: 'ABIERTO'
          });
          incidentes.push(incidente);
        }
      }
    }

    return {
      lectura,
      alertas_generadas: alertas.length,
      alertas,
      incidentes_generados: incidentes.length,
      incidentes,
      alerta_generada: alertas.length > 0
    };
  }

  static async ejecutarMonitoreoSensores() {
    const alertas = await AlertaRepository.detectarAlertasEstadoSensores();
    return { alertas_generadas: alertas.length, alertas };
  }
}

export { MonitoreoService as monitoreoService };
