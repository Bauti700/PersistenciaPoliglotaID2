import { ReporteComercialSqlRepository } from './reporteComercialSqlRepository.js';
import { ReporteMongoRepository } from './reporteMongoRepository.js';

export class ReporteComercialRepository {
  // Auditoría documental común para los reportes operativos y analíticos.
  // Si MongoDB falla, el reporte igual se devuelve al usuario.
  static async _auditarReporte({ usuario = null, tipo, categoria, parametros = {}, resumen = {}, ...extra }) {
    try {
      const reporteDoc = await ReporteMongoRepository.registrarReporte({
        usuario: usuario || 'sistema',
        tipo,
        categoria,
        parametros,
        resumen,
        ...extra
      });
      return reporteDoc?.id_reporte || null;
    } catch (error) {
      console.warn(`[Reporte] No se pudo auditar ${tipo} en MongoDB: ${error.message}`);
      return null;
    }
  }

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

  static async tiemposEnvioPorCliente(usuario = null) {
    const datos = await ReporteComercialSqlRepository.tiemposEnvioPorCliente();
    const id_reporte_mongo = await ReporteComercialRepository._auditarReporte({
      usuario,
      tipo: 'REPORTE_TIEMPOS_ENVIO_POR_CLIENTE',
      categoria: 'ANALITICO',
      parametros: {},
      resumen: {
        total_clientes: datos.length,
        total_envios: datos.reduce((acc, fila) => acc + Number(fila.total_envios || 0), 0),
        entregados: datos.reduce((acc, fila) => acc + Number(fila.entregados || 0), 0),
        en_curso: datos.reduce((acc, fila) => acc + Number(fila.en_curso || 0), 0),
        cancelados: datos.reduce((acc, fila) => acc + Number(fila.cancelados || 0), 0)
      }
    });
    return { datos, id_reporte_mongo };
  }

  static async promedioIncidentesPorPaisEstadoCliente(filtros = {}, usuario = null) {
    const datos = await ReporteComercialSqlRepository.promedioIncidentesPorPaisEstadoCliente(filtros);
    const id_reporte_mongo = await ReporteComercialRepository._auditarReporte({
      usuario,
      tipo: 'REPORTE_PROMEDIO_INCIDENTES',
      categoria: 'ANALITICO',
      parametros: filtros,
      resumen: {
        total_grupos: datos.length,
        total_incidentes: datos.reduce((acc, fila) => acc + Number(fila.total_incidentes || 0), 0),
        total_envios: datos.reduce((acc, fila) => acc + Number(fila.total_envios || 0), 0)
      }
    });
    return { datos, id_reporte_mongo };
  }

  static async tiemposPromedioEntrega(usuario = null) {
    const datos = await ReporteComercialSqlRepository.tiemposPromedioEntrega();
    const id_reporte_mongo = await ReporteComercialRepository._auditarReporte({
      usuario,
      tipo: 'REPORTE_TIEMPOS_PROMEDIO_ENTREGA',
      categoria: 'ANALITICO',
      parametros: {},
      resumen: {
        total_paises: datos.length,
        entregados: datos.reduce((acc, fila) => acc + Number(fila.entregados || 0), 0)
      }
    });
    return { datos, id_reporte_mongo };
  }

  static async costosPorTipoTransporte(usuario = null) {
    const datos = await ReporteComercialSqlRepository.costosPorTipoTransporte();
    const id_reporte_mongo = await ReporteComercialRepository._auditarReporte({
      usuario,
      tipo: 'REPORTE_COSTOS_POR_TRANSPORTE',
      categoria: 'ANALITICO',
      parametros: {},
      resumen: {
        total_medios: datos.length,
        total_tramos: datos.reduce((acc, fila) => acc + Number(fila.total_tramos || 0), 0),
        costo_total_estimado: datos.reduce((acc, fila) => acc + Number(fila.costo_total_estimado || 0), 0)
      }
    });
    return { datos, id_reporte_mongo };
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
