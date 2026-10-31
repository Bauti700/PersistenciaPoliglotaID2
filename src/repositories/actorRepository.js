import { pgPool } from '../config/database.js';

/**
 * Clase base para la persistencia de entidades comerciales y logísticas
 */
class BaseEntidadRepository {
  constructor(tabla, idColumna) {
    this.tabla = tabla;
    this.idColumna = idColumna;
  }

  async crear({ razon_social, cuit, email, telefono = null, direccion = null, pais }) {
    const query = `
      INSERT INTO ${this.tabla} (razon_social, cuit, email, telefono, direccion, pais)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const res = await pgPool.query(query, [razon_social, cuit, email, telefono, direccion, pais]);
    return res.rows[0];
  }

  async listarTodos() {
    const query = `
      SELECT *, COALESCE(saldo, 0.00) as saldo
      FROM ${this.tabla}
      ORDER BY ${this.idColumna} ASC;
    `;
    const res = await pgPool.query(query);
    return res.rows;
  }

  async obtenerPorId(id) {
    const query = `
      SELECT *, COALESCE(saldo, 0.00) as saldo
      FROM ${this.tabla}
      WHERE ${this.idColumna} = $1;
    `;
    const res = await pgPool.query(query, [id]);
    return res.rows[0] || null;
  }

  async actualizar(id, { razon_social, email, telefono, direccion, pais, estado }) {
    const query = `
      UPDATE ${this.tabla}
      SET razon_social = COALESCE($2, razon_social),
          email = COALESCE($3, email),
          telefono = COALESCE($4, telefono),
          direccion = COALESCE($5, direccion),
          pais = COALESCE($6, pais),
          estado = COALESCE($7, estado)
      WHERE ${this.idColumna} = $1
      RETURNING *;
    `;
    const res = await pgPool.query(query, [id, razon_social, email, telefono, direccion, pais, estado]);
    return res.rows[0] || null;
  }

  async darDeBaja(id) {
    const query = `
      UPDATE ${this.tabla}
      SET estado = 'INACTIVO'
      WHERE ${this.idColumna} = $1
      RETURNING *;
    `;
    const res = await pgPool.query(query, [id]);
    return res.rows[0] || null;
  }

  async activar(id) {
    const query = `
      UPDATE ${this.tabla}
      SET estado = 'ACTIVO'
      WHERE ${this.idColumna} = $1
      RETURNING *;
    `;
    const res = await pgPool.query(query, [id]);
    return res.rows[0] || null;
  }

  async eliminar(id) {
    const query = `DELETE FROM ${this.tabla} WHERE ${this.idColumna} = $1 RETURNING *;`;
    const res = await pgPool.query(query, [id]);
    return res.rows[0] || null;
  }
}

// 1. Repositorio de Clientes (tabla: clientes)
const _clienteRepo = new BaseEntidadRepository('clientes', 'id_cliente');
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
const _proveedorRepo = new BaseEntidadRepository('proveedores', 'id_proveedor');
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
const _operadorRepo = new BaseEntidadRepository('operadores', 'id_operador');
export class OperadorRepository {
  static crear(data) { return _operadorRepo.crear(data); }
  static listarTodos() { return _operadorRepo.listarTodos(); }
  static obtenerPorId(id) { return _operadorRepo.obtenerPorId(id); }
  static actualizar(id, data) { return _operadorRepo.actualizar(id, data); }
  static darDeBaja(id) { return _operadorRepo.darDeBaja(id); }
  static activar(id) { return _operadorRepo.activar(id); }
  static eliminar(id) { return _operadorRepo.eliminar(id); }
}

// 4. Fachada de compatibilidad ActorRepository (para servicios que requieran consulta polimórfica)
export class ActorRepository {
  static async listarTodos(tipo_actor = null) {
    if (tipo_actor) {
      const tipo = tipo_actor.toUpperCase();
      if (tipo === 'CLIENTE') {
        const items = await ClienteRepository.listarTodos();
        return items.map(c => ({ ...c, id_actor: c.id_cliente, tipo_actor: 'CLIENTE' }));
      }
      if (tipo === 'PROVEEDOR') {
        const items = await ProveedorRepository.listarTodos();
        return items.map(p => ({ ...p, id_actor: p.id_proveedor, tipo_actor: 'PROVEEDOR' }));
      }
      if (tipo === 'OPERADOR') {
        const items = await OperadorRepository.listarTodos();
        return items.map(o => ({ ...o, id_actor: o.id_operador, tipo_actor: 'OPERADOR' }));
      }
    }
    const [clientes, proveedores, operadores] = await Promise.all([
      ClienteRepository.listarTodos(),
      ProveedorRepository.listarTodos(),
      OperadorRepository.listarTodos()
    ]);
    return [
      ...clientes.map(c => ({ ...c, id_actor: c.id_cliente, tipo_actor: 'CLIENTE' })),
      ...proveedores.map(p => ({ ...p, id_actor: p.id_proveedor, tipo_actor: 'PROVEEDOR' })),
      ...operadores.map(o => ({ ...o, id_actor: o.id_operador, tipo_actor: 'OPERADOR' }))
    ];
  }

  static async obtenerPorId(id, tipo_actor = null) {
    if (tipo_actor) {
      const tipo = tipo_actor.toUpperCase();
      if (tipo === 'CLIENTE') {
        const res = await ClienteRepository.obtenerPorId(id);
        return res ? { ...res, id_actor: res.id_cliente, tipo_actor: 'CLIENTE' } : null;
      }
      if (tipo === 'PROVEEDOR') {
        const res = await ProveedorRepository.obtenerPorId(id);
        return res ? { ...res, id_actor: res.id_proveedor, tipo_actor: 'PROVEEDOR' } : null;
      }
      if (tipo === 'OPERADOR') {
        const res = await OperadorRepository.obtenerPorId(id);
        return res ? { ...res, id_actor: res.id_operador, tipo_actor: 'OPERADOR' } : null;
      }
    }

    const cli = await ClienteRepository.obtenerPorId(id);
    if (cli) return { ...cli, id_actor: cli.id_cliente, tipo_actor: 'CLIENTE' };

    const prov = await ProveedorRepository.obtenerPorId(id);
    if (prov) return { ...prov, id_actor: prov.id_proveedor, tipo_actor: 'PROVEEDOR' };

    const op = await OperadorRepository.obtenerPorId(id);
    if (op) return { ...op, id_actor: op.id_operador, tipo_actor: 'OPERADOR' };

    return null;
  }

  /**
   * Resuelve un actor por su identidad completa.
   * Si no se informa tipo_actor, solo acepta IDs que no estén repetidos entre
   * clientes, proveedores y operadores para evitar operar sobre el actor erróneo.
   */
  static async resolverActor(id_actor, tipo_actor = null) {
    if (tipo_actor) {
      const actor = await this.obtenerPorId(id_actor, tipo_actor);
      if (!actor) {
        throw new Error(`Actor ${String(tipo_actor).toUpperCase()} con ID ${id_actor} no encontrado.`);
      }
      return actor;
    }

    const actores = await this.listarTodos();
    const coincidencias = actores.filter(a => Number(a.id_actor) === Number(id_actor));

    if (coincidencias.length === 0) {
      throw new Error(`Actor con ID ${id_actor} no encontrado.`);
    }
    if (coincidencias.length > 1) {
      const tipos = coincidencias.map(a => a.tipo_actor).join(', ');
      throw new Error(`El ID ${id_actor} es ambiguo (existe para ${tipos}). Indique el tipo de actor.`);
    }
    return coincidencias[0];
  }

  static async crear({ tipo_actor = 'CLIENTE', razon_social, cuit, email, telefono, direccion, pais }) {
    const tipo = (tipo_actor || 'CLIENTE').toUpperCase();
    if (tipo === 'CLIENTE') return ClienteRepository.crear({ razon_social, cuit, email, telefono, direccion, pais });
    if (tipo === 'PROVEEDOR') return ProveedorRepository.crear({ razon_social, cuit, email, telefono, direccion, pais });
    if (tipo === 'OPERADOR') return OperadorRepository.crear({ razon_social, cuit, email, telefono, direccion, pais });
    throw new Error(`Tipo no válido: ${tipo_actor}`);
  }

  static async actualizar(id, data, tipo_actor = 'CLIENTE') {
    const tipo = (tipo_actor || 'CLIENTE').toUpperCase();
    if (tipo === 'CLIENTE') return ClienteRepository.actualizar(id, data);
    if (tipo === 'PROVEEDOR') return ProveedorRepository.actualizar(id, data);
    if (tipo === 'OPERADOR') return OperadorRepository.actualizar(id, data);
    return null;
  }

  static async darDeBaja(id, tipo_actor = 'CLIENTE') {
    const tipo = (tipo_actor || 'CLIENTE').toUpperCase();
    if (tipo === 'CLIENTE') return ClienteRepository.darDeBaja(id);
    if (tipo === 'PROVEEDOR') return ProveedorRepository.darDeBaja(id);
    if (tipo === 'OPERADOR') return OperadorRepository.darDeBaja(id);
    return null;
  }

  static async eliminar(id, tipo_actor = 'CLIENTE') {
    const tipo = (tipo_actor || 'CLIENTE').toUpperCase();
    if (tipo === 'CLIENTE') return ClienteRepository.eliminar(id);
    if (tipo === 'PROVEEDOR') return ProveedorRepository.eliminar(id);
    if (tipo === 'OPERADOR') return OperadorRepository.eliminar(id);
    return null;
  }
}
