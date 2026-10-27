import { redisClient } from '../config/database.js';

export class RedisCacheRepository {
  // --- GESTIÓN DE SESIONES CON TTL ---
  static async guardarSesion(id_sesion, datosUsuario, ttlSegundos = 3600) {
    if (!redisClient.isOpen) return false;
    const key = `sesion:${id_sesion}`;
    await redisClient.hSet(key, {
      id_usuario: String(datosUsuario.id_usuario),
      email: datosUsuario.email,
      rol: String(datosUsuario.id_rol || 'CLIENTE'),
      login_time: new Date().toISOString()
    });
    await redisClient.expire(key, ttlSegundos);
    return true;
  }

  static async obtenerSesion(id_sesion) {
    if (!redisClient.isOpen) return null;
    const data = await redisClient.hGetAll(`sesion:${id_sesion}`);
    return Object.keys(data).length > 0 ? data : null;
  }

  static async cerrarSesion(id_sesion) {
    if (!redisClient.isOpen) return false;
    await redisClient.del(`sesion:${id_sesion}`);
    return true;
  }

  // --- CACHÉ DE ÚLTIMA POSICIÓN GPS (GEO / HASH) ---
  static async actualizarUltimaPosicion(id_contenedor, lat, lng, datosExtra = {}) {
    if (!redisClient.isOpen) return false;
    const key = `contenedor:posicion:${id_contenedor}`;
    await redisClient.hSet(key, {
      latitud: String(lat),
      longitud: String(lng),
      actualizado_en: new Date().toISOString(),
      ...datosExtra
    });
    // Opcional: Agregar a índice espacial de Redis
    try {
      await redisClient.geoAdd('contenedores:geo', {
        longitude: Number(lng),
        latitude: Number(lat),
        member: id_contenedor
      });
    } catch (e) {}
    return true;
  }

  static async obtenerUltimaPosicion(id_contenedor) {
    if (!redisClient.isOpen) return null;
    const pos = await redisClient.hGetAll(`contenedor:posicion:${id_contenedor}`);
    return Object.keys(pos).length > 0 ? pos : null;
  }

  // --- CACHÉ DE PREDICCIÓN DE RIESGO ---
  static async cachearPrediccionRiesgo(id_envio, prediccion, ttlSegundos = 86400) {
    if (!redisClient.isOpen) return false;
    const key = `prediccion:envio:${id_envio}`;
    await redisClient.set(key, JSON.stringify(prediccion), { EX: ttlSegundos });
    return true;
  }

  static async obtenerPrediccionRiesgo(id_envio) {
    if (!redisClient.isOpen) return null;
    const raw = await redisClient.get(`prediccion:envio:${id_envio}`);
    return raw ? JSON.parse(raw) : null;
  }

  // --- CACHÉ DE INTELIGENCIA ANALÍTICA Y REPORTES ---
  static async cachearAnalitica(clave, datos, ttlSegundos = 3600) {
    if (!redisClient.isOpen) return false;
    const key = `analytics:${clave}`;
    await redisClient.set(key, JSON.stringify(datos), { EX: ttlSegundos });
    return true;
  }

  static async obtenerAnaliticaCacheada(clave) {
    if (!redisClient.isOpen) return null;
    const raw = await redisClient.get(`analytics:${clave}`);
    return raw ? JSON.parse(raw) : null;
  }
}

export { RedisCacheRepository as RedisRepository };
