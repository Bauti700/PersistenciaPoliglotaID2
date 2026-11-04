import { randomUUID } from 'node:crypto';
import { getDb } from '../config/database.js';
import {
  textoRequerido,
  emailValido,
  unoDe,
  errorValidacion
} from '../utils/validation.js';

export const TIPOS_MENSAJE = ['PRIVADO', 'GRUPAL'];
const MAX_CONTENIDO = 2000;

function normalizarIdGrupo(id_grupo) {
  return textoRequerido(id_grupo, 'id_grupo', { max: 50 }).toUpperCase();
}

function integrantesNormalizados(grupo) {
  return (grupo?.integrantes || [])
    .map(integrante => String(integrante || '').trim().toLowerCase())
    .filter(Boolean);
}

export class MensajeRepository {
  // --- GRUPOS DE TRABAJO ---
  static async listarGrupos(usuario = null) {
    const grupos = await getDb()
      .collection('grupos_trabajo')
      .find({})
      .sort({ nombre: 1 })
      .toArray();

    if (!usuario) return grupos;

    const email = emailValido(usuario, 'usuario');
    return grupos.filter(grupo => integrantesNormalizados(grupo).includes(email));
  }

  static async obtenerGrupo(id_grupo) {
    const id = normalizarIdGrupo(id_grupo);
    const grupo = await getDb().collection('grupos_trabajo').findOne({ id_grupo: id });
    if (!grupo) {
      throw errorValidacion(`El grupo ${id} no existe.`, 404);
    }
    return grupo;
  }

  static async validarIntegranteGrupo(id_grupo, email) {
    const grupo = await this.obtenerGrupo(id_grupo);
    const usuario = emailValido(email, 'remitente');
    if (!integrantesNormalizados(grupo).includes(usuario)) {
      throw errorValidacion(
        `El usuario ${usuario} no pertenece al grupo ${grupo.id_grupo}.`,
        403
      );
    }
    return grupo;
  }

  // --- MENSAJERÍA PRIVADA ---
  static async enviarMensajePrivado({ remitente, destinatario, contenido }) {
    const emisor = emailValido(remitente, 'remitente');
    const receptor = emailValido(destinatario, 'destinatario');
    if (emisor === receptor) {
      throw errorValidacion('El destinatario debe ser distinto del remitente.');
    }
    const texto = textoRequerido(contenido, 'contenido', { max: MAX_CONTENIDO });

    const doc = {
      id_mensaje: `MSG-${randomUUID()}`,
      remitente: emisor,
      destinatario: receptor,
      id_grupo: null,
      contenido: texto,
      tipo: 'PRIVADO',
      formato: 'TEXTO',
      fecha: new Date(),
      estado: 'ENVIADO'
    };
    await getDb().collection('mensajes').insertOne(doc);
    return doc;
  }

  static async obtenerMensajes(usuario1, usuario2) {
    const u1 = emailValido(usuario1, 'usuario1');
    const u2 = emailValido(usuario2, 'usuario2');
    return await getDb().collection('mensajes').find({
      tipo: 'PRIVADO',
      $or: [
        { remitente: u1, destinatario: u2 },
        { remitente: u2, destinatario: u1 }
      ]
    }).sort({ fecha: 1 }).toArray();
  }

  // --- MENSAJERÍA GRUPAL ---
  static async enviarMensajeGrupal({ remitente, id_grupo, contenido }) {
    const emisor = emailValido(remitente, 'remitente');
    const grupo = await this.validarIntegranteGrupo(id_grupo, emisor);
    const texto = textoRequerido(contenido, 'contenido', { max: MAX_CONTENIDO });

    const doc = {
      id_mensaje: `MSG-${randomUUID()}`,
      remitente: emisor,
      destinatario: null,
      id_grupo: grupo.id_grupo,
      contenido: texto,
      tipo: 'GRUPAL',
      formato: 'TEXTO',
      fecha: new Date(),
      estado: 'ENVIADO'
    };
    await getDb().collection('mensajes').insertOne(doc);
    return doc;
  }

  static async obtenerMensajesGrupales(id_grupo) {
    const grupo = await this.obtenerGrupo(id_grupo);
    return await getDb().collection('mensajes').find({
      id_grupo: grupo.id_grupo,
      tipo: 'GRUPAL'
    }).sort({ fecha: 1 }).toArray();
  }

  static async listarMensajesPorGrupo(id_grupo) {
    return this.obtenerMensajesGrupales(id_grupo);
  }

  // --- ENVÍO GENÉRICO (compatibilidad) ---
  static async enviarMensaje({
    remitente,
    destinatario = null,
    id_grupo = null,
    contenido,
    tipo
  }) {
    const tipoNormalizado = unoDe(
      tipo || (id_grupo ? 'GRUPAL' : 'PRIVADO'),
      TIPOS_MENSAJE,
      'tipo'
    );

    if (tipoNormalizado === 'PRIVADO') {
      if (id_grupo !== null && id_grupo !== undefined && id_grupo !== '') {
        throw errorValidacion('Un mensaje privado no puede tener id_grupo.');
      }
      return this.enviarMensajePrivado({ remitente, destinatario, contenido });
    }

    if (destinatario !== null && destinatario !== undefined && destinatario !== '') {
      throw errorValidacion('Un mensaje grupal no puede tener destinatario individual.');
    }
    return this.enviarMensajeGrupal({ remitente, id_grupo, contenido });
  }
}

export { MensajeRepository as mensajeRepository };
