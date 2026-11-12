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

// =============================================================================
// DATOS EXTENDIDOS PARA DEMOSTRACIÓN EN VIVO (CLIENTES, RUTAS, IOT, MULTIMODAL)
// =============================================================================

// Nuevas Ubicaciones
CREATE (u12:Ubicacion {nombre: "Curicó", pais: "Chile"})
CREATE (u13:Ubicacion {nombre: "Antofagasta", pais: "Chile"})
CREATE (u14:Ubicacion {nombre: "Bogotá", pais: "Colombia"})
CREATE (u15:Ubicacion {nombre: "Rosario", pais: "Argentina"})
CREATE (u16:Ubicacion {nombre: "Callao", pais: "Perú"})
CREATE (u17:Ubicacion {nombre: "Róterdam", pais: "Países Bajos"})
CREATE (u18:Ubicacion {nombre: "Hamburgo", pais: "Alemania"})

// Nuevos Clientes
CREATE (c5:Cliente {id_cliente: 5, razon_social: "Minera del Altiplano S.A.", pais: "Chile"})
CREATE (c6:Cliente {id_cliente: 6, razon_social: "AgroExport del Sur S.R.L.", pais: "Argentina"})
CREATE (c7:Cliente {id_cliente: 7, razon_social: "Frutícola del Valle Central SpA", pais: "Chile"})
CREATE (c8:Cliente {id_cliente: 8, razon_social: "Distribuidora Mercosur S.A.", pais: "Uruguay"})
CREATE (c9:Cliente {id_cliente: 9, razon_social: "BioTech Solutions Corp", pais: "Colombia"})
CREATE (c10:Cliente {id_cliente: 10, razon_social: "Automotriz Continental S.A.", pais: "Brasil"})

// Nuevos Operadores Logísticos
CREATE (op5:Operador {id_actor: 5, nombre: "Transoceánica Shipping Group"})
CREATE (op6:Operador {id_actor: 6, nombre: "Ferrocarril Trasandino Cargas S.A."})
CREATE (op7:Operador {id_actor: 7, nombre: "AeroCargas Andinas S.A."})
CREATE (op8:Operador {id_actor: 8, nombre: "Hidrovía Fluvial Paraná-Paraguay S.A."})

// Nuevos Proveedores Especializados
CREATE (pr9:Proveedor {id_actor: 9, nombre: "Telemetría Satelital OrbitLink", pais: "Argentina"})
CREATE (pr10:Proveedor {id_actor: 10, nombre: "Reefer Cold Services S.A.", pais: "Chile"})
CREATE (pr11:Proveedor {id_actor: 11, nombre: "Embalajes Industriales del Plata", pais: "Argentina"})
CREATE (pr12:Proveedor {id_actor: 12, nombre: "Terminal Portuaria Callao Logistics", pais: "Perú"})

// Nuevos Vehículos Multimodales
CREATE (v7:Vehiculo {id_vehiculo: "VEH-TRAIN-01", tipo: "Locomotora Diésel GM-GT22", identificacion: "BAP-9012"})
CREATE (v8:Vehiculo {id_vehiculo: "VEH-PLANE-01", tipo: "Boeing 767-300F Carga", identificacion: "LV-B767"})
CREATE (v9:Vehiculo {id_vehiculo: "VEH-BARGE-01", tipo: "Barcaza Fluvial Cono Sur I", identificacion: "BF-7740"})
CREATE (v10:Vehiculo {id_vehiculo: "VEH-SHIP-04", tipo: "Buque Portacontenedores NeoPanamax", identificacion: "IMO-9812345"})
CREATE (v11:Vehiculo {id_vehiculo: "VEH-TRUCK-05", tipo: "Camión Bitren Tolva", identificacion: "AG-882-MM"})

// Operadores manejan sus flotas
CREATE (op6)-[:OPERA_VEHICULO]->(v7)
CREATE (op7)-[:OPERA_VEHICULO]->(v8)
CREATE (op8)-[:OPERA_VEHICULO]->(v9)
CREATE (op5)-[:OPERA_VEHICULO]->(v10)
CREATE (op1)-[:OPERA_VEHICULO]->(v11)

