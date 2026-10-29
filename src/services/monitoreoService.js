import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { RedisCacheRepository } from '../repositories/cacheRepository.js';
import { AlertaRepository } from '../repositories/alertaRepository.js';
import { IncidenteRepository } from '../repositories/incidenteRepository.js';

export class MonitoreoService {
  static async procesarLecturaSensor({ id_sensor, id_contenedor, id_envio, temperatura, humedad, vibracion = 0, latitud, longitud, nivel_bateria = 100 }) {
    // 1. Guardar lectura en MongoDB (Documental)
    const lectura = await MongoTelemetryRepository.registrarLecturaSensor({
      id_sensor,
      id_contenedor,
      id_envio,
      temperatura: Number(temperatura),
      humedad: Number(humedad),
      vibracion: Number(vibracion),
      latitud: latitud ? Number(latitud) : null,
      longitud: longitud ? Number(longitud) : null,
      nivel_bateria: Number(nivel_bateria)
    });

    // 2. Actualizar última posición GPS en Redis (Clave-Valor)
    if (latitud && longitud) {
      await RedisCacheRepository.actualizarUltimaPosicion(id_contenedor, latitud, longitud, {
        id_envio,
        id_sensor,
        ultima_lectura: new Date().toISOString()
      });
    }

    // 3. Detección automática de incidentes si temperatura > 8°C
    if (Number(temperatura) > 8) {
      const incidente = await IncidenteRepository.registrarIncidente({
        id_incidente: `INC-${Date.now()}`,
        id_envio,
        id_sensor,
        id_contenedor,
        tipo: 'EXCESO_TEMPERATURA',
        severidad: Number(temperatura) > 12 ? 'CRITICA' : 'ALTA',
        descripcion: `Temperatura fuera de rango: ${temperatura} °C en contenedor ${id_contenedor}`,
        estado: 'ABIERTO'
      });
      await AlertaRepository.crearAlerta({
        id_alerta: `ALR-TEMP-${Date.now()}`,
        id_sensor,
        id_envio,
        id_contenedor,
        tipo: 'TEMPERATURA',
        mensaje: `Alerta por exceso de temperatura: ${temperatura}°C`,
        severidad: Number(temperatura) > 12 ? 'CRITICA' : 'ALTA',
        motivo: 'UMBRAL_TEMPERATURA'
      });
      return { lectura, incidente, alerta_generada: true };
    }

    return { lectura, alerta_generada: false };
  }

  static async ejecutarMonitoreoSensores() {
    const alertas = await AlertaRepository.detectarAlertasEstadoSensores();
    return { alertas_generadas: alertas.length, alertas };
  }
}

export { MonitoreoService as monitoreoService };
