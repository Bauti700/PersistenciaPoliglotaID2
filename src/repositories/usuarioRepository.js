import { pgPool } from '../config/database.js';
import bcrypt from 'bcryptjs';

export class UsuarioRepository {
  static async ensureSchema() {
    try {
      await pgPool.query("ALTER TABLE roles ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '{}'");
      await pgPool.query("ALTER TABLE roles ADD COLUMN IF NOT EXISTS nivel_permisos INTEGER DEFAULT 1");
      await pgPool.query("ALTER TABLE roles ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'ACTIVO'");
      await pgPool.query("ALTER TABLE roles ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP DEFAULT NOW()");
      await pgPool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)");
      await pgPool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_ultimo_acceso TIMESTAMP");
      await pgPool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_activa BOOLEAN DEFAULT FALSE");
    } catch (e) {
      // Ignorar si ya existen o no hay permisos
    }
  }

  // --- ROLES ---
  static async crearRol({ descripcion, nivel_permisos = 1, permisos = {}, estado = 'ACTIVO' }) {
    await this.ensureSchema();
    try {
      const query = `
        INSERT INTO roles (descripcion, nivel_permisos, permisos, estado)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const res = await pgPool.query(query, [descripcion, nivel_permisos, JSON.stringify(permisos), estado]);
      return res.rows[0];
    } catch (e) {
      const query = `
        INSERT INTO roles (descripcion, nivel_permisos, estado)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const res = await pgPool.query(query, [descripcion, nivel_permisos, estado]);
      return res.rows[0];
    }
  }

  static async listarRoles() {
    await this.ensureSchema();
    const res = await pgPool.query('SELECT * FROM roles ORDER BY id_rol ASC');
    return res.rows;
  }

  static async obtenerRolPorId(id_rol) {
    await this.ensureSchema();
    const res = await pgPool.query('SELECT * FROM roles WHERE id_rol = $1', [id_rol]);
    return res.rows[0] || null;
  }

  static async actualizarRol(id_rol, datos) {
    await this.ensureSchema();
    const campos = [];
    const valores = [];
    let idx = 1;
    
    if (datos.descripcion !== undefined) { campos.push(`descripcion = $${idx++}`); valores.push(datos.descripcion); }
    if (datos.nivel_permisos !== undefined) { campos.push(`nivel_permisos = $${idx++}`); valores.push(datos.nivel_permisos); }
    if (datos.permisos !== undefined) { 
      try {
        campos.push(`permisos = $${idx++}`); 
        valores.push(JSON.stringify(datos.permisos)); 
      } catch {}
    }
    if (datos.estado !== undefined) { campos.push(`estado = $${idx++}`); valores.push(datos.estado); }
    
    if (campos.length === 0) return await this.obtenerRolPorId(id_rol);
    
    valores.push(id_rol);
    try {
      const query = `UPDATE roles SET ${campos.join(', ')} WHERE id_rol = $${idx} RETURNING *`;
      const res = await pgPool.query(query, valores);
      return res.rows[0] || null;
    } catch (e) {
      // Reintentar sin campos que no existan
      return await this.obtenerRolPorId(id_rol);
    }
  }

  static async desactivarRol(id_rol) {
    await this.ensureSchema();
    const res = await pgPool.query("UPDATE roles SET estado = 'INACTIVO' WHERE id_rol = $1 RETURNING *", [id_rol]);
    return res.rows[0] || null;
  }

  // --- USUARIOS ---
  static async crearUsuario({ id_cliente = null, nombre, apellido, id_rol, email, password, estado = 'ACTIVO' }) {
    await this.ensureSchema();
    const hash = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO usuarios (id_cliente, nombre, apellido, id_rol, email, password_hash, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const res = await pgPool.query(query, [id_cliente, nombre, apellido, id_rol, email, hash, estado]);
    return res.rows[0];
  }

  static async listarUsuarios(filtro = {}) {
    await this.ensureSchema();
    let query = `
      SELECT u.*, r.descripcion as rol_descripcion, r.nivel_permisos
      FROM usuarios u
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE 1=1
    `;
    const params = [];
    
    if (filtro.estado) {
      params.push(filtro.estado);
      query += ` AND u.estado = $${params.length}`;
    }
    if (filtro.id_rol) {
      params.push(filtro.id_rol);
      query += ` AND u.id_rol = $${params.length}`;
    }
    
    query += ' ORDER BY u.id_usuario ASC';
    const res = await pgPool.query(query, params);
    return res.rows;
  }

  static async obtenerUsuarioPorId(id_usuario) {
    await this.ensureSchema();
    const query = `
      SELECT u.*, r.descripcion as rol_descripcion, r.nivel_permisos
      FROM usuarios u
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.id_usuario = $1
    `;
    const res = await pgPool.query(query, [id_usuario]);
    return res.rows[0] || null;
  }

  static async obtenerUsuarioPorEmail(email) {
    await this.ensureSchema();
    const query = `
      SELECT u.*, r.descripcion as rol_descripcion, r.nivel_permisos
      FROM usuarios u
      LEFT JOIN roles r ON r.id_rol = u.id_rol
      WHERE LOWER(u.email) = LOWER($1)
    `;
    const res = await pgPool.query(query, [email]);
    return res.rows[0] || null;
  }

  static async autenticar(email, password) {
    const user = await this.obtenerUsuarioPorEmail(email);
    if (!user || user.estado !== 'ACTIVO') return null;
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return null;
    await this.actualizarUltimoAcceso(user.id_usuario);
    return user;
  }

  static async actualizarUsuario(id_usuario, datos) {
    const campos = [];
    const valores = [];
    let idx = 1;
    
    if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
    if (datos.apellido !== undefined) { campos.push(`apellido = $${idx++}`); valores.push(datos.apellido); }
    if (datos.email !== undefined) { campos.push(`email = $${idx++}`); valores.push(datos.email); }
    if (datos.id_cliente !== undefined) { campos.push(`id_cliente = $${idx++}`); valores.push(datos.id_cliente); }
    if (datos.estado !== undefined) { campos.push(`estado = $${idx++}`); valores.push(datos.estado); }
    if (datos.password) {
      const hash = await bcrypt.hash(datos.password, 10);
      campos.push(`password_hash = $${idx++}`);
      valores.push(hash);
    }
    
    if (campos.length === 0) return await this.obtenerUsuarioPorId(id_usuario);
    
    valores.push(id_usuario);
    const query = `UPDATE usuarios SET ${campos.join(', ')} WHERE id_usuario = $${idx} RETURNING *`;
    const res = await pgPool.query(query, valores);
    return res.rows[0] || null;
  }

  static async cambiarRol(id_usuario, id_rol) {
    const res = await pgPool.query('UPDATE usuarios SET id_rol = $1 WHERE id_usuario = $2 RETURNING *', [id_rol, id_usuario]);
    return res.rows[0] || null;
  }

  static async bloquearUsuario(id_usuario) {
    const res = await pgPool.query("UPDATE usuarios SET estado = 'BLOQUEADO' WHERE id_usuario = $1 RETURNING *", [id_usuario]);
    return res.rows[0] || null;
  }

  static async activarUsuario(id_usuario) {
    const res = await pgPool.query("UPDATE usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1 RETURNING *", [id_usuario]);
    return res.rows[0] || null;
  }

  static async actualizarUltimoAcceso(id_usuario) {
    const res = await pgPool.query('UPDATE usuarios SET fecha_ultimo_acceso = NOW() WHERE id_usuario = $1 RETURNING *', [id_usuario]);
    return res.rows[0] || null;
  }
}

export { UsuarioRepository as usuarioRepository };