// Nuevos Contenedores
CREATE (cont9:Contenedor {id_contenedor: "CONT-009", codigo_internacional: "CMAU-881920-3", estado: "EN_TRANSITO"})
CREATE (cont10:Contenedor {id_contenedor: "CONT-010", codigo_internacional: "MSCU-334912-8", estado: "EN_TRANSITO"})
CREATE (cont11:Contenedor {id_contenedor: "CONT-011", codigo_internacional: "TCNU-990145-2", estado: "EN_TRANSITO"})
CREATE (cont12:Contenedor {id_contenedor: "CONT-012", codigo_internacional: "HLXU-667123-0", estado: "EN_TRANSITO"})
CREATE (cont13:Contenedor {id_contenedor: "CONT-013", codigo_internacional: "OOLU-112358-4", estado: "EN_TRANSITO"})
CREATE (cont14:Contenedor {id_contenedor: "CONT-014", codigo_internacional: "SUDU-445890-1", estado: "CREADO"})
CREATE (cont15:Contenedor {id_contenedor: "CONT-015", codigo_internacional: "TGHU-998877-6", estado: "ENTREGADO"})

// Nuevos Sensores IoT
CREATE (s7:Sensor {id_sensor: "SENS-107", tipo: "Temperatura/Humedad/GPS"})
CREATE (s8:Sensor {id_sensor: "SENS-108", tipo: "Vibración/Impacto/GPS"})
CREATE (s9:Sensor {id_sensor: "SENS-109", tipo: "Temperatura/Humedad/GPS"})
CREATE (s10:Sensor {id_sensor: "SENS-110", tipo: "Presión/Vibración/GPS"})
CREATE (s11:Sensor {id_sensor: "SENS-111", tipo: "Temperatura/GPS"})
CREATE (s12:Sensor {id_sensor: "SENS-112", tipo: "Temperatura/Humedad/GPS"})
CREATE (s13:Sensor {id_sensor: "SENS-113", tipo: "GPS/Vibración"})

CREATE (cont9)-[:MONITOREADO_POR]->(s7)
CREATE (cont10)-[:MONITOREADO_POR]->(s8)
CREATE (cont11)-[:MONITOREADO_POR]->(s9)
CREATE (cont12)-[:MONITOREADO_POR]->(s10)
CREATE (cont13)-[:MONITOREADO_POR]->(s11)
CREATE (cont14)-[:MONITOREADO_POR]->(s12)
CREATE (cont15)-[:MONITOREADO_POR]->(s13)

// Nuevos Envíos (ENV-1009 a ENV-1015)
CREATE (e9:Envio {id_envio: "ENV-1009", estado: "EN_TRANSITO", prioridad: "ALTA"})
CREATE (e10:Envio {id_envio: "ENV-1010", estado: "EN_TRANSITO", prioridad: "MEDIA"})
CREATE (e11:Envio {id_envio: "ENV-1011", estado: "EN_TRANSITO", prioridad: "URGENTE"})
CREATE (e12:Envio {id_envio: "ENV-1012", estado: "EN_TRANSITO", prioridad: "MEDIA"})
CREATE (e13:Envio {id_envio: "ENV-1013", estado: "EN_TRANSITO", prioridad: "ALTA"})
CREATE (e14:Envio {id_envio: "ENV-1014", estado: "CREADO", prioridad: "MEDIA"})
CREATE (e15:Envio {id_envio: "ENV-1015", estado: "ENTREGADO", prioridad: "ALTA"})

// Relaciones Contenedores a Envíos
CREATE (cont9)-[:PERTENECE_A]->(e9)
CREATE (cont10)-[:PERTENECE_A]->(e10)
CREATE (cont11)-[:PERTENECE_A]->(e11)
CREATE (cont12)-[:PERTENECE_A]->(e12)
CREATE (cont13)-[:PERTENECE_A]->(e13)
CREATE (cont14)-[:PERTENECE_A]->(e14)
CREATE (cont15)-[:PERTENECE_A]->(e15)

