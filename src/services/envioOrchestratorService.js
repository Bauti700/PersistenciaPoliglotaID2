import { ActorRepository } from '../repositories/actorRepository.js';
import { ContenedorRepository } from '../repositories/contenedorRepository.js';
import { SensorRepository } from '../repositories/sensorRepository.js';
import { EnvioRepository } from '../repositories/envioRepository.js';
import { FacturaRepository } from '../repositories/facturaRepository.js';
import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { Neo4jRouteRepository } from '../repositories/rutaRepository.js';
import { RedisCacheRepository } from '../repositories/cacheRepository.js';
import { pgPool } from '../config/database.js';
import {
  textoRequerido,
  textoOpcional,
  errorValidacion
} from '../utils/validation.js';

function claveCacheEnvio(id_envio) {
  return `envio:estado:${id_envio}`;
}

// Normaliza y valida la composición del envío. Todo envío debe tener al menos
// un contenedor entero y no puede repetir el mismo contenedor.
function normalizarContenedores(contenedores) {
  if (!Array.isArray(contenedores) || contenedores.length === 0) {
    throw errorValidacion('El envío debe incluir al menos un contenedor.');
  }
  const ids = contenedores.map((contenedor, index) => {
    const valor = typeof contenedor === 'string'
      ? contenedor
      : contenedor?.id_contenedor;
    return textoRequerido(valor, `contenedores[${index}]`, { max: 50 });
  });
  const unicos = [...new Set(ids)];
  if (unicos.length !== ids.length) {
    throw errorValidacion('No se puede repetir el mismo contenedor en un envío.');
  }
  return unicos;
}

// Revierte el estado del envío y la liberación de contenedores si falla la
// sincronización con Neo4j.
async function revertirEstadoYContenedores(id_envio, estadoAnterior, contenedoresLiberados = []) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await EnvioRepository.cambiarEstado(id_envio, estadoAnterior, client);
    if (contenedoresLiberados.length > 0) {
      await ContenedorRepository.reactivarContenedoresDeEnvio(
        id_envio,
        contenedoresLiberados,
        client
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.warn(
      `[EnvioOrchestrator] No se pudo revertir el estado del envío ${id_envio}: ${error.message}`
    );
  } finally {
    client.release();
  }
}

async function compensar(acciones) {
  const errores = [];
  for (const accion of acciones) {
    try {
      await accion.run();
    } catch (error) {
      errores.push(`${accion.nombre}: ${error.message}`);
    }
  }
  return errores;
}

async function actualizarCacheEnvio(id_envio, datos) {
  await RedisCacheRepository.setCache(claveCacheEnvio(id_envio), {
    ...datos,
    ultima_actualizacion: new Date().toISOString()
  }, 3600);
}

async function invalidarPrediccionEnvio(id_envio) {
  try {
    await RedisCacheRepository.invalidarPrediccionRiesgo(id_envio);
  } catch (error) {
    console.warn(`[EnvioOrchestrator] No se pudo invalidar la predicción de ${id_envio}: ${error.message}`);
  }
}

