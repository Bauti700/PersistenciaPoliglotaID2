import { randomUUID } from 'crypto';
import { getDb } from '../config/database.js';

export class ReporteMongoRepository {
  static _indicesAsegurados = false;

  //Asegura que los índices necesarios para la colección de reportes estén creados. Si ya se han asegurado, no hace nada. Si hay duplicados de id_reporte, elimina los más antiguos antes de crear el índice único.
  static async asegurarIndices() {
    if (ReporteMongoRepository._indicesAsegurados) return;
    try {
      const col = getDb().collection('reportes');

      // Limpiar identificadores repetidos de versiones anteriores antes de
      // crear la restricción única (se conserva el documento más reciente).
      const duplicados = await col.aggregate([
        { $match: { id_reporte: { $type: 'string' } } },
        { $sort: { fecha_generacion: -1, _id: -1 } },
        { $group: { _id: '$id_reporte', ids: { $push: '$_id' }, total: { $sum: 1 } } },
        { $match: { total: { $gt: 1 } } }
      ]).toArray();
      for (const grupo of duplicados) {
        const sobrantes = grupo.ids.slice(1);
        if (sobrantes.length > 0) {
          await col.deleteMany({ _id: { $in: sobrantes } });
        }
      }

      await col.createIndexes([
        { key: { id_reporte: 1 }, name: 'uq_reporte_id', unique: true, sparse: true },
        { key: { fecha_generacion: -1 }, name: 'idx_reporte_fecha' },
        { key: { categoria: 1, tipo: 1 }, name: 'idx_reporte_categoria_tipo' }
      ]);
    } catch (error) {
      console.warn(`[Reportes Mongo] No se pudieron asegurar los índices: ${error.message}`);
    } finally {
      ReporteMongoRepository._indicesAsegurados = true;
    }
  }

  // --- REPORTES (DOCUMENTAL) ---
  // Registra un reporte en la colección de reportes. Si no se proporciona id_reporte, se genera uno único. Se asegura que los índices estén creados antes de insertar el documento.
  static async registrarReporte({
    id_reporte,
    usuario = 'sistema',
    tipo,
    categoria = 'COMERCIAL',
    parametros = {},
    resumen = {},
    ...extra
  }) {
    await ReporteMongoRepository.asegurarIndices();
    const col = getDb().collection('reportes');
    const doc = {
      id_reporte: id_reporte || `REP-${Date.now()}-${randomUUID().slice(0, 8)}`,
      usuario,
      tipo,
      categoria,
      parametros,
      resumen,
      ...extra,
      fecha_generacion: new Date()
    };
    await col.insertOne(doc);
    return doc;
  }

  // Lista los reportes más recientes, limitando la cantidad a un máximo de 200. Devuelve un array de documentos con id_reporte, usuario, tipo, categoria, parametros, resumen y fecha_generacion.
  static async listarReportes(limite = 20) {
    await ReporteMongoRepository.asegurarIndices();
    const maximo = Math.min(Math.max(Number(limite) || 20, 1), 200);
    return await getDb().collection('reportes')
      .find({})
      .sort({ fecha_generacion: -1 })
      .limit(maximo)
      .toArray();
  }

  // Obtiene un reporte por su id_reporte. Devuelve el documento completo o null si no se encuentra. Se asegura que los índices estén creados antes de la búsqueda.
  static async obtenerReportePorId(id_reporte) {
    await ReporteMongoRepository.asegurarIndices();
    return await getDb().collection('reportes').findOne({ id_reporte });
  }
}

export { ReporteMongoRepository as reporteMongoRepository };