// Asignaciones de Envíos a Clientes, Operadores, Rutas y Flota
// ENV-1009: Fruta fresca refrigerada Curicó -> Valparaíso -> Róterdam
CREATE (c7)-[:SOLICITA]->(e9)
CREATE (e9)-[:TIENE_ORIGEN]->(u12)
CREATE (e9)-[:TIENE_DESTINO]->(u17)
CREATE (e9)-[:ASIGNADO_A]->(op5)
CREATE (e9)-[:TRANSPORTADO_POR]->(v10)
CREATE (pr10)-[:PROVEE_SERVICIO_PORTUARIO_A]->(e9)

CREATE (t13:Tramo {id_tramo: "TR-1009-1", orden: 1, medio: "Terrestre"})
CREATE (t14:Tramo {id_tramo: "TR-1009-2", orden: 2, medio: "Marítimo"})
CREATE (e9)-[:COMPUESTO_POR]->(t13)
CREATE (e9)-[:COMPUESTO_POR]->(t14)
CREATE (t13)-[:DESDE]->(u12)
CREATE (t13)-[:HASTA]->(u10)
CREATE (t14)-[:DESDE]->(u10)
CREATE (t14)-[:HASTA]->(u17)
CREATE (t13)-[:CONECTA_A]->(t14)

// ENV-1010: Carga minera Trasandina Ferrocarril Mendoza -> Antofagasta
CREATE (c5)-[:SOLICITA]->(e10)
CREATE (e10)-[:TIENE_ORIGEN]->(u6)
CREATE (e10)-[:TIENE_DESTINO]->(u13)
CREATE (e10)-[:ASIGNADO_A]->(op6)
CREATE (e10)-[:TRANSPORTADO_POR]->(v7)
CREATE (pr9)-[:PROVEE_COMPONENTES_A]->(e10)

CREATE (t15:Tramo {id_tramo: "TR-1010-1", orden: 1, medio: "Ferroviario"})
CREATE (e10)-[:COMPUESTO_POR]->(t15)
CREATE (t15)-[:DESDE]->(u6)
CREATE (t15)-[:HASTA]->(u13)

// ENV-1011: Reactivos e insumos biotecnológicos Aéreos Buenos Aires -> Bogotá
CREATE (c9)-[:SOLICITA]->(e11)
CREATE (e11)-[:TIENE_ORIGEN]->(u1)
CREATE (e11)-[:TIENE_DESTINO]->(u14)
CREATE (e11)-[:ASIGNADO_A]->(op7)
CREATE (e11)-[:TRANSPORTADO_POR]->(v8)
CREATE (pr9)-[:PROVEE_COMPONENTES_A]->(e11)

CREATE (t16:Tramo {id_tramo: "TR-1011-1", orden: 1, medio: "Aéreo"})
CREATE (e11)-[:COMPUESTO_POR]->(t16)
CREATE (t16)-[:DESDE]->(u1)
CREATE (t16)-[:HASTA]->(u14)

// ENV-1012: Granos y harinas barcaza fluvial Rosario -> Asunción
CREATE (c6)-[:SOLICITA]->(e12)
CREATE (e12)-[:TIENE_ORIGEN]->(u15)
CREATE (e12)-[:TIENE_DESTINO]->(u11)
CREATE (e12)-[:ASIGNADO_A]->(op8)
CREATE (e12)-[:TRANSPORTADO_POR]->(v9)
CREATE (pr11)-[:PROVEE_COMPONENTES_A]->(e12)

CREATE (t17:Tramo {id_tramo: "TR-1012-1", orden: 1, medio: "Fluvial"})
CREATE (e12)-[:COMPUESTO_POR]->(t17)
CREATE (t17)-[:DESDE]->(u15)
CREATE (t17)-[:HASTA]->(u11)

