import { getDb } from '../config/database.js';

export class SensorRepository {
  // --- SENSORES ---
  static async registrarSensor(sensorData) {
    const col = getDb().collection('sensores');
    const doc = {
      ...sensorData,
      fecha_instalacion: sensorData.fecha_instalacion ? new Date(sensorData.fecha_instalacion) : new Date(),
      estado: sensorData.estado || 'ACTIVO',
      fecha_registro: new Date()
    };
    await col.updateOne({ id_sensor: sensorData.id_sensor }, { $set: doc }, { upsert: true });
    return doc;
  }

  static async listarSensores(filtro = {}) {
    return await getDb().collection('sensores').find(filtro).toArray();
  }

  static async obtenerSensorPorId(id_sensor) {
    return await getDb().collection('sensores').findOne({ id_sensor });
  }

  static async listarSensoresPorContenedor(id_contenedor) {
    return await getDb().collection('sensores').find({ id_contenedor }).toArray();
  }

  static async asignarSensorAContenedor(id_sensor, id_contenedor) {
    const col = getDb().collection('sensores');
    const res = await col.updateOne({ id_sensor }, { $set: { id_contenedor, fecha_asignacion: new Date() } });
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_sensor });
  }

  static async actualizarSensor(id_sensor, datos) {
    const col = getDb().collection('sensores');
    const actualizacion = { ...datos, fecha_actualizacion: new Date() };
    const res = await col.updateOne({ id_sensor }, { $set: actualizacion });
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_sensor });
  }

  static async darDeBajaSensor(id_sensor) {
    const col = getDb().collection('sensores');
    const res = await col.updateOne({ id_sensor }, { $set: { estado: 'INACTIVO', fecha_baja: new Date() } });
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_sensor });
  }

  static async activarSensor(id_sensor) {
    const col = getDb().collection('sensores');
    const res = await col.updateOne({ id_sensor }, { $set: { estado: 'ACTIVO', fecha_reactivacion: new Date() } });
    if (res.matchedCount === 0) return null;
    return await col.findOne({ id_sensor });
  }

  static async eliminarSensor(id_sensor) {
    const col = getDb().collection('sensores');
    const res = await col.deleteOne({ id_sensor });
    return res.deletedCount > 0;
  }
}

export { SensorRepository as sensorRepository };
