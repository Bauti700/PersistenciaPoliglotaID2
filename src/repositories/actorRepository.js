import { pgPool } from '../config/database.js';
import {
  textoRequerido,
  textoOpcional,
  emailValido,
  cuitValido,
  enteroPositivo,
  unoDe,
  errorValidacion
} from '../utils/validation.js';

const TIPOS_ACTOR = ['CLIENTE', 'PROVEEDOR', 'OPERADOR'];
const ESTADOS_ACTOR = ['ACTIVO', 'INACTIVO'];

/**
 * Clase base para la persistencia de entidades comerciales y logísticas.
 *
 * La identidad de un actor es la tupla (tipo_actor, id_actor): las tablas de
 * clientes, proveedores y operadores tienen secuencias independientes y el
 * mismo ID puede repetirse entre ellas. Por eso toda operación conoce su tipo.
 */
class BaseEntidadRepository {
  constructor(tabla, idColumna, tipoActor) {
    this.tabla = tabla;
    this.idColumna = idColumna;
    this.tipoActor = tipoActor;
  }

  mapear(actor) {
    if (!actor) return null;
    return { ...actor, id_actor: actor[this.idColumna], tipo_actor: this.tipoActor };
  }

  normalizarId(id) {
    return enteroPositivo(id, this.idColumna);
  }

  validarAlta(data = {}) {
    return {
      razon_social: textoRequerido(data.razon_social, 'razon_social', { max: 150 }),
      cuit: cuitValido(data.cuit),
      email: emailValido(data.email),
      telefono: textoOpcional(data.telefono, 'telefono', { max: 50 }),
      direccion: textoOpcional(data.direccion, 'direccion', { max: 255 }),
      pais: textoRequerido(data.pais, 'pais', { max: 100 })
    };
  }

  validarActualizacion(data = {}) {
    const valores = {};
    let cantidad = 0;

    if (data.razon_social !== undefined) {
      valores.razon_social = textoRequerido(data.razon_social, 'razon_social', { max: 150 });
      cantidad++;
    }
    if (data.cuit !== undefined) {
      valores.cuit = cuitValido(data.cuit);
      cantidad++;
    }
    if (data.email !== undefined) {
      valores.email = emailValido(data.email);
      cantidad++;
    }
    if (data.telefono !== undefined) {
      valores.telefono = textoOpcional(data.telefono, 'telefono', { max: 50 });
      cantidad++;
    }
    if (data.direccion !== undefined) {
      valores.direccion = textoOpcional(data.direccion, 'direccion', { max: 255 });
      cantidad++;
    }
    if (data.pais !== undefined) {
      valores.pais = textoRequerido(data.pais, 'pais', { max: 100 });
      cantidad++;
    }
    if (data.estado !== undefined) {
      valores.estado = unoDe(data.estado, ESTADOS_ACTOR, 'estado');
      cantidad++;
    }

    if (cantidad === 0) {
      throw errorValidacion('Debe indicar al menos un campo para actualizar.');
    }
    return valores;
  }

