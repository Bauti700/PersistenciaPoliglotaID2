import { neoDriver } from '../config/database.js';

export class Neo4jRouteRepository {
  static async crearEnvioConRuta({ id_envio, id_cliente, origen, destino, operador, vehiculo, tramos, prioridad = 'MEDIA' }) {
    const session = neoDriver.session();
    try {
      const cypher = `
        MERGE (c:Cliente {id_cliente: $id_cliente})
        MERGE (e:Envio {id_envio: $id_envio})
        SET e.estado = 'EN_TRANSITO', e.fecha_creacion = datetime(), e.prioridad = $prioridad
        MERGE (c)-[:SOLICITA]->(e)

        MERGE (uOri:Ubicacion {nombre: $origen})
        MERGE (uDes:Ubicacion {nombre: $destino})
        MERGE (e)-[:TIENE_ORIGEN]->(uOri)
        MERGE (e)-[:TIENE_DESTINO]->(uDes)

        FOREACH (_ IN CASE WHEN $operador IS NOT NULL THEN [1] ELSE [] END |
          MERGE (op:Operador {nombre: $operador})
          MERGE (e)-[:ASIGNADO_A]->(op)
        )

        FOREACH (_ IN CASE WHEN $vehiculo IS NOT NULL THEN [1] ELSE [] END |
          MERGE (v:Vehiculo {identificacion: $vehiculo})
          MERGE (e)-[:TRANSPORTADO_POR]->(v)
        )
      `;
      await session.run(cypher, { id_envio, id_cliente: Number(id_cliente), origen, destino, operador, vehiculo, prioridad });

      // Conectar tramos en secuencia si se proporcionaron
      if (tramos && tramos.length > 0) {
        for (let i = 0; i < tramos.length; i++) {
          const t = tramos[i];
          const tramoCypher = `
            MATCH (e:Envio {id_envio: $id_envio})
            MERGE (u1:Ubicacion {nombre: $desde})
            MERGE (u2:Ubicacion {nombre: $hasta})
            MERGE (tr:Tramo {id_tramo: $id_tramo})
            SET tr.orden = $orden, tr.medio = $medio
            MERGE (e)-[:COMPUESTO_POR]->(tr)
            WITH tr, u1, u2
            OPTIONAL MATCH (tr)-[r:DESDE|HASTA]->(:Ubicacion)
            DELETE r
            WITH tr, u1, u2
            MERGE (tr)-[:DESDE]->(u1)
            MERGE (tr)-[:HASTA]->(u2)
          `;
          await session.run(tramoCypher, {
            id_envio,
            id_tramo: t.id_tramo || `TR-${id_envio}-${i+1}`,
            orden: i + 1,
            medio: t.medio || 'Terrestre',
            desde: t.desde,
            hasta: t.hasta
          });
        }
      }

      return { status: 'OK', id_envio };
    } finally {
      await session.close();
    }
  }

  // Vincula un contenedor existente (o lo crea en el grafo) con un envío.
  static async asignarContenedorAEnvio(id_envio, id_contenedor) {
    const session = neoDriver.session();
    try {
      const cypher = `
        MATCH (e:Envio {id_envio: $id_envio})
        MERGE (c:Contenedor {id_contenedor: $id_contenedor})
        MERGE (c)-[:PERTENECE_A]->(e)
        RETURN c.id_contenedor AS contenedor, e.id_envio AS envio
      `;
      const result = await session.run(cypher, { id_envio, id_contenedor });
      if (result.records.length === 0) {
        throw new Error(`El envío ${id_envio} no existe en Neo4j. Cree primero el envío o verifique el código.`);
      }
      return { status: 'OK', id_envio, id_contenedor };
    } finally {
      await session.close();
    }
  }

  // Vincula sensor, contenedor y envío en una sola operación, dejando el grafo
  // consistente con reconstruirRecorridoContenedor e historialMovimientosContenedor.
  static async asignarSensorAContenedorEnvio(id_envio, id_contenedor, id_sensor) {
    const session = neoDriver.session();
    try {
      const cypher = `
        MATCH (e:Envio {id_envio: $id_envio})
        MERGE (c:Contenedor {id_contenedor: $id_contenedor})
        MERGE (s:Sensor {id_sensor: $id_sensor})
        MERGE (c)-[:PERTENECE_A]->(e)
        MERGE (c)-[:MONITOREADO_POR]->(s)
        RETURN c.id_contenedor AS contenedor, e.id_envio AS envio, s.id_sensor AS sensor
      `;
      const result = await session.run(cypher, { id_envio, id_contenedor, id_sensor });
      if (result.records.length === 0) {
        throw new Error(`El envío ${id_envio} no existe en Neo4j. Cree primero el envío o verifique el código.`);
      }
      return { status: 'OK', id_envio, id_contenedor, id_sensor };
    } finally {
      await session.close();
    }
  }

