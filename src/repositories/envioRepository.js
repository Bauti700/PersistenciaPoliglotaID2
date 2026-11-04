import { pgPool } from '../config/database.js';
import {
  textoRequerido,
  textoOpcional,
  enteroPositivo,
  numeroPositivo,
  unoDe,
  errorValidacion
} from '../utils/validation.js';

const ESTADOS_ENVIO = ['CREADO', 'EN_TRANSITO', 'ENTREGADO', 'RETRASADO', 'CANCELADO'];
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'];

function validarTramo(tramo, index = 0) {
  if (!tramo || typeof tramo !== 'object') {
    throw errorValidacion(`El tramo ${index + 1} es inválido.`);
  }
  const desde = textoRequerido(tramo.desde, `tramos[${index}].desde`, { max: 100 });
  const hasta = textoRequerido(tramo.hasta, `tramos[${index}].hasta`, { max: 100 });
  const medio = textoOpcional(tramo.medio, `tramos[${index}].medio`, { max: 50 }) || 'Terrestre';
  const id_tramo = tramo.id_tramo
    ? textoRequerido(tramo.id_tramo, `tramos[${index}].id_tramo`, { max: 50 })
    : null;
  const costo = tramo.costo !== undefined && tramo.costo !== null
    ? numeroPositivo(tramo.costo, `tramos[${index}].costo`, { min: 0, max: 99999999.99 })
    : null;

  const fechas = {};
  for (const campo of ['fecha_salida', 'fecha_llegada_estimada']) {
    if (tramo[campo] !== undefined && tramo[campo] !== null && tramo[campo] !== '') {
      const fecha = new Date(tramo[campo]);
      if (Number.isNaN(fecha.getTime())) {
        throw errorValidacion(`El campo tramos[${index}].${campo} no es una fecha válida.`);
      }
      fechas[campo] = fecha;
    }
  }

  return { id_tramo, desde, hasta, medio, costo, ...fechas };
}

function validarTramos(tramos) {
  if (tramos === undefined) return [];
  if (!Array.isArray(tramos)) {
    throw errorValidacion('El campo tramos debe ser una lista.');
  }
  return tramos.map((tramo, index) => validarTramo(tramo, index));
}

async function insertarTramos(client, id_envio, tramos) {
  const insertados = [];
  for (let i = 0; i < tramos.length; i++) {
    const tramo = tramos[i];
    const idTramo = tramo.id_tramo || `TR-${id_envio}-${i + 1}`;
    const res = await client.query(`
      INSERT INTO tramos
        (id_tramo, id_envio, medio_transporte, origen, destino, costo, fecha_salida, fecha_llegada_estimada)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, 15000.00), $7, $8)
      RETURNING *;
    `, [
      idTramo,
      id_envio,
      tramo.medio,
      tramo.desde,
      tramo.hasta,
      tramo.costo,
      tramo.fecha_salida || null,
      tramo.fecha_llegada_estimada || null
    ]);
    insertados.push(res.rows[0]);
  }
  return insertados;
}

export class EnvioRepository {
  static validarEnvio(data, { parcial = false } = {}) {
    const envio = {};
    let cantidad = 0;

    if (data.id_envio !== undefined) {
      if (parcial) throw errorValidacion('El ID del envío no se puede modificar.');
      envio.id_envio = textoRequerido(data.id_envio, 'id_envio', { max: 50 });
      cantidad++;
    } else if (!parcial) {
      throw errorValidacion('El campo id_envio es obligatorio.');
    }

    if (data.id_cliente !== undefined) {
      envio.id_cliente = enteroPositivo(data.id_cliente, 'id_cliente');
      cantidad++;
    } else if (!parcial) {
      throw errorValidacion('El campo id_cliente es obligatorio.');
    }

    if (data.origen !== undefined) {
      envio.origen = textoRequerido(data.origen, 'origen', { max: 100 });
      cantidad++;
    } else if (!parcial) {
      throw errorValidacion('El campo origen es obligatorio.');
    }

    if (data.destino !== undefined) {
      envio.destino = textoRequerido(data.destino, 'destino', { max: 100 });
      cantidad++;
    } else if (!parcial) {
      throw errorValidacion('El campo destino es obligatorio.');
    }

    if (data.prioridad !== undefined) {
      envio.prioridad = unoDe(data.prioridad, PRIORIDADES, 'prioridad');
      cantidad++;
    } else if (!parcial) {
      envio.prioridad = 'MEDIA';
    }

    if (data.estado !== undefined) {
      envio.estado = unoDe(data.estado, ESTADOS_ENVIO, 'estado');
      cantidad++;
    } else if (!parcial) {
      envio.estado = 'CREADO';
    }

    if (data.fecha_entrega !== undefined) {
      if (data.fecha_entrega === null || data.fecha_entrega === '') {
        envio.fecha_entrega = null;
      } else {
        const fecha = new Date(data.fecha_entrega);
        if (Number.isNaN(fecha.getTime())) {
          throw errorValidacion('El campo fecha_entrega no es una fecha válida.');
        }
        envio.fecha_entrega = fecha;
      }
      cantidad++;
    }

    if (parcial && cantidad === 0) {
      throw errorValidacion('Debe indicar al menos un campo del envío para actualizar.');
    }
    return envio;
  }

