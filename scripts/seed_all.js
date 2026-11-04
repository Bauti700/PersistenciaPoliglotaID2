// =============================================================================
// SEED UNIFICADO - TPO PERSISTENCIA POLÍGLOTA GRUPO 12
// Aplica los datos semilla de PostgreSQL, MongoDB y Neo4j.
//
// Uso:
//   npm run seed
//
// - PostgreSQL: aplica scripts/init_postgres.sql (idempotente, no borra datos).
// - MongoDB:    ejecuta scripts/init_mongo.js (recrea las colecciones semilla).
// - Neo4j:      ejecuta scripts/init_neo4j.cypher (borra el grafo y lo recrea).
// - Redis:      carga las últimas posiciones GPS conocidas de los contenedores.
//
// MongoDB se ejecuta con mongosh local o, si no está instalado, dentro del
// contenedor tpo_mongo vía docker exec.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

import {
  pgPool,
  neoDriver,
  redisClient,
  closeDatabaseConnections
} from '../src/config/database.js';
import { RedisCacheRepository } from '../src/repositories/cacheRepository.js';

const SCRIPTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const RUTA_POSTGRES = fileURLToPath(new URL('./init_postgres.sql', import.meta.url));
const RUTA_MONGO = fileURLToPath(new URL('./init_mongo.js', import.meta.url));
const RUTA_NEO4J = fileURLToPath(new URL('./init_neo4j.cypher', import.meta.url));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:password123@localhost:27017/tpo_telemetria?authSource=admin';
const MONGO_CONTAINER = process.env.MONGO_CONTAINER || 'tpo_mongo';

function logSeccion(titulo) {
  console.log(`\n=== ${titulo} ===`);
}

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------
const PG_RETRIES = Number(process.env.SEED_PG_RETRIES || 10);
const PG_RETRY_DELAY_MS = Number(process.env.SEED_PG_RETRY_DELAY_MS || 2000);

async function conectarPostgres() {
  for (let intento = 1; intento <= PG_RETRIES; intento++) {
    try {
      return await pgPool.connect();
    } catch (err) {
      if (intento === PG_RETRIES) {
        throw new Error(
          `No se pudo conectar a PostgreSQL tras ${PG_RETRIES} intentos: ${err.message || err.code || 'sin detalle'}\n` +
          'Verificá que los contenedores estén levantados con: docker compose up -d'
        );
      }
      console.log(
        `[PostgreSQL] Aún no está listo (intento ${intento}/${PG_RETRIES}): ${err.message || err.code || 'sin detalle'}. ` +
        `Reintentando en ${PG_RETRY_DELAY_MS / 1000}s...`
      );
      await new Promise(resolve => setTimeout(resolve, PG_RETRY_DELAY_MS));
    }
  }
}

async function seedPostgres() {
  logSeccion('PostgreSQL');
  const sql = await readFile(RUTA_POSTGRES, 'utf8');
  const client = await conectarPostgres();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw new Error(
      `No se pudo aplicar init_postgres.sql: ${err.message}\n` +
      'Si el volumen PostgreSQL fue creado con un esquema anterior, recreálo con:\n' +
      '  docker compose down -v && docker compose up -d'
    );
  } finally {
    client.release();
  }
  console.log('Esquema y datos semilla aplicados correctamente.');
}

// ---------------------------------------------------------------------------
// MongoDB (mongosh local o dentro del contenedor)
// ---------------------------------------------------------------------------
function ejecutarComando(comando, args, etiqueta) {
  const resultado = spawnSync(comando, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120000
  });

  if (resultado.error) {
    if (resultado.error.code === 'ENOENT') {
      return { disponible: false };
    }
    throw new Error(`[${etiqueta}] ${resultado.error.message}`);
  }

  if (resultado.status !== 0) {
    const detalle = (resultado.stderr || resultado.stdout || '').trim();
    throw new Error(`[${etiqueta}] mongosh terminó con código ${resultado.status}${detalle ? `:\n${detalle}` : ''}`);
  }

  return { disponible: true, salida: (resultado.stdout || '').trim() };
}

function uriParaContenedor(uri) {
  try {
    const url = new URL(uri);
    url.hostname = 'localhost';
    return url.toString();
  } catch {
    return uri;
  }
}

async function seedMongo() {
  logSeccion('MongoDB');
  const script = await readFile(RUTA_MONGO, 'utf8');
  const argumentosBase = [MONGO_URI, '--quiet', '--eval', script];

  // 1. mongosh instalado en el host
  const local = ejecutarComando('mongosh', argumentosBase, 'mongosh local');
  if (local.disponible) {
    if (local.salida) console.log(local.salida);
    console.log('Colecciones y datos semilla aplicados correctamente.');
    return;
  }

  // 2. mongosh dentro del contenedor Docker (no requiere instalación local)
  console.log('mongosh no está instalado en el host; usando el contenedor Docker...');
  const argsDocker = [
    'exec', MONGO_CONTAINER,
    'mongosh', uriParaContenedor(MONGO_URI), '--quiet', '--eval', script
  ];
  const docker = ejecutarComando('docker', argsDocker, 'mongosh en docker');
  if (!docker.disponible) {
    throw new Error(
      'No se encontró mongosh ni Docker. Instalá MongoDB Shell o iniciá Docker Desktop ' +
      'y ejecutá "docker compose up -d".'
    );
  }
  if (docker.salida) console.log(docker.salida);
  console.log('Colecciones y datos semilla aplicados correctamente.');
}

// ---------------------------------------------------------------------------
// Neo4j (driver oficial)
// ---------------------------------------------------------------------------
const NEO4J_RETRIES = Number(process.env.SEED_NEO4J_RETRIES || 10);
const NEO4J_RETRY_DELAY_MS = Number(process.env.SEED_NEO4J_RETRY_DELAY_MS || 3000);

