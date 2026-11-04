import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { PositionCacheRepository } from '../repositories/positionCacheRepository.js';
import { AlertaRepository } from '../repositories/alertaRepository.js';
import { IncidenteRepository } from '../repositories/incidenteRepository.js';
import { SensorRepository } from '../repositories/sensorRepository.js';
import { ContenedorRepository } from '../repositories/contenedorRepository.js';
import { EnvioRepository } from '../repositories/envioRepository.js';
import { Neo4jRouteRepository } from '../repositories/rutaRepository.js';
import { AlertRuleRepository } from '../repositories/alertRuleRepository.js';
import {
  textoRequerido,
  numeroPositivo,
  errorValidacion
} from '../utils/validation.js';

const MAPA_INCIDENTE = {
  TEMPERATURA: 'EXCESO_TEMPERATURA',
  BATERIA: 'BATERIA_BAJA',
  INACTIVIDAD: 'SENSOR_INACTIVO'
};

function numeroOpcional(valor, campo, opciones) {
  if (valor === undefined || valor === null || valor === '') return null;
  return numeroPositivo(valor, campo, opciones);
}

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

    if (id_envio) {
      const envio = await EnvioRepository.obtenerPorId(id_envio);
      if (!envio) {
        throw errorValidacion(`El envío ${id_envio} no existe en PostgreSQL.`, 404);
      }
    }

    return {
      id_sensor,
      id_contenedor,
      id_envio,
      temperatura: numeroOpcional(data.temperatura, 'temperatura', { min: -100, max: 100 }),
      humedad: numeroOpcional(data.humedad, 'humedad', { min: 0, max: 100 }),
      vibracion: numeroOpcional(data.vibracion, 'vibracion', { min: 0, max: 1000 }),
      latitud: numeroOpcional(data.latitud, 'latitud', { min: -90, max: 90 }),
      longitud: numeroOpcional(data.longitud, 'longitud', { min: -180, max: 180 }),
      nivel_bateria: numeroOpcional(data.nivel_bateria, 'nivel_bateria', { min: 0, max: 100 })
    };
  }

  static async crearIncidenteAutomatico({
    tipoAlerta,
    regla = null,
    valor = null,
    id_sensor,
    id_contenedor = null,
    id_envio = null,
    mensaje = null
  }) {
    const tipo = MAPA_INCIDENTE[tipoAlerta];
    if (!tipo) return null;

    const yaExiste = await IncidenteRepository.existeIncidenteAbierto({ id_sensor, tipo });
    if (yaExiste) return null;

    let descripcion = mensaje;
    if (!descripcion) {
      if (tipoAlerta === 'TEMPERATURA') {
        descripcion =
          `Temperatura ${valor} °C fuera del umbral configurado ` +
          `(${regla?.condicion || 'MAYOR_QUE'} ${regla?.umbral ?? ''} °C) en contenedor ${id_contenedor}.`;
      } else if (tipoAlerta === 'BATERIA') {
        descripcion =
          `Batería ${valor}% fuera del umbral configurado ` +
          `(${regla?.condicion || 'MENOR_QUE'} ${regla?.umbral ?? ''}%) en el sensor ${id_sensor}.`;
      } else {
        descripcion =
          `Sensor ${id_sensor} sin transmisión durante ${valor} h ` +
          `(umbral ${regla?.condicion || 'MAYOR_QUE'} ${regla?.umbral ?? ''} h).`;
      }
    }

    return await IncidenteRepository.registrarIncidente({
      id_incidente: `INC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      id_envio,
      id_sensor,
      id_contenedor,
      tipo,
      severidad: regla?.severidad || 'MEDIA',
      descripcion,
      estado: 'ABIERTO'
    });
  }

  static async crearIncidenteDesdeAlerta(alerta) {
    if (!alerta || !MAPA_INCIDENTE[alerta.tipo]) return null;
    return await this.crearIncidenteAutomatico({
      tipoAlerta: alerta.tipo,
      regla: {
        condicion: alerta.tipo === 'BATERIA' ? 'MENOR_QUE' : 'MAYOR_QUE',
        umbral: alerta.umbral_aplicado,
        severidad: alerta.severidad
      },
      valor: alerta.valor_detectado,
      id_sensor: alerta.id_sensor,
      id_contenedor: alerta.id_contenedor || null,
      id_envio: alerta.id_envio || null,
      mensaje: `Alerta ${alerta.tipo}: ${alerta.mensaje}`
    });
  }

  static async procesarLecturaSensor(data) {
    const lecturaValidada = await this.validarLectura(data);

    // 1. Guardar lectura en MongoDB (Documental / time-series)
    const lectura = await MongoTelemetryRepository.registrarLecturaSensor(lecturaValidada);

    // 2. Actualizar última posición GPS en Redis (Clave-Valor)
    if (lecturaValidada.latitud !== null && lecturaValidada.longitud !== null) {
      try {
        await PositionCacheRepository.actualizarUltimaPosicion(
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

    // 3. Proyectar la lectura al grafo para el historial de movimientos.
    // Es best-effort: MongoDB sigue siendo la fuente de verdad de la telemetría.
    try {
      await Neo4jRouteRepository.registrarLectura(lectura);
    } catch (error) {
      console.warn(`[Monitoreo] No se pudo proyectar la lectura ${lectura.id_lectura} en Neo4j: ${error.message}`);
    }

    // 4. Evaluar reglas configurables contra la lectura recién ingresada
    const reglas = await AlertRuleRepository.obtenerActivas();
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

      const incidente = await this.crearIncidenteAutomatico({
        tipoAlerta: disparo.tipo,
        regla: disparo.regla,
        valor: disparo.valor,
        id_sensor: lecturaValidada.id_sensor,
        id_contenedor: lecturaValidada.id_contenedor,
        id_envio: lecturaValidada.id_envio
      });
      if (incidente) incidentes.push(incidente);
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
    const incidentes = [];

    for (const alerta of alertas) {
      const incidente = await this.crearIncidenteDesdeAlerta(alerta);
      if (incidente) incidentes.push(incidente);
    }

    return {
      alertas_generadas: alertas.length,
      alertas,
      incidentes_generados: incidentes.length,
      incidentes
    };
  }

  static async registrarIncidenteManual(data) {
    const incidente = await IncidenteRepository.registrarIncidente(data);
    const alerta = await AlertaRepository.crearAlertaDesdeIncidente(incidente);
    return { incidente, alerta };
  }

  static async cerrarIncidente(id_incidente) {
    const incidente = await IncidenteRepository.cerrarIncidente(id_incidente);
    if (!incidente) return null;
    const alertas_cerradas = await AlertaRepository.cerrarAlertasPorIncidente(id_incidente);
    return { incidente, alertas_cerradas };
  }
}

export { MonitoreoService as monitoreoService };