  static async listarTodos({ estado = null, id_cliente = null, prioridad = null } = {}) {
    const condiciones = [];
    const params = [];

    if (estado) {
      params.push(unoDe(estado, ESTADOS_ENVIO, 'estado'));
      condiciones.push(`e.estado = $${params.length}`);
    }
    if (id_cliente) {
      params.push(enteroPositivo(id_cliente, 'id_cliente'));
      condiciones.push(`e.id_cliente = $${params.length}`);
    }
    if (prioridad) {
      params.push(unoDe(prioridad, PRIORIDADES, 'prioridad'));
      condiciones.push(`e.prioridad = $${params.length}`);
    }
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const res = await pgPool.query(`
      SELECT e.*, c.razon_social AS cliente,
             (SELECT COUNT(*)::int FROM tramos t WHERE t.id_envio = e.id_envio) AS cantidad_tramos,
             (SELECT COUNT(*)::int
                FROM envio_contenedores ec
               WHERE ec.id_envio = e.id_envio) AS cantidad_contenedores,
             (SELECT COUNT(*)::int
                FROM envio_contenedores ec
               WHERE ec.id_envio = e.id_envio
                 AND ec.fecha_liberacion IS NULL) AS contenedores_activos
      FROM envios e
      JOIN clientes c ON c.id_cliente = e.id_cliente
      ${where}
      ORDER BY e.fecha_creacion DESC, e.id_envio ASC
    `, params);
    return res.rows;
  }

  static async obtenerPorId(id_envio) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const res = await pgPool.query(`
      SELECT e.*, c.razon_social AS cliente
      FROM envios e
      JOIN clientes c ON c.id_cliente = e.id_cliente
      WHERE e.id_envio = $1
    `, [id]);
    if (!res.rows[0]) return null;