  async crear(data) {
    const actor = this.validarAlta(data);
    const query = `
      INSERT INTO ${this.tabla} (razon_social, cuit, email, telefono, direccion, pais)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    try {
      const res = await pgPool.query(query, [
        actor.razon_social,
        actor.cuit,
        actor.email,
        actor.telefono,
        actor.direccion,
        actor.pais
      ]);
      return this.mapear(res.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        throw errorValidacion('Ya existe un actor con el mismo CUIT.', 409);
      }
      throw error;
    }
  }

  async listarTodos() {
    const query = `
      SELECT t.${this.idColumna} AS ${this.idColumna},
             t.razon_social,
             t.cuit,
             t.email,
             t.telefono,
             t.direccion,
             t.pais,
             t.estado,
             t.fecha_registro,
             COALESCE(cc.saldo, 0.00) AS saldo,
             cc.fecha_actualizacion AS cc_actualizacion
      FROM ${this.tabla} t
      LEFT JOIN cuentas_corrientes cc
        ON cc.id_actor = t.${this.idColumna} AND cc.tipo_actor = $1
      ORDER BY t.${this.idColumna} ASC;
    `;
    const res = await pgPool.query(query, [this.tipoActor]);
    return res.rows.map(row => this.mapear(row));
  }

  async obtenerPorId(id) {
    const idNormalizado = this.normalizarId(id);
    const query = `
      SELECT t.${this.idColumna} AS ${this.idColumna},
             t.razon_social,
             t.cuit,
             t.email,
             t.telefono,
             t.direccion,
             t.pais,
             t.estado,
             t.fecha_registro,
             COALESCE(cc.saldo, 0.00) AS saldo,
             cc.fecha_actualizacion AS cc_actualizacion
      FROM ${this.tabla} t
      LEFT JOIN cuentas_corrientes cc
        ON cc.id_actor = t.${this.idColumna} AND cc.tipo_actor = $1
      WHERE t.${this.idColumna} = $2;
    `;
    const res = await pgPool.query(query, [this.tipoActor, idNormalizado]);
    return this.mapear(res.rows[0]);
  }

  async actualizar(id, data) {
    const idNormalizado = this.normalizarId(id);
    const valores = this.validarActualizacion(data);
    const entries = Object.entries(valores);
    const params = [idNormalizado, ...entries.map(([, value]) => value)];
    const assignments = entries.map(([field], index) => `${field} = $${index + 2}`);

    const query = `
      UPDATE ${this.tabla}
      SET ${assignments.join(', ')}
      WHERE ${this.idColumna} = $1
      RETURNING *;
    `;
    try {
      const res = await pgPool.query(query, params);
      return this.mapear(res.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        throw errorValidacion('Ya existe un actor con el mismo CUIT.', 409);
      }
      throw error;
    }
  }

  async cambiarEstado(id, estado) {
    const idNormalizado = this.normalizarId(id);
    const estadoNormalizado = unoDe(estado, ESTADOS_ACTOR, 'estado');
    const res = await pgPool.query(`
      UPDATE ${this.tabla}
      SET estado = $2
      WHERE ${this.idColumna} = $1
      RETURNING *;
    `, [idNormalizado, estadoNormalizado]);
    return this.mapear(res.rows[0]);
  }

  async darDeBaja(id) {
    return this.cambiarEstado(id, 'INACTIVO');
  }

  async activar(id) {
    return this.cambiarEstado(id, 'ACTIVO');
  }

  async contarDependencias(id) {
    const idNormalizado = this.normalizarId(id);
    const checks = [];

    checks.push({
      etiqueta: 'facturas',
      query: pgPool.query(
        'SELECT COUNT(*)::int AS total FROM facturas WHERE id_cliente = $1 AND tipo_actor = $2',
        [idNormalizado, this.tipoActor]
      )
    });
    checks.push({
      etiqueta: 'cierres de cuentas corrientes',
      query: pgPool.query(
        'SELECT COUNT(*)::int AS total FROM cierres_cuentas_corrientes WHERE id_actor = $1 AND tipo_actor = $2',
        [idNormalizado, this.tipoActor]
      )
    });

    if (this.tipoActor === 'CLIENTE') {
      checks.push({
        etiqueta: 'envíos',
        query: pgPool.query('SELECT COUNT(*)::int AS total FROM envios WHERE id_cliente = $1', [idNormalizado])
      });
      checks.push({
        etiqueta: 'usuarios asociados',
        query: pgPool.query('SELECT COUNT(*)::int AS total FROM usuarios WHERE id_cliente = $1', [idNormalizado])
      });
    }

    const resultados = await Promise.all(checks.map(check => check.query));
    const dependencias = resultados
      .map((res, index) => ({ etiqueta: checks[index].etiqueta, total: res.rows[0].total }))
      .filter(item => item.total > 0);

    const cuenta = await pgPool.query(
      'SELECT saldo FROM cuentas_corrientes WHERE id_actor = $1 AND tipo_actor = $2',
      [idNormalizado, this.tipoActor]
    );
    if (cuenta.rows[0] && Number(cuenta.rows[0].saldo) !== 0) {
      dependencias.push({ etiqueta: 'saldo de cuenta corriente distinto de cero', total: 1 });
    }

    return dependencias;
  }

  async eliminar(id) {
    const idNormalizado = this.normalizarId(id);
    const dependencias = await this.contarDependencias(idNormalizado);
    if (dependencias.length > 0) {
      const detalle = dependencias.map(d => `${d.etiqueta} (${d.total})`).join(', ');
      throw errorValidacion(
        `No se puede eliminar físicamente el ${this.tipoActor} ${idNormalizado}: tiene ${detalle}. ` +
        'Use la baja lógica o elimine primero las dependencias.',
        409
      );
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'DELETE FROM cuentas_corrientes WHERE id_actor = $1 AND tipo_actor = $2',
        [idNormalizado, this.tipoActor]
      );
      const res = await client.query(
        `DELETE FROM ${this.tabla} WHERE ${this.idColumna} = $1 RETURNING *`,
        [idNormalizado]
      );
      await client.query('COMMIT');
      return this.mapear(res.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// 1. Repositorio de Clientes (tabla: clientes)
const _clienteRepo = new BaseEntidadRepository('clientes', 'id_cliente', 'CLIENTE');
export class ClienteRepository {
  static crear(data) { return _clienteRepo.crear(data); }
  static listarTodos() { return _clienteRepo.listarTodos(); }
  static obtenerPorId(id) { return _clienteRepo.obtenerPorId(id); }
  static actualizar(id, data) { return _clienteRepo.actualizar(id, data); }
  static darDeBaja(id) { return _clienteRepo.darDeBaja(id); }
  static activar(id) { return _clienteRepo.activar(id); }
  static eliminar(id) { return _clienteRepo.eliminar(id); }
}

// 2. Repositorio de Proveedores (tabla: proveedores)
const _proveedorRepo = new BaseEntidadRepository('proveedores', 'id_proveedor', 'PROVEEDOR');
export class ProveedorRepository {
  static crear(data) { return _proveedorRepo.crear(data); }
  static listarTodos() { return _proveedorRepo.listarTodos(); }
  static obtenerPorId(id) { return _proveedorRepo.obtenerPorId(id); }
  static actualizar(id, data) { return _proveedorRepo.actualizar(id, data); }
  static darDeBaja(id) { return _proveedorRepo.darDeBaja(id); }
  static activar(id) { return _proveedorRepo.activar(id); }
  static eliminar(id) { return _proveedorRepo.eliminar(id); }
}

// 3. Repositorio de Operadores Logísticos (tabla: operadores)
const _operadorRepo = new BaseEntidadRepository('operadores', 'id_operador', 'OPERADOR');
export class OperadorRepository {
  static crear(data) { return _operadorRepo.crear(data); }
  static listarTodos() { return _operadorRepo.listarTodos(); }
  static obtenerPorId(id) { return _operadorRepo.obtenerPorId(id); }
  static actualizar(id, data) { return _operadorRepo.actualizar(id, data); }
  static darDeBaja(id) { return _operadorRepo.darDeBaja(id); }
  static activar(id) { return _operadorRepo.activar(id); }
  static eliminar(id) { return _operadorRepo.eliminar(id); }
}

const REPOSITORIOS = {
  CLIENTE: ClienteRepository,
  PROVEEDOR: ProveedorRepository,
  OPERADOR: OperadorRepository
};

function repositorioDe(tipoActor) {
  const tipo = unoDe(tipoActor, TIPOS_ACTOR, 'tipo_actor');
  return { tipo, repo: REPOSITORIOS[tipo] };
}

// 4. Fachada de compatibilidad ActorRepository (consulta polimórfica)
export class ActorRepository {
  static async listarTodos(tipo_actor = null) {
    if (tipo_actor) {
      const { repo } = repositorioDe(tipo_actor);
      return repo.listarTodos();
    }
    const [clientes, proveedores, operadores] = await Promise.all([
      ClienteRepository.listarTodos(),
      ProveedorRepository.listarTodos(),
      OperadorRepository.listarTodos()
    ]);
    return [...clientes, ...proveedores, ...operadores];
  }

  static async obtenerPorId(id, tipo_actor = null) {
    if (tipo_actor) {
      const { repo } = repositorioDe(tipo_actor);
      return repo.obtenerPorId(id);
    }
    const idNormalizado = enteroPositivo(id, 'id_actor');
    const [cli, prov, op] = await Promise.all([
      ClienteRepository.obtenerPorId(idNormalizado),
      ProveedorRepository.obtenerPorId(idNormalizado),
      OperadorRepository.obtenerPorId(idNormalizado)
    ]);
    if (cli) return cli;
    if (prov) return prov;
    return op || null;
  }

  /**
   * Resuelve un actor por su identidad completa.
   * Si no se informa tipo_actor, solo acepta IDs que no estén repetidos entre
   * clientes, proveedores y operadores para evitar operar sobre el actor erróneo.
   */
  static async resolverActor(id_actor, tipo_actor = null) {
    const idNormalizado = enteroPositivo(id_actor, 'id_actor');

    if (tipo_actor) {
      const { tipo, repo } = repositorioDe(tipo_actor);
      const actor = await repo.obtenerPorId(idNormalizado);
      if (!actor) {
        throw errorValidacion(`Actor ${tipo} con ID ${idNormalizado} no encontrado.`, 404);
      }
      return actor;
    }

    const actores = await this.listarTodos();
    const coincidencias = actores.filter(a => Number(a.id_actor) === idNormalizado);

    if (coincidencias.length === 0) {
      throw errorValidacion(`Actor con ID ${idNormalizado} no encontrado.`, 404);
    }
    if (coincidencias.length > 1) {
      const tipos = coincidencias.map(a => a.tipo_actor).join(', ');
      throw errorValidacion(
        `El ID ${idNormalizado} es ambiguo (existe para ${tipos}). Indique el tipo de actor.`,
        409
      );
    }
    return coincidencias[0];
  }

  static async crear({ tipo_actor = 'CLIENTE', ...data }) {
    const { repo } = repositorioDe(tipo_actor);
    return repo.crear(data);
  }

  static async actualizar(id, data, tipo_actor = null) {
    const actor = await this.resolverActor(id, tipo_actor);
    const { repo } = repositorioDe(actor.tipo_actor);
    return repo.actualizar(actor.id_actor, data);
  }

  static async darDeBaja(id, tipo_actor = null) {
    const actor = await this.resolverActor(id, tipo_actor);
    const { repo } = repositorioDe(actor.tipo_actor);
    return repo.darDeBaja(actor.id_actor);
  }

  static async activar(id, tipo_actor = null) {
    const actor = await this.resolverActor(id, tipo_actor);
    const { repo } = repositorioDe(actor.tipo_actor);
    return repo.activar(actor.id_actor);
  }

  static async eliminar(id, tipo_actor = null) {
    const actor = await this.resolverActor(id, tipo_actor);
    const { repo } = repositorioDe(actor.tipo_actor);
    return repo.eliminar(actor.id_actor);
  }
}

export { TIPOS_ACTOR, ESTADOS_ACTOR };
