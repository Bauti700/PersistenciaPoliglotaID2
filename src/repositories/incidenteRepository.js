import { getDb } from '../config/database.js';

export class IncidenteRepository {
  // --- INCIDENTES ---
  static async registrarIncidente(incidente) {
    const col = getDb().collection('incidentes');
    const doc = {
      id_incidente: incidente.id_incidente || `INC-${Date.now()}`,
      id_envio: incidente.id_envio,
      id_sensor: incidente.id_sensor,
      id_contenedor: incidente.id_contenedor,
      tipo: incidente.tipo,
      severidad: incidente.severidad || 'MEDIA',
      descripcion: incidente.descripcion,
      estado: incidente.estado || 'ABIERTO',
      ubicacion: incidente.ubicacion,
      fecha: incidente.fecha || new Date()
    };
    await col.insertOne(doc);
    return doc;
  }

  static async listarIncidentesAbiertos() {
    return await getDb().collection('incidentes').find({ estado: 'ABIERTO' }).toArray();
  }

  static async listarIncidentesPorEnvio(id_envio) {
    return await getDb().collection('incidentes').find({ id_envio }).toArray();
  }

  static async cerrarIncidente(id_incidente) {
    const col = getDb().collection('incidentes');
    const res = await col.updateOne({ id_incidente }, { $set: { estado: 'CERRADO', fecha_cierre: new Date() } });
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_incidente });
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
}

export { IncidenteRepository as incidenteRepository };