async function registrarEventoTrazabilidad({ id_envio, tipo_evento, descripcion, ubicacion = null }) {
  try {
    await MongoTelemetryRepository.registrarEventoLogistico({
      id_evento: `EVT-${id_envio}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      id_envio,
      tipo_evento,
      descripcion,
      ubicacion
    });
  } catch (error) {
    console.warn(`[EnvioOrchestrator] No se pudo registrar el evento ${tipo_evento} de ${id_envio}: ${error.message}`);
  }
}

function construirTramosActualizados(tramosActuales, origen, destino) {
  const normalizar = (tramo) => ({
    id_tramo: tramo.id_tramo || tramo.tramo_id || null,
    desde: tramo.origen || tramo.desde,
    hasta: tramo.destino || tramo.hasta,
    medio: tramo.medio_transporte || tramo.medio || 'Terrestre'
  });
  const tramos = (tramosActuales || [])
    .filter(t => t && (t.id_tramo || t.tramo_id))
    .map(normalizar);

  if (tramos.length === 0) {
    return [{ desde: origen, hasta: destino, medio: 'Terrestre' }];
  }
  if (tramos.length === 1) {
    return [{
      id_tramo: tramos[0].id_tramo,
      desde: origen,
      hasta: destino,
      medio: tramos[0].medio
    }];
  }
  return tramos.map((tramo, indice) => ({
    id_tramo: tramo.id_tramo,
    desde: indice === 0 ? origen : tramo.desde,
    hasta: indice === tramos.length - 1 ? destino : tramo.hasta,
    medio: tramo.medio
  }));
}

export class EnvioOrchestratorService {
  /**
   * Crea un envío de forma políglota y consistente:
   * 1. PostgreSQL es la fuente transaccional (envío + tramos en una transacción).
   * 2. Neo4j proyecta la topología del envío.
   * 3. MongoDB registra el evento inicial en eventos_logisticos.
   * 4. Redis prepara la caché de estado.
   *
   * Si falla cualquier motor secundario se revierte PostgreSQL y se compensan
   * los motores que ya habían escrito, informando los estados reales.
   */
  static async crearEnvioPoliglota({
    id_envio,
    id_cliente,
    origen,
    destino,
    prioridad = 'MEDIA',
    operador = null,
    vehiculo = null,
    contenedores,
    tramos = []
  }) {
    const cliente = await ActorRepository.resolverActor(id_cliente, 'CLIENTE');
    if (cliente.estado !== 'ACTIVO') {
      throw errorValidacion(`El cliente ${cliente.razon_social} está inactivo.`, 409);
    }

    const contenedoresNormalizados = normalizarContenedores(contenedores);

    const datosBase = EnvioRepository.validarEnvio({
      id_envio,
      id_cliente: cliente.id_actor,
      origen,
      destino,
      prioridad,
      estado: 'EN_TRANSITO'
    });

    const operadorNormalizado = textoOpcional(operador, 'operador', { max: 150 });
    const vehiculoNormalizado = textoOpcional(vehiculo, 'vehiculo', { max: 100 });
    const tramosNormalizados = Array.isArray(tramos) && tramos.length > 0
      ? tramos
      : [{ desde: datosBase.origen, hasta: datosBase.destino, medio: 'Terrestre' }];

    const idEvento = `EVT-${datosBase.id_envio}-INIT`;
    let neo4jOk = false;
    let mongoOk = false;
    let redisOk = false;
    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');
      const envioCreado = await EnvioRepository.crearEnvio(
        { ...datosBase, tramos: tramosNormalizados },
        client
      );

      // El envío y sus contenedores se persisten en la misma transacción.
      const contenedoresAsignados = await ContenedorRepository.asignarContenedoresAEnvio(
        datosBase.id_envio,
        contenedoresNormalizados,
        client
      );

      // 2. Neo4j: topología de red
      await Neo4jRouteRepository.crearEnvioConRuta({
        id_envio: datosBase.id_envio,
        id_cliente: cliente.id_actor,
        cliente_nombre: cliente.razon_social,
        cliente_pais: cliente.pais,
        origen: datosBase.origen,
        destino: datosBase.destino,
        operador: operadorNormalizado,
        vehiculo: vehiculoNormalizado,
        prioridad: datosBase.prioridad,
        tramos: tramosNormalizados,
        contenedores: contenedoresNormalizados
      });
      neo4jOk = true;

      // 3. MongoDB: evento de trazabilidad
      await MongoTelemetryRepository.registrarEventoLogistico({
        id_evento: idEvento,
        id_envio: datosBase.id_envio,
        tipo_evento: 'ENVIO_CREADO',
        ubicacion: datosBase.origen,
        descripcion:
          `Envío creado con destino ${datosBase.destino}. ` +
          `Prioridad ${datosBase.prioridad}; ${tramosNormalizados.length} tramo(s); ` +
          `${contenedoresNormalizados.length} contenedor(es): ${contenedoresNormalizados.join(', ')}.`
      });
      mongoOk = true;

      // 4. Redis: caché de estado
      await actualizarCacheEnvio(datosBase.id_envio, {
        estado: 'EN_TRANSITO',
        origen: datosBase.origen,
        destino: datosBase.destino
      });
      redisOk = true;

      await client.query('COMMIT');

      return {
        envio: {
          ...envioCreado,
          contenedores: contenedoresAsignados.map(c => c.id_contenedor)
        },
        sincronizacion: {
          postgresql: 'OK',
          neo4j: 'OK',
          mongodb: 'OK',
          redis: 'OK'
        }
      };
    } catch (error) {
      let rollbackOk = false;
      try {
        await client.query('ROLLBACK');
        rollbackOk = true;
      } catch (rollbackError) {
        console.warn(`[EnvioOrchestrator] Falló el ROLLBACK: ${rollbackError.message}`);
      }

      const compensaciones = [];
      if (redisOk) {
        compensaciones.push({
          nombre: 'redis',
          run: () => RedisCacheRepository.delCache(claveCacheEnvio(datosBase.id_envio))
        });
      }
      if (mongoOk) {
        compensaciones.push({
          nombre: 'mongodb',
          run: () => MongoTelemetryRepository.eliminarEventoLogistico(idEvento)
        });
      }
      if (neo4jOk) {
        compensaciones.push({
          nombre: 'neo4j',
          run: () => Neo4jRouteRepository.eliminarEnvio(datosBase.id_envio)
        });
      }

      const erroresCompensacion = await compensar(compensaciones);
      const detalle = erroresCompensacion.length > 0
        ? ` Compensaciones con error: ${erroresCompensacion.join('; ')}.`
        : '';

      if (error.statusCode) {
        throw error;
      }
      if (error.code === '23505' && error.constraint === 'uq_envio_contenedor_activo') {
        throw errorValidacion('Alguno de los contenedores ya está asignado a otro envío activo.', 409);
      }
      if (error.code === '23505') {
        throw errorValidacion(`Ya existe un envío con el ID ${datosBase.id_envio}.`, 409);
      }
      throw new Error(
        `No se pudo crear el envío ${datosBase.id_envio}: ${error.message}. ` +
        `PostgreSQL ${rollbackOk ? 'revertido' : 'NO revertido'}.${detalle}`
      );
    } finally {
      client.release();
    }
  }

  static async crearEnvioSincronizado({ id_envio, id_cliente, origen, destino, prioridad = 'MEDIA', contenedores }) {
    return this.crearEnvioPoliglota({
      id_envio,
      id_cliente,
      origen,
      destino,
      prioridad,
      contenedores,
      tramos: [{ desde: origen, hasta: destino, medio: 'Terrestre' }]
    });
  }

  static async asignarContenedorAEnvio({ id_envio, id_contenedor }) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const idContenedor = textoRequerido(id_contenedor, 'id_contenedor', { max: 50 });

    const envio = await EnvioRepository.obtenerPorId(idEnvio);
    if (!envio) throw errorValidacion(`El envío ${idEnvio} no existe.`, 404);
    if (['ENTREGADO', 'CANCELADO'].includes(envio.estado)) {
      throw errorValidacion(`El envío ${idEnvio} está ${envio.estado} y no admite asignaciones.`, 409);
    }

    const contenedor = await ContenedorRepository.obtenerPorId(idContenedor);
    if (!contenedor) throw errorValidacion(`El contenedor ${idContenedor} no existe.`, 404);
    if (contenedor.estado === 'FUERA_SERVICIO') {
      throw errorValidacion(`El contenedor ${idContenedor} está fuera de servicio.`, 409);
    }

    const client = await pgPool.connect();
    let neo4jOk = false;
    try {
      await client.query('BEGIN');
      await ContenedorRepository.asignarContenedoresAEnvio(
        idEnvio,
        [idContenedor],
        client
      );
      await Neo4jRouteRepository.asignarContenedorAEnvio(idEnvio, idContenedor);
      neo4jOk = true;
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (neo4jOk) {
        try {
          await Neo4jRouteRepository.desasignarContenedorDeEnvio(idEnvio, idContenedor);
        } catch (errorNeo4j) {
          console.warn(
            `[EnvioOrchestrator] No se pudo compensar Neo4j para ${idContenedor}: ${errorNeo4j.message}`
          );
        }
      }
      if (error.statusCode) throw error;
      throw new Error(
        `No se pudo asignar el contenedor ${idContenedor} al envío ${idEnvio}: ${error.message}.`
      );
    } finally {
      client.release();
    }

    await registrarEventoTrazabilidad({
      id_envio: idEnvio,
      tipo_evento: 'CONTENEDOR_ASIGNADO',
      descripcion: `Contenedor ${idContenedor} asignado al envío.`,
      ubicacion: envio.origen
    });

    return {
      envio: idEnvio,
      contenedor: idContenedor,
      estado_contenedor: 'EN_TRANSITO',
      grafo: 'OK'
    };
  }

  static async asignarSensorAContenedorEnvio({ id_envio, id_contenedor, id_sensor }) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const idContenedor = textoRequerido(id_contenedor, 'id_contenedor', { max: 50 });
    const idSensor = textoRequerido(id_sensor, 'id_sensor', { max: 50 });

    const envio = await EnvioRepository.obtenerPorId(idEnvio);
    if (!envio) throw errorValidacion(`El envío ${idEnvio} no existe.`, 404);
    if (['ENTREGADO', 'CANCELADO'].includes(envio.estado)) {
      throw errorValidacion(`El envío ${idEnvio} está ${envio.estado} y no admite asignaciones.`, 409);
    }

    const contenedor = await ContenedorRepository.obtenerPorId(idContenedor);
    if (!contenedor) throw errorValidacion(`El contenedor ${idContenedor} no existe.`, 404);
    if (contenedor.estado === 'FUERA_SERVICIO') {
      throw errorValidacion(`El contenedor ${idContenedor} está fuera de servicio.`, 409);
    }
    if (!(await ContenedorRepository.estaAsignadoAEnvio(idEnvio, idContenedor))) {
      throw errorValidacion(
        `El contenedor ${idContenedor} no pertenece al envío ${idEnvio}. ` +
        'Asigne primero el contenedor al envío desde la opción 8.',
        409
      );
    }

    const sensor = await SensorRepository.obtenerSensorPorId(idSensor);
    if (!sensor) throw errorValidacion(`El sensor ${idSensor} no existe.`, 404);
    if (sensor.estado !== 'ACTIVO') {
      throw errorValidacion(`El sensor ${idSensor} está inactivo.`, 409);
    }

    const contenedorAnteriorSensor = sensor.id_contenedor || null;
    const estadoAnteriorContenedor = contenedor.estado;

    let contenedorActualizado = false;
    let sensorActualizado = false;

    try {
      if (contenedor.estado === 'DISPONIBLE') {
        await ContenedorRepository.marcarEnTransito(idContenedor);
        contenedorActualizado = true;
      }

      await SensorRepository.asignarSensorAContenedor(idSensor, idContenedor);
      sensorActualizado = true;

      await Neo4jRouteRepository.asignarSensorAContenedorEnvio(idEnvio, idContenedor, idSensor);
    } catch (error) {
      const compensaciones = [];
      if (sensorActualizado) {
        compensaciones.push({
          nombre: 'mongo',
          run: () => SensorRepository.restaurarAsignacion(idSensor, contenedorAnteriorSensor)
        });
      }
      if (contenedorActualizado) {
        compensaciones.push({
          nombre: 'postgresql',
          run: () => ContenedorRepository.restaurarEstado(idContenedor, estadoAnteriorContenedor)
        });
      }
      compensaciones.push({
        nombre: 'neo4j',
        run: () => Neo4jRouteRepository.desasignarSensorDeContenedor(idContenedor, idSensor)
      });

      const errores = await compensar(compensaciones);
      const detalle = errores.length > 0 ? ` Compensaciones con error: ${errores.join('; ')}.` : '';
      throw new Error(
        `No se pudo asignar el sensor ${idSensor} al contenedor ${idContenedor} / envío ${idEnvio}: ` +
        `${error.message}.${detalle}`
      );
    }

    await registrarEventoTrazabilidad({
      id_envio: idEnvio,
      tipo_evento: 'SENSOR_ASIGNADO',
      descripcion: `Sensor ${idSensor} asignado al contenedor ${idContenedor}.`,
      ubicacion: envio.origen
    });

    return {
      envio: idEnvio,
      contenedor: idContenedor,
      sensor: idSensor,
      estado_contenedor: 'EN_TRANSITO',
      asignacion: 'OK'
    };
  }

  static async actualizarEnvio(id_envio, cambios) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const existente = await EnvioRepository.obtenerPorId(idEnvio);
    if (!existente) throw errorValidacion(`El envío ${idEnvio} no existe.`, 404);

    const cambiosNormalizados = EnvioRepository.validarEnvio(cambios, { parcial: true });
    if (cambiosNormalizados.estado !== undefined) {
      throw errorValidacion('Para cambiar el estado use la opción "Cambiar estado del envío".');
    }
    const actualizado = await EnvioRepository.actualizar(idEnvio, cambiosNormalizados);

    const origen = cambiosNormalizados.origen || existente.origen;
    const destino = cambiosNormalizados.destino || existente.destino;
    const prioridad = cambiosNormalizados.prioridad || existente.prioridad;
    const estado = cambiosNormalizados.estado || existente.estado;
    const cambioRuta = origen !== existente.origen || destino !== existente.destino;

    if (cambioRuta) {
      await EnvioRepository.actualizarExtremosTramos(idEnvio, origen, destino);
    }

    let grafo = 'OK';
    let redis = 'OK';
    try {
      await Neo4jRouteRepository.actualizarDatosEnvio({
        id_envio: idEnvio,
        origen,
        destino,
        prioridad,
        estado
      });
      if (cambioRuta) {
        await Neo4jRouteRepository.reemplazarTramosEnvio(
          idEnvio,
          construirTramosActualizados(existente.tramos, origen, destino)
        );
      }
    } catch (error) {
      grafo = 'ERROR';
      await EnvioRepository.actualizar(idEnvio, {
        origen: existente.origen,
        destino: existente.destino,
        prioridad: existente.prioridad,
        estado: existente.estado
      });
      if (cambioRuta) {
        await EnvioRepository.actualizarExtremosTramos(
          idEnvio,
          existente.origen,
          existente.destino
        );
      }
      throw new Error(
        `No se pudo actualizar el envío ${idEnvio} en Neo4j: ${error.message}. ` +
        'Se restauraron los datos en PostgreSQL.'
      );
    }

    try {
      await actualizarCacheEnvio(idEnvio, {
        estado,
        origen,
        destino,
        prioridad
      });
    } catch (error) {
      redis = 'DEGRADADO';
    }
    await invalidarPrediccionEnvio(idEnvio);

    await registrarEventoTrazabilidad({
      id_envio: idEnvio,
      tipo_evento: 'ENVIO_ACTUALIZADO',
      descripcion: `Envío actualizado: origen ${origen}, destino ${destino}, prioridad ${prioridad}.`,
      ubicacion: origen
    });

    return { envio: actualizado, sincronizacion: { postgresql: 'OK', neo4j: grafo, redis } };
  }

  static async cambiarEstadoEnvio(id_envio, estado) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const existente = await EnvioRepository.obtenerPorId(idEnvio);
    if (!existente) throw errorValidacion(`El envío ${idEnvio} no existe.`, 404);

    // El estado y la liberación de contenedores se confirman en una sola
    // transacción: un envío cerrado nunca queda con contenedores activos.
    const client = await pgPool.connect();
    let actualizado;
    let contenedoresLiberados = [];
    try {
      await client.query('BEGIN');
      actualizado = await EnvioRepository.cambiarEstado(idEnvio, estado, client);
      if (['ENTREGADO', 'CANCELADO'].includes(actualizado.estado)) {
        contenedoresLiberados = await ContenedorRepository.liberarContenedoresDeEnvio(
          idEnvio,
          client
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    try {
      await Neo4jRouteRepository.actualizarEstadoEnvio(idEnvio, actualizado.estado, {
        liberarContenedores: contenedoresLiberados.length > 0
      });
    } catch (error) {
      await revertirEstadoYContenedores(idEnvio, existente.estado, contenedoresLiberados);
      throw new Error(
        `No se pudo cambiar el estado del envío ${idEnvio} en Neo4j: ${error.message}. ` +
        'Se restauró el estado y la composición en PostgreSQL.'
      );
    }

    let redis = 'OK';
    try {
      await actualizarCacheEnvio(idEnvio, {
        estado: actualizado.estado,
        origen: actualizado.origen,
        destino: actualizado.destino,
        prioridad: actualizado.prioridad
      });
    } catch {
      redis = 'DEGRADADO';
    }
    await invalidarPrediccionEnvio(idEnvio);

    const detalleContenedores = contenedoresLiberados.length > 0
      ? ` Contenedores liberados: ${contenedoresLiberados.join(', ')}.`
      : '';
    await registrarEventoTrazabilidad({
      id_envio: idEnvio,
      tipo_evento: 'ESTADO_CAMBIADO',
      descripcion:
        `Estado del envío cambiado de ${existente.estado} a ${actualizado.estado}.` +
        detalleContenedores,
      ubicacion: actualizado.origen
    });

    // Al cerrar el envío como ENTREGADO se dispara la facturación automática.
    // Es best-effort: si falla, el cambio de estado no se revierte y se informa
    // el error para poder reintentar desde el módulo financiero.
    let facturacion = null;
    if (actualizado.estado === 'ENTREGADO' && existente.estado !== 'ENTREGADO') {
      try {
        const resultado = await FacturaRepository.facturacionAutomaticaPorEnvio(idEnvio);
        facturacion = resultado.ya_facturado
          ? { estado: 'YA_FACTURADO', factura_id: resultado.factura.id_factura }
          : {
              estado: 'FACTURADO',
              factura_id: resultado.factura.id_factura,
              importe: resultado.factura.importe_total
            };
      } catch (error) {
        facturacion = { estado: 'ERROR', mensaje: error.message };
      }
    }

    return {
      envio: actualizado,
      contenedores_liberados: contenedoresLiberados,
      sincronizacion: { postgresql: 'OK', neo4j: 'OK', redis },
      facturacion
    };
  }

  static async cancelarEnvio(id_envio) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const existente = await EnvioRepository.obtenerPorId(idEnvio);
    if (!existente) throw errorValidacion(`El envío ${idEnvio} no existe.`, 404);
    if (existente.estado === 'ENTREGADO') {
      throw errorValidacion(`El envío ${idEnvio} ya fue entregado y no puede cancelarse.`, 409);
    }
    if (existente.estado === 'CANCELADO') {
      return {
        envio: existente,
        contenedores_liberados: [],
        sincronizacion: { postgresql: 'OK', neo4j: 'OK', redis: 'OK' }
      };
    }

    const client = await pgPool.connect();
    let cancelado;
    let contenedoresLiberados = [];
    try {
      await client.query('BEGIN');
      cancelado = await EnvioRepository.cambiarEstado(idEnvio, 'CANCELADO', client);
      contenedoresLiberados = await ContenedorRepository.liberarContenedoresDeEnvio(
        idEnvio,
        client
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    try {
      await Neo4jRouteRepository.actualizarEstadoEnvio(idEnvio, 'CANCELADO', {
        liberarContenedores: contenedoresLiberados.length > 0
      });
    } catch (error) {
      await revertirEstadoYContenedores(idEnvio, existente.estado, contenedoresLiberados);
      throw new Error(
        `No se pudo cancelar el envío ${idEnvio} en Neo4j: ${error.message}. ` +
        'Se restauró el estado y la composición en PostgreSQL.'
      );
    }

    let redis = 'OK';
    try {
      await RedisCacheRepository.delCache(claveCacheEnvio(idEnvio));
    } catch {
      redis = 'DEGRADADO';
    }
    await invalidarPrediccionEnvio(idEnvio);

    await registrarEventoTrazabilidad({
      id_envio: idEnvio,
      tipo_evento: 'ENVIO_CANCELADO',
      descripcion:
        'Envío cancelado. Contenedores liberados: ' +
        `${contenedoresLiberados.join(', ') || 'ninguno'}.`,
      ubicacion: existente.origen
    });

    return {
      envio: cancelado,
      contenedores_liberados: contenedoresLiberados,
      sincronizacion: { postgresql: 'OK', neo4j: 'OK', redis }
    };
  }

  static async eliminarEnvio(id_envio) {
    const idEnvio = textoRequerido(id_envio, 'id_envio', { max: 50 });
    const existente = await EnvioRepository.obtenerPorId(idEnvio);
    if (!existente) throw errorValidacion(`El envío ${idEnvio} no existe.`, 404);

    const eliminado = await EnvioRepository.eliminar(idEnvio);

    const sincronizacion = { postgresql: 'OK', neo4j: 'OK', redis: 'OK', mongodb: 'OK' };
    try {
      await Neo4jRouteRepository.eliminarEnvio(idEnvio);
    } catch {
      sincronizacion.neo4j = 'ERROR';
    }
    try {
      await RedisCacheRepository.delCache(claveCacheEnvio(idEnvio));
    } catch {
      sincronizacion.redis = 'ERROR';
    }
    await invalidarPrediccionEnvio(idEnvio);
    try {
      const eventos = await MongoTelemetryRepository.listarEventosPorEnvio(idEnvio, 500);
      for (const evento of eventos) {
        await MongoTelemetryRepository.eliminarEventoLogistico(evento.id_evento);
      }
    } catch {
      sincronizacion.mongodb = 'ERROR';
    }

    return { envio: eliminado, sincronizacion };
  }

  static async listarEnvios(filtro = {}) {
    return EnvioRepository.listarTodos(filtro);
  }
}

export { EnvioOrchestratorService as envioOrchestratorService };
