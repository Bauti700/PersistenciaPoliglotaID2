import { randomUUID } from 'crypto';
import { getDb } from '../config/database.js';

export class ReporteMongoRepository {
  static _indicesAsegurados = false;

  static async asegurarIndices() {
    if (this._indicesAsegurados) return;
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
      this._indicesAsegurados = true;
    }
  }

  // --- REPORTES (DOCUMENTAL) ---
  static async registrarReporte({
    id_reporte,
    usuario = 'sistema',
    tipo,
    categoria = 'COMERCIAL',
    parametros = {},
    resumen = {},
    ...extra
  }) {
    await this.asegurarIndices();
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

  static async listarReportes(limite = 20) {
    await this.asegurarIndices();
    const maximo = Math.min(Math.max(Number(limite) || 20, 1), 200);
    return await getDb().collection('reportes')
      .find({})
      .sort({ fecha_generacion: -1 })
      .limit(maximo)
      .toArray();
  }

  static async obtenerReportePorId(id_reporte) {
    await this.asegurarIndices();
    return await getDb().collection('reportes').findOne({ id_reporte });
  }
}

export { ReporteMongoRepository as reporteMongoRepository };
