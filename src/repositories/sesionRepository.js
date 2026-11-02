import { redisClient, pgPool } from '../config/database.js';
import crypto from 'crypto';
import { UsuarioRepository } from './usuarioRepository.js';
import { enteroPositivo, textoRequerido, unoDe, errorValidacion } from '../utils/validation.js';

const ESTADOS_HISTORIAL = ['ACTIVA', 'CERRADA', 'EXPIRADA'];

function asegurarRedis() {
  if (!redisClient.isOpen) {
    throw new Error('Redis no está disponible. No se pueden gestionar sesiones.');
  }
}

function normalizarToken(token) {
  return textoRequerido(token, 'token', { min: 8, max: 64 });
}

export class SesionRepository {
  static async crearSesion({ id_usuario, email, id_rol, ip = null, ttl = 3600 }) {
    asegurarRedis();
    await UsuarioRepository.ensureSchema();

    const usuario = enteroPositivo(id_usuario, 'id_usuario');
    const rol = enteroPositivo(id_rol, 'id_rol');
    const correo = textoRequerido(email, 'email', { max: 100 });
    const ttlSegundos = enteroPositivo(ttl, 'ttl', { min: 60, max: 86400 });
    const ipOrigen = ip ? textoRequerido(ip, 'ip', { max: 45 }) : null;

    const token = crypto.randomUUID();
    const ahora = new Date().toISOString();
    const sesion = {
      token,
      id_usuario: usuario,
      email: correo,
      id_rol: rol,
      ip: ipOrigen,
      fecha_inicio: ahora,
      ultimo_acceso: ahora
    };

    await redisClient.set(`sesion:${token}`, JSON.stringify(sesion), { EX: ttlSegundos });
    await redisClient.sAdd('sesiones:activas', token);
    await redisClient.sAdd(`sesiones:usuario:${usuario}`, token);
    await redisClient.expire(`sesiones:usuario:${usuario}`, ttlSegundos);

    try {
      await pgPool.query(`
        INSERT INTO historial_sesiones
          (id_usuario, id_rol, token, ip_origen, fecha_inicio, fecha_ultima_actividad, estado)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ACTIVA')
      `, [usuario, rol, token, ipOrigen]);
    } catch (error) {
      // Si no se puede auditar la sesión, se revierte la creación en Redis para
      // no dejar una sesión sin respaldo en PostgreSQL.
      await redisClient.del(`sesion:${token}`);
      await redisClient.sRem('sesiones:activas', token);
      await redisClient.sRem(`sesiones:usuario:${usuario}`, token);
      throw new Error(`No se pudo registrar el historial de la sesión: ${error.message}`);
    }

    await UsuarioRepository.marcarSesionActiva(usuario, true);
    return sesion;
  }

