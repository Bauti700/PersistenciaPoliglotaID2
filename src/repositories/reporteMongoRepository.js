import { getDb } from '../config/database.js';

export class ReporteMongoRepository {
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

  static async obtenerReportePorId(id_reporte) {
    return await getDb().collection('reportes').findOne({ id_reporte });
  }
}

export { ReporteMongoRepository as reporteMongoRepository };
