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
