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
CREATE CONSTRAINT IF NOT EXISTS FOR (pr:Proveedor) REQUIRE pr.id_actor IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (v:Vehiculo) REQUIRE v.identificacion IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (cont:Contenedor) REQUIRE cont.id_contenedor IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (s:Sensor) REQUIRE s.id_sensor IS UNIQUE;

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
CREATE (u6:Ubicacion {nombre: "Mendoza", pais: "Argentina"})

CREATE (op1:Operador {id_actor: 1, nombre: "Logística Express del Plata"})
CREATE (op2:Operador {id_actor: 2, nombre: "Andes Cargo Internacional S.A."})
CREATE (op3:Operador {id_actor: 3, nombre: "Río de la Plata Transportes S.A."})
CREATE (op4:Operador {id_actor: 4, nombre: "Pacífico Sur Logistics SpA"})

CREATE (pr1:Proveedor {id_actor: 1, nombre: "Sensores del Sur Corp", pais: "Argentina"})
CREATE (pr2:Proveedor {id_actor: 2, nombre: "Naviera del Atlántico Sur S.A.", pais: "Argentina"})
CREATE (pr3:Proveedor {id_actor: 3, nombre: "Brasil Cargo Aéreo Ltda.", pais: "Brasil"})
CREATE (pr4:Proveedor {id_actor: 4, nombre: "Agencia Aduanera Pacífico SpA", pais: "Chile"})
CREATE (pr5:Proveedor {id_actor: 5, nombre: "Transportes Terrestres del Uruguay S.A.", pais: "Uruguay"})
CREATE (pr6:Proveedor {id_actor: 6, nombre: "Shanghai East Gate Logistics Co.", pais: "China"})
CREATE (pr7:Proveedor {id_actor: 7, nombre: "Miami Gateway Port Services LLC", pais: "Estados Unidos"})
CREATE (pr8:Proveedor {id_actor: 8, nombre: "Almacenes y Carga Ibérica S.L.", pais: "España"})

CREATE (v1:Vehiculo {id_vehiculo: "VEH-TRUCK-01", tipo: "Camión Semirremolque", identificacion: "AF-204-ZX"})
CREATE (v4:Vehiculo {id_vehiculo: "VEH-TRUCK-03", tipo: "Camión Refrigerado", identificacion: "AG-315-KL"})
CREATE (v5:Vehiculo {id_vehiculo: "VEH-TRUCK-04", tipo: "Camión Semirremolque", identificacion: "SAB-7821"})
CREATE (v6:Vehiculo {id_vehiculo: "VEH-SHIP-03", tipo: "Buque Portacontenedores", identificacion: "IMO-9674521"})

CREATE (e1:Envio {id_envio: "ENV-1001", estado: "EN_TRANSITO", prioridad: "ALTA"})
CREATE (e2:Envio {id_envio: "ENV-1002", estado: "CREADO", prioridad: "MEDIA"})

// Relaciones para ENV-1001
CREATE (c1)-[:SOLICITA]->(e1)
CREATE (e1)-[:TIENE_ORIGEN]->(u1)
CREATE (e1)-[:TIENE_DESTINO]->(u3)
CREATE (e1)-[:ASIGNADO_A]->(op1)
CREATE (op1)-[:OPERA_VEHICULO]->(v1)
CREATE (e1)-[:TRANSPORTADO_POR]->(v1)
CREATE (e2)-[:ASIGNADO_A]->(op2)
CREATE (op2)-[:OPERA_VEHICULO]->(v4)
CREATE (e2)-[:TRANSPORTADO_POR]->(v4)
CREATE (pr1)-[:PROVEE_COMPONENTES_A]->(e1)
CREATE (pr2)-[:PROVEE_TRANSPORTE_A]->(e1)
CREATE (pr3)-[:PROVEE_TRANSPORTE_A]->(e2)

// Ruta / Tramos del Envío
CREATE (t1:Tramo {id_tramo: "TR-1001-1", orden: 1, medio: "Terrestre"})
CREATE (t2:Tramo {id_tramo: "TR-1001-2", orden: 2, medio: "Terrestre"})

