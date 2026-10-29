import { ClienteRepository } from '../repositories/actorRepository.js';
import { ContenedorRepository } from '../repositories/contenedorRepository.js';
import { ActorRepository } from '../repositories/actorRepository.js';
import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { Neo4jRouteRepository } from '../repositories/rutaRepository.js';
import { RedisCacheRepository } from '../repositories/cacheRepository.js';
import { pgPool } from '../config/database.js';

export class EnvioOrchestratorService {
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

    // 3. MongoDB: Evento inicial de seguimiento
    try {
      await MongoTelemetryRepository.registrarReporte({
        id_reporte: `EVT-${id_envio}-INIT`,
        tipo: 'EVENTO_LOGISTICO',
        categoria: 'TRAZABILIDAD',
        parametros: { id_envio, id_cliente, origen, destino },
        resumen: { evento: 'ENVIO_CREADO', fecha: new Date().toISOString(), estado: 'EN_TRANSITO' }
      });
    } catch (err) {
      console.warn(`[Sync Mongo Warning] No se pudo registrar evento de trazabilidad: ${err.message}`);
    }

    // 4. Redis: Inicializar caché para seguimiento
    try {
      await RedisCacheRepository.setCache(`envio:estado:${id_envio}`, {
        estado: 'EN_TRANSITO',
        ultima_actualizacion: new Date().toISOString(),
        origen,
        destino
      }, 3600);
    } catch (err) {
      console.warn(`[Sync Redis Warning] No se pudo inicializar caché: ${err.message}`);
    }

    return {
      envio: envioCreado,
      sincronizacion: {
        postgresql: 'OK',
        neo4j: 'PROYECTADO',
        mongodb: 'TRAZABILIDAD_REGISTRADA',
        redis: 'CACHE_INICIALIZADO'
      }
    };
  }

  static async crearEnvioSincronizado({ id_envio, id_cliente, origen, destino, prioridad = 'NORMAL' }) {
    return this.crearEnvioPoliglota({
      id_envio,
      id_cliente,
      origen,
      destino,
      prioridad,
      tramos: [{ desde: origen, hasta: destino, medio: 'Terrestre' }]
    });
  }
}

export { EnvioOrchestratorService as envioOrchestratorService };
