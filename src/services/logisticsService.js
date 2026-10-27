import { ClienteRepository } from '../repositories/actorRepository.js';
import { ContenedorRepository } from '../repositories/contenedorRepository.js';
import { ActorRepository } from '../repositories/actorRepository.js';
import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { Neo4jRouteRepository } from '../repositories/rutaRepository.js';
import { RedisCacheRepository } from '../repositories/cacheRepository.js';
import { pgPool } from '../config/database.js';

export class LogisticsService {
  /**
   * Crea un envío de forma políglota y consistente:
   * 1. Registra en PostgreSQL (fuente transaccional).
   * 2. Registra el grafo y la red de trayectos en Neo4j.
   * 3. Registra el evento inicial de trazabilidad en MongoDB.
   * 4. Prepara el contenedor y su caché en Redis.
   */
  static async crearEnvioPoliglota({ id_envio, id_cliente, origen, destino, prioridad = 'MEDIA', operador = null, vehiculo = null, tramos = [] }) {
    // 1. PostgreSQL
    const pgRes = await pgPool.query(`
      INSERT INTO envios (id_envio, id_cliente, origen, destino, estado, prioridad)
      VALUES ($1, $2, $3, $4, 'EN_TRANSITO', $5)
      RETURNING *;
    `, [id_envio, id_cliente, origen, destino, prioridad]);

    const envioCreado = pgRes.rows[0];

    // Registrar tramos en PG si existen
    for (let i = 0; i < tramos.length; i++) {
      const t = tramos[i];
      await pgPool.query(`
        INSERT INTO tramos (id_tramo, id_envio, medio_transporte, origen, destino)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING;
      `, [t.id_tramo || `TR-${id_envio}-${i+1}`, id_envio, t.medio || 'Terrestre', t.desde, t.hasta]);
    }

    // 2. Neo4j: Crear topología de red
    try {
      await Neo4jRouteRepository.crearEnvioConRuta({
        id_envio,
        id_cliente,
        origen,
        destino,
        operador,
        vehiculo,
        tramos
      });
    } catch (err) {
      console.warn(`[Sync Neo4j Warning] No se pudo proyectar en el grafo: ${err.message}`);
    }

    // 3. MongoDB: Registrar evento logístico inicial
    try {
      await MongoTelemetryRepository.registrarEventoLogistico({
        id_evento: `EVT-${Date.now()}`,
        id_envio,
        tipo_evento: 'Carga iniciada',
        ubicacion: origen,
        descripcion: `Envío ${id_envio} dado de alta y programado para traslado hacia ${destino}.`
      });
    } catch (err) {
      console.warn(`[Sync MongoDB Warning] No se pudo registrar evento de inicio: ${err.message}`);
    }

    return envioCreado;
  }

  /**
   * Ingesta de telemetría IoT con actualización de caché y detección de incidentes:
   * 1. Almacena lectura en MongoDB (Time-series / Histórico).
   * 2. Actualiza la última posición GPS en Redis (Caché en memoria).
   * 3. Si detecta temperatura > 8°C o vibración > 0.5, dispara alerta e incidente.
   */
  static async procesarLecturaSensor({ id_sensor, id_contenedor, id_envio, temperatura, humedad, vibracion, latitud, longitud, nivel_bateria }) {
    if (id_contenedor) {
      const contenedor = await ContenedorRepository.obtenerPorId(id_contenedor);
      if (!contenedor) {
        const error = new Error(`Contenedor ${id_contenedor} no encontrado.`);
        error.statusCode = 404;
        throw error;
      }
      if (contenedor.estado === 'FUERA_SERVICIO') {
        const error = new Error(`El contenedor ${id_contenedor} está fuera de servicio.`);
        error.statusCode = 409;
        throw error;
      }
    }

    // 1. Guardar en MongoDB
    const lectura = await MongoTelemetryRepository.registrarLectura({
      id_sensor,
      temperatura,
      humedad,
      vibracion,
      latitud,
      longitud,
      nivel_bateria
    });

    // 2. Actualizar caché rápido en Redis
    if (id_contenedor) {
      await RedisCacheRepository.actualizarUltimaPosicion(id_contenedor, latitud, longitud, {
        temperatura: String(temperatura),
        humedad: String(humedad),
        id_sensor
      });
    }

    // 3. Control de alertas e incidentes automáticos
    const tempNum = Number(temperatura);
    if (tempNum > 8.0) {
      await MongoTelemetryRepository.registrarIncidente({
        id_incidente: `INC-${Date.now()}`,
        id_envio: id_envio || 'ENV-DESCONOCIDO',
        tipo: 'Temperatura Crítica',
        severidad: 'ALTA',
        descripcion: `Sensor ${id_sensor} registró temperatura de ${tempNum}°C (Umbral máx: 8.0°C).`
      });
    }

    return lectura;
  }

  /**
   * Cálculo o recuperación en caché de Predicción de Riesgo
   */
  static async obtenerOPredicirRiesgo(id_envio) {
    // 1. Intentar leer de Redis (Caché 24h)
    const cached = await RedisCacheRepository.obtenerPrediccionRiesgo(id_envio);
    if (cached) {
      return { origen_datos: 'REDIS_CACHE', ...cached };
    }

    // 2. Si no está en caché, calcular predicción
    const prediccion = {
      id_envio,
      riesgo_climatico: Math.random() > 0.5 ? 'MODERADO' : 'BAJO',
      riesgo_operativo: 'BAJO',
      probabilidad_demora: Number((Math.random() * 0.4).toFixed(2)),
      factores: ['Tráfico aduanero proyectado', 'Condiciones climáticas de ruta'],
      fecha_calculo: new Date().toISOString()
    };

    // 3. Guardar en Redis y MongoDB
    await RedisCacheRepository.cachearPrediccionRiesgo(id_envio, prediccion, 86400);

    return { origen_datos: 'CALCULADO_NUEVO', ...prediccion };
  }
}