CREATE (e1)-[:COMPUESTO_POR]->(t1)
CREATE (e1)-[:COMPUESTO_POR]->(t2)
CREATE (t1)-[:CONECTA_A]->(t2)
CREATE (t1)-[:DESDE]->(u1)
CREATE (t1)-[:HASTA]->(u2)
CREATE (t2)-[:DESDE]->(u2)
CREATE (t2)-[:HASTA]->(u3)

// Relaciones para ENV-1002
CREATE (c2)-[:SOLICITA]->(e2)
CREATE (e2)-[:TIENE_ORIGEN]->(u4)
CREATE (e2)-[:TIENE_DESTINO]->(u5)

// Relaciones para ENV-1003
CREATE (e3:Envio {id_envio: "ENV-1003", estado: "ENTREGADO", prioridad: "ALTA"})
CREATE (c1)-[:SOLICITA]->(e3)
CREATE (e3)-[:TIENE_ORIGEN]->(u1)
CREATE (e3)-[:TIENE_DESTINO]->(u5)

// Relaciones para ENV-1004
CREATE (e4:Envio {id_envio: "ENV-1004", estado: "ENTREGADO", prioridad: "MEDIA"})
CREATE (c2)-[:SOLICITA]->(e4)
CREATE (e4)-[:TIENE_ORIGEN]->(u3)
CREATE (e4)-[:TIENE_DESTINO]->(u4)

// Relaciones para ENV-1005
CREATE (e5:Envio {id_envio: "ENV-1005", estado: "EN_TRANSITO", prioridad: "ALTA"})
CREATE (c1)-[:SOLICITA]->(e5)
CREATE (e5)-[:TIENE_ORIGEN]->(u1)
CREATE (e5)-[:TIENE_DESTINO]->(u3)
CREATE (e5)-[:ASIGNADO_A]->(op1)

// Contenedores y sensores IoT (alineados con PostgreSQL y MongoDB)
CREATE (cont1:Contenedor {id_contenedor: "CONT-001", codigo_internacional: "MSCU-908123-1", estado: "EN_TRANSITO"})
CREATE (cont2:Contenedor {id_contenedor: "CONT-002", codigo_internacional: "CMAU-554129-4", estado: "EN_TRANSITO"})
CREATE (cont3:Contenedor {id_contenedor: "CONT-003", codigo_internacional: "TCNU-771204-9", estado: "DISPONIBLE"})
CREATE (cont4:Contenedor {id_contenedor: "CONT-004", codigo_internacional: "HLXU-332087-2", estado: "DISPONIBLE"})
CREATE (cont5:Contenedor {id_contenedor: "CONT-005", codigo_internacional: "SUDU-118452-0", estado: "EN_TRANSITO"})

CREATE (s1:Sensor {id_sensor: "SENS-101", tipo: "Temperatura/Humedad/GPS"})
CREATE (s2:Sensor {id_sensor: "SENS-102", tipo: "Vibración/Impacto/GPS"})
CREATE (s3:Sensor {id_sensor: "SENS-103", tipo: "Temperatura/GPS"})

// Todo envío semilla queda compuesto por al menos un contenedor entero.
CREATE (cont1)-[:PERTENECE_A]->(e1)
CREATE (cont2)-[:PERTENECE_A]->(e2)
CREATE (cont3)-[:PERTENECE_A]->(e3)
CREATE (cont4)-[:PERTENECE_A]->(e4)
CREATE (cont5)-[:PERTENECE_A]->(e5)

CREATE (cont1)-[:MONITOREADO_POR]->(s1)
CREATE (cont1)-[:MONITOREADO_POR]->(s2)
CREATE (cont2)-[:MONITOREADO_POR]->(s3)

