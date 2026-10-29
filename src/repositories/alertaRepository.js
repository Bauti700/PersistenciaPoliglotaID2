import { getDb } from '../config/database.js';

export class AlertaRepository {
  // --- REGLAS Y ALERTAS ---
  static async crearRegla(regla) {
    const col = getDb().collection('reglas_alertas');
    const doc = {
      id_regla: regla.id_regla || `REG-${Date.now()}`,
      tipo: regla.tipo,
      condicion: regla.condicion,
      umbral: regla.umbral,
      severidad: regla.severidad || 'MEDIA',
      activa: regla.activa !== undefined ? regla.activa : true,
      descripcion: regla.descripcion,
      fecha_creacion: new Date()
    };
    await col.insertOne(doc);
    return doc;
  }

  static async listarReglas() {
    return await getDb().collection('reglas_alertas').find({}).toArray();
  }

  static async actualizarRegla(id_regla, datos) {
    const col = getDb().collection('reglas_alertas');
    const res = await col.updateOne({ id_regla }, { $set: { ...datos, fecha_actualizacion: new Date() } });
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_regla });
  }

  static async desactivarRegla(id_regla) {
    const col = getDb().collection('reglas_alertas');
    const res = await col.updateOne({ id_regla }, { $set: { activa: false, fecha_desactivacion: new Date() } });
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_regla });
  }

  static async crearAlerta(alerta) {
    const col = getDb().collection('alertas');
    const doc = {
      id_alerta: alerta.id_alerta || `ALR-${Date.now()}`,
      id_sensor: alerta.id_sensor,
      id_contenedor: alerta.id_contenedor,
      id_envio: alerta.id_envio,
      tipo: alerta.tipo || 'TEMPERATURA',
      mensaje: alerta.mensaje,
      severidad: alerta.severidad || 'ALTA',
      estado: alerta.estado || 'ABIERTA',
      motivo: alerta.motivo,
      fecha: new Date()
    };
    await col.insertOne(doc);
    return doc;
  }

  static async listarAlertasAbiertas() {
    return await getDb().collection('alertas').find({ estado: 'ABIERTA' }).sort({ fecha: -1 }).toArray();
  }

  static async listarAlertasPorTipo(tipo) {
    return await getDb().collection('alertas').find({ tipo, estado: 'ABIERTA' }).sort({ fecha: -1 }).toArray();
  }

  static async cerrarAlerta(id_alerta) {
    const col = getDb().collection('alertas');
    const res = await col.updateOne({ id_alerta }, { $set: { estado: 'CERRADA', fecha_cierre: new Date() } });
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_alerta });
  }

  static async detectarAlertasEstadoSensores() {
    const colSensores = getDb().collection('sensores');
    const colLecturas = getDb().collection('lecturas_sensores');
    const colAlertas = getDb().collection('alertas');
    const ahora = new Date();
    const alertasGeneradas = [];

    const sensores = await colSensores.find({ estado: 'ACTIVO' }).toArray();
    for (const sensor of sensores) {
      const ultimaLectura = await colLecturas.findOne(
        { id_sensor: sensor.id_sensor },
        { sort: { fecha_hora: -1 } }
      );
      if (!ultimaLectura) {
        const alertaExistente = await colAlertas.findOne({ id_sensor: sensor.id_sensor, tipo: 'INACTIVIDAD', estado: 'ABIERTA' });
        if (!alertaExistente) {
          const alerta = await this.crearAlerta({
            id_sensor: sensor.id_sensor,
            id_contenedor: sensor.id_contenedor,
            tipo: 'INACTIVIDAD',
            mensaje: `Sensor ${sensor.id_sensor} sin lecturas registradas`,
            severidad: 'ALTA',
            motivo: 'SIN_LECTURAS'
          });
          alertasGeneradas.push(alerta);
        }
      } else {
        const diffHoras = (ahora - new Date(ultimaLectura.fecha_hora)) / (1000 * 60 * 60);
        if (diffHoras > 2) {
          const alertaExistente = await colAlertas.findOne({ id_sensor: sensor.id_sensor, tipo: 'INACTIVIDAD', estado: 'ABIERTA' });
          if (!alertaExistente) {
            const alerta = await this.crearAlerta({
              id_sensor: sensor.id_sensor,
              id_contenedor: sensor.id_contenedor,
              tipo: 'INACTIVIDAD',
              mensaje: `Sensor ${sensor.id_sensor} inactivo por ${Math.round(diffHoras)} horas sin lecturas`,
              severidad: 'ALTA',
              motivo: 'INACTIVO_SIN_TRANSMISION'
            });
            alertasGeneradas.push(alerta);
          }
        }
        if (ultimaLectura.nivel_bateria && Number(ultimaLectura.nivel_bateria) < 20) {
          const alertaExistente = await colAlertas.findOne({ id_sensor: sensor.id_sensor, tipo: 'BATERIA', estado: 'ABIERTA' });
          if (!alertaExistente) {
            const alerta = await this.crearAlerta({
              id_sensor: sensor.id_sensor,
              id_contenedor: sensor.id_contenedor,
              tipo: 'BATERIA',
              mensaje: `Batería baja en sensor ${sensor.id_sensor}: ${ultimaLectura.nivel_bateria}%`,
              severidad: 'MEDIA',
              motivo: 'BATERIA_BAJA'
            });
            alertasGeneradas.push(alerta);
          }
        }
      }
    }
    return alertasGeneradas;
  }
}

export { AlertaRepository as alertaRepository };
