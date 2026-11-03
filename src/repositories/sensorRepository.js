import { getDb, pgPool } from '../config/database.js';
import { Neo4jRouteRepository } from './rutaRepository.js';
import {
  textoRequerido,
  textoOpcional,
  unoDe,
  errorValidacion
} from '../utils/validation.js';

const ESTADOS_SENSOR = ['ACTIVO', 'INACTIVO'];
const CAMPOS_SENSOR = ['id_sensor', 'tipo', 'fabricante', 'id_contenedor', 'estado', 'fecha_instalacion'];

function validarSensor(data, { parcial = false } = {}) {
  const claves = Object.keys(data || {});
  const desconocidos = claves.filter(campo => !CAMPOS_SENSOR.includes(campo));
  if (desconocidos.length > 0) {
    throw errorValidacion(`Campos no permitidos: ${desconocidos.join(', ')}.`);
  }

  const sensor = {};
  if (data.id_sensor !== undefined) {
    if (parcial) {
      throw errorValidacion('El ID del sensor no se puede modificar.');
    }
    sensor.id_sensor = textoRequerido(data.id_sensor, 'id_sensor', { max: 50 });
  } else if (!parcial) {
    throw errorValidacion('El campo id_sensor es obligatorio.');
  }

  if (data.tipo !== undefined) {
    sensor.tipo = textoRequerido(data.tipo, 'tipo', { max: 100 });
  } else if (!parcial) {
    throw errorValidacion('El campo tipo es obligatorio.');
  }

  if (data.fabricante !== undefined) {
    sensor.fabricante = textoOpcional(data.fabricante, 'fabricante', { max: 100 });
  }
  if (data.id_contenedor !== undefined) {
    sensor.id_contenedor = textoOpcional(data.id_contenedor, 'id_contenedor', { max: 50 });
  }
  if (data.estado !== undefined) {
    sensor.estado = unoDe(data.estado, ESTADOS_SENSOR, 'estado');
  }
  if (data.fecha_instalacion !== undefined) {
    const fecha = new Date(data.fecha_instalacion);
    if (Number.isNaN(fecha.getTime())) {
      throw errorValidacion('El campo fecha_instalacion no es una fecha válida.');
    }
    sensor.fecha_instalacion = fecha;
  }

  if (parcial && Object.keys(sensor).length === 0) {
    throw errorValidacion('Debe indicar al menos un campo para actualizar.');
  }
  return sensor;
}

async function validarContenedorExistente(id_contenedor) {
  if (id_contenedor === undefined || id_contenedor === null || id_contenedor === '') return null;
  const id = textoRequerido(id_contenedor, 'id_contenedor', { max: 50 });
  const res = await pgPool.query(
    'SELECT id_contenedor, estado FROM contenedores WHERE id_contenedor = $1',
    [id]
  );
  if (!res.rows[0]) {
    throw errorValidacion(`El contenedor ${id} no existe en PostgreSQL.`, 404);
  }
  if (res.rows[0].estado === 'FUERA_SERVICIO') {
    throw errorValidacion(`El contenedor ${id} está fuera de servicio.`, 409);
  }
  return res.rows[0];
}

export class SensorRepository {
  static async registrarSensor(sensorData) {
    const datos = validarSensor(sensorData);
    const col = getDb().collection('sensores');

    const existente = await col.findOne({ id_sensor: datos.id_sensor });
    if (existente) {
      throw errorValidacion(`Ya existe un sensor con el ID ${datos.id_sensor}.`, 409);
    }

    await validarContenedorExistente(datos.id_contenedor);

    const doc = {
      ...datos,
      fecha_instalacion: datos.fecha_instalacion || new Date(),
      estado: datos.estado || 'ACTIVO',
      fecha_registro: new Date()
    };
    await col.insertOne(doc);

    try {
      await Neo4jRouteRepository.sincronizarSensor(doc);
    } catch (error) {
      console.warn(`[SensorRepository] Sensor ${doc.id_sensor} guardado en MongoDB, pero no en Neo4j: ${error.message}`);
    }

    return doc;
  }

  static async listarSensores(filtro = {}) {
    const query = {};
    if (filtro.estado) query.estado = unoDe(filtro.estado, ESTADOS_SENSOR, 'estado');
    if (filtro.id_contenedor) query.id_contenedor = textoRequerido(filtro.id_contenedor, 'id_contenedor', { max: 50 });
    if (filtro.tipo) query.tipo = textoRequerido(filtro.tipo, 'tipo', { max: 100 });
    return await getDb().collection('sensores').find(query).sort({ id_sensor: 1 }).toArray();
  }