// Tramos de los envíos restantes (alineados con PostgreSQL)
CREATE (t3:Tramo {id_tramo: "TR-1002-1", orden: 1, medio: "Terrestre"})
CREATE (t4:Tramo {id_tramo: "TR-1003-1", orden: 1, medio: "Terrestre"})
CREATE (t5:Tramo {id_tramo: "TR-1003-2", orden: 2, medio: "Terrestre"})
CREATE (t6:Tramo {id_tramo: "TR-1004-1", orden: 1, medio: "Marítimo"})
CREATE (t7:Tramo {id_tramo: "TR-1004-2", orden: 2, medio: "Marítimo"})
CREATE (t8:Tramo {id_tramo: "TR-1005-1", orden: 1, medio: "Terrestre"})

// Ruta del Envío ENV-1002 (Montevideo -> Santiago)
CREATE (e2)-[:COMPUESTO_POR]->(t3)
CREATE (t3)-[:DESDE]->(u4)
CREATE (t3)-[:HASTA]->(u5)

// Ruta del Envío ENV-1003 (Buenos Aires -> Mendoza -> Santiago)
CREATE (e3)-[:COMPUESTO_POR]->(t4)
CREATE (e3)-[:COMPUESTO_POR]->(t5)
CREATE (t4)-[:DESDE]->(u1)
CREATE (t4)-[:HASTA]->(u6)
CREATE (t5)-[:DESDE]->(u6)
CREATE (t5)-[:HASTA]->(u5)
CREATE (t4)-[:CONECTA_A]->(t5)

// Ruta del Envío ENV-1004 (San Pablo -> Puerto de Santos -> Montevideo)
CREATE (e4)-[:COMPUESTO_POR]->(t6)
CREATE (e4)-[:COMPUESTO_POR]->(t7)
CREATE (t6)-[:DESDE]->(u3)
CREATE (t6)-[:HASTA]->(u2)
CREATE (t7)-[:DESDE]->(u2)
CREATE (t7)-[:HASTA]->(u4)
CREATE (t6)-[:CONECTA_A]->(t7)

// Ruta del Envío ENV-1005 (Buenos Aires -> San Pablo)
CREATE (e5)-[:COMPUESTO_POR]->(t8)
CREATE (t8)-[:DESDE]->(u1)
CREATE (t8)-[:HASTA]->(u3)

