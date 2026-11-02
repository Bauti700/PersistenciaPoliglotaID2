import { pgPool } from '../config/database.js';
import bcrypt from 'bcryptjs';
import {
  textoRequerido,
  textoOpcional,
  emailValido,
  enteroPositivo,
  unoDe,
  objetoJson,
  errorValidacion
} from '../utils/validation.js';

const ESTADOS_GENERALES = ['ACTIVO', 'INACTIVO'];
const ESTADOS_USUARIO = ['ACTIVO', 'INACTIVO', 'BLOQUEADO'];
const PERMISOS_ADMIN = {
  admin: true,
  seguridad: true,
  usuarios: true,
  roles: true,
  sesiones: true,
  envios: true,
  alertas: true,
  finanzas: true
};

function normalizarEmail(email) {
  return emailValido(email).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarPermisos(permisos) {
  return objetoJson(permisos, 'permisos');
}

function sinPassword(usuario) {
  if (!usuario) return null;
  const { password_hash, ...resto } = usuario;
  return resto;
}

export class UsuarioRepository {
  static async ensureSchema() {
    const alteraciones = [
      "ALTER TABLE roles ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '{}'::jsonb",
      'ALTER TABLE roles ADD COLUMN IF NOT EXISTS nivel_permisos INTEGER DEFAULT 1',
      "ALTER TABLE roles ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'ACTIVO'",
      'ALTER TABLE roles ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)',
      'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_ultimo_acceso TIMESTAMP',
      'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_activa BOOLEAN DEFAULT FALSE',
      "ALTER TABLE historial_sesiones ADD COLUMN IF NOT EXISTS token VARCHAR(64)",
      'ALTER TABLE historial_sesiones ADD COLUMN IF NOT EXISTS id_rol INTEGER',
      'ALTER TABLE historial_sesiones ADD COLUMN IF NOT EXISTS fecha_ultima_actividad TIMESTAMP'
    ];

    for (const query of alteraciones) {
      try {
        await pgPool.query(query);
      } catch (error) {
        if (!['42701', '42P01'].includes(error.code)) {
          console.warn(`[UsuarioRepository] No se pudo aplicar migración: ${error.message}`);
        }
      }
    }

    try {
      await pgPool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_historial_sesiones_token
        ON historial_sesiones (token)
        WHERE token IS NOT NULL
      `);
    } catch (error) {
      if (error.code !== '42P01') {
        console.warn(`[UsuarioRepository] No se pudo crear índice de sesiones: ${error.message}`);
      }
    }

    // Completa permisos de roles existentes que fueron creados antes de la
    // incorporación de la columna JSONB.
    try {
      await pgPool.query(`
        UPDATE roles
        SET permisos = $1::jsonb
        WHERE UPPER(descripcion) IN ('ADMIN', 'ADMINISTRADOR')
          AND (permisos IS NULL OR permisos = '{}'::jsonb)
      `, [JSON.stringify(PERMISOS_ADMIN)]);
    } catch (error) {
      if (error.code !== '42P01') {
        console.warn(`[UsuarioRepository] No se pudieron completar permisos de ADMIN: ${error.message}`);
      }
    }
  }

  // --- ROLES ---
  static validarRol(data = {}, parcial = false) {
    const rol = {};
    let cantidad = 0;

    if (data.descripcion !== undefined) {
      rol.descripcion = textoRequerido(data.descripcion, 'descripcion', { max: 100 }).toUpperCase();
      cantidad++;
    } else if (!parcial) {
      throw errorValidacion('El campo descripcion es obligatorio.');
    }

    if (data.nivel_permisos !== undefined) {
      rol.nivel_permisos = enteroPositivo(data.nivel_permisos, 'nivel_permisos', { min: 1, max: 10 });
      cantidad++;
    } else if (!parcial) {
      rol.nivel_permisos = 1;
    }

    if (data.permisos !== undefined) {
      rol.permisos = normalizarPermisos(data.permisos);
      cantidad++;
    } else if (!parcial) {
      rol.permisos = {};
    }

    if (data.estado !== undefined) {
      rol.estado = unoDe(data.estado, ESTADOS_GENERALES, 'estado');
      cantidad++;
    } else if (!parcial) {
      rol.estado = 'ACTIVO';
    }

    if (parcial && cantidad === 0) {
      throw errorValidacion('Debe indicar al menos un campo del rol para actualizar.');
    }
    return rol;
  }

  static async crearRol(data) {
    await this.ensureSchema();
    const rol = this.validarRol(data);

    const existente = await pgPool.query(
      'SELECT id_rol FROM roles WHERE UPPER(descripcion) = $1',
      [rol.descripcion]
    );
    if (existente.rows[0]) {
      throw errorValidacion(`Ya existe un rol con la descripción ${rol.descripcion}.`, 409);
    }

    const res = await pgPool.query(`
      INSERT INTO roles (descripcion, nivel_permisos, permisos, estado)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [rol.descripcion, rol.nivel_permisos, JSON.stringify(rol.permisos), rol.estado]);
    return res.rows[0];
  }

  static async listarRoles({ soloActivos = false } = {}) {
    await this.ensureSchema();
    const where = soloActivos ? "WHERE estado = 'ACTIVO'" : '';
    const res = await pgPool.query(`
      SELECT r.*,
             (SELECT COUNT(*)::int FROM usuarios u WHERE u.id_rol = r.id_rol) AS cantidad_usuarios
      FROM roles r
      ${where}
      ORDER BY r.nivel_permisos DESC, r.id_rol ASC
    `);
    return res.rows;
  }

  static async obtenerRolPorId(id_rol) {
    await this.ensureSchema();
    const id = enteroPositivo(id_rol, 'id_rol');
    const res = await pgPool.query('SELECT * FROM roles WHERE id_rol = $1', [id]);
    return res.rows[0] || null;
  }

  static async actualizarRol(id_rol, datos) {
    await this.ensureSchema();
    const id = enteroPositivo(id_rol, 'id_rol');
    const rol = this.validarRol(datos, true);

    if (rol.descripcion) {
      const existente = await pgPool.query(
        'SELECT id_rol FROM roles WHERE UPPER(descripcion) = $1 AND id_rol <> $2',
        [rol.descripcion, id]
      );
      if (existente.rows[0]) {
        throw errorValidacion(`Ya existe un rol con la descripción ${rol.descripcion}.`, 409);
      }
    }

    const entries = Object.entries(rol);
    const valores = entries.map(([campo, valor]) => campo === 'permisos' ? JSON.stringify(valor) : valor);
    valores.push(id);
    const assignments = entries.map(([campo], index) => `${campo} = $${index + 1}`);
    const res = await pgPool.query(
      `UPDATE roles SET ${assignments.join(', ')} WHERE id_rol = $${entries.length + 1} RETURNING *`,
      valores
    );
    return res.rows[0] || null;
  }

  static async desactivarRol(id_rol) {
    await this.ensureSchema();
    const id = enteroPositivo(id_rol, 'id_rol');
    const asignados = await pgPool.query(
      "SELECT COUNT(*)::int AS total FROM usuarios WHERE id_rol = $1 AND estado = 'ACTIVO'",
      [id]
    );
    if (asignados.rows[0].total > 0) {
      throw errorValidacion(
        'No se puede desactivar un rol que tiene usuarios activos. Reasigne esos usuarios primero.',
        409
      );
    }
    const res = await pgPool.query(
      "UPDATE roles SET estado = 'INACTIVO' WHERE id_rol = $1 RETURNING *",
      [id]
    );
    return res.rows[0] || null;
  }

  static async activarRol(id_rol) {
    await this.ensureSchema();
    const id = enteroPositivo(id_rol, 'id_rol');
    const res = await pgPool.query(
      "UPDATE roles SET estado = 'ACTIVO' WHERE id_rol = $1 RETURNING *",
      [id]
    );
    return res.rows[0] || null;
  }

  static async eliminarRol(id_rol) {
    await this.ensureSchema();
    const id = enteroPositivo(id_rol, 'id_rol');
    const asignados = await pgPool.query(
      'SELECT COUNT(*)::int AS total FROM usuarios WHERE id_rol = $1',
      [id]
    );
    if (asignados.rows[0].total > 0) {
      throw errorValidacion('No se puede eliminar un rol asignado a usuarios.', 409);
    }
    const res = await pgPool.query('DELETE FROM roles WHERE id_rol = $1 RETURNING *', [id]);
    return res.rows[0] || null;
  }

  // --- USUARIOS ---
  static async obtenerRolActivo(id_rol) {
    const rol = await this.obtenerRolPorId(id_rol);
    if (!rol) {
      throw errorValidacion(`El rol ${id_rol} no existe.`, 404);
    }
    if (rol.estado !== 'ACTIVO') {
      throw errorValidacion(`El rol ${rol.descripcion} está inactivo y no puede asignarse.`, 409);
    }
    return rol;
  }

  static async validarCliente(id_cliente) {
    if (id_cliente === undefined || id_cliente === null || id_cliente === '') return null;
    const id = enteroPositivo(id_cliente, 'id_cliente');
    const res = await pgPool.query('SELECT id_cliente FROM clientes WHERE id_cliente = $1', [id]);
    if (!res.rows[0]) {
      throw errorValidacion(`El cliente ${id} no existe.`, 404);
    }
    return id;
  }

  static async crearUsuario(data) {
    await this.ensureSchema();
    const nombre = textoRequerido(data.nombre, 'nombre', { max: 100 });
    const apellido = textoRequerido(data.apellido, 'apellido', { max: 100 });
    const email = normalizarEmail(data.email);
    const password = textoRequerido(data.password, 'password', { min: 6, max: 100 });
    const id_rol = enteroPositivo(data.id_rol, 'id_rol');
    const id_cliente = await this.validarCliente(data.id_cliente);
    const estado = data.estado !== undefined
      ? unoDe(data.estado, ESTADOS_USUARIO, 'estado')
      : 'ACTIVO';

    await this.obtenerRolActivo(id_rol);

    const existente = await pgPool.query('SELECT id_usuario FROM usuarios WHERE LOWER(email) = $1', [email.toLowerCase()]);
    if (existente.rows[0]) {
      throw errorValidacion(`Ya existe un usuario con el email ${email}.`, 409);
    }

    const hash = await bcrypt.hash(password, 10);
    const res = await pgPool.query(`
      INSERT INTO usuarios (id_cliente, nombre, apellido, id_rol, email, password_hash, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `, [id_cliente, nombre, apellido, id_rol, email, hash, estado]);
    return sinPassword(res.rows[0]);
  }

  static async listarUsuarios(filtro = {}) {
    await this.ensureSchema();
    let query = `
      SELECT u.id_usuario, u.id_cliente, u.nombre, u.apellido, u.id_rol, u.email,
             u.estado, u.fecha_ultimo_acceso, u.sesion_activa,
             r.descripcion AS rol_descripcion,
             r.nivel_permisos,
             r.permisos,
             r.estado AS rol_estado
      FROM usuarios u
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE 1=1
    `;
    const params = [];

    if (filtro.estado) {
      params.push(unoDe(filtro.estado, ESTADOS_USUARIO, 'estado'));
      query += ` AND u.estado = $${params.length}`;
    }
    if (filtro.id_rol) {
      params.push(enteroPositivo(filtro.id_rol, 'id_rol'));
      query += ` AND u.id_rol = $${params.length}`;
    }
    if (filtro.solo_activos) {
      query += " AND u.estado = 'ACTIVO'";
    }

    query += ' ORDER BY u.id_usuario ASC';
    const res = await pgPool.query(query, params);
    return res.rows;
  }

  static async obtenerUsuarioPorId(id_usuario) {
    await this.ensureSchema();
    const id = enteroPositivo(id_usuario, 'id_usuario');
    const res = await pgPool.query(`
      SELECT u.id_usuario, u.id_cliente, u.nombre, u.apellido, u.id_rol, u.email,
             u.estado, u.fecha_ultimo_acceso, u.sesion_activa,
             r.descripcion AS rol_descripcion,
             r.nivel_permisos,
             r.permisos,
             r.estado AS rol_estado
      FROM usuarios u
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.id_usuario = $1
    `, [id]);
    return res.rows[0] || null;
  }

  static async obtenerUsuarioPorEmail(email) {
    await this.ensureSchema();
    const limpio = normalizarEmail(email);
    const res = await pgPool.query(`
      SELECT u.*, r.descripcion AS rol_descripcion, r.nivel_permisos,
             r.permisos, r.estado AS rol_estado
      FROM usuarios u
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE LOWER(u.email) = $1
    `, [limpio.toLowerCase()]);
    return res.rows[0] || null;
  }

  static async autenticar(email, password) {
    const user = await this.obtenerUsuarioPorEmail(email);
    if (!user || user.estado !== 'ACTIVO') return null;
    if (user.rol_estado && user.rol_estado !== 'ACTIVO') return null;

    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return null;

    await this.actualizarUltimoAcceso(user.id_usuario);
    return sinPassword({ ...user, sesion_activa: true });
  }

  static async actualizarUsuario(id_usuario, datos) {
    await this.ensureSchema();
    const id = enteroPositivo(id_usuario, 'id_usuario');
    const campos = [];
    const valores = [];

    if (datos.nombre !== undefined) {
      valores.push(textoRequerido(datos.nombre, 'nombre', { max: 100 }));
      campos.push('nombre');
    }
    if (datos.apellido !== undefined) {
      valores.push(textoRequerido(datos.apellido, 'apellido', { max: 100 }));
      campos.push('apellido');
    }
    if (datos.email !== undefined) {
      valores.push(normalizarEmail(datos.email));
      campos.push('email');
    }
    if (datos.id_cliente !== undefined) {
      valores.push(await this.validarCliente(datos.id_cliente));
      campos.push('id_cliente');
    }
    if (datos.id_rol !== undefined) {
      const idRol = enteroPositivo(datos.id_rol, 'id_rol');
      await this.obtenerRolActivo(idRol);
      valores.push(idRol);
      campos.push('id_rol');
    }
    if (datos.estado !== undefined) {
      valores.push(unoDe(datos.estado, ESTADOS_USUARIO, 'estado'));
      campos.push('estado');
    }
    if (datos.password !== undefined && datos.password !== null && datos.password !== '') {
      const password = textoRequerido(datos.password, 'password', { min: 6, max: 100 });
      valores.push(await bcrypt.hash(password, 10));
      campos.push('password_hash');
    }

    if (campos.length === 0) {
      return this.obtenerUsuarioPorId(id);
    }

    const assignments = campos.map((campo, index) => `${campo} = $${index + 1}`);
    valores.push(id);
    try {
      const res = await pgPool.query(
        `UPDATE usuarios SET ${assignments.join(', ')} WHERE id_usuario = $${campos.length + 1} RETURNING *`,
        valores
      );
      return sinPassword(res.rows[0] || null);
    } catch (error) {
      if (error.code === '23505') {
        throw errorValidacion('Ya existe un usuario con ese email.', 409);
      }
      throw error;
    }
  }

  static async cambiarRol(id_usuario, id_rol) {
    await this.ensureSchema();
    const id = enteroPositivo(id_usuario, 'id_usuario');
    const idRol = enteroPositivo(id_rol, 'id_rol');
    await this.obtenerRolActivo(idRol);
    const res = await pgPool.query(
      'UPDATE usuarios SET id_rol = $1 WHERE id_usuario = $2 RETURNING *',
      [idRol, id]
    );
    return sinPassword(res.rows[0] || null);
  }

  static async bloquearUsuario(id_usuario) {
    await this.ensureSchema();
    const id = enteroPositivo(id_usuario, 'id_usuario');
    const res = await pgPool.query(
      "UPDATE usuarios SET estado = 'BLOQUEADO', sesion_activa = FALSE WHERE id_usuario = $1 RETURNING *",
      [id]
    );
    return sinPassword(res.rows[0] || null);
  }

  static async activarUsuario(id_usuario) {
    await this.ensureSchema();
    const id = enteroPositivo(id_usuario, 'id_usuario');
    const res = await pgPool.query(
      "UPDATE usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1 RETURNING *",
      [id]
    );
    return sinPassword(res.rows[0] || null);
  }

  static async eliminarUsuario(id_usuario) {
    await this.ensureSchema();
    const id = enteroPositivo(id_usuario, 'id_usuario');
    const res = await pgPool.query('DELETE FROM usuarios WHERE id_usuario = $1 RETURNING *', [id]);
    return sinPassword(res.rows[0] || null);
  }

  static async actualizarUltimoAcceso(id_usuario) {
    await this.ensureSchema();
    const id = enteroPositivo(id_usuario, 'id_usuario');
    const res = await pgPool.query(
      'UPDATE usuarios SET fecha_ultimo_acceso = CURRENT_TIMESTAMP, sesion_activa = TRUE WHERE id_usuario = $1 RETURNING *',
      [id]
    );
    return sinPassword(res.rows[0] || null);
  }

  static async marcarSesionActiva(id_usuario, activa) {
    await this.ensureSchema();
    const id = enteroPositivo(id_usuario, 'id_usuario');
    await pgPool.query('UPDATE usuarios SET sesion_activa = $2 WHERE id_usuario = $1', [id, Boolean(activa)]);
  }

  static tienePermiso(usuario, permiso) {
    if (!usuario) return false;
    if (usuario.permisos && usuario.permisos[permiso] === true) return true;
    return this.esAdministrador(usuario);
  }

  static esAdministrador(usuario) {
    if (!usuario) return false;
    const rol = String(usuario.rol_descripcion || '').toUpperCase();
    if (rol === 'ADMIN' || rol === 'ADMINISTRADOR') return true;
    if (Number(usuario.nivel_permisos) >= 9) return true;
    return Boolean(usuario.permisos && (usuario.permisos.admin === true || usuario.permisos.seguridad === true));
  }
}

export { UsuarioRepository as usuarioRepository };
