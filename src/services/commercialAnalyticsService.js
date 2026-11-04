import { ReporteComercialRepository } from '../repositories/reporteComercialRepository.js';

export class CommercialAnalyticsService {
  static rankingClientesPorVolumen() {
    return ReporteComercialRepository.rankingClientesPorVolumen();
  }
}