// ENV-1013: Exportación Callao -> Róterdam
CREATE (c4)-[:SOLICITA]->(e13)
CREATE (e13)-[:TIENE_ORIGEN]->(u16)
CREATE (e13)-[:TIENE_DESTINO]->(u17)
CREATE (e13)-[:ASIGNADO_A]->(op5)
CREATE (e13)-[:TRANSPORTADO_POR]->(v10)
CREATE (pr12)-[:PROVEE_SERVICIO_PORTUARIO_A]->(e13)

CREATE (t18:Tramo {id_tramo: "TR-1013-1", orden: 1, medio: "Marítimo"})
CREATE (e13)-[:COMPUESTO_POR]->(t18)
CREATE (t18)-[:DESDE]->(u16)
CREATE (t18)-[:HASTA]->(u17)

// ENV-1014: Componentes automotrices San Pablo -> Buenos Aires
CREATE (c10)-[:SOLICITA]->(e14)
CREATE (e14)-[:TIENE_ORIGEN]->(u3)
CREATE (e14)-[:TIENE_DESTINO]->(u1)
CREATE (e14)-[:ASIGNADO_A]->(op1)
CREATE (e14)-[:TRANSPORTADO_POR]->(v11)

CREATE (t19:Tramo {id_tramo: "TR-1014-1", orden: 1, medio: "Terrestre"})
CREATE (e14)-[:COMPUESTO_POR]->(t19)
CREATE (t19)-[:DESDE]->(u3)
CREATE (t19)-[:HASTA]->(u1)

// ENV-1015: Maquinaria industrial importada Hamburgo -> Buenos Aires
CREATE (c8)-[:SOLICITA]->(e15)
CREATE (e15)-[:TIENE_ORIGEN]->(u18)
CREATE (e15)-[:TIENE_DESTINO]->(u1)
CREATE (e15)-[:ASIGNADO_A]->(op5)
CREATE (e15)-[:TRANSPORTADO_POR]->(v10)

CREATE (t20:Tramo {id_tramo: "TR-1015-1", orden: 1, medio: "Marítimo"})
CREATE (e15)-[:COMPUESTO_POR]->(t20)
CREATE (t20)-[:DESDE]->(u18)
CREATE (t20)-[:HASTA]->(u1)

