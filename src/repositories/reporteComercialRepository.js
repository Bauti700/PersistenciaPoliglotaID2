import { ReporteComercialSqlRepository } from './reporteComercialSqlRepository.js';
import { ReporteMongoRepository } from './reporteMongoRepository.js';

export class ReporteComercialRepository {
  static async reporteComercialParametrizado(filtros = {}, usuario = null) {
    const base = await ReporteComercialSqlRepository.reporteComercialParametrizado(filtros);

    let reporteDoc = null;
    try {
      reporteDoc = await ReporteMongoRepository.registrarReporte({
        usuario: usuario || 'sistema',
        tipo: 'REPORTE_COMERCIAL_PARAMETRIZADO',
        categoria: 'FACTURACION_Y_COBROS',
        parametros: base.parametros,
        resumen: base.metricas
      });
    } catch (eMongo) {
      console.warn(`[Sync Mongo Warning en Reporte]: ${eMongo.message}`);
    }

    return {
      ...base,
      id_reporte_mongo: reporteDoc?.id_reporte || null
    };
  }

  static async rankingClientesPorVolumen() {
    return await ReporteComercialSqlRepository.rankingClientesPorVolumen();
  }

  static async reporteOperativoEnvios(filtros = {}, usuario = null) {
    const datos = await ReporteComercialSqlRepository.reporteOperativoEnvios(filtros);
    try {
      const reporteDoc = await ReporteMongoRepository.registrarReporte({
        usuario: usuario || 'sistema',
        tipo: 'REPORTE_OPERATIVO_ENVIOS',
        categoria: 'OPERATIVO',
        parametros: filtros,
        resumen: {
          cantidad_registros: datos.length,
          demorados: datos.filter(d => d.demorado === 'SI').length,
          con_incidentes_abiertos: datos.filter(d => Number(d.incidentes_abiertos) > 0).length
        }
      });
      return { datos, id_reporte_mongo: reporteDoc?.id_reporte || null };
    } catch (e) {
      return { datos, id_reporte_mongo: null };
    }
  }

  static async tiemposEnvioPorCliente() {
    return await ReporteComercialSqlRepository.tiemposEnvioPorCliente();
  }

  static async promedioIncidentesPorPaisEstadoCliente(filtros = {}) {
    return await ReporteComercialSqlRepository.promedioIncidentesPorPaisEstadoCliente(filtros);
  }

  static async tiemposPromedioEntrega() {
    return await ReporteComercialSqlRepository.tiemposPromedioEntrega();
  }

  static async costosPorTipoTransporte() {
    return await ReporteComercialSqlRepository.costosPorTipoTransporte();
  }

  static async reporteFacturableParametrizado(filtros = {}, usuario = null) {
    // Se consulta una sola vez y se persiste un único documento FACTURABLE.
    const base = await ReporteComercialSqlRepository.reporteComercialParametrizado(filtros);
    try {
      const reporteDoc = await ReporteMongoRepository.registrarReporte({
        usuario: usuario || 'sistema',
        tipo: 'REPORTE_FACTURABLE_PARAMETRIZADO',
        categoria: 'FACTURABLE',
        parametros: base.parametros,
        resumen: base.metricas,
        facturable: true,
        cantidad_facturas: base.facturas.length
      });
      return { ...base, facturable: true, id_reporte_facturable: reporteDoc?.id_reporte || null };
    } catch (e) {
      return { ...base, facturable: true, id_reporte_facturable: null };
    }
  }
}

export { ReporteComercialRepository as reporteComercialRepository };
