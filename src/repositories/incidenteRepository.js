import { getDb } from '../config/database.js';
import { RedisCacheRepository } from './cacheRepository.js';
import {
  textoRequerido,
  textoOpcional,
  unoDe,
  enteroPositivo,
  errorValidacion
} from '../utils/validation.js';

export const TIPOS_INCIDENTE = [
  'EXCESO_TEMPERATURA',
  'BATERIA_BAJA',
  'SENSOR_INACTIVO',
  'DESVIO_RUTA',
  'RUPTURA_CADENA_FRIO',
  'DEMORA',
  'VIBRACION_EXCESIVA',
  'CONDICIONES_CLIMATICAS',
  'OTRO'
];

export const SEVERIDADES_INCIDENTE = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
export const ESTADOS_INCIDENTE = ['ABIERTO', 'EN_PROCESO', 'CERRADO'];
const ESTADOS_ABIERTOS = ['ABIERTO', 'EN_PROCESO'];

// Cuando cambia un incidente, la predicción de riesgo del envío queda
// desactualizada. La invalidación es best-effort para no bloquear el ABM.
async function invalidarPrediccionDeIncidente(id_envio) {
  if (!id_envio) return;
  try {
    await RedisCacheRepository.invalidarPrediccionRiesgo(id_envio);
  } catch (error) {
    console.warn(`[Incidentes] No se pudo invalidar la predicción de ${id_envio}: ${error.message}`);
  }
}

function fechaValida(valor, campo = 'fecha') {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw errorValidacion(`El campo ${campo} no es una fecha válida.`);
  }
  return fecha;
}