function esErrorDeConexionNeo4j(err) {
  return /Connection was closed by server|ServiceUnavailable|SessionExpired|Failed to connect|Couldn't connect|ECONNREFUSED|ECONNRESET|Socket closed/i.test(err?.message || '');
}

function parsearCypher(cypher) {
  return cypher
    .split(/\r?\n/)
    .map(linea => linea.replace(/\/\/.*$/, ''))
    .join('\n')
    .split(';')
    .map(sentencia => sentencia.trim())
    .filter(sentencia => sentencia.length > 0);
}

// Neo4j puede tardar varios segundos en quedar listo después de
// `docker compose up -d` (inicialización del store, password inicial, etc.).
async function esperarNeo4j(etiqueta = 'Neo4j') {
  for (let intento = 1; intento <= NEO4J_RETRIES; intento++) {
    try {
      await neoDriver.verifyConnectivity();
      return;
    } catch (err) {
      if (intento === NEO4J_RETRIES) {
        throw new Error(`${etiqueta} no está disponible tras ${NEO4J_RETRIES} intentos: ${err.message}`);
      }
      console.log(
        `[${etiqueta}] Aún no está listo (intento ${intento}/${NEO4J_RETRIES}): ${err.message}. ` +
        `Reintentando en ${NEO4J_RETRY_DELAY_MS / 1000}s...`
      );
      await new Promise(resolve => setTimeout(resolve, NEO4J_RETRY_DELAY_MS));
    }
  }
}

async function ejecutarSentenciasNeo4j(sentencias) {
  const session = neoDriver.session();
  try {
    for (const sentencia of sentencias) {
      try {
        await session.run(sentencia);
      } catch (err) {
        const resumen = sentencia.split('\n')[0].slice(0, 120);
        err.message = `[${resumen}] ${err.message}`;
        throw err;
      }
    }
  } finally {
    await session.close();
  }
}

async function seedNeo4j() {
  logSeccion('Neo4j');
  const cypher = await readFile(RUTA_NEO4J, 'utf8');
  const sentencias = parsearCypher(cypher);

  await esperarNeo4j();

  try {
    await ejecutarSentenciasNeo4j(sentencias);
  } catch (err) {
    // Si el servidor cerró la conexión (por ejemplo, porque terminó de
    // inicializarse o se reinició), reintentamos el seed completo. Es seguro
    // porque el script empieza con MATCH (n) DETACH DELETE n.
    if (!esErrorDeConexionNeo4j(err)) {
      throw new Error(`No se pudo aplicar init_neo4j.cypher: ${err.message}`);
    }
    console.log(`La conexión con Neo4j se interrumpió (${err.message}). Reintentando el seed completo...`);
    await esperarNeo4j();
    try {
      await ejecutarSentenciasNeo4j(sentencias);
    } catch (err2) {
      throw new Error(`No se pudo aplicar init_neo4j.cypher tras reintentar: ${err2.message}`);
    }
  }

  console.log(`Grafo recreado correctamente (${sentencias.length} sentencias ejecutadas).`);
}

// ---------------------------------------------------------------------------
// Redis (últimas posiciones GPS conocidas)
// ---------------------------------------------------------------------------
const POSICIONES_SEED = [
  {
    id_contenedor: 'CONT-001',
    lat: -34.1,
    lng: -57.8,
    datosExtra: { id_envio: 'ENV-1001', id_sensor: 'SENS-101', estado: 'EN_TRANSITO' }
  },
  {
    id_contenedor: 'CONT-002',
    lat: -34.9011,
    lng: -56.1645,
    datosExtra: { id_envio: 'ENV-1002', id_sensor: 'SENS-103', estado: 'EN_TRANSITO' }
  },
  {
    id_contenedor: 'CONT-003',
    lat: -33.4489,
    lng: -70.6693,
    datosExtra: { id_envio: 'ENV-1003', estado: 'DISPONIBLE' }
  },
  {
    id_contenedor: 'CONT-004',
    lat: -34.9011,
    lng: -56.1645,
    datosExtra: { id_envio: 'ENV-1004', estado: 'DISPONIBLE' }
  },
  {
    id_contenedor: 'CONT-005',
    lat: -31.6333,
    lng: -60.7,
    datosExtra: { id_envio: 'ENV-1005', estado: 'EN_TRANSITO' }
  }
];

async function seedRedis() {
  logSeccion('Redis');
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (err) {
      throw new Error(
        `No se pudo conectar a Redis: ${err.message}\n` +
        'Verificá que los contenedores estén levantados con: docker compose up -d'
      );
    }
  }

  // Dejar el seed idempotente: se descartan las posiciones previas y se
  // vuelven a cargar las posiciones semilla junto con el índice geoespacial.
  const clavesPrevias = await redisClient.keys('contenedor:posicion:*');
  if (clavesPrevias.length > 0) {
    await redisClient.del(clavesPrevias);
  }
  await redisClient.del('contenedores:geo');

  for (const posicion of POSICIONES_SEED) {
    await RedisCacheRepository.actualizarUltimaPosicion(
      posicion.id_contenedor,
      posicion.lat,
      posicion.lng,
      posicion.datosExtra
    );
  }

  console.log(`Posiciones GPS semilla cargadas para ${POSICIONES_SEED.length} contenedores.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Inicializando datos semilla del TPO...');
  console.log(`Directorio de scripts: ${SCRIPTS_DIR}`);

  await seedPostgres();
  await seedMongo();
  await seedNeo4j();
  await seedRedis();

  console.log('\nSeed finalizado correctamente. Ya podés ejecutar "npm start".');
}

try {
  await main();
} catch (err) {
  console.error(`\n[Error en el seed] ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabaseConnections();
}
