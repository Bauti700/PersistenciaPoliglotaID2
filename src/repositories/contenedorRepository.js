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
    if (contenedor.estado === 'DISPONIBLE' || contenedor.estado === 'FUERA_SERVICIO') {
      const activas = await this.contarAsignacionesActivas(idContenedor);
      if (activas > 0) {
        throw errorValidacion(
          `No se puede cambiar el estado del contenedor ${idContenedor}: ` +
          `está asignado a ${activas} envío(s) activo(s).`,
          409
        );
      }
    }
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
    const existente = await this.obtenerPorId(idContenedor);
    if (!existente) return null;
    if (existente.estado === 'EN_TRANSITO') {
      throw errorValidacion('No se puede dar de baja un contenedor que está en tránsito.', 409);
    }
    const activas = await this.contarAsignacionesActivas(idContenedor);
    if (activas > 0) {
      throw errorValidacion(
        `No se puede dar de baja el contenedor ${idContenedor}: ` +
        `está asignado a ${activas} envío(s) activo(s).`,
        409
      );
    }

    const res = await pgPool.query(`
      UPDATE contenedores
      SET estado = 'FUERA_SERVICIO'
      WHERE id_contenedor = $1 AND estado = 'DISPONIBLE'
      RETURNING *;
    `, [idContenedor]);
    return res.rows[0] || existente;
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

  static async contarAsignaciones(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const res = await pgPool.query(
      'SELECT COUNT(*)::int AS total FROM envio_contenedores WHERE id_contenedor = $1',
      [idContenedor]
    );
    return res.rows[0]?.total || 0;
  }

  static async contarAsignacionesActivas(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const res = await pgPool.query(`
      SELECT COUNT(*)::int AS total
      FROM envio_contenedores
      WHERE id_contenedor = $1 AND fecha_liberacion IS NULL
    `, [idContenedor]);
    return res.rows[0]?.total || 0;
  }

  static async estaAsignadoAEnvio(id_envio, id_contenedor) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const idContenedor = textoRequerido(id_contenedor, 'id_contenedor', { max: 50 });
    const res = await pgPool.query(`
      SELECT 1
      FROM envio_contenedores
      WHERE id_envio = $1 AND id_contenedor = $2 AND fecha_liberacion IS NULL
    `, [idEnvio, idContenedor]);
    return res.rowCount > 0;
  }

  // Bloquea y valida los contenedores antes de asignarlos. Debe ejecutarse
  // dentro de una transacción para que dos altas concurrentes no reserven el
  // mismo contenedor.
  static async bloquearYValidarParaAsignacion(ids, client = pgPool, id_envio = null) {
    const contenedores = [...new Set(ids || [])];
    if (contenedores.length === 0) {
      throw errorValidacion('El envío debe incluir al menos un contenedor.');
    }

    const res = await client.query(`
      SELECT *
      FROM contenedores
      WHERE id_contenedor = ANY($1::varchar[])
      ORDER BY id_contenedor
      FOR UPDATE
    `, [contenedores]);

    const encontrados = new Set(res.rows.map(c => c.id_contenedor));
    const faltantes = contenedores.filter(id => !encontrados.has(id));
    if (faltantes.length > 0) {
      throw errorValidacion(
        `No existe(n) el/los contenedor(es): ${faltantes.join(', ')}.`,
        404
      );
    }

    const fueraServicio = res.rows
      .filter(c => c.estado === 'FUERA_SERVICIO')
      .map(c => c.id_contenedor);
    if (fueraServicio.length > 0) {
      throw errorValidacion(
        `El/los contenedor(es) ${fueraServicio.join(', ')} están fuera de servicio.`,
        409
      );
    }

    const asignaciones = await client.query(`
      SELECT ec.id_contenedor, ec.id_envio
      FROM envio_contenedores ec
      WHERE ec.id_contenedor = ANY($1::varchar[])
        AND ec.fecha_liberacion IS NULL
    `, [contenedores]);

    const otrosEnvios = asignaciones.rows.filter(a => a.id_envio !== id_envio);
    if (otrosEnvios.length > 0) {
      const detalle = otrosEnvios
        .map(a => `${a.id_contenedor} (envío ${a.id_envio})`)
        .join(', ');
      throw errorValidacion(
        `El/los contenedor(es) ya están asignados a otro envío activo: ${detalle}.`,
        409
      );
    }

    const asignadosAlMismoEnvio = new Set(
      asignaciones.rows
        .filter(a => a.id_envio === id_envio)
        .map(a => a.id_contenedor)
    );
    const enTransitoAjenos = res.rows
      .filter(c => c.estado === 'EN_TRANSITO' && !asignadosAlMismoEnvio.has(c.id_contenedor))
      .map(c => c.id_contenedor);
    if (enTransitoAjenos.length > 0) {
      throw errorValidacion(
        `El/los contenedor(es) ${enTransitoAjenos.join(', ')} están en tránsito y no disponibles.`,
        409
      );
    }

    return res.rows;
  }

  static async asignarContenedoresAEnvio(id_envio, contenedores, client = pgPool) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const ids = (contenedores || []).map((contenedor, index) => {
      const valor = typeof contenedor === 'string'
        ? contenedor
        : contenedor?.id_contenedor;
      return textoRequerido(valor, `contenedores[${index}]`, { max: 50 });
    });
    const unicos = [...new Set(ids)];
    if (unicos.length !== ids.length) {
      throw errorValidacion('No se puede repetir el mismo contenedor en un envío.');
    }
    if (unicos.length === 0) {
      throw errorValidacion('El envío debe incluir al menos un contenedor.');
    }

    await this.bloquearYValidarParaAsignacion(unicos, client, idEnvio);

    const asignados = await client.query(`
      INSERT INTO envio_contenedores (id_envio, id_contenedor)
      SELECT $1, unnest($2::varchar[])
      ON CONFLICT (id_envio, id_contenedor) DO UPDATE
        SET fecha_asignacion = CURRENT_TIMESTAMP,
            fecha_liberacion = NULL
      RETURNING id_contenedor, fecha_asignacion, fecha_liberacion
    `, [idEnvio, unicos]);

    await client.query(`
      UPDATE contenedores
      SET estado = 'EN_TRANSITO'
      WHERE id_contenedor = ANY($1::varchar[])
    `, [unicos]);

    return asignados.rows;
  }

  static async listarContenedoresDeEnvio(id_envio, { soloActivos = false, client = pgPool } = {}) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const filtroActivo = soloActivos ? 'AND ec.fecha_liberacion IS NULL' : '';
    const res = await client.query(`
      SELECT c.*, ec.fecha_asignacion, ec.fecha_liberacion
      FROM envio_contenedores ec
      JOIN contenedores c ON c.id_contenedor = ec.id_contenedor
      WHERE ec.id_envio = $1 ${filtroActivo}
      ORDER BY ec.fecha_asignacion ASC, c.id_contenedor ASC
    `, [idEnvio]);
    return res.rows;
  }

  // Libera los contenedores activos del envío y conserva la relación histórica.
  static async liberarContenedoresDeEnvio(id_envio, client = pgPool) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const liberados = await client.query(`
      UPDATE envio_contenedores
      SET fecha_liberacion = CURRENT_TIMESTAMP
      WHERE id_envio = $1 AND fecha_liberacion IS NULL
      RETURNING id_contenedor
    `, [idEnvio]);

    const ids = liberados.rows.map(fila => fila.id_contenedor);
    if (ids.length > 0) {
      await client.query(`
        UPDATE contenedores
        SET estado = 'DISPONIBLE'
        WHERE id_contenedor = ANY($1::varchar[]) AND estado = 'EN_TRANSITO'
      `, [ids]);
    }
    return ids;
  }

  // Compensa una liberación si falla la sincronización con Neo4j.
  static async reactivarContenedoresDeEnvio(id_envio, ids, client = pgPool) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    if (!Array.isArray(ids) || ids.length === 0) return;
    await client.query(`
      UPDATE envio_contenedores
      SET fecha_liberacion = NULL
      WHERE id_envio = $1 AND id_contenedor = ANY($2::varchar[])
    `, [idEnvio, ids]);
    await client.query(`
      UPDATE contenedores
      SET estado = 'EN_TRANSITO'
      WHERE id_contenedor = ANY($1::varchar[]) AND estado = 'DISPONIBLE'
    `, [ids]);
  }

  static async eliminar(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    const existente = await this.obtenerPorId(idContenedor);
    if (!existente) return null;
    if (existente.estado === 'EN_TRANSITO') {
      throw errorValidacion('No se puede eliminar un contenedor que está en tránsito.', 409);
    }
    const asignaciones = await this.contarAsignaciones(idContenedor);
    if (asignaciones > 0) {
      throw errorValidacion(
        `No se puede eliminar el contenedor ${idContenedor}: tiene ${asignaciones} envío(s) asociado(s). ` +
        'Conserve el historial de composición de los envíos.',
        409
      );
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
