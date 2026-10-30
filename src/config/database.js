import pg from 'pg';
import { MongoClient } from 'mongodb';
import neo4j from 'neo4j-driver';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// 1. PostgreSQL Pool
export const pgPool = new pg.Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'admin',
  password: process.env.PG_PASSWORD || 'password123',
  database: process.env.PG_DATABASE || 'tpo_logistica',
});

// 2. MongoDB Client
const mongoUri = process.env.MONGO_URI || 'mongodb://admin:password123@localhost:27017/tpo_telemetria?authSource=admin';
export const mongoClient = new MongoClient(mongoUri);
export let mongoDb = null;

// 3. Neo4j Driver
export const neoDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password123'),
  { encrypted: false }  // El contenedor Docker no usa TLS; sin esto el driver 4.0+ falla al conectar
);

// 4. Redis Client
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  // Manejo de advertencia cuando no está conectado
});

// Inicializador de todas las conexiones
export async function initDatabaseConnections() {
  const status = {
    postgres: false,
    mongo: false,
    neo4j: false,
    redis: false
  };

  // Check PostgreSQL
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    status.postgres = true;
  } catch (err) {
    console.warn(`[Aviso DB] PostgreSQL no disponible: ${err.message}`);
  }

  // Check MongoDB
  try {
    await mongoClient.connect();
    mongoDb = mongoClient.db(process.env.MONGO_DB_NAME || 'tpo_telemetria');
    status.mongo = true;
  } catch (err) {
    console.warn(`[Aviso DB] MongoDB no disponible: ${err.message}`);
  }

  // Check Neo4j (con reintentos, ya que puede tardar en inicializarse)
  {
    const NEO4J_RETRIES = 5;
    const NEO4J_RETRY_DELAY_MS = 3000;
    for (let attempt = 1; attempt <= NEO4J_RETRIES; attempt++) {
      try {
        const serverInfo = await neoDriver.getServerInfo();
        if (serverInfo) {
          status.neo4j = true;
          break;
        }
      } catch (err) {
        if (attempt < NEO4J_RETRIES) {
          console.warn(`[Aviso DB] Neo4j no disponible (intento ${attempt}/${NEO4J_RETRIES}): ${err.message}. Reintentando en ${NEO4J_RETRY_DELAY_MS / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, NEO4J_RETRY_DELAY_MS));
        } else {
          console.warn(`[Aviso DB] Neo4j no disponible tras ${NEO4J_RETRIES} intentos: ${err.message}`);
        }
      }
    }
  }

  // Check Redis
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    await redisClient.ping();
    status.redis = true;
  } catch (err) {
    console.warn(`[Aviso DB] Redis no disponible: ${err.message}`);
  }

  return status;
}

// Cierre ordenado
export function getDb() {
  if (!mongoDb) {
    throw new Error('MongoDB no inicializado. Llamar a initDatabaseConnections() primero.');
  }
  return mongoDb;
}

export async function closeDatabaseConnections() {
  try { await pgPool.end(); } catch {}
  try { await mongoClient.close(); } catch {}
  try { await neoDriver.close(); } catch {}
  try { if (redisClient.isOpen) await redisClient.quit(); } catch {}
}
