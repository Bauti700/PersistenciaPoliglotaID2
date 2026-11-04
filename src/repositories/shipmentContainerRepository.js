import { pgPool, getDb } from '../config/database.js';
import { textoRequerido, errorValidacion } from '../utils/validation.js';

export class ShipmentContainerRepository {
  static async contarSensoresAsignados(id) {
    const idContenedor = textoRequerido(id, 'id_contenedor', { max: 50 });
    return getDb().collection('sensores').countDocuments({ id_contenedor: idContenedor });
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
      SELECT COUNT(*)::int AS total FROM envio_contenedores
      WHERE id_contenedor = $1 AND fecha_liberacion IS NULL
    `, [idContenedor]);
    return res.rows[0]?.total || 0;
  }

  static async estaAsignadoAEnvio(id_envio, id_contenedor) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const idContenedor = textoRequerido(id_contenedor, 'id_contenedor', { max: 50 });
    const res = await pgPool.query(`
      SELECT 1 FROM envio_contenedores
      WHERE id_envio = $1 AND id_contenedor = $2 AND fecha_liberacion IS NULL
    `, [idEnvio, idContenedor]);
    return res.rowCount > 0;
  }

  static async bloquearYValidar(ids, client = pgPool, id_envio = null) {
    const contenedores = [...new Set(ids || [])];
    if (contenedores.length === 0) {
      throw errorValidacion('El envío debe incluir al menos un contenedor.');
    }

    const res = await client.query(`
      SELECT * FROM contenedores
      WHERE id_contenedor = ANY($1::varchar[])
      ORDER BY id_contenedor
      FOR UPDATE
    `, [contenedores]);
    const faltantes = contenedores.filter(id => !res.rows.some(c => c.id_contenedor === id));
    if (faltantes.length > 0) {
      throw errorValidacion(`No existe(n) el/los contenedor(es): ${faltantes.join(', ')}.`, 404);
    }

    const fueraServicio = res.rows.filter(c => c.estado === 'FUERA_SERVICIO').map(c => c.id_contenedor);
    if (fueraServicio.length > 0) {
      throw errorValidacion(`El/los contenedor(es) ${fueraServicio.join(', ')} están fuera de servicio.`, 409);
    }

    const asignaciones = await client.query(`
      SELECT id_contenedor, id_envio FROM envio_contenedores
      WHERE id_contenedor = ANY($1::varchar[]) AND fecha_liberacion IS NULL
    `, [contenedores]);
    const otros = asignaciones.rows.filter(a => a.id_envio !== id_envio);
    if (otros.length > 0) {
      const detalle = otros.map(a => `${a.id_contenedor} (envío ${a.id_envio})`).join(', ');
      throw errorValidacion(`El/los contenedor(es) ya están asignados a otro envío activo: ${detalle}.`, 409);
    }

    const propios = new Set(
      asignaciones.rows.filter(a => a.id_envio === id_envio).map(a => a.id_contenedor)
    );
    const enTransito = res.rows
      .filter(c => c.estado === 'EN_TRANSITO' && !propios.has(c.id_contenedor))
      .map(c => c.id_contenedor);
    if (enTransito.length > 0) {
      throw errorValidacion(`El/los contenedor(es) ${enTransito.join(', ')} están en tránsito y no disponibles.`, 409);
    }
    return res.rows;
  }

  static async asignar(id_envio, contenedores, client = pgPool) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const ids = (contenedores || []).map((contenedor, index) => textoRequerido(
      typeof contenedor === 'string' ? contenedor : contenedor?.id_contenedor,
      `contenedores[${index}]`,
      { max: 50 }
    ));
    const unicos = [...new Set(ids)];
    if (unicos.length !== ids.length) {
      throw errorValidacion('No se puede repetir el mismo contenedor en un envío.');
    }
    await this.bloquearYValidar(unicos, client, idEnvio);
    const asignados = await client.query(`
      INSERT INTO envio_contenedores (id_envio, id_contenedor)
      SELECT $1, unnest($2::varchar[])
      ON CONFLICT (id_envio, id_contenedor) DO UPDATE
        SET fecha_asignacion = CURRENT_TIMESTAMP, fecha_liberacion = NULL
      RETURNING id_contenedor, fecha_asignacion, fecha_liberacion
    `, [idEnvio, unicos]);
    await client.query(`
      UPDATE contenedores SET estado = 'EN_TRANSITO'
      WHERE id_contenedor = ANY($1::varchar[])
    `, [unicos]);
    return asignados.rows;
  }

  static async listar(id_envio, { soloActivos = false, client = pgPool } = {}) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const filtroActivo = soloActivos ? 'AND ec.fecha_liberacion IS NULL' : '';
    const res = await client.query(`
      SELECT c.*, ec.fecha_asignacion, ec.fecha_liberacion
      FROM envio_contenedores ec JOIN contenedores c ON c.id_contenedor = ec.id_contenedor
      WHERE ec.id_envio = $1 ${filtroActivo}
      ORDER BY ec.fecha_asignacion ASC, c.id_contenedor ASC
    `, [idEnvio]);
    return res.rows;
  }

  static async liberar(id_envio, client = pgPool) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const liberados = await client.query(`
      UPDATE envio_contenedores SET fecha_liberacion = CURRENT_TIMESTAMP
      WHERE id_envio = $1 AND fecha_liberacion IS NULL
      RETURNING id_contenedor
    `, [idEnvio]);
    const ids = liberados.rows.map(row => row.id_contenedor);
    if (ids.length > 0) {
      await client.query(`
        UPDATE contenedores SET estado = 'DISPONIBLE'
        WHERE id_contenedor = ANY($1::varchar[]) AND estado = 'EN_TRANSITO'
      `, [ids]);
    }
    return ids;
  }

  static async reactivar(id_envio, ids, client = pgPool) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    if (!Array.isArray(ids) || ids.length === 0) return;
    await client.query(`
      UPDATE envio_contenedores SET fecha_liberacion = NULL
      WHERE id_envio = $1 AND id_contenedor = ANY($2::varchar[])
    `, [idEnvio, ids]);
    await client.query(`
      UPDATE contenedores SET estado = 'EN_TRANSITO'
      WHERE id_contenedor = ANY($1::varchar[]) AND estado = 'DISPONIBLE'
    `, [ids]);
  }

  static asignarContenedoresAEnvio(...args) {
    return this.asignar(...args);
  }

  static listarContenedoresDeEnvio(...args) {
    return this.listar(...args);
  }

  static liberarContenedoresDeEnvio(...args) {
    return this.liberar(...args);
  }

  static reactivarContenedoresDeEnvio(...args) {
    return this.reactivar(...args);
  }

  static bloquearYValidarParaAsignacion(...args) {
    return this.bloquearYValidar(...args);
  }
}
