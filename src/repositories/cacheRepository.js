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

  // --- CACHÉ GENÉRICA (JSON CON TTL OPCIONAL) ---
  // Se usa con claves ya prefijadas por el consumidor, por ejemplo
  // "envio:estado:ENV-1001" o "prediccion:riesgo:ENV-1001".
  static async setCache(key, value, ttlSegundos = null) {
    if (!redisClient.isOpen) return false;
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    const ttl = Number(ttlSegundos);
    if (Number.isFinite(ttl) && ttl > 0) {
      await redisClient.set(key, payload, { EX: Math.floor(ttl) });
    } else {
      await redisClient.set(key, payload);
    }
    return true;
  }

  static async getCache(key) {
    if (!redisClient.isOpen) return null;
    const raw = await redisClient.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  static async delCache(key) {
    if (!redisClient.isOpen) return false;
    return (await redisClient.del(key)) > 0;
  }

  // --- CACHÉ DE ÚLTIMA POSICIÓN GPS (GEO / HASH) ---
  static async actualizarUltimaPosicion(id_contenedor, lat, lng, datosExtra = {}) {
    if (!redisClient.isOpen) return false;
    const key = `contenedor:posicion:${id_contenedor}`;
    const campos = {
      latitud: String(lat),
      longitud: String(lng),
      actualizado_en: new Date().toISOString()
    };
    for (const [campo, valor] of Object.entries(datosExtra || {})) {
      if (valor !== undefined && valor !== null && valor !== '') {
        campos[campo] = String(valor);
      }
    }
    await redisClient.hSet(key, campos);
    // Agregar a índice espacial de Redis
    try {
      await redisClient.geoAdd('contenedores:geo', {
        longitude: Number(lng),
        latitude: Number(lat),
        member: id_contenedor
      });
    } catch (e) {
      console.warn(`[Redis] No se pudo actualizar el índice geoespacial: ${e.message}`);
    }
    return true;
  }

  static async obtenerUltimaPosicion(id_contenedor) {
    if (!redisClient.isOpen) return null;
    const pos = await redisClient.hGetAll(`contenedor:posicion:${id_contenedor}`);
    return Object.keys(pos).length > 0 ? pos : null;
  }

  static async obtenerTodasPosiciones() {
    if (!redisClient.isOpen) return [];
    try {
      const keys = await redisClient.keys('contenedor:posicion:*');
      const posiciones = [];
      for (const key of keys) {
        const id_contenedor = key.replace('contenedor:posicion:', '');
        const pos = await redisClient.hGetAll(key);
        if (Object.keys(pos).length > 0) {
          posiciones.push({ id_contenedor, ...pos });
        }
      }
      return posiciones;
    } catch (e) {
      return [];
    }
  }

  static async obtenerPosicionesCercanas(lng, lat, radioKm = 100) {
    if (!redisClient.isOpen) return [];
    try {
      const members = await redisClient.geoRadius(
        'contenedores:geo',
        { longitude: Number(lng), latitude: Number(lat) },
        Number(radioKm),
        'km'
      );
      const posiciones = [];
      for (const member of members) {
        const id_contenedor = typeof member === 'string' ? member : member.member;
        const pos = await redisClient.hGetAll(`contenedor:posicion:${id_contenedor}`);
        posiciones.push({ id_contenedor, ...pos });
      }
      return posiciones;
    } catch (e) {
      console.warn(`[Redis] No se pudo consultar posiciones cercanas: ${e.message}`);
      return [];
    }
  }

  // --- CACHÉ DE PREDICCIÓN DE RIESGO ---
  // La misma clave se usa en RiesgoService y en la invalidación que disparan
  // los cambios de envío y los incidentes.
  static clavePrediccionRiesgo(id_envio) {
    return `prediccion:riesgo:${id_envio}`;
  }

  static async cachearPrediccionRiesgo(id_envio, prediccion, ttlSegundos = 86400) {
    if (!redisClient.isOpen) return false;
    const key = RedisCacheRepository.clavePrediccionRiesgo(id_envio);
    await redisClient.set(key, JSON.stringify(prediccion), { EX: ttlSegundos });
    return true;
  }

  static async obtenerPrediccionRiesgo(id_envio) {
    if (!redisClient.isOpen) return null;
    const raw = await redisClient.get(RedisCacheRepository.clavePrediccionRiesgo(id_envio));
    return raw ? JSON.parse(raw) : null;
  }

  static async invalidarPrediccionRiesgo(id_envio) {
    if (!redisClient.isOpen || !id_envio) return false;
    return (await redisClient.del(RedisCacheRepository.clavePrediccionRiesgo(id_envio))) > 0;
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
