import { pgPool } from '../config/database.js';
import { ContenedorRepository } from '../repositories/contenedorRepository.js';
import { ShipmentContainerRepository } from '../repositories/shipmentContainerRepository.js';
import { Neo4jRouteRepository } from '../repositories/rutaRepository.js';
import { EnvioRepository } from '../repositories/envioRepository.js';
import { MongoTelemetryRepository } from '../repositories/telemetriaRepository.js';
import { textoRequerido, errorValidacion } from '../utils/validation.js';

// Servicio para manejar la asignación de contenedores a envíos, incluyendo validaciones de estado y registro de eventos logísticos.
export class ContenedorAssignmentService {
  // Asigna múltiples contenedores a un envío específico, utilizando una transacción para asegurar la consistencia entre PostgreSQL y Neo4j.
  static async asignarContenedoresAEnvio(id_envio, contenedores, client = pgPool) {
    return ShipmentContainerRepository.asignar(id_envio, contenedores, client);
  }

  // Libera todos los contenedores asignados a un envío específico, permitiendo que puedan ser reasignados a otros envíos.
  static async liberarContenedoresDeEnvio(id_envio, client = pgPool) {
    return ShipmentContainerRepository.liberar(id_envio, client);
  }

  // Reactiva contenedores previamente desasignados de un envío, permitiendo que vuelvan a estar disponibles para asignación.
  static async reactivarContenedoresDeEnvio(id_envio, ids, client = pgPool) {
    return ShipmentContainerRepository.reactivar(id_envio, ids, client);
  }

  // Marca un contenedor como "en tránsito", indicando que está actualmente asignado a un envío y no disponible para otras asignaciones.
  static marcarEnTransito(id) {
    return ContenedorRepository.marcarEnTransito(id);
  }

  // Restaura el estado de un contenedor a un estado específico, permitiendo revertir cambios de estado previos.
  static restaurarEstado(id, estado) {
    return ContenedorRepository.restaurarEstado(id, estado);
  }

  // Actualiza la información de un contenedor, incluyendo validaciones de estado y verificando que no esté asignado a envíos activos antes de permitir ciertos cambios.
  static async actualizar(id, cambios) {
    if (['DISPONIBLE', 'FUERA_SERVICIO'].includes(cambios?.estado)) {
      const activas = await ShipmentContainerRepository.contarAsignacionesActivas(id);
      if (activas > 0) {
        throw errorValidacion(
          `No se puede cambiar el estado del contenedor ${id}: está asignado a ${activas} envío(s) activo(s).`,
          409
        );
      }
    }
    return ContenedorRepository.actualizar(id, cambios);
  }

  // Da de baja un contenedor, asegurando que no esté en tránsito ni asignado a envíos activos antes de permitir la baja.
  static async darDeBaja(id) {
    const existente = await ContenedorRepository.obtenerPorId(id);
    if (!existente) return null;
    if (existente.estado === 'EN_TRANSITO') {
      throw errorValidacion('No se puede dar de baja un contenedor que está en tránsito.', 409);
    }
    const activas = await ShipmentContainerRepository.contarAsignacionesActivas(id);
    if (activas > 0) {
      throw errorValidacion(
        `No se puede dar de baja el contenedor ${id}: está asignado a ${activas} envío(s) activo(s).`,
        409
      );
    }
    return ContenedorRepository.darDeBaja(id);
  }

  // Reactiva un contenedor previamente dado de baja, permitiendo que vuelva a estar disponible para asignación.
  static activar(id) {
    return ContenedorRepository.activar(id);
  }

  // Elimina un contenedor, asegurando que no tenga sensores asignados antes de permitir la eliminación y manejando la consistencia entre PostgreSQL y Neo4j.
  static async eliminar(id) {
    const sensores = await ShipmentContainerRepository.contarSensoresAsignados(id);
    if (sensores > 0) {
      throw errorValidacion(
        `No se puede eliminar el contenedor ${id}: tiene ${sensores} sensor(es) asignado(s).`,
        409
      );
    }
    const eliminado = await ContenedorRepository.eliminar(id);
    if (eliminado) {
      try {
        await Neo4jRouteRepository.eliminarContenedor(id);
      } catch (error) {
        console.warn(
          `[ContenedorAssignmentService] Contenedor ${id} eliminado de PostgreSQL, pero no de Neo4j: ${error.message}`
        );
      }
    }
    return eliminado;
  }

  // Asigna un contenedor a un envío específico, realizando validaciones de existencia y estado, y registrando el evento en la base de datos de telemetría.
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
    try {
      await client.query('BEGIN');
      await ShipmentContainerRepository.asignar(idEnvio, [idContenedor], client);
      await Neo4jRouteRepository.asignarContenedorAEnvio(idEnvio, idContenedor);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error.statusCode ? error : new Error(
        `No se pudo asignar el contenedor ${idContenedor} al envío ${idEnvio}: ${error.message}.`
      );
    } finally {
      client.release();
    }
    try {
      await MongoTelemetryRepository.registrarEventoLogistico({
        id_evento: `EVT-${idEnvio}-CONT-${Date.now()}`,
        id_envio: idEnvio,
        tipo_evento: 'CONTENEDOR_ASIGNADO',
        descripcion: `Contenedor ${idContenedor} asignado al envío.`,
        ubicacion: envio.origen
      });
    } catch (error) {
      console.warn(`[ContenedorAssignmentService] No se pudo registrar la asignación: ${error.message}`);
    }
    return { envio: idEnvio, contenedor: idContenedor, estado_contenedor: 'EN_TRANSITO', grafo: 'OK' };
  }
}