// Datos adicionales para una demo con rutas, estados y sensores variados
CREATE (c3:Cliente {id_cliente: 3, razon_social: "Andes Pharma S.A.", pais: "Argentina"})
CREATE (c4:Cliente {id_cliente: 4, razon_social: "Pacific Imports SpA", pais: "Chile"})
CREATE (u8:Ubicacion {nombre: "Paso Internacional", pais: "Argentina"})
CREATE (u9:Ubicacion {nombre: "Lima", pais: "Perú"})
CREATE (u10:Ubicacion {nombre: "Valparaíso", pais: "Chile"})
CREATE (u11:Ubicacion {nombre: "Asunción", pais: "Paraguay"})
CREATE (v2:Vehiculo {id_vehiculo: "VEH-TRUCK-02", tipo: "Camión Refrigerado", identificacion: "AB-908-CD"})
CREATE (v3:Vehiculo {id_vehiculo: "VEH-SHIP-02", tipo: "Buque Portacontenedores", identificacion: "IMO-9567890"})
CREATE (e6:Envio {id_envio: "ENV-1006", estado: "EN_TRANSITO", prioridad: "ALTA"})
CREATE (e7:Envio {id_envio: "ENV-1007", estado: "CREADO", prioridad: "BAJA"})
CREATE (e8:Envio {id_envio: "ENV-1008", estado: "ENTREGADO", prioridad: "MEDIA"})
CREATE (c3)-[:SOLICITA]->(e6)
CREATE (c4)-[:SOLICITA]->(e7)
CREATE (c2)-[:SOLICITA]->(e8)
CREATE (e6)-[:TIENE_ORIGEN]->(u6)
CREATE (e6)-[:TIENE_DESTINO]->(u9)
CREATE (e6)-[:ASIGNADO_A]->(op1)
CREATE (e6)-[:TRANSPORTADO_POR]->(v2)
CREATE (e7)-[:TIENE_ORIGEN]->(u10)
CREATE (e7)-[:TIENE_DESTINO]->(u1)
CREATE (e7)-[:ASIGNADO_A]->(op1)
CREATE (e7)-[:TRANSPORTADO_POR]->(v3)
CREATE (e8)-[:TIENE_ORIGEN]->(u3)
CREATE (e8)-[:TIENE_DESTINO]->(u11)
CREATE (e8)-[:TRANSPORTADO_POR]->(v2)
CREATE (pr4)-[:GESTIONA_ADUANA_DE]->(e3)
CREATE (pr5)-[:PROVEE_TRANSPORTE_A]->(e4)
CREATE (pr6)-[:PROVEE_SERVICIO_PORTUARIO_A]->(e5)
CREATE (e3)-[:ASIGNADO_A]->(op3)
CREATE (op3)-[:OPERA_VEHICULO]->(v5)
CREATE (e3)-[:TRANSPORTADO_POR]->(v5)
CREATE (e4)-[:ASIGNADO_A]->(op4)
CREATE (op4)-[:OPERA_VEHICULO]->(v6)
CREATE (e4)-[:TRANSPORTADO_POR]->(v6)
CREATE (e8)-[:ASIGNADO_A]->(op2)
CREATE (pr7)-[:PROVEE_SERVICIO_PORTUARIO_A]->(e6)
CREATE (pr8)-[:PROVEE_ALMACENAJE_A]->(e7)
CREATE (cont6:Contenedor {id_contenedor: "CONT-006", codigo_internacional: "OOLU-445566-7", estado: "EN_TRANSITO"})
CREATE (cont7:Contenedor {id_contenedor: "CONT-007", codigo_internacional: "MSCU-778899-3", estado: "EN_TRANSITO"})
CREATE (cont8:Contenedor {id_contenedor: "CONT-008", codigo_internacional: "TGHU-112233-5", estado: "DISPONIBLE"})
CREATE (cont6)-[:PERTENECE_A]->(e6)
CREATE (cont7)-[:PERTENECE_A]->(e7)
CREATE (cont8)-[:PERTENECE_A]->(e8)
CREATE (s4:Sensor {id_sensor: "SENS-104", tipo: "Temperatura/Humedad/GPS"})
CREATE (s5:Sensor {id_sensor: "SENS-105", tipo: "GPS/Vibración"})
CREATE (s6:Sensor {id_sensor: "SENS-106", tipo: "Temperatura/GPS"})
CREATE (cont6)-[:MONITOREADO_POR]->(s4)
CREATE (cont7)-[:MONITOREADO_POR]->(s5)
CREATE (cont8)-[:MONITOREADO_POR]->(s6)
CREATE (t9:Tramo {id_tramo: "TR-1006-1", orden: 1, medio: "Terrestre"})
CREATE (t10:Tramo {id_tramo: "TR-1006-2", orden: 2, medio: "Terrestre"})
CREATE (t11:Tramo {id_tramo: "TR-1007-1", orden: 1, medio: "Marítimo"})
CREATE (t12:Tramo {id_tramo: "TR-1008-1", orden: 1, medio: "Terrestre"})
CREATE (e6)-[:COMPUESTO_POR]->(t9)
CREATE (e6)-[:COMPUESTO_POR]->(t10)
CREATE (t9)-[:DESDE]->(u6)
CREATE (t9)-[:HASTA]->(u8)
CREATE (t10)-[:DESDE]->(u8)
CREATE (t10)-[:HASTA]->(u9)
CREATE (t9)-[:CONECTA_A]->(t10)
CREATE (e7)-[:COMPUESTO_POR]->(t11)
CREATE (t11)-[:DESDE]->(u10)
CREATE (t11)-[:HASTA]->(u1)
CREATE (e8)-[:COMPUESTO_POR]->(t12)
CREATE (t12)-[:DESDE]->(u3)
CREATE (t12)-[:HASTA]->(u11)