    const tramos = await pgPool.query(
      'SELECT * FROM tramos WHERE id_envio = $1 ORDER BY fecha_salida NULLS LAST, id_tramo ASC',
      [id]
    );
    const contenedores = await pgPool.query(`
      SELECT c.*, ec.fecha_asignacion, ec.fecha_liberacion
      FROM envio_contenedores ec
      JOIN contenedores c ON c.id_contenedor = ec.id_contenedor
      WHERE ec.id_envio = $1
      ORDER BY ec.fecha_asignacion ASC, c.id_contenedor ASC
    `, [id]);
    return { ...res.rows[0], tramos: tramos.rows, contenedores: contenedores.rows };
  }

  static async existeEnvio(id_envio) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const res = await pgPool.query('SELECT 1 FROM envios WHERE id_envio = $1', [id]);
    return res.rowCount > 0;
  }

  static async crearEnvio(data, client = pgPool) {
    const envio = this.validarEnvio(data);
    const tramos = validarTramos(data.tramos);

    const res = await client.query(`
      INSERT INTO envios (id_envio, id_cliente, origen, destino, estado, prioridad)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `, [envio.id_envio, envio.id_cliente, envio.origen, envio.destino, envio.estado, envio.prioridad]);

    const tramosInsertados = await insertarTramos(client, envio.id_envio, tramos);
    return { ...res.rows[0], tramos: tramosInsertados };
  }

  static async actualizar(id_envio, data) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const envio = this.validarEnvio(data, { parcial: true });

    const existente = await this.obtenerPorId(id);
    if (!existente) return null;
    if (['ENTREGADO', 'CANCELADO'].includes(existente.estado)) {
      throw errorValidacion(`El envío ${id} está ${existente.estado} y no puede modificarse.`, 409);
    }

    const entries = Object.entries(envio);
    const valores = entries.map(([, value]) => value);
    valores.push(id);
    const assignments = entries.map(([campo], index) => `${campo} = $${index + 1}`);

    try {
      const res = await pgPool.query(
        `UPDATE envios SET ${assignments.join(', ')} WHERE id_envio = $${entries.length + 1} RETURNING *`,
        valores
      );
      return res.rows[0] || null;
    } catch (error) {
      if (error.code === '23503') {
        throw errorValidacion(`El cliente ${envio.id_cliente} no existe.`, 404);
      }
      throw error;
    }
  }

  static async actualizarExtremosTramos(id_envio, origen, destino) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const tramos = await pgPool.query(
      `SELECT id_tramo FROM tramos
       WHERE id_envio = $1
       ORDER BY fecha_salida NULLS LAST, id_tramo ASC`,
      [id]
    );
    if (tramos.rows.length === 0) return 0;

    if (tramos.rows.length === 1) {
      await pgPool.query(
        'UPDATE tramos SET origen = $2, destino = $3 WHERE id_tramo = $1',
        [tramos.rows[0].id_tramo, origen, destino]
      );
    } else {
      await pgPool.query(
        'UPDATE tramos SET origen = $2 WHERE id_tramo = $1',
        [tramos.rows[0].id_tramo, origen]
      );
      await pgPool.query(
        'UPDATE tramos SET destino = $2 WHERE id_tramo = $1',
        [tramos.rows[tramos.rows.length - 1].id_tramo, destino]
      );
    }
    return tramos.rows.length;
  }

  static async cambiarEstado(id_envio, estado, client = pgPool) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const estadoNormalizado = unoDe(estado, ESTADOS_ENVIO, 'estado');
    const fechaEntrega = estadoNormalizado === 'ENTREGADO' ? 'CURRENT_TIMESTAMP' : 'fecha_entrega';

    const res = await client.query(`
      UPDATE envios
      SET estado = $2, fecha_entrega = ${fechaEntrega}
      WHERE id_envio = $1
      RETURNING *;
    `, [id, estadoNormalizado]);
    return res.rows[0] || null;
  }

  static async contarFacturas(id_envio) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const res = await pgPool.query(
      "SELECT COUNT(*)::int AS total FROM facturas WHERE id_envio = $1 AND tipo_factura = 'EMITIDA'",
      [id]
    );
    return res.rows[0].total;
  }

  static async eliminar(id_envio) {
    const id = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const existente = await this.obtenerPorId(id);
    if (!existente) return null;

    const facturas = await this.contarFacturas(id);
    if (facturas > 0) {
      throw errorValidacion(
        `No se puede eliminar el envío ${id}: tiene ${facturas} factura(s) emitida(s). ` +
        'Cancele el envío para conservar el historial contable.',
        409
      );
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const activos = await client.query(`
        SELECT id_contenedor
        FROM envio_contenedores
        WHERE id_envio = $1 AND fecha_liberacion IS NULL
      `, [id]);
      const contenedoresLiberados = activos.rows.map(fila => fila.id_contenedor);
      if (contenedoresLiberados.length > 0) {
        await client.query(`
          UPDATE contenedores
          SET estado = 'DISPONIBLE'
          WHERE id_contenedor = ANY($1::varchar[]) AND estado = 'EN_TRANSITO'
        `, [contenedoresLiberados]);
      }
      await client.query('DELETE FROM tramos WHERE id_envio = $1', [id]);
      const res = await client.query('DELETE FROM envios WHERE id_envio = $1 RETURNING *', [id]);
      await client.query('COMMIT');
      return {
        ...res.rows[0],
        tramos: existente.tramos,
        contenedores: existente.contenedores,
        contenedores_liberados: contenedoresLiberados
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export { ESTADOS_ENVIO, PRIORIDADES };
