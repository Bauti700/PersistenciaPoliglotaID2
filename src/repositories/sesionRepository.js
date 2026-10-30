import { redisClient } from '../config/database.js';
import crypto from 'crypto';

export class SesionRepository {
  static async crearSesion({ id_usuario, email, id_rol, ip = null, ttl = 3600 }) {
    const token = crypto.randomUUID();
    const sesion = {
      token,
      id_usuario,
      email,
      id_rol,
      ip,
      fecha_inicio: new Date().toISOString(),
      ultimo_acceso: new Date().toISOString()
    };

    await redisClient.set(`sesion:${token}`, JSON.stringify(sesion), { EX: ttl });
    await redisClient.sAdd('sesiones:activas', token);
    await redisClient.sAdd(`sesiones:usuario:${id_usuario}`, token);
    await redisClient.expire(`sesiones:usuario:${id_usuario}`, ttl);

    return sesion;
  }

  static async obtenerSesion(token) {
    const data = await redisClient.get(`sesion:${token}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static async listarSesionesActivas() {
    const tokens = await redisClient.sMembers('sesiones:activas');
    const sesiones = [];
    for (const token of tokens) {
      const data = await redisClient.get(`sesion:${token}`);
      if (!data) {
        await redisClient.sRem('sesiones:activas', token);
        continue;
      }
      try {
        const sesion = JSON.parse(data);
        const ttl = await redisClient.ttl(`sesion:${token}`);
        sesiones.push({ ...sesion, ttl_segundos: ttl });
      } catch {
        await redisClient.sRem('sesiones:activas', token);
      }
    }
    return sesiones;
  }

  static async renovarSesion(token, ttl = 3600) {
    const sesion = await this.obtenerSesion(token);
    if (!sesion) return null;
    sesion.ultimo_acceso = new Date().toISOString();
    await redisClient.set(`sesion:${token}`, JSON.stringify(sesion), { EX: ttl });
    await redisClient.expire(`sesiones:usuario:${sesion.id_usuario}`, ttl);
    return sesion;
  }

  static async cerrarSesion(token) {
    const sesion = await this.obtenerSesion(token);
    if (!sesion) return false;
    await redisClient.del(`sesion:${token}`);
    await redisClient.sRem('sesiones:activas', token);
    await redisClient.sRem(`sesiones:usuario:${sesion.id_usuario}`, token);
    return true;
  }

  static async cerrarSesionesUsuario(id_usuario) {
    const tokens = await redisClient.sMembers(`sesiones:usuario:${id_usuario}`);
    for (const token of tokens) {
      await redisClient.del(`sesion:${token}`);
      await redisClient.sRem('sesiones:activas', token);
    }
    await redisClient.del(`sesiones:usuario:${id_usuario}`);
    return tokens.length;
  }

  static async cerrarTodas() {
    const tokens = await redisClient.sMembers('sesiones:activas');
    for (const token of tokens) {
      const data = await redisClient.get(`sesion:${token}`);
      if (data) {
        try {
          const sesion = JSON.parse(data);
          await redisClient.sRem(`sesiones:usuario:${sesion.id_usuario}`, token);
        } catch {}
      }
      await redisClient.del(`sesion:${token}`);
    }
    await redisClient.del('sesiones:activas');
    const keys = await redisClient.keys('sesiones:usuario:*');
    for (const k of keys) {
      await redisClient.del(k);
    }
    return tokens.length;
  }
}

export { SesionRepository as sesionRepository };
