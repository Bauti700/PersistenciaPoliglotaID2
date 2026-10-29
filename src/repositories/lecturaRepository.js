import { getDb } from '../config/database.js';

export class LecturaRepository {
  // --- LECTURAS DE SENSORES IOT ---
  static async registrarLecturaSensor(lecturaData) {
    const col = getDb().collection('lecturas_sensores');
    const doc = {
      id_lectura: `LEC-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      id_sensor: lecturaData.id_sensor,
      id_contenedor: lecturaData.id_contenedor,
      id_envio: lecturaData.id_envio,
      temperatura: lecturaData.temperatura !== undefined ? Number(lecturaData.temperatura) : null,
      humedad: lecturaData.humedad !== undefined ? Number(lecturaData.humedad) : null,
      vibracion: lecturaData.vibracion !== undefined ? Number(lecturaData.vibracion) : null,
      nivel_bateria: lecturaData.nivel_bateria !== undefined ? Number(lecturaData.nivel_bateria) : null,
      posicion_gps: (lecturaData.latitud && lecturaData.longitud) ? {
        type: 'Point',
        coordinates: [Number(lecturaData.longitud), Number(lecturaData.latitud)]
      } : null,
      fecha_hora: new Date()
    };
    await col.insertOne(doc);
    return doc;
  }

  static async consultarHistoricoLecturas(id_sensor, limite = 10) {
    return await getDb().collection('lecturas_sensores')
      .find({ id_sensor })
      .sort({ fecha_hora: -1 })
      .limit(limite)
      .toArray();
  }

  static async consultarHistoricoPorContenedor(id_contenedor, limite = 20) {
    return await getDb().collection('lecturas_sensores')
      .find({ id_contenedor })
      .sort({ fecha_hora: -1 })
      .limit(limite)
      .toArray();
  }

  static async detectarAnomaliasTemperatura(umbral = 8.0) {
    const pipeline = [
      { $match: { temperatura: { $gt: umbral } } },
      { $sort: { fecha_hora: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'sensores',
          localField: 'id_sensor',
          foreignField: 'id_sensor',
          as: 'sensor_info'
        }
      },
      { $unwind: { path: '$sensor_info', preserveNullAndEmptyArrays: true } }
    ];
    return await getDb().collection('lecturas_sensores').aggregate(pipeline).toArray();
  }
}

export { LecturaRepository as lecturaRepository };
