import { ReporteComercialRepository } from '../repositories/reporteComercialRepository.js';

// Servicio para manejar análisis comerciales, incluyendo reportes y métricas de rendimiento.
export class CommercialAnalyticsService {
  static rankingClientesPorVolumen() {
    return ReporteComercialRepository.rankingClientesPorVolumen();
  }
}