  static async actualizarEstadoEnvio(id_envio, estado) {
    const session = neoDriver.session();
    try {
      const result = await session.run(`
        MATCH (e:Envio {id_envio: $id_envio})
        SET e.estado = $estado
        RETURN e.id_envio AS envio
      `, { id_envio, estado });
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }

  static async actualizarDatosEnvio({ id_envio, origen, destino, prioridad, estado }) {
    const session = neoDriver.session();
    try {
      const result = await session.run(`
        MATCH (e:Envio {id_envio: $id_envio})
        SET e.prioridad = COALESCE($prioridad, e.prioridad),
            e.estado = COALESCE($estado, e.estado)
        WITH e
        OPTIONAL MATCH (e)-[ro:TIENE_ORIGEN]->(:Ubicacion)
        DELETE ro
        WITH e
        OPTIONAL MATCH (e)-[rd:TIENE_DESTINO]->(:Ubicacion)
        DELETE rd
        WITH e
        MERGE (uo:Ubicacion {nombre: $origen})
        MERGE (ud:Ubicacion {nombre: $destino})
        MERGE (e)-[:TIENE_ORIGEN]->(uo)
        MERGE (e)-[:TIENE_DESTINO]->(ud)
        RETURN e.id_envio AS envio
      `, { id_envio, origen, destino, prioridad: prioridad || null, estado: estado || null });
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }

  static async reemplazarTramosEnvio(id_envio, tramos = []) {
    const session = neoDriver.session();
    try {
      const cypher = `
        MATCH (e:Envio {id_envio: $id_envio})
        OPTIONAL MATCH (e)-[:COMPUESTO_POR]->(tr:Tramo)
        WITH e, collect(tr) AS existentes
        FOREACH (t IN existentes | DETACH DELETE t)
        WITH e
        UNWIND $tramos AS t
        MERGE (u1:Ubicacion {nombre: t.desde})
        MERGE (u2:Ubicacion {nombre: t.hasta})
        MERGE (tr:Tramo {id_tramo: t.id_tramo})
        SET tr.orden = t.orden, tr.medio = t.medio
        MERGE (e)-[:COMPUESTO_POR]->(tr)
        MERGE (tr)-[:DESDE]->(u1)
        MERGE (tr)-[:HASTA]->(u2)
        RETURN count(tr) AS tramos_actualizados
      `;
      const tramosNormalizados = tramos.map((t, i) => ({
        id_tramo: t.id_tramo || `TR-${id_envio}-${i + 1}`,
        orden: i + 1,
        medio: t.medio || 'Terrestre',
        desde: t.desde,
        hasta: t.hasta
      }));
      const result = await session.run(cypher, { id_envio, tramos: tramosNormalizados });
      return result.records[0]?.get('tramos_actualizados')?.toNumber?.() ?? tramosNormalizados.length;
    } finally {
      await session.close();
    }
  }

  /**
   * Mantiene sincronizado el nodo Sensor y su relación MONITOREADO_POR con el
   * contenedor actual. Se usa desde el ABM de sensores para que los cambios
   * hechos en MongoDB no dejen el grafo desactualizado.
   */
  static async sincronizarSensor(sensor) {
    const idSensor = sensor.id_sensor;
    const idContenedor = sensor.id_contenedor || null;
    const session = neoDriver.session();
    try {
      const cypher = `
        MERGE (s:Sensor {id_sensor: $id_sensor})
        SET s.tipo = COALESCE($tipo, s.tipo),
            s.fabricante = COALESCE($fabricante, s.fabricante),
            s.estado = COALESCE($estado, s.estado)
        WITH s
        OPTIONAL MATCH (c:Contenedor)-[r:MONITOREADO_POR]->(s)
        DELETE r
        WITH s
        FOREACH (_ IN CASE WHEN $id_contenedor IS NOT NULL THEN [1] ELSE [] END |
          MERGE (c:Contenedor {id_contenedor: $id_contenedor})
          MERGE (c)-[:MONITOREADO_POR]->(s)
        )
        RETURN s.id_sensor AS sensor
      `;
      const result = await session.run(cypher, {
        id_sensor: idSensor,
        id_contenedor: idContenedor,
        tipo: sensor.tipo || null,
        fabricante: sensor.fabricante || null,
        estado: sensor.estado || null
      });
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }

  static async actualizarEstadoSensor(id_sensor, estado) {
    const session = neoDriver.session();
    try {
      const result = await session.run(`
        MERGE (s:Sensor {id_sensor: $id_sensor})
        SET s.estado = $estado
        RETURN s.id_sensor AS sensor
      `, { id_sensor, estado });
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }

  /**
   * Proyecta una lectura IoT a Neo4j para que el historial de movimientos y la
   * reconstrucción del recorrido puedan consultarse desde el grafo.
   */
  static async registrarLectura(lectura) {
    const fecha = lectura.fecha_hora instanceof Date
      ? lectura.fecha_hora
      : new Date(lectura.fecha_hora || Date.now());
    const tieneGPS =
      lectura.latitud !== undefined && lectura.latitud !== null &&
      lectura.longitud !== undefined && lectura.longitud !== null;

    const session = neoDriver.session();
    try {
      const cypher = `
        MERGE (s:Sensor {id_sensor: $id_sensor})
        MERGE (c:Contenedor {id_contenedor: $id_contenedor})
        MERGE (c)-[:MONITOREADO_POR]->(s)
        MERGE (l:Lectura {id_lectura: $id_lectura})
        SET l.timestamp = datetime($fecha_hora),
            l.fecha_hora = datetime($fecha_hora),
            l.temperatura = $temperatura,
            l.humedad = $humedad,
            l.vibracion = $vibracion,
            l.nivel_bateria = $nivel_bateria,
            l.latitud = $latitud,
            l.longitud = $longitud,
            l.evento = 'LECTURA',
            l.ubicacion = CASE
              WHEN $latitud IS NULL OR $longitud IS NULL THEN null
              ELSE toString($latitud) + ',' + toString($longitud)
            END,
            l.id_envio = $id_envio
        MERGE (s)-[:REGISTRA]->(l)
        RETURN l.id_lectura AS lectura
      `;
      const result = await session.run(cypher, {
        id_lectura: lectura.id_lectura,
        id_sensor: lectura.id_sensor,
        id_contenedor: lectura.id_contenedor,
        id_envio: lectura.id_envio || null,
        fecha_hora: fecha.toISOString(),
        temperatura: lectura.temperatura ?? null,
        humedad: lectura.humedad ?? null,
        vibracion: lectura.vibracion ?? null,
        nivel_bateria: lectura.nivel_bateria ?? null,
        latitud: tieneGPS ? Number(lectura.latitud) : null,
        longitud: tieneGPS ? Number(lectura.longitud) : null
      });
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }

  static async desasignarContenedorDeEnvio(id_envio, id_contenedor) {
    const session = neoDriver.session();
    try {
      await session.run(`
        MATCH (e:Envio {id_envio: $id_envio})<-[r:PERTENECE_A]-(c:Contenedor {id_contenedor: $id_contenedor})
        DELETE r
      `, { id_envio, id_contenedor });
      return true;
    } finally {
      await session.close();
    }
  }

  static async desasignarSensorDeContenedor(id_contenedor, id_sensor) {
    const session = neoDriver.session();
    try {
      await session.run(`
        MATCH (c:Contenedor {id_contenedor: $id_contenedor})-[r:MONITOREADO_POR]->(s:Sensor {id_sensor: $id_sensor})
        DELETE r
      `, { id_contenedor, id_sensor });
      return true;
    } finally {
      await session.close();
    }
  }

  static async eliminarSensor(id_sensor) {
    const session = neoDriver.session();
    try {
      await session.run(`
        MATCH (s:Sensor {id_sensor: $id_sensor})
        DETACH DELETE s
      `, { id_sensor });
      return true;
    } finally {
      await session.close();
    }
  }

  static async eliminarContenedor(id_contenedor) {
    const session = neoDriver.session();
    try {
      await session.run(`
        MATCH (c:Contenedor {id_contenedor: $id_contenedor})
        DETACH DELETE c
      `, { id_contenedor });
      return true;
    } finally {
      await session.close();
    }
  }

  static async eliminarEnvio(id_envio) {
    const session = neoDriver.session();
    try {
      await session.run(`
        MATCH (e:Envio {id_envio: $id_envio})-[:COMPUESTO_POR]->(tr:Tramo)
        DETACH DELETE tr
      `, { id_envio });
      const result = await session.run(`
        MATCH (e:Envio {id_envio: $id_envio})
        DETACH DELETE e
        RETURN count(*) AS eliminados
      `, { id_envio });
      return result.records.length > 0;
    } finally {
      await session.close();
    }
  }

  static async listarContenedoresDeEnvio(id_envio) {
    const session = neoDriver.session();
    try {
      const result = await session.run(`
        MATCH (c:Contenedor)-[:PERTENECE_A]->(e:Envio {id_envio: $id_envio})
        OPTIONAL MATCH (c)-[:MONITOREADO_POR]->(s:Sensor)
        RETURN c.id_contenedor AS contenedor, collect(s.id_sensor) AS sensores
      `, { id_envio });
      return result.records.map(r => r.toObject());
    } finally {
      await session.close();
    }
  }

  // Consulta Avanzada: Reconstrucción de la ruta completa de un envío
  static async obtenerRutaCompletaEnvio(id_envio) {
    const session = neoDriver.session();
    try {
      const cypher = `
        MATCH (c:Cliente)-[:SOLICITA]->(e:Envio {id_envio: $id_envio})
        OPTIONAL MATCH (e)-[:TIENE_ORIGEN]->(orig:Ubicacion)
        OPTIONAL MATCH (e)-[:TIENE_DESTINO]->(dest:Ubicacion)
        OPTIONAL MATCH (e)-[:ASIGNADO_A]->(op:Operador)
        OPTIONAL MATCH (e)-[:TRANSPORTADO_POR]->(v:Vehiculo)
        OPTIONAL MATCH (e)-[:COMPUESTO_POR]->(tr:Tramo)
        OPTIONAL MATCH (tr)-[:DESDE]->(uDesde:Ubicacion)
        OPTIONAL MATCH (tr)-[:HASTA]->(uHasta:Ubicacion)
        RETURN e.id_envio AS envio,
               c.id_cliente AS cliente,
               orig.nombre AS origen,
               dest.nombre AS destino,
               op.nombre AS operador,
               v.identificacion AS vehiculo,
               collect({
                 tramo_id: tr.id_tramo,
                 orden: tr.orden,
                 medio: tr.medio,
                 desde: uDesde.nombre,
                 hasta: uHasta.nombre
               }) AS tramos
      `;
      const result = await session.run(cypher, { id_envio });
      if (result.records.length === 0) return null;
      return result.records[0].toObject();
    } finally {
      await session.close();
    }
  }

  // Consulta Avanzada: Red de relaciones entre clientes, operadores y envíos
  static async obtenerRedRelaciones() {
    const session = neoDriver.session();
    try {
      const cypher = `
        MATCH (c:Cliente)-[:SOLICITA]->(e:Envio)
        OPTIONAL MATCH (e)-[:ASIGNADO_A]->(op:Operador)
        OPTIONAL MATCH (e)-[:TRANSPORTADO_POR]->(v:Vehiculo)
        RETURN c.id_cliente AS cliente_id,
               c.razon_social AS cliente_nombre,
               e.id_envio AS envio_id,
               e.estado AS envio_estado,
               op.nombre AS operador,
               v.identificacion AS vehiculo
        LIMIT 50
      `;
      const result = await session.run(cypher);
      return result.records.map(r => r.toObject());
    } finally {
      await session.close();
    }
  }

  // Reconstrucción del recorrido de un contenedor
  static async reconstruirRecorridoContenedor(id_contenedor) {
    const session = neoDriver.session();
    try {
      const cypher = `
        MATCH (c:Contenedor {id_contenedor: $id_contenedor})-[:PERTENECE_A]->(e:Envio)
        OPTIONAL MATCH (e)-[:COMPUESTO_POR]->(tr:Tramo)
        OPTIONAL MATCH (tr)-[:DESDE]->(u1:Ubicacion)
        OPTIONAL MATCH (tr)-[:HASTA]->(u2:Ubicacion)
        OPTIONAL MATCH (e)-[:TIENE_ORIGEN]->(orig:Ubicacion)
        OPTIONAL MATCH (e)-[:TIENE_DESTINO]->(dest:Ubicacion)
        RETURN e.id_envio AS envio_id,
               e.estado AS estado_envio,
               orig.nombre AS origen,
               dest.nombre AS destino,
               collect({
                 tramo_id: tr.id_tramo,
                 orden: tr.orden,
                 medio: tr.medio,
                 desde: u1.nombre,
                 hasta: u2.nombre
               }) AS tramos
        ORDER BY envio_id
      `;
      const result = await session.run(cypher, { id_contenedor });
      return result.records.map(r => r.toObject());
    } finally {
      await session.close();
    }
  }

  // Historial completo de movimientos de un contenedor
  static async historialMovimientosContenedor(id_contenedor) {
    const session = neoDriver.session();
    try {
      const cypher = `
        MATCH (cont:Contenedor {id_contenedor: $id_contenedor})-[:MONITOREADO_POR]->(s:Sensor)
        OPTIONAL MATCH (s)-[:REGISTRA]->(l:Lectura)
        RETURN s.id_sensor AS sensor,
               collect({
                 timestamp: l.timestamp,
                 ubicacion: l.ubicacion,
                 evento: l.evento
               }) AS movimientos
        ORDER BY sensor
      `;
      const result = await session.run(cypher, { id_contenedor });
      return result.records.map(r => r.toObject());
    } finally {
      await session.close();
    }
  }
}

export { Neo4jRouteRepository as Neo4jRepository };
