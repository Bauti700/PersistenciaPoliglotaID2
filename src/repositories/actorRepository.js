import { pgPool } from '../config/database.js';

export class ActorRepository {
  static async crear({ tipo_actor = 'CLIENTE', razon_social, cuit, email, telefono, direccion, pais }) {
    const tiposPermitidos = ['CLIENTE', 'PROVEEDOR', 'OPERADOR'];
    const tipo = tipo_actor.toUpperCase();
    if (!tiposPermitidos.includes(tipo)) {
      throw new Error(`Tipo de actor inválido. Valores permitidos: ${tiposPermitidos.join(', ')}`);
    }

    const query = `
      INSERT INTO actores (tipo_actor, razon_social, cuit, email, telefono, direccion, pais)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const res = await pgPool.query(query, [tipo, razon_social, cuit, email, telefono, direccion, pais]);
    // Inicializar cuenta corriente en 0.00
    await pgPool.query(`INSERT INTO cuentas_corrientes (id_actor, saldo) VALUES ($1, 0.00) ON CONFLICT DO NOTHING;`, [res.rows[0].id_actor]);
    return res.rows[0];
  }

  static async listarTodos(tipo_actor = null) {
    const params = [];
    let filter = '';
    if (tipo_actor) {
      params.push(tipo_actor.toUpperCase());
      filter = 'WHERE a.tipo_actor = $1';
    }
    const query = `
      SELECT a.*, COALESCE(c.saldo, 0.00) as saldo, c.fecha_actualizacion as cc_actualizacion
      FROM actores a
      LEFT JOIN cuentas_corrientes c ON a.id_actor = c.id_actor
      ${filter}
      ORDER BY a.tipo_actor, a.id_actor ASC;
    `;
    const res = await pgPool.query(query, params);
    return res.rows;
  }

  static async obtenerPorId(id) {
    const query = `
      SELECT a.*, COALESCE(c.saldo, 0.00) as saldo, c.fecha_actualizacion as cc_actualizacion
      FROM actores a
      LEFT JOIN cuentas_corrientes c ON a.id_actor = c.id_actor
      WHERE a.id_actor = $1;
    `;
    const res = await pgPool.query(query, [id]);
    return res.rows[0] || null;
  }

  static async actualizar(id, { razon_social, email, telefono, direccion, pais, estado }) {
    const query = `
      UPDATE actores
      SET razon_social = COALESCE($2, razon_social),
          email = COALESCE($3, email),
          telefono = COALESCE($4, telefono),
          direccion = COALESCE($5, direccion),
          pais = COALESCE($6, pais),
          estado = COALESCE($7, estado)
      WHERE id_actor = $1
      RETURNING *;
    `;
    const res = await pgPool.query(query, [id, razon_social, email, telefono, direccion, pais, estado]);
    return res.rows[0];
  }


  static async darDeBaja(id) {
  const res = await pgPool.query(`
    UPDATE actores
    SET estado = 'INACTIVO'
    WHERE id_actor = $1
    RETURNING *;
  `, [id]);

  return res.rows[0] || null;
}


  static async eliminar(id) {
    const res = await pgPool.query(`DELETE FROM actores WHERE id_actor = $1 RETURNING *;`, [id]);
    return res.rows[0];
  }
}

export class ClienteRepository {
  static async crear(data) {
    return ActorRepository.crear({ ...data, tipo_actor: 'CLIENTE' });
  }

  static async listarTodos() {
    return ActorRepository.listarTodos('CLIENTE');
  }

  static async obtenerPorId(id) {
    return ActorRepository.obtenerPorId(id);
  }

  static async actualizar(id, data) {
    return ActorRepository.actualizar(id, data);
  }

  static async eliminar(id) {
    return ActorRepository.eliminar(id);
  }
}
