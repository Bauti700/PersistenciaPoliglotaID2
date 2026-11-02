import { getDb } from '../config/database.js';
import {
  textoRequerido,
  textoOpcional,
  enteroPositivo,
  errorValidacion
} from '../utils/validation.js';

export class EventoLogisticoRepository {
  static async registrarEventoLogistico(evento) {
    const idEnvio = textoRequerido(evento.id_envio, 'id_envio', { max: 50 });
    const tipoEvento = textoRequerido(evento.tipo_evento, 'tipo_evento', { max: 100 });
    const descripcion = textoOpcional(evento.descripcion, 'descripcion', { max: 500 });
    const ubicacion = textoOpcional(evento.ubicacion, 'ubicacion', { max: 150 });

    const fecha = evento.fecha_hora ? new Date(evento.fecha_hora) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      throw errorValidacion('El campo fecha_hora no es una fecha válida.');
    }

    const doc = {
      id_evento: evento.id_evento || `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      id_envio: idEnvio,
      fecha_hora: fecha,
      tipo_evento: tipoEvento,
      ubicacion,
      descripcion
    };

    await getDb().collection('eventos_logisticos').insertOne(doc);
    return doc;
  }

  static async listarEventosPorEnvio(id_envio, limite = 50) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const cantidad = enteroPositivo(limite, 'limite', { min: 1, max: 500 });
    return await getDb().collection('eventos_logisticos')
      .find({ id_envio: id })
      .sort({ fecha_hora: -1 })
      .limit(cantidad)
      .toArray();
  }

  static async listarEventos({ id_envio = null, tipo_evento = null, limite = 100 } = {}) {
    const filtro = {};
    if (id_envio) filtro.id_envio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    if (tipo_evento) filtro.tipo_evento = textoRequerido(tipo_evento, 'tipo_evento', { max: 100 });

    const cantidad = enteroPositivo(limite, 'limite', { min: 1, max: 500 });
    return await getDb().collection('eventos_logisticos')
      .find(filtro)
      .sort({ fecha_hora: -1 })
      .limit(cantidad)
      .toArray();
  }

  static async obtenerEventoPorId(id_evento) {
    const id = textoRequerido(id_evento, 'id_evento', { max: 100 });
    return await getDb().collection('eventos_logisticos').findOne({ id_evento: id });
  }

  static async eliminarEventoLogistico(id_evento) {
    const id = textoRequerido(id_evento, 'id_evento', { max: 100 });
    const res = await getDb().collection('eventos_logisticos').deleteOne({ id_evento: id });
    return res.deletedCount > 0;
  }
}

export { EventoLogisticoRepository as eventoLogisticoRepository };
