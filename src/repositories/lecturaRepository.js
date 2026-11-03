import { getDb } from '../config/database.js';
import { enteroPositivo } from '../utils/validation.js';

const OPERADORES = {
  MAYOR_QUE: '$gt',
  MAYOR_IGUAL_QUE: '$gte',
  MENOR_QUE: '$lt',
  MENOR_IGUAL_QUE: '$lte',
  IGUAL_QUE: '$eq'
};

function rangoFechas(desde = null, hasta = null) {
  const filtro = {};
  if (desde) {
    const fechaDesde = new Date(desde);
    if (!Number.isNaN(fechaDesde.getTime())) filtro.$gte = fechaDesde;
  }
  if (hasta) {
    const fechaHasta = new Date(hasta);
    if (!Number.isNaN(fechaHasta.getTime())) filtro.$lte = fechaHasta;
  }
  return Object.keys(filtro).length > 0 ? filtro : null;
}

function construirFiltroHistorico(identificador, { desde = null, hasta = null } = {}) {
  const filtro = { ...identificador };
  const rango = rangoFechas(desde, hasta);
  if (rango) filtro.fecha_hora = rango;
  return filtro;
}

export class LecturaRepository {
  // --- LECTURAS DE SENSORES IOT ---
  static async registrarLecturaSensor(lecturaData) {
    const col = getDb().collection('lecturas_sensores');
    const tieneGPS =
      lecturaData.latitud !== undefined && lecturaData.latitud !== null &&
      lecturaData.longitud !== undefined && lecturaData.longitud !== null;

    const doc = {
      id_lectura: `LEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      id_sensor: lecturaData.id_sensor,
      id_contenedor: lecturaData.id_contenedor,
      id_envio: lecturaData.id_envio ?? null,
      temperatura: lecturaData.temperatura !== undefined && lecturaData.temperatura !== null
        ? Number(lecturaData.temperatura)
        : null,
      humedad: lecturaData.humedad !== undefined && lecturaData.humedad !== null
        ? Number(lecturaData.humedad)
        : null,
      vibracion: lecturaData.vibracion !== undefined && lecturaData.vibracion !== null
        ? Number(lecturaData.vibracion)
        : null,
      nivel_bateria: lecturaData.nivel_bateria !== undefined && lecturaData.nivel_bateria !== null
        ? Number(lecturaData.nivel_bateria)
        : null,
      posicion_gps: tieneGPS ? {
        type: 'Point',
        coordinates: [Number(lecturaData.longitud), Number(lecturaData.latitud)]
      } : null,
      fecha_hora: new Date()
    };
    await col.insertOne(doc);
    return doc;
  }

  static async consultarHistoricoLecturas(id_sensor, limite = 10, filtros = {}) {
    const cantidad = enteroPositivo(limite, 'limite', { min: 1, max: 500 });
    return await getDb().collection('lecturas_sensores')
      .find(construirFiltroHistorico({ id_sensor }, filtros))
      .sort({ fecha_hora: -1 })
      .limit(cantidad)
      .toArray();
  }

  static async consultarHistoricoPorContenedor(id_contenedor, limite = 20, filtros = {}) {
    const cantidad = enteroPositivo(limite, 'limite', { min: 1, max: 500 });
    return await getDb().collection('lecturas_sensores')
      .find(construirFiltroHistorico({ id_contenedor }, filtros))
      .sort({ fecha_hora: -1 })
      .limit(cantidad)
      .toArray();
  }

  static async detectarAnomaliasTemperatura(umbral = 8.0, condicion = 'MAYOR_QUE', filtros = {}) {
    const operador = OPERADORES[condicion] || '$gt';
    const match = { temperatura: { [operador]: Number(umbral) } };

    if (filtros.id_sensor) match.id_sensor = filtros.id_sensor;
    if (filtros.id_contenedor) match.id_contenedor = filtros.id_contenedor;

    const rango = rangoFechas(filtros.desde, filtros.hasta);
    if (rango) match.fecha_hora = rango;

    const limite = enteroPositivo(filtros.limite || 50, 'limite', { min: 1, max: 500 });
    const db = getDb();

    // Aggregation Pipeline sobre la colección time-series. $lookup permite
    // enriquecer cada lectura con los datos del sensor en una sola consulta.
    const lecturas = await db.collection('lecturas_sensores').aggregate([
      { $match: match },
      { $sort: { fecha_hora: -1 } },
      { $limit: limite },
      {
        $lookup: {
          from: 'sensores',
          localField: 'id_sensor',
          foreignField: 'id_sensor',
          as: 'sensor_info'
        }
      },
      {
        $unwind: {
          path: '$sensor_info',
          preserveNullAndEmptyArrays: true
        }
      }
    ]).toArray();

    return lecturas.map(lectura => ({
      ...lectura,
      sensor_info: lectura.sensor_info || null
    }));
  }
}

export { LecturaRepository as lecturaRepository };