function validarIncidente(data, { parcial = false } = {}) {
  const incidente = {};
  let cantidad = 0;

  if (data.id_incidente !== undefined) {
    incidente.id_incidente = textoRequerido(data.id_incidente, 'id_incidente', { max: 100 });
    cantidad++;
  } else if (!parcial) {
    incidente.id_incidente = `INC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  if (data.id_envio !== undefined) {
    incidente.id_envio = textoOpcional(data.id_envio, 'id_envio', { max: 50 });
    cantidad++;
  } else if (!parcial) {
    incidente.id_envio = null;
  }

  if (data.id_sensor !== undefined) {
    incidente.id_sensor = textoOpcional(data.id_sensor, 'id_sensor', { max: 50 });
    cantidad++;
  } else if (!parcial) {
    incidente.id_sensor = null;
  }

  if (data.id_contenedor !== undefined) {
    incidente.id_contenedor = textoOpcional(data.id_contenedor, 'id_contenedor', { max: 50 });
    cantidad++;
  } else if (!parcial) {
    incidente.id_contenedor = null;
  }

  if (data.tipo !== undefined) {
    incidente.tipo = unoDe(data.tipo, TIPOS_INCIDENTE, 'tipo');
    cantidad++;
  } else if (!parcial) {
    throw errorValidacion('El campo tipo es obligatorio.');
  }

  if (data.severidad !== undefined) {
    incidente.severidad = unoDe(data.severidad, SEVERIDADES_INCIDENTE, 'severidad');
    cantidad++;
  } else if (!parcial) {
    incidente.severidad = 'MEDIA';
  }

  if (data.descripcion !== undefined) {
    incidente.descripcion = textoOpcional(data.descripcion, 'descripcion', { max: 500 });
    cantidad++;
  } else if (!parcial) {
    incidente.descripcion = null;
  }

  if (data.estado !== undefined) {
    incidente.estado = unoDe(data.estado, ESTADOS_INCIDENTE, 'estado');
    cantidad++;
  } else if (!parcial) {
    incidente.estado = 'ABIERTO';
  }

  if (data.ubicacion !== undefined) {
    incidente.ubicacion = textoOpcional(data.ubicacion, 'ubicacion', { max: 150 });
    cantidad++;
  } else if (!parcial) {
    incidente.ubicacion = null;
  }

  if (data.fecha !== undefined) {
    incidente.fecha = fechaValida(data.fecha, 'fecha');
    cantidad++;
  } else if (!parcial) {
    incidente.fecha = new Date();
  }

  if (parcial && cantidad === 0) {
    throw errorValidacion('Debe indicar al menos un campo del incidente para actualizar.');
  }

  return incidente;
}

export class IncidenteRepository {
  // --- INCIDENTES ---
  static async registrarIncidente(incidente) {
    const doc = validarIncidente(incidente);
    await getDb().collection('incidentes').insertOne(doc);
    await invalidarPrediccionDeIncidente(doc.id_envio);
    return doc;
  }

  static async actualizarIncidente(id_incidente, cambios) {
    const id = textoRequerido(id_incidente, 'id_incidente', { max: 100 });
    const actualizacion = validarIncidente(cambios, { parcial: true });
    const col = getDb().collection('incidentes');
    const previo = await col.findOne({ id_incidente: id }, { projection: { id_envio: 1 } });
    const res = await col.updateOne(
      { id_incidente: id },
      { $set: { ...actualizacion, fecha_actualizacion: new Date() } }
    );
    if (res.matchedCount === 0) return null;
    const actualizado = await col.findOne({ id_incidente: id });
    await invalidarPrediccionDeIncidente(previo?.id_envio);
    await invalidarPrediccionDeIncidente(actualizado?.id_envio);
    return actualizado;
  }

  static async existeIncidenteAbierto({ id_sensor = null, tipo = null, id_envio = null } = {}) {
    const filtro = { estado: { $in: ESTADOS_ABIERTOS } };
    if (id_sensor) filtro.id_sensor = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    if (tipo) filtro.tipo = unoDe(tipo, TIPOS_INCIDENTE, 'tipo');
    if (id_envio) filtro.id_envio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const res = await getDb().collection('incidentes').findOne(filtro, { projection: { _id: 1 } });
    return Boolean(res);
  }

  static async listarIncidentes({
    estado = null,
    id_envio = null,
    id_sensor = null,
    id_contenedor = null,
    tipo = null,
    limite = 100
  } = {}) {
    const filtro = {};
    if (estado) filtro.estado = unoDe(estado, ESTADOS_INCIDENTE, 'estado');
    if (id_envio) filtro.id_envio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    if (id_sensor) filtro.id_sensor = textoRequerido(id_sensor, 'id_sensor', { max: 50 });
    if (id_contenedor) filtro.id_contenedor = textoRequerido(id_contenedor, 'id_contenedor', { max: 50 });
    if (tipo) filtro.tipo = unoDe(tipo, TIPOS_INCIDENTE, 'tipo');

    const cantidad = enteroPositivo(limite, 'limite', { min: 1, max: 500 });
    return await getDb().collection('incidentes')
      .find(filtro)
      .sort({ fecha: -1 })
      .limit(cantidad)
      .toArray();
  }

  static async listarIncidentesAbiertos() {
    return await this.listarIncidentes({ estado: 'ABIERTO', limite: 500 });
  }

  static async listarIncidentesPorEnvio(id_envio) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });
    return await this.listarIncidentes({ id_envio: id, limite: 500 });
  }

  static async cerrarIncidente(id_incidente) {
    const id = textoRequerido(id_incidente, 'id_incidente', { max: 100 });
    const col = getDb().collection('incidentes');
    const res = await col.updateOne(
      { id_incidente: id, estado: { $in: ESTADOS_ABIERTOS } },
      { $set: { estado: 'CERRADO', fecha_cierre: new Date() } }
    );
    if (res.matchedCount === 0) return null;
    const cerrado = await col.findOne({ id_incidente: id });
    await invalidarPrediccionDeIncidente(cerrado?.id_envio);
    return cerrado;
  }

  // --- ANALÍTICA DE INCIDENTES POR ENVÍO (AGGREGATION PIPELINE) ---
  static async obtenerIncidentesPorEnvio() {
    return await getDb().collection('incidentes').aggregate([
      {
        $group: {
          _id: '$id_envio',
          total_incidentes: { $sum: 1 },
          criticos: {
            $sum: {
              $cond: [{ $in: ['$severidad', ['ALTA', 'CRITICA']] }, 1, 0]
            }
          },
          leves: {
            $sum: {
              $cond: [{ $in: ['$severidad', ['MEDIA', 'BAJA']] }, 1, 0]
            }
          },
          abiertos: {
            $sum: {
              $cond: [{ $in: ['$estado', ['ABIERTO', 'EN_PROCESO']] }, 1, 0]
            }
          },
          tipos: { $addToSet: '$tipo' },
          ultimos_incidentes: {
            $push: {
              id: '$id_incidente',
              tipo: '$tipo',
              severidad: '$severidad',
              estado: '$estado',
              descripcion: '$descripcion'
            }
          }
        }
      }
    ]).toArray();
  }
}

export { IncidenteRepository as incidenteRepository };
