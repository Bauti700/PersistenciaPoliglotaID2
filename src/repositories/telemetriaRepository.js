import { mongoClient, mongoDb } from '../config/database.js';

function getDb() {
  return mongoDb || mongoClient.db(process.env.MONGO_DB_NAME || 'tpo_telemetria');
}

export class MongoTelemetryRepository {
  // --- SENSORES ---
  static async registrarSensor(sensorData) {
    const col = getDb().collection('sensores');
    const doc = {
      ...sensorData,
      fecha_instalacion: sensorData.fecha_instalacion ? new Date(sensorData.fecha_instalacion) : new Date(),
      estado: sensorData.estado || 'ACTIVO'
    };
    await col.updateOne({ id_sensor: sensorData.id_sensor }, { $set: doc }, { upsert: true });
    return doc;
  }

  static async listarSensores() {
    return await getDb().collection('sensores').find({}).toArray();
  }

  // --- LECTURAS IOT ---
  static async registrarLectura({ id_sensor, temperatura, humedad, vibracion, latitud, longitud, nivel_bateria }) {
    const col = getDb().collection('lecturas_sensores');
    const doc = {
      id_sensor,
      fecha_hora: new Date(),
      temperatura: Number(temperatura),
      humedad: Number(humedad),
      vibracion: Number(vibracion),
      posicion_gps: {
        type: 'Point',
        coordinates: [Number(longitud), Number(latitud)] // [lng, lat] GeoJSON estándar
      },
      nivel_bateria: Number(nivel_bateria)
    };
    const res = await col.insertOne(doc);
    return { ...doc, _id: res.insertedId };
  }

  static async consultarHistoricoLecturas(id_sensor, limite = 20) {
    return await getDb().collection('lecturas_sensores')
      .find({ id_sensor })
      .sort({ fecha_hora: -1 })
      .limit(limite)
      .toArray();
  }

  // --- ANÁLISIS DE ANOMALÍAS DE TEMPERATURA ---
  static async detectarAnomaliasTemperatura(umbralMaximo = 8.0) {
    return await getDb().collection('lecturas_sensores').aggregate([
      { $match: { temperatura: { $gt: umbralMaximo } } },
      { $sort: { fecha_hora: -1 } },
      {
        $lookup: {
          from: 'sensores',
          localField: 'id_sensor',
          foreignField: 'id_sensor',
          as: 'sensor_info'
        }
      },
      { $unwind: { path: '$sensor_info', preserveNullAndEmptyArrays: true } }
    ]).toArray();
  }

  // --- TRAZABILIDAD Y EVENTOS ---
  static async registrarEventoLogistico({ id_evento, id_envio, tipo_evento, ubicacion, descripcion }) {
    const col = getDb().collection('eventos_logisticos');
    const doc = {
      id_evento,
      id_envio,
      tipo_evento,
      ubicacion,
      descripcion,
      fecha_hora: new Date()
    };
    await col.insertOne(doc);
    return doc;
  }

  static async obtenerHistorialEventosEnvio(id_envio) {
    return await getDb().collection('eventos_logisticos')
      .find({ id_envio })
      .sort({ fecha_hora: 1 })
      .toArray();
  }

  // --- INCIDENTES Y ALERTAS ---
  static async registrarIncidente({ id_incidente, id_envio, tipo, severidad = 'MEDIA', descripcion }) {
    const col = getDb().collection('incidentes');
    const doc = {
      id_incidente,
      id_envio,
      tipo,
      severidad,
      estado: 'ABIERTO',
      descripcion,
      fecha: new Date()
    };
    await col.insertOne(doc);
    return doc;
  }

  static async listarIncidentesAbiertos() {
    return await getDb().collection('incidentes').find({ estado: 'ABIERTO' }).toArray();
  }

  // --- ANALÍTICA DE INCIDENTES POR ENVÍO (AGGREGATION PIPELINE) ---
  static async obtenerIncidentesPorEnvio() {
    return await getDb().collection('incidentes').aggregate([
      {
        $group: {
          _id: '$id_envio',
          total_incidentes: { $sum: 1 },
          criticos: {
            $sum: {
              $cond: [{ $in: ['$severidad', ['ALTA', 'CRITICA']] }, 1, 0]
            }
          },
          leves: {
            $sum: {
              $cond: [{ $in: ['$severidad', ['MEDIA', 'BAJA']] }, 1, 0]
            }
          },
          abiertos: {
            $sum: {
              $cond: [{ $eq: ['$estado', 'ABIERTO'] }, 1, 0]
            }
          },
          tipos: { $addToSet: '$tipo' },
          ultimos_incidentes: {
            $push: {
              id: '$id_incidente',
              tipo: '$tipo',
              severidad: '$severidad',
              estado: '$estado',
              descripcion: '$descripcion'
            }
          }
        }
      }
    ]).toArray();
  }

  // --- MENSAJERÍA ---
  static async enviarMensaje({ remitente, destinatario, id_grupo = null, contenido, tipo = 'PRIVADO' }) {
    const col = getDb().collection('mensajes');
    const doc = {
      id_mensaje: `MSG-${Date.now()}`,
      remitente,
      destinatario,
      id_grupo,
      contenido,
      tipo,
      fecha: new Date(),
      estado: 'ENVIADO'
    };
    await col.insertOne(doc);
    return doc;
  }

  static async obtenerMensajes(usuario1, usuario2) {
    return await getDb().collection('mensajes').find({
      $or: [
        { remitente: usuario1, destinatario: usuario2 },
        { remitente: usuario2, destinatario: usuario1 }
      ]
    }).sort({ fecha: 1 }).toArray();
  }

  // --- REPORTES (DOCUMENTAL) ---
  static async registrarReporte({ id_reporte, usuario = 'admin@logistica.com', tipo, categoria = 'COMERCIAL', parametros = {}, resumen = {} }) {
    const col = getDb().collection('reportes');
    const doc = {
      id_reporte: id_reporte || `REP-${Date.now()}`,
      usuario,
      tipo,
      categoria,
      parametros,
      resumen,
      fecha_generacion: new Date()
    };
    await col.insertOne(doc);
    return doc;
  }

  static async listarReportes(limite = 20) {
    return await getDb().collection('reportes')
      .find({})
      .sort({ fecha_generacion: -1 })
      .limit(limite)
      .toArray();
  }
}

export { MongoTelemetryRepository as MongoRepository };