  static async obtenerSensorPorId(id_sensor) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    return await getDb().collection('sensores').findOne({ id_sensor: id });
  }

  static async listarSensoresPorContenedor(id_contenedor) {
    const id = textoRequerido(id_contenedor, 'id_contenedor', { max: 50 });
    return await getDb().collection('sensores').find({ id_contenedor: id }).sort({ id_sensor: 1 }).toArray();
  }

  static async existeSensor(id_sensor) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    return Boolean(await getDb().collection('sensores').findOne({ id_sensor: id }, { projection: { _id: 1 } }));
  }

  static async asignarSensorAContenedor(id_sensor, id_contenedor) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    const idCont = textoRequerido(id_contenedor, 'id_contenedor', { max: 50 });
    const col = getDb().collection('sensores');

    const sensor = await col.findOne({ id_sensor: id });
    if (!sensor) {
      throw errorValidacion(`El sensor ${id} no existe.`, 404);
    }
    if (sensor.estado !== 'ACTIVO') {
      throw errorValidacion(`El sensor ${id} está inactivo y no puede asignarse.`, 409);
    }
    await validarContenedorExistente(idCont);

    await col.updateOne(
      { id_sensor: id },
      {
        $set: { id_contenedor: idCont, fecha_asignacion: new Date() },
        $unset: { fecha_desasignacion: '' }
      }
    );
    const actualizado = await col.findOne({ id_sensor: id });
    try {
      await Neo4jRouteRepository.sincronizarSensor(actualizado);
    } catch (error) {
      console.warn(`[SensorRepository] Asignación de ${id} guardada en MongoDB, pero no en Neo4j: ${error.message}`);
    }
    return actualizado;
  }

  static async desasignarSensorDeContenedor(id_sensor) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    const col = getDb().collection('sensores');
    const res = await col.updateOne(
      { id_sensor: id },
      {
        $unset: { id_contenedor: '', fecha_asignacion: '' },
        $set: { fecha_desasignacion: new Date() }
      }
    );
    if (res.matchedCount === 0) return null;
    const actualizado = await col.findOne({ id_sensor: id });
    try {
      await Neo4jRouteRepository.sincronizarSensor(actualizado);
    } catch (error) {
      console.warn(`[SensorRepository] Desasignación de ${id} guardada en MongoDB, pero no en Neo4j: ${error.message}`);
    }
    return actualizado;
  }

  static async restaurarAsignacion(id_sensor, id_contenedor) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    const col = getDb().collection('sensores');
    if (id_contenedor === undefined || id_contenedor === null || id_contenedor === '') {
      return this.desasignarSensorDeContenedor(id);
    }
    await validarContenedorExistente(id_contenedor);
    const res = await col.updateOne(
      { id_sensor: id },
      { $set: { id_contenedor: textoRequerido(id_contenedor, 'id_contenedor', { max: 50 }) } }
    );
    if (res.matchedCount === 0) return null;
    const actualizado = await col.findOne({ id_sensor: id });
    try {
      await Neo4jRouteRepository.sincronizarSensor(actualizado);
    } catch (error) {
      console.warn(`[SensorRepository] Restauración de ${id} guardada en MongoDB, pero no en Neo4j: ${error.message}`);
    }
    return actualizado;
  }

  static async actualizarSensor(id_sensor, datos) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    const actualizacion = validarSensor(datos, { parcial: true });

    if (actualizacion.id_contenedor !== undefined) {
      await validarContenedorExistente(actualizacion.id_contenedor);
    }

    const col = getDb().collection('sensores');
    const set = { ...actualizacion, fecha_actualizacion: new Date() };
    const update = { $set: set };
    if (actualizacion.id_contenedor === null) {
      delete set.id_contenedor;
      update.$unset = { id_contenedor: '', fecha_asignacion: '' };
    }

    const res = await col.updateOne({ id_sensor: id }, update);
    if (res.matchedCount === 0) return null;
    const actualizado = await col.findOne({ id_sensor: id });
    try {
      await Neo4jRouteRepository.sincronizarSensor(actualizado);
    } catch (error) {
      console.warn(`[SensorRepository] Sensor ${id} actualizado en MongoDB, pero no en Neo4j: ${error.message}`);
    }
    return actualizado;
  }

  static async darDeBajaSensor(id_sensor) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    const col = getDb().collection('sensores');
    const res = await col.updateOne(
      { id_sensor: id },
      { $set: { estado: 'INACTIVO', fecha_baja: new Date() }, $unset: { fecha_reactivacion: '' } }
    );
    if (res.matchedCount === 0) return null;
    const actualizado = await col.findOne({ id_sensor: id });
    try {
      await Neo4jRouteRepository.sincronizarSensor(actualizado);
    } catch (error) {
      console.warn(`[SensorRepository] Baja de ${id} guardada en MongoDB, pero no en Neo4j: ${error.message}`);
    }
    return actualizado;
  }

  static async activarSensor(id_sensor) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    const col = getDb().collection('sensores');
    const res = await col.updateOne(
      { id_sensor: id },
      { $set: { estado: 'ACTIVO', fecha_reactivacion: new Date() }, $unset: { fecha_baja: '' } }
    );
    if (res.matchedCount === 0) return null;
    const actualizado = await col.findOne({ id_sensor: id });
    try {
      await Neo4jRouteRepository.sincronizarSensor(actualizado);
    } catch (error) {
      console.warn(`[SensorRepository] Activación de ${id} guardada en MongoDB, pero no en Neo4j: ${error.message}`);
    }
    return actualizado;
  }

  static async contarDependencias(id_sensor) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    const db = getDb();
    const [lecturas, alertas, incidentes] = await Promise.all([
      db.collection('lecturas_sensores').countDocuments({ id_sensor: id }),
      db.collection('alertas').countDocuments({ id_sensor: id }),
      db.collection('incidentes').countDocuments({ id_sensor: id })
    ]);
    return { lecturas, alertas, incidentes, total: lecturas + alertas + incidentes };
  }

  static async eliminarSensor(id_sensor) {
    const id = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    const dependencias = await this.contarDependencias(id);
    if (dependencias.total > 0) {
      throw errorValidacion(
        `No se puede eliminar el sensor ${id}: tiene ${dependencias.lecturas} lectura(s), ` +
        `${dependencias.alertas} alerta(s) y ${dependencias.incidentes} incidente(s). ` +
        'Use la baja lógica para conservar el historial.',
        409
      );
    }
    const res = await getDb().collection('sensores').deleteOne({ id_sensor: id });
    if (res.deletedCount > 0) {
      try {
        await Neo4jRouteRepository.eliminarSensor(id);
      } catch (error) {
        console.warn(`[SensorRepository] Sensor ${id} eliminado de MongoDB, pero no de Neo4j: ${error.message}`);
      }
    }
    return res.deletedCount > 0;
  }
}

export { SensorRepository as sensorRepository, ESTADOS_SENSOR };