  static async obtenerSesion(token) {
    asegurarRedis();
    const tokenNormalizado = normalizarToken(token);
    const data = await redisClient.get(`sesion:${tokenNormalizado}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      await redisClient.del(`sesion:${tokenNormalizado}`);
      return null;
    }
  }

  static async listarSesionesActivas() {
    asegurarRedis();
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
    return sesiones.sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)));
  }

  static async renovarSesion(token, ttl = 3600) {
    asegurarRedis();
    const sesion = await this.obtenerSesion(token);
    if (!sesion) return null;

    const ttlSegundos = enteroPositivo(ttl, 'ttl', { min: 60, max: 86400 });
    sesion.ultimo_acceso = new Date().toISOString();
    await redisClient.set(`sesion:${sesion.token}`, JSON.stringify(sesion), { EX: ttlSegundos });
    await redisClient.sAdd(`sesiones:usuario:${sesion.id_usuario}`, sesion.token);
    await redisClient.expire(`sesiones:usuario:${sesion.id_usuario}`, ttlSegundos);

    await pgPool.query(`
      UPDATE historial_sesiones
      SET fecha_ultima_actividad = CURRENT_TIMESTAMP
      WHERE token = $1 AND estado = 'ACTIVA'
    `, [sesion.token]);

    return sesion;
  }

  static async cerrarSesion(token) {
    asegurarRedis();
    const tokenNormalizado = normalizarToken(token);
    const sesion = await this.obtenerSesion(tokenNormalizado);

    await redisClient.del(`sesion:${tokenNormalizado}`);
    await redisClient.sRem('sesiones:activas', tokenNormalizado);

    if (sesion) {
      await redisClient.sRem(`sesiones:usuario:${sesion.id_usuario}`, tokenNormalizado);
      const restantes = await redisClient.sCard(`sesiones:usuario:${sesion.id_usuario}`);
      if (restantes === 0) {
        await UsuarioRepository.marcarSesionActiva(sesion.id_usuario, false);
      }
    }

    const res = await pgPool.query(`
      UPDATE historial_sesiones
      SET estado = 'CERRADA', fecha_fin = CURRENT_TIMESTAMP
      WHERE token = $1 AND estado = 'ACTIVA'
      RETURNING id_usuario
    `, [tokenNormalizado]);

    if (res.rows[0]) {
      const restantes = await redisClient.sCard(`sesiones:usuario:${res.rows[0].id_usuario}`);
      if (restantes === 0) {
        await UsuarioRepository.marcarSesionActiva(res.rows[0].id_usuario, false);
      }
    }

    return Boolean(sesion || res.rows[0]);
  }

  static async cerrarSesionesUsuario(id_usuario) {
    asegurarRedis();
    const usuario = enteroPositivo(id_usuario, 'id_usuario');
    const tokens = await redisClient.sMembers(`sesiones:usuario:${usuario}`);

    for (const token of tokens) {
      await redisClient.del(`sesion:${token}`);
      await redisClient.sRem('sesiones:activas', token);
    }
    await redisClient.del(`sesiones:usuario:${usuario}`);

    await pgPool.query(`
      UPDATE historial_sesiones
      SET estado = 'CERRADA', fecha_fin = CURRENT_TIMESTAMP
      WHERE id_usuario = $1 AND estado = 'ACTIVA'
    `, [usuario]);
    await UsuarioRepository.marcarSesionActiva(usuario, false);

    return tokens.length;
  }

  static async cerrarTodas() {
    asegurarRedis();
    const tokens = await redisClient.sMembers('sesiones:activas');

    for (const token of tokens) {
      await redisClient.del(`sesion:${token}`);
    }
    await redisClient.del('sesiones:activas');

    const keys = await redisClient.keys('sesiones:usuario:*');
    for (const key of keys) {
      await redisClient.del(key);
    }

    await pgPool.query(`
      UPDATE historial_sesiones
      SET estado = 'CERRADA', fecha_fin = CURRENT_TIMESTAMP
      WHERE estado = 'ACTIVA'
    `);
    await pgPool.query('UPDATE usuarios SET sesion_activa = FALSE WHERE sesion_activa = TRUE');

    return tokens.length;
  }

  static async listarHistorialSesiones({ id_usuario = null, estado = null, limite = 50 } = {}) {
    await UsuarioRepository.ensureSchema();
    const condiciones = [];
    const params = [];

    if (id_usuario !== null && id_usuario !== undefined && id_usuario !== '') {
      params.push(enteroPositivo(id_usuario, 'id_usuario'));
      condiciones.push(`h.id_usuario = $${params.length}`);
    }
    if (estado) {
      params.push(unoDe(estado, ESTADOS_HISTORIAL, 'estado'));
      condiciones.push(`h.estado = $${params.length}`);
    }

    const limiteNormalizado = enteroPositivo(limite, 'limite', { min: 1, max: 500 });
    params.push(limiteNormalizado);
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const res = await pgPool.query(`
      SELECT h.*, u.nombre, u.apellido, u.email, r.descripcion AS rol_descripcion
      FROM historial_sesiones h
      JOIN usuarios u ON u.id_usuario = h.id_usuario
      LEFT JOIN roles r ON r.id_rol = h.id_rol
      ${where}
      ORDER BY h.fecha_inicio DESC
      LIMIT $${params.length}
    `, params);
    return res.rows;
  }

  static async obtenerHistorialSesion(token) {
    await UsuarioRepository.ensureSchema();
    const tokenNormalizado = normalizarToken(token);
    const res = await pgPool.query(
      'SELECT * FROM historial_sesiones WHERE token = $1',
      [tokenNormalizado]
    );
    return res.rows[0] || null;
  }

  static async limpiarHistorialExpirado(dias = 30) {
    const diasNormalizados = enteroPositivo(dias, 'dias', { min: 1, max: 3650 });
    const res = await pgPool.query(`
      UPDATE historial_sesiones
      SET estado = 'EXPIRADA', fecha_fin = COALESCE(fecha_fin, CURRENT_TIMESTAMP)
      WHERE estado = 'ACTIVA'
        AND fecha_ultima_actividad < CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 day')
      RETURNING id_sesion
    `, [diasNormalizados]);
    return res.rowCount;
  }
}

export { SesionRepository as sesionRepository };
