import { neoDriver } from '../config/database.js';

export class Neo4jRouteRepository {
  static async crearEnvioConRuta({ id_envio, id_cliente, origen, destino, operador, vehiculo, tramos }) {
    const session = neoDriver.session();
    try {
      const cypher = `
        MERGE (c:Cliente {id_cliente: $id_cliente})
        MERGE (e:Envio {id_envio: $id_envio})
        SET e.estado = 'EN_TRANSITO', e.fecha_creacion = datetime()
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
      await session.run(cypher, { id_envio, id_cliente: Number(id_cliente), origen, destino, operador, vehiculo });

      // Conectar tramos en secuencia si se proporcionaron
      if (tramos && tramos.length > 0) {
        for (let i = 0; i < tramos.length; i++) {
          const t = tramos[i];
          const tramoCypher = `
            MATCH (e:Envio {id_envio: $id_envio})
            MERGE (u1:Ubicacion {nombre: $desde})
            MERGE (u2:Ubicacion {nombre: $hasta})
            CREATE (tr:Tramo {id_tramo: $id_tramo, orden: $orden, medio: $medio})
            CREATE (e)-[:COMPUESTO_POR]->(tr)
            CREATE (tr)-[:DESDE]->(u1)
            CREATE (tr)-[:HASTA]->(u2)
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
}
