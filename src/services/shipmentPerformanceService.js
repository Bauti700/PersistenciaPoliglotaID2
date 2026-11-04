import { AnalyticsService } from './analyticsService.js';

export class ShipmentPerformanceService {
  static analisisHistoricoDesempeno(options = {}) {
    return AnalyticsService.analisisHistoricoDesempeno(options);
  }
}