// Lecturas IoT proyectadas desde MongoDB (alineadas con LEC-001..LEC-009)
CREATE (l1:Lectura {id_lectura: "LEC-001", timestamp: datetime() - duration('PT3H'), fecha_hora: datetime() - duration('PT3H'), temperatura: 4.1, humedad: 62.5, vibracion: 0.08, nivel_bateria: 95, latitud: -34.6037, longitud: -58.3816, evento: "LECTURA", ubicacion: "-34.6037,-58.3816", id_envio: "ENV-1001"})
CREATE (l2:Lectura {id_lectura: "LEC-002", timestamp: datetime() - duration('PT2H'), fecha_hora: datetime() - duration('PT2H'), temperatura: 8.9, humedad: 68.0, vibracion: 0.12, nivel_bateria: 94, latitud: -34.4000, longitud: -58.2000, evento: "LECTURA", ubicacion: "-34.4,-58.2", id_envio: "ENV-1001"})
CREATE (l3:Lectura {id_lectura: "LEC-003", timestamp: datetime() - duration('PT1H'), fecha_hora: datetime() - duration('PT1H'), temperatura: 4.3, humedad: 61.2, vibracion: 0.09, nivel_bateria: 93, latitud: -34.1000, longitud: -57.8000, evento: "LECTURA", ubicacion: "-34.1,-57.8", id_envio: "ENV-1001"})
CREATE (l4:Lectura {id_lectura: "LEC-004", timestamp: datetime() - duration('PT90M'), fecha_hora: datetime() - duration('PT90M'), vibracion: 0.85, nivel_bateria: 91, latitud: -34.2500, longitud: -57.9500, evento: "LECTURA", ubicacion: "-34.25,-57.95", id_envio: "ENV-1001"})
CREATE (l5:Lectura {id_lectura: "LEC-005", timestamp: datetime() - duration('PT5H'), fecha_hora: datetime() - duration('PT5H'), temperatura: 10.4, humedad: 71.0, vibracion: 0.05, nivel_bateria: 88, latitud: -34.9011, longitud: -56.1645, evento: "LECTURA", ubicacion: "-34.9011,-56.1645", id_envio: "ENV-1002"})

CREATE (s1)-[:REGISTRA]->(l1)
CREATE (s1)-[:REGISTRA]->(l2)
CREATE (s1)-[:REGISTRA]->(l3)
CREATE (s2)-[:REGISTRA]->(l4)
CREATE (s3)-[:REGISTRA]->(l5)
CREATE (l6:Lectura {id_lectura: "LEC-006", timestamp: datetime() - duration('PT6H'), fecha_hora: datetime() - duration('PT6H'), temperatura: 3.8, humedad: 58.2, vibracion: 0.06, nivel_bateria: 87, latitud: -32.8895, longitud: -68.8458, evento: "LECTURA", ubicacion: "-32.8895,-68.8458", id_envio: "ENV-1006"})
CREATE (l7:Lectura {id_lectura: "LEC-007", timestamp: datetime() - duration('PT4H'), fecha_hora: datetime() - duration('PT4H'), temperatura: 4.2, humedad: 60.1, vibracion: 0.07, nivel_bateria: 86, latitud: -31.9500, longitud: -68.7000, evento: "LECTURA", ubicacion: "-31.95,-68.7", id_envio: "ENV-1006"})
CREATE (l8:Lectura {id_lectura: "LEC-008", timestamp: datetime() - duration('PT2H'), fecha_hora: datetime() - duration('PT2H'), temperatura: 6.1, humedad: 64.0, vibracion: 0.11, nivel_bateria: 92, latitud: -12.0464, longitud: -77.0428, evento: "LECTURA", ubicacion: "-12.0464,-77.0428", id_envio: "ENV-1007"})
CREATE (l9:Lectura {id_lectura: "LEC-009", timestamp: datetime() - duration('PT8H'), fecha_hora: datetime() - duration('PT8H'), temperatura: 5.0, humedad: 55.0, vibracion: 0.04, nivel_bateria: 89, latitud: -33.0472, longitud: -71.6127, evento: "LECTURA", ubicacion: "-33.0472,-71.6127", id_envio: "ENV-1008"})
CREATE (s4)-[:REGISTRA]->(l6)
CREATE (s4)-[:REGISTRA]->(l7)
CREATE (s5)-[:REGISTRA]->(l8)
CREATE (s6)-[:REGISTRA]->(l9)
