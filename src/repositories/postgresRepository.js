import { pgPool } from '../config/database.js';

export class ClienteRepository {
  static async crear({ tipo_actor = 'CLIENTE', razon_social, cuit, email, telefono, direccion, pais }) {
    const query = `
      INSERT INTO actores (tipo_actor, razon_social, cuit, email, telefono, direccion, pais)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const res = await pgPool.query(query, [tipo_actor, razon_social, cuit, email, telefono, direccion, pais]);
    // Inicializar cuenta corriente en 0
    await pgPool.query(`INSERT INTO cuentas_corrientes (id_actor, saldo) VALUES ($1, 0.00) ON CONFLICT DO NOTHING;`, [res.rows[0].id_actor]);
    return res.rows[0];
  }

  static async listarTodos() {
    const query = `
      SELECT a.*, c.saldo 
      FROM actores a
      LEFT JOIN cuentas_corrientes c ON a.id_actor = c.id_actor
      ORDER BY a.id_actor ASC;
    `;
    const res = await pgPool.query(query);
    return res.rows;
  }

  static async obtenerPorId(id) {
    const query = `
      SELECT a.*, c.saldo 
      FROM actores a
      LEFT JOIN cuentas_corrientes c ON a.id_actor = c.id_actor
      WHERE a.id_actor = $1;
    `;
    const res = await pgPool.query(query, [id]);
    return res.rows[0];
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

  static async eliminar(id) {
    const res = await pgPool.query(`DELETE FROM actores WHERE id_actor = $1 RETURNING *;`, [id]);
    return res.rows[0];
  }
}

export class ComercialRepository {
  static async emitirFactura({ id_cliente, importe_total }) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const insertFactura = `
        INSERT INTO facturas (id_cliente, importe_total, estado)
        VALUES ($1, $2, 'PENDIENTE')
        RETURNING *;
      `;
      const resFactura = await client.query(insertFactura, [id_cliente, importe_total]);
      const factura = resFactura.rows[0];

      // Disminuir saldo o registrar deuda en cuenta corriente
      await client.query(`
        UPDATE cuentas_corrientes
        SET saldo = saldo - $1, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_actor = $2;
      `, [importe_total, id_cliente]);

      await client.query('COMMIT');
      return factura;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async registrarPago({ id_factura, monto, medio_pago }) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const resFac = await client.query(`SELECT id_cliente, importe_total, estado FROM facturas WHERE id_factura = $1;`, [id_factura]);
      if (resFac.rows.length === 0) throw new Error(`Factura ${id_factura} no encontrada.`);

      const factura = resFac.rows[0];
      const resPago = await client.query(`
        INSERT INTO pagos (id_factura, monto, medio_pago)
        VALUES ($1, $2, $3)
        RETURNING *;
      `, [id_factura, monto, medio_pago]);

      // Si cubre o supera el importe, marcar pagada
      await client.query(`UPDATE facturas SET estado = 'PAGADA' WHERE id_factura = $1;`, [id_factura]);

      // Acreditar en cuenta corriente
      await client.query(`
        UPDATE cuentas_corrientes
        SET saldo = saldo + $1, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id_actor = $2;
      `, [monto, factura.id_cliente]);

      await client.query('COMMIT');
      return resPago.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async obtenerEstadoCuenta(id_cliente) {
    const cc = await pgPool.query(`SELECT * FROM cuentas_corrientes WHERE id_actor = $1;`, [id_cliente]);
    const facturas = await pgPool.query(`SELECT * FROM facturas WHERE id_cliente = $1 ORDER BY id_factura DESC;`, [id_cliente]);
    return {
      cuenta_corriente: cc.rows[0],
      facturas: facturas.rows
    };
  }

  static async rankingClientesPorVolumen() {
    const query = `
      SELECT a.id_actor, a.razon_social, a.pais,
             COUNT(e.id_envio) AS total_envios,
             COALESCE(SUM(f.importe_total), 0.00) AS volumen_facturado
      FROM actores a
      LEFT JOIN envios e ON a.id_actor = e.id_cliente
      LEFT JOIN facturas f ON a.id_actor = f.id_cliente
      WHERE a.tipo_actor = 'CLIENTE'
      GROUP BY a.id_actor, a.razon_social, a.pais
      ORDER BY total_envios DESC, volumen_facturado DESC;
    `;
    const res = await pgPool.query(query);
    return res.rows;
  }
}
