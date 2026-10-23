import express from 'express';
import cors from 'cors';
import { initDatabaseConnections } from './config/database.js';
import { ClienteRepository, ComercialRepository, ContenedorRepository } from './repositories/postgresRepository.js';
import { MongoTelemetryRepository } from './repositories/mongoRepository.js';
import { Neo4jRouteRepository } from './repositories/neo4jRepository.js';
import { RedisCacheRepository } from './repositories/redisRepository.js';
import { LogisticsService } from './services/logisticsService.js';
import { pgPool } from './config/database.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

function responderError(res, err) {
  const statusCode = err.statusCode || (err.code === '23505' ? 409 : 500);
  res.status(statusCode).json({ error: err.message });
}

// --- HEALTH & STATUS DE BASES DE DATOS ---
app.get('/api/status', async (req, res) => {
  const status = await initDatabaseConnections();
  res.json({
    status: 'ONLINE',
    engines: status
  });
});

// --- POSTGRESQL: CLIENTES Y COMERCIAL ---
app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await ClienteRepository.listarTodos();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const cliente = await ClienteRepository.crear(req.body);
    res.status(201).json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POSTGRESQL: CONTENEDORES ---
app.get('/api/contenedores', async (req, res) => {
  try {
    res.json(await ContenedorRepository.listarTodos());
  } catch (err) {
    responderError(res, err);
  }
});

app.get('/api/contenedores/:id', async (req, res) => {
  try {
    const contenedor = await ContenedorRepository.obtenerPorId(req.params.id);
    if (!contenedor) return res.status(404).json({ error: 'Contenedor no encontrado.' });
    res.json(contenedor);
  } catch (err) {
    responderError(res, err);
  }
});

app.post('/api/contenedores', async (req, res) => {
  try {
    const contenedor = await ContenedorRepository.crear(req.body);
    res.status(201).json(contenedor);
  } catch (err) {
    responderError(res, err);
  }
});

app.put('/api/contenedores/:id', async (req, res) => {
  try {
    const contenedor = await ContenedorRepository.actualizar(req.params.id, req.body);
    if (!contenedor) return res.status(404).json({ error: 'Contenedor no encontrado.' });
    res.json(contenedor);
  } catch (err) {
    responderError(res, err);
  }
});

app.delete('/api/contenedores/:id', async (req, res) => {
  try {
    const contenedor = await ContenedorRepository.darDeBaja(req.params.id);
    if (!contenedor) return res.status(404).json({ error: 'Contenedor no encontrado.' });
    res.json(contenedor);
  } catch (err) {
    responderError(res, err);
  }
});

app.get('/api/clientes/:id/cuenta', async (req, res) => {
  try {
    const data = await ComercialRepository.obtenerEstadoCuenta(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/facturas', async (req, res) => {
  try {
    const factura = await ComercialRepository.emitirFactura(req.body);
    res.status(201).json(factura);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pagos', async (req, res) => {
  try {
    const pago = await ComercialRepository.registrarPago(req.body);
    res.status(201).json(pago);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reportes/ranking-clientes', async (req, res) => {
  try {
    const ranking = await ComercialRepository.rankingClientesPorVolumen();
    res.json(ranking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MONGODB: SENSORES Y TELEMETRÍA IOT ---
app.get('/api/sensores', async (req, res) => {
  try {
    const sensores = await MongoTelemetryRepository.listarSensores();
    res.json(sensores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telemetria', async (req, res) => {
  try {
    const lectura = await LogisticsService.procesarLecturaSensor(req.body);
    res.status(201).json(lectura);
  } catch (err) {
    responderError(res, err);
  }
});

app.get('/api/telemetria/:id_sensor', async (req, res) => {
  try {
    const lecturas = await MongoTelemetryRepository.consultarHistoricoLecturas(req.params.id_sensor, 20);
    res.json(lecturas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/anomalias/temperatura', async (req, res) => {
  try {
    const anomalias = await MongoTelemetryRepository.detectarAnomaliasTemperatura(8.0);
    res.json(anomalias);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/incidentes', async (req, res) => {
  try {
    const incidentes = await MongoTelemetryRepository.listarIncidentesAbiertos();
    res.json(incidentes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mensajería
app.get('/api/mensajes', async (req, res) => {
  try {
    const { u1 = 'admin@logistica.com', u2 = 'carlos@expressplata.com' } = req.query;
    const msgs = await MongoTelemetryRepository.obtenerMensajes(u1, u2);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mensajes', async (req, res) => {
  try {
    const msg = await MongoTelemetryRepository.enviarMensaje(req.body);
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEO4J: RUTAS Y RED LOGÍSTICA ---
app.get('/api/grafo/red', async (req, res) => {
  try {
    const red = await Neo4jRouteRepository.obtenerRedRelaciones();
    res.json(red);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/grafo/envio/:id_envio', async (req, res) => {
  try {
    const ruta = await Neo4jRouteRepository.obtenerRutaCompletaEnvio(req.params.id_envio);
    res.json(ruta || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REDIS: CACHÉ TIEMPO REAL ---
app.get('/api/redis/posicion/:id_contenedor', async (req, res) => {
  try {
    const pos = await RedisCacheRepository.obtenerUltimaPosicion(req.params.id_contenedor);
    res.json(pos || { estado: 'SIN_DATOS_EN_CACHE' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ORQUESTACIÓN POLÍGLOTA ---
app.get('/api/envios', async (req, res) => {
  try {
    const envios = await pgPool.query(`
      SELECT e.*, a.razon_social AS cliente_nombre 
      FROM envios e
      JOIN actores a ON e.id_cliente = a.id_actor
      ORDER BY e.fecha_creacion DESC;
    `);
    res.json(envios.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/envios', async (req, res) => {
  try {
    const envio = await LogisticsService.crearEnvioPoliglota(req.body);
    res.status(201).json(envio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/prediccion/:id_envio', async (req, res) => {
  try {
    const prediccion = await LogisticsService.obtenerOPredicirRiesgo(req.params.id_envio);
    res.json(prediccion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`[API Server] Corriendo en http://localhost:${PORT}`);
  await initDatabaseConnections();
});
