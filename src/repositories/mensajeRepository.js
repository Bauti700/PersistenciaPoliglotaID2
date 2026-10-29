import { getDb } from '../config/database.js';

export class MensajeRepository {
  // --- MENSAJERÍA ---
  static async enviarMensaje({ remitente, destinatario, id_grupo = null, contenido, tipo = 'PRIVADO' }) {
    const col = getDb().collection('mensajes');
    const doc = {
      id_mensaje: `MSG-${Date.now()}`,
      remitente,
      destinatario,
      id_grupo,
      contenido,
      tipo,
      fecha: new Date(),
      estado: 'ENVIADO'
    };
    await col.insertOne(doc);
    return doc;
  }

  static async obtenerMensajes(usuario1, usuario2) {
    return await getDb().collection('mensajes').find({
      $or: [
        { remitente: usuario1, destinatario: usuario2 },
        { remitente: usuario2, destinatario: usuario1 }
      ]
    }).sort({ fecha: 1 }).toArray();
  }

  static async listarMensajesPorGrupo(id_grupo) {
    return await getDb().collection('mensajes').find({ id_grupo }).sort({ fecha: 1 }).toArray();
  }
}

export { MensajeRepository as mensajeRepository };