// Lecturas IoT proyectadas de nuevos sensores (LEC-010 a LEC-021)
CREATE (l10:Lectura {id_lectura: "LEC-010", timestamp: datetime() - duration('PT4H'), fecha_hora: datetime() - duration('PT4H'), temperatura: -18.2, humedad: 45.0, vibracion: 0.05, nivel_bateria: 97, latitud: -34.9828, longitud: -71.2489, evento: "LECTURA", ubicacion: "-34.9828,-71.2489", id_envio: "ENV-1009"})
CREATE (l11:Lectura {id_lectura: "LEC-011", timestamp: datetime() - duration('PT2H'), fecha_hora: datetime() - duration('PT2H'), temperatura: -17.8, humedad: 46.5, vibracion: 0.07, nivel_bateria: 96, latitud: -33.0472, longitud: -71.6127, evento: "LECTURA", ubicacion: "-33.0472,-71.6127", id_envio: "ENV-1009"})
CREATE (l12:Lectura {id_lectura: "LEC-012", timestamp: datetime() - duration('PT5H'), fecha_hora: datetime() - duration('PT5H'), temperatura: null, humedad: null, vibracion: 0.28, nivel_bateria: 90, latitud: -23.8000, longitud: -69.0000, evento: "LECTURA", ubicacion: "-23.8,-69.0", id_envio: "ENV-1010"})
CREATE (l13:Lectura {id_lectura: "LEC-013", timestamp: datetime() - duration('PT1H'), fecha_hora: datetime() - duration('PT1H'), temperatura: null, humedad: null, vibracion: 0.14, nivel_bateria: 89, latitud: -23.6509, longitud: -70.3975, evento: "LECTURA", ubicacion: "-23.6509,-70.3975", id_envio: "ENV-1010"})
CREATE (l14:Lectura {id_lectura: "LEC-014", timestamp: datetime() - duration('PT6H'), fecha_hora: datetime() - duration('PT6H'), temperatura: 2.4, humedad: 40.0, vibracion: 0.03, nivel_bateria: 99, latitud: -34.8222, longitud: -58.5358, evento: "LECTURA", ubicacion: "-34.8222,-58.5358", id_envio: "ENV-1011"})
CREATE (l15:Lectura {id_lectura: "LEC-015", timestamp: datetime() - duration('PT2H'), fecha_hora: datetime() - duration('PT2H'), temperatura: 3.1, humedad: 42.0, vibracion: 0.08, nivel_bateria: 98, latitud: 4.7016, longitud: -74.1469, evento: "LECTURA", ubicacion: "4.7016,-74.1469", id_envio: "ENV-1011"})
CREATE (l16:Lectura {id_lectura: "LEC-016", timestamp: datetime() - duration('PT8H'), fecha_hora: datetime() - duration('PT8H'), temperatura: 21.0, humedad: 75.0, vibracion: 0.04, nivel_bateria: 94, latitud: -32.9468, longitud: -60.6393, evento: "LECTURA", ubicacion: "-32.9468,-60.6393", id_envio: "ENV-1012"})
CREATE (l17:Lectura {id_lectura: "LEC-017", timestamp: datetime() - duration('PT3H'), fecha_hora: datetime() - duration('PT3H'), temperatura: 22.5, humedad: 78.0, vibracion: 0.05, nivel_bateria: 93, latitud: -25.2800, longitud: -57.6300, evento: "LECTURA", ubicacion: "-25.28,-57.63", id_envio: "ENV-1012"})
CREATE (l18:Lectura {id_lectura: "LEC-018", timestamp: datetime() - duration('PT12H'), fecha_hora: datetime() - duration('PT12H'), temperatura: 1.5, humedad: 50.0, vibracion: 0.06, nivel_bateria: 95, latitud: -12.0500, longitud: -77.1500, evento: "LECTURA", ubicacion: "-12.05,-77.15", id_envio: "ENV-1013"})
CREATE (l19:Lectura {id_lectura: "LEC-019", timestamp: datetime() - duration('PT2H'), fecha_hora: datetime() - duration('PT2H'), temperatura: 2.0, humedad: 52.0, vibracion: 0.05, nivel_bateria: 91, latitud: 51.9000, longitud: 4.4000, evento: "LECTURA", ubicacion: "51.9,4.4", id_envio: "ENV-1013"})
CREATE (l20:Lectura {id_lectura: "LEC-020", timestamp: datetime() - duration('PT1H'), fecha_hora: datetime() - duration('PT1H'), temperatura: 19.8, humedad: 55.0, vibracion: 0.09, nivel_bateria: 100, latitud: -23.5505, longitud: -46.6333, evento: "LECTURA", ubicacion: "-23.5505,-46.6333", id_envio: "ENV-1014"})
CREATE (l21:Lectura {id_lectura: "LEC-021", timestamp: datetime() - duration('PT24H'), fecha_hora: datetime() - duration('PT24H'), temperatura: 15.0, humedad: 60.0, vibracion: 0.04, nivel_bateria: 85, latitud: 53.5511, longitud: 9.9937, evento: "LECTURA", ubicacion: "53.5511,9.9937", id_envio: "ENV-1015"})

CREATE (s7)-[:REGISTRA]->(l10)
CREATE (s7)-[:REGISTRA]->(l11)
CREATE (s8)-[:REGISTRA]->(l12)
CREATE (s8)-[:REGISTRA]->(l13)
CREATE (s9)-[:REGISTRA]->(l14)
CREATE (s9)-[:REGISTRA]->(l15)
CREATE (s10)-[:REGISTRA]->(l16)
CREATE (s10)-[:REGISTRA]->(l17)
CREATE (s11)-[:REGISTRA]->(l18)
CREATE (s11)-[:REGISTRA]->(l19)
CREATE (s12)-[:REGISTRA]->(l20)
CREATE (s13)-[:REGISTRA]->(l21)
