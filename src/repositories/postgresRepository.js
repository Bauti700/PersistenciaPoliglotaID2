import { pgPool } from '../config/database.js';

const ESTADOS_CONTENEDOR = new Set(['DISPONIBLE', 'EN_TRANSITO', 'FUERA_SERVICIO']);

function errorContenedor(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validarContenedor(data, parcial = false) {
  const campos = parcial
    ? ['codigo_internacional', 'tipo', 'capacidad', 'estado']
    : ['id_contenedor', 'codigo_internacional', 'tipo', 'capacidad', 'estado'];
  const valores = { ...data };

  if (Object.keys(valores).some(campo => !campos.includes(campo))) {
    throw errorContenedor('La solicitud contiene campos no permitidos.');
  }

  for (const campo of campos) {
    if (valores[campo] === undefined) continue;
    if (['id_contenedor', 'codigo_internacional', 'tipo', 'estado'].includes(campo)) {
      if (typeof valores[campo] !== 'string') {
        throw errorContenedor(`El campo ${campo} debe ser texto.`);
      }
      valores[campo] = valores[campo].trim();
    }
  }

  const requeridos = parcial ? Object.keys(valores) : ['id_contenedor', 'codigo_internacional', 'tipo', 'capacidad'];
  for (const campo of requeridos) {
    if (valores[campo] === undefined || valores[campo] === null || valores[campo] === '') {
      throw errorContenedor(`El campo ${campo} es obligatorio.`);
    }
  }

  const longitudes = { id_contenedor: 50, codigo_internacional: 100, tipo: 50 };
  for (const [campo, maximo] of Object.entries(longitudes)) {
    if (valores[campo] !== undefined && valores[campo].length > maximo) {
      throw errorContenedor(`El campo ${campo} no puede superar los ${maximo} caracteres.`);
    }
  }

  if (valores.capacidad !== undefined) {
    valores.capacidad = Number(valores.capacidad);
    if (!Number.isFinite(valores.capacidad) || valores.capacidad <= 0 || valores.capacidad > 99999999.99) {
      throw errorContenedor('La capacidad debe ser mayor a cero y no superar 99.999.999,99 kg.');
    }
  }

  if (valores.estado !== undefined && !ESTADOS_CONTENEDOR.has(valores.estado)) {
    throw errorContenedor(`Estado inválido. Valores permitidos: ${[...ESTADOS_CONTENEDOR].join(', ')}.`);
  }

  return valores;
}

export class ContenedorRepository {
  static async listarTodos() {
    const res = await pgPool.query(`
      SELECT * FROM contenedores
      ORDER BY id_contenedor ASC;
    `);
    return res.rows;
  }

  static async obtenerPorId(id) {
    const res = await pgPool.query(
      'SELECT * FROM contenedores WHERE id_contenedor = $1;',
      [id]
    );
    return res.rows[0] || null;
  }

  static async crear(data) {
    const contenedor = validarContenedor(data);
    const res = await pgPool.query(`
      INSERT INTO contenedores (id_contenedor, codigo_internacional, tipo, capacidad, estado)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [
      contenedor.id_contenedor,
      contenedor.codigo_internacional,
      contenedor.tipo,
      contenedor.capacidad,
      contenedor.estado || 'DISPONIBLE'
    ]);
    return res.rows[0];
  }

  static async actualizar(id, data) {
    const contenedor = validarContenedor(data, true);
    delete contenedor.id_contenedor;
    const entries = Object.entries(contenedor);
    if (entries.length === 0) {
      throw errorContenedor('Debe indicar al menos un campo para actualizar.');
    }

    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([field], index) => `${field} = $${index + 2}`);
    const statusGuard = contenedor.estado === 'FUERA_SERVICIO' ? "AND estado <> 'EN_TRANSITO'" : '';
    const res = await pgPool.query(`
      UPDATE contenedores
      SET ${assignments.join(', ')}
      WHERE id_contenedor = $1 ${statusGuard}
      RETURNING *;
    `, [id, ...values]);

    if (res.rows[0]) return res.rows[0];
    const existente = await this.obtenerPorId(id);
    if (existente?.estado === 'EN_TRANSITO' && contenedor.estado === 'FUERA_SERVICIO') {
      throw errorContenedor('No se puede dar de baja un contenedor que está en tránsito.', 409);
    }
    return null;
  }

  static async darDeBaja(id) {
    const res = await pgPool.query(`
      UPDATE contenedores
      SET estado = 'FUERA_SERVICIO'
      WHERE id_contenedor = $1 AND estado <> 'EN_TRANSITO'
      RETURNING *;
    `, [id]);
    if (res.rows[0]) return res.rows[0];

    const existente = await this.obtenerPorId(id);
    if (!existente) return null;
    if (existente.estado === 'EN_TRANSITO') {
      throw errorContenedor('No se puede dar de baja un contenedor que está en tránsito.', 409);
    }
    return existente;
  }
}

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
