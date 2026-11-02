import { pgPool, getDb } from '../config/database.js';
import { Neo4jRouteRepository } from './rutaRepository.js';
import {
  textoRequerido,
  enteroPositivo,
  numeroPositivo,
  unoDe,
  errorValidacion
} from '../utils/validation.js';

const ESTADOS_CONTENEDOR = ['DISPONIBLE', 'EN_TRANSITO', 'FUERA_SERVICIO'];
const CAMPOS_CONTENEDOR = ['id_contenedor', 'codigo_internacional', 'tipo', 'capacidad', 'estado'];

function validarContenedor(data, { parcial = false } = {}) {
  const claves = Object.keys(data || {});
  const desconocidos = claves.filter(campo => !CAMPOS_CONTENEDOR.includes(campo));
  if (desconocidos.length > 0) {
    throw errorValidacion(`Campos no permitidos: ${desconocidos.join(', ')}.`);
  }

  if (!parcial && data.id_contenedor === undefined) {
    throw errorValidacion('El campo id_contenedor es obligatorio.');
  }

  const contenedor = {};
  if (data.id_contenedor !== undefined) {
    if (parcial) {
      throw errorValidacion('El ID del contenedor no se puede modificar.');
    }
    contenedor.id_contenedor = textoRequerido(data.id_contenedor, 'id_contenedor', { max: 50 });
  }
  if (data.codigo_internacional !== undefined) {
    contenedor.codigo_internacional = textoRequerido(data.codigo_internacional, 'codigo_internacional', { max: 100 });
  }
  if (data.tipo !== undefined) {
    contenedor.tipo = textoRequerido(data.tipo, 'tipo', { max: 50 });
  }
  if (data.capacidad !== undefined) {
    contenedor.capacidad = numeroPositivo(data.capacidad, 'capacidad', { min: 0.01, max: 99999999.99 });
  }
  if (data.estado !== undefined) {
    contenedor.estado = unoDe(data.estado, ESTADOS_CONTENEDOR, 'estado');
  }

  if (parcial && Object.keys(contenedor).length === 0) {
    throw errorValidacion('Debe indicar al menos un campo para actualizar.');
  }
  return contenedor;
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
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const res = await pgPool.query(
      'SELECT * FROM contenedores WHERE id_contenedor = $1;',
      [idContenedor]
    );
    return res.rows[0] || null;
  }

  static async obtenerPorCodigoInternacional(codigo) {
    const codigoNormalizado = textoRequerido(codigo, 'codigo_internacional', { max: 100 });
    const res = await pgPool.query(
      'SELECT * FROM contenedores WHERE UPPER(codigo_internacional) = UPPER($1);',
      [codigoNormalizado]
    );
    return res.rows[0] || null;
  }

  static async crear(data) {
    const contenedor = validarContenedor(data);
    try {
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
    } catch (error) {
      if (error.code === '23505') {
        throw errorValidacion('Ya existe un contenedor con ese ID o código internacional.', 409);
      }
      throw error;
    }
  }

  static async actualizar(id, data) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const contenedor = validarContenedor(data, { parcial: true });
    const entries = Object.entries(contenedor);
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([field], index) => `${field} = $${index + 2}`);
    const statusGuard = contenedor.estado === 'FUERA_SERVICIO' ? "AND estado <> 'EN_TRANSITO'" : '';

    try {
      const res = await pgPool.query(`
        UPDATE contenedores
        SET ${assignments.join(', ')}
        WHERE id_contenedor = $1 ${statusGuard}
        RETURNING *;
      `, [idContenedor, ...values]);

      if (res.rows[0]) return res.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw errorValidacion('Ya existe un contenedor con ese código internacional.', 409);
      }
      throw error;
    }

    const existente = await this.obtenerPorId(idContenedor);
    if (!existente) return null;
    if (existente.estado === 'EN_TRANSITO' && contenedor.estado === 'FUERA_SERVICIO') {
      throw errorValidacion('No se puede dar de baja un contenedor que está en tránsito.', 409);
    }
    return existente;
  }

  static async darDeBaja(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const res = await pgPool.query(`
      UPDATE contenedores
      SET estado = 'FUERA_SERVICIO'
      WHERE id_contenedor = $1 AND estado = 'DISPONIBLE'
      RETURNING *;
    `, [idContenedor]);
    if (res.rows[0]) return res.rows[0];

    const existente = await this.obtenerPorId(idContenedor);
    if (!existente) return null;
    if (existente.estado === 'EN_TRANSITO') {
      throw errorValidacion('No se puede dar de baja un contenedor que está en tránsito.', 409);
    }
    return existente;
  }

  static async activar(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const res = await pgPool.query(`
      UPDATE contenedores
      SET estado = 'DISPONIBLE'
      WHERE id_contenedor = $1 AND estado <> 'EN_TRANSITO'
      RETURNING *;
    `, [idContenedor]);
    if (res.rows[0]) return res.rows[0];

    const existente = await this.obtenerPorId(idContenedor);
    if (!existente) return null;
    if (existente.estado === 'EN_TRANSITO') {
      throw errorValidacion('No se puede activar manualmente un contenedor en tránsito.', 409);
    }
    return existente;
  }

  static async marcarEnTransito(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const res = await pgPool.query(`
      UPDATE contenedores
      SET estado = 'EN_TRANSITO'
      WHERE id_contenedor = $1 AND estado = 'DISPONIBLE'
      RETURNING *;
    `, [idContenedor]);
    if (res.rows[0]) return res.rows[0];

    const existente = await this.obtenerPorId(idContenedor);
    if (!existente) {
      throw errorValidacion(`El contenedor ${idContenedor} no existe.`, 404);
    }
    if (existente.estado === 'FUERA_SERVICIO') {
      throw errorValidacion(`El contenedor ${idContenedor} está fuera de servicio.`, 409);
    }
    return existente;
  }

  static async restaurarEstado(id, estado) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const estadoNormalizado = unoDe(estado, ESTADOS_CONTENEDOR, 'estado');
    const res = await pgPool.query(
      'UPDATE contenedores SET estado = $2 WHERE id_contenedor = $1 RETURNING *',
      [idContenedor, estadoNormalizado]
    );
    return res.rows[0] || null;
  }

  static async contarSensoresAsignados(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    return await getDb().collection('sensores').countDocuments({ id_contenedor: idContenedor });
  }

  static async eliminar(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const existente = await this.obtenerPorId(idContenedor);
    if (!existente) return null;
    if (existente.estado === 'EN_TRANSITO') {
      throw errorValidacion('No se puede eliminar un contenedor que está en tránsito.', 409);
    }
    const sensores = await this.contarSensoresAsignados(idContenedor);
    if (sensores > 0) {
      throw errorValidacion(
        `No se puede eliminar el contenedor ${idContenedor}: tiene ${sensores} sensor(es) asignado(s). ` +
        'Reasigne o elimine los sensores primero.',
        409
      );
    }
    const res = await pgPool.query(
      'DELETE FROM contenedores WHERE id_contenedor = $1 RETURNING *',
      [idContenedor]
    );
    if (res.rows[0]) {
      try {
        await Neo4jRouteRepository.eliminarContenedor(idContenedor);
      } catch (error) {
        console.warn(
          `[ContenedorRepository] Contenedor ${idContenedor} eliminado de PostgreSQL, ` +
          `pero no de Neo4j: ${error.message}`
        );
      }
    }
    return res.rows[0] || null;
  }

  static async existe(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const res = await pgPool.query(
      'SELECT 1 FROM contenedores WHERE id_contenedor = $1',
      [idContenedor]
    );
    return res.rowCount > 0;
  }
}

export { ESTADOS_CONTENEDOR };
