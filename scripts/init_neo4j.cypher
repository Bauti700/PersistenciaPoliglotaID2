// =============================================================================
// SCRIPT DE INICIALIZACIÓN NEO4J (CYPHER) - TPO PERSISTENCIA POLÍGLOTA GRUPO 12
// Modela relaciones de red logística: Clientes, Envíos, Ubicaciones, Tramos,
// Operadores y Vehículos.
// =============================================================================

// Constraints
CREATE CONSTRAINT IF NOT EXISTS FOR (c:Cliente) REQUIRE c.id_cliente IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (e:Envio) REQUIRE e.id_envio IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (u:Ubicacion) REQUIRE u.nombre IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (op:Operador) REQUIRE op.nombre IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (v:Vehiculo) REQUIRE v.identificacion IS UNIQUE;

// Limpiar datos previos si existieran
MATCH (n) DETACH DELETE n;

// Crear Nodos
CREATE (c1:Cliente {id_cliente: 1, razon_social: "Importadora Andina S.A.", pais: "Argentina"})
CREATE (c2:Cliente {id_cliente: 2, razon_social: "Global Traders Ltd", pais: "Brasil"})

CREATE (u1:Ubicacion {nombre: "Buenos Aires", pais: "Argentina"})
CREATE (u2:Ubicacion {nombre: "Puerto de Santos", pais: "Brasil"})
CREATE (u3:Ubicacion {nombre: "San Pablo", pais: "Brasil"})
CREATE (u4:Ubicacion {nombre: "Montevideo", pais: "Uruguay"})
CREATE (u5:Ubicacion {nombre: "Santiago", pais: "Chile"})

CREATE (op1:Operador {id_actor: 3, nombre: "Logística Express del Plata"})

CREATE (v1:Vehiculo {id_vehiculo: "VEH-TRUCK-01", tipo: "Camión Semirremolque", identificacion: "AF-204-ZX"})

CREATE (e1:Envio {id_envio: "ENV-1001", estado: "EN_TRANSITO", prioridad: "ALTA"})
CREATE (e2:Envio {id_envio: "ENV-1002", estado: "CREADO", prioridad: "MEDIA"})

// Relaciones para ENV-1001
CREATE (c1)-[:SOLICITA]->(e1)
CREATE (e1)-[:TIENE_ORIGEN]->(u1)
CREATE (e1)-[:TIENE_DESTINO]->(u3)
CREATE (e1)-[:ASIGNADO_A]->(op1)
CREATE (op1)-[:OPERA_VEHICULO]->(v1)
CREATE (e1)-[:TRANSPORTADO_POR]->(v1)

// Ruta / Tramos del Envío
CREATE (t1:Tramo {id_tramo: "TR-1001-1", orden: 1, medio: "Terrestre"})
CREATE (t2:Tramo {id_tramo: "TR-1001-2", orden: 2, medio: "Terrestre"})

CREATE (e1)-[:COMPUESTO_POR]->(t1)
CREATE (t1)-[:CONECTA_A]->(t2)
CREATE (t1)-[:DESDE]->(u1)
CREATE (t1)-[:HASTA]->(u2)
CREATE (t2)-[:DESDE]->(u2)
CREATE (t2)-[:HASTA]->(u3)

// Relaciones para ENV-1002
CREATE (c2)-[:SOLICITA]->(e2)
CREATE (e2)-[:TIENE_ORIGEN]->(u4)
CREATE (e2)-[:TIENE_DESTINO]->(u5)
