# Resolución técnica y modelado

## Trabajo Práctico: Persistencia Políglota – Grupo 12

La solución implementa una aplicación interactiva de consola para gestionar
envíos internacionales y cargas monitoreadas por sensores IoT. Se utilizan
cuatro paradigmas de persistencia, cada uno seleccionado según el tipo de
consulta y las garantías requeridas:

1. **Relacional:** PostgreSQL.
2. **Documental:** MongoDB.
3. **Grafos:** Neo4j.
4. **Clave-Valor:** Redis.

La aplicación está desarrollada en Node.js con módulos ES y se ejecuta mediante
una CLI. No es una API REST ni una aplicación web. Las conexiones a los cuatro
motores se centralizan en `src/config/database.js`, y la infraestructura local
se levanta con Docker Compose.

---

## 1. Persistencia políglota

### 1.1 PostgreSQL: base relacional

**Tipo:** relacional, orientada a transacciones y datos estructurados.

**Información almacenada:**

- Clientes, proveedores y operadores logísticos.
- Usuarios, roles y permisos.
- Historial de sesiones y auditoría de autenticación.
- Contenedores y vehículos.
- Envíos y tramos.
- Relación envío-contenedor.
- Facturas, pagos, cuentas corrientes y cierres mensuales.

**Ventajas:**

- Propiedades ACID para operaciones financieras y cambios de estado.
- Claves primarias, claves foráneas, restricciones `CHECK` y `UNIQUE`.
- Consultas SQL y agregaciones adecuadas para reportes operativos.
- Integridad transaccional entre un envío, sus contenedores y sus tramos.

**Desventajas:**

- Esquema más rígido que el de MongoDB.
- La distribución horizontal requiere una estrategia adicional.
- No es el motor más conveniente para telemetría de alta frecuencia ni
  recorridos de grafos.

**Justificación técnica:** los importes, saldos, facturas, pagos, usuarios y
relaciones principales del negocio deben conservar consistencia fuerte. Por eso
PostgreSQL funciona como fuente de verdad para el núcleo transaccional.

### 1.2 MongoDB: base documental

**Tipo:** documental, con documentos BSON y esquema flexible.

**Información almacenada:**

- `sensores`: metadatos, estado y contenedor asociado.
- `lecturas_sensores`: telemetría de temperatura, humedad, vibración, GPS y
  batería.
- `eventos_logisticos`: historial de eventos de cada envío.
- `incidentes`: incidentes manuales y generados por reglas.
- `reglas_alertas`: umbrales configurables.
- `alertas`: alertas producidas por lecturas o reglas.
- `mensajes` y `grupos_trabajo`: comunicación privada y grupal.
- `predicciones_riesgo`: histórico de predicciones.
- `reportes`: reportes comerciales, operativos y analíticos.

**Ventajas:**

- Modelo flexible para lecturas con campos opcionales.
- Alta velocidad de escritura para telemetría.
- Colecciones específicas para cada tipo de documento.
- Soporte de colecciones `time-series` para `lecturas_sensores`.
- Consultas e índices adecuados para históricos y filtros por envío, sensor o
  fecha.

**Desventajas:**

- Las relaciones entre documentos no tienen la misma integridad referencial
  que las claves foráneas de PostgreSQL.
- Puede existir duplicación controlada de identificadores de envío, sensor o
  contenedor.
- Las operaciones que requieren consistencia entre varios motores deben ser
  coordinadas desde la aplicación.

**Justificación técnica:** la telemetría y los eventos tienen gran volumen,
crecen continuamente y pueden incorporar atributos opcionales. MongoDB permite
registrarlos sin modificar un esquema relacional ante cada variación.

### 1.3 Neo4j: base de grafos

**Tipo:** grafo de propiedades, consultado con Cypher.

**Información almacenada:**

- Nodos `Cliente`, `Envio`, `Ubicacion`, `Operador`, `Vehiculo`,
  `Contenedor`, `Sensor`, `Tramo` y `Lectura`.
- Relaciones de solicitud, asignación, transporte, composición de rutas,
  conexión entre tramos, pertenencia de contenedores y registro de lecturas.

**Ventajas:**

- Recorridos de rutas y relaciones con navegación directa.
- Consultas naturales para reconstruir el trayecto de un envío o contenedor.
- Permite visualizar la red entre clientes, operadores, vehículos, envíos y
  ubicaciones.
- Las restricciones de unicidad evitan duplicar nodos identificables.

**Desventajas:**

- No reemplaza a PostgreSQL para saldos, facturación o reportes tabulares.
- Algunas agregaciones masivas son más sencillas en SQL o MongoDB.
- La proyección de datos desde los otros motores debe manejarse
  explícitamente.

**Justificación técnica:** la aplicación necesita consultas de caminos y de
conectividad, como la ruta completa de un envío, la red de relaciones y el
historial de movimientos de un contenedor. Estas operaciones se expresan de
forma más directa en Neo4j.

### 1.4 Redis: base clave-valor

**Tipo:** clave-valor en memoria, con estructuras Hash, Set, String y GEO.

**Información almacenada:**

- Sesiones activas con expiración TTL.
- Índice de sesiones activas y sesiones por usuario.
- Última posición conocida de cada contenedor.
- Índice geoespacial `contenedores:geo`.
- Predicciones de riesgo cacheadas durante 24 horas.
- Resultados de analítica cacheados durante una hora.

**Ventajas:**

- Baja latencia para sesiones, posiciones y consultas repetitivas.
- TTL nativo para sesiones, predicciones y resultados temporales.
- Comandos GEO para consultar posiciones cercanas.
- Sets para administrar sesiones activas.

**Desventajas:**

- La información cacheada no debe ser la única fuente de verdad.
- El consumo depende de la memoria disponible.
- La pérdida de Redis afecta la disponibilidad de cachés, aunque los datos
  principales permanezcan en PostgreSQL o MongoDB.

**Justificación técnica:** Redis se utiliza para información temporal y de
acceso frecuente. La sesión se audita además en PostgreSQL, mientras que las
posiciones y resultados cacheados pueden reconstruirse desde las fuentes
persistentes.

No se incorporó una base orientada a objetos ni una base tabular adicional,
porque los cuatro paradigmas seleccionados cubren los requisitos del
enunciado sin duplicar responsabilidades.

---

## 2. Modelado físico

Los scripts ejecutables se encuentran en `scripts/`:

- `scripts/init_postgres.sql`
- `scripts/init_mongo.js`
- `scripts/init_neo4j.cypher`
- `scripts/seed_all.js`

### 2.1 Modelo físico relacional

El esquema de PostgreSQL contiene las siguientes tablas principales:

| Grupo | Tablas |
|---|---|
| Actores y seguridad | `clientes`, `proveedores`, `operadores`, `roles`, `usuarios`, `historial_sesiones` |
| Operación | `contenedores`, `vehiculos`, `envios`, `tramos`, `envio_contenedores` |
| Finanzas | `cuentas_corrientes`, `facturas`, `pagos`, `cierres_cuentas_corrientes` |

Relaciones relevantes:

- `usuarios.id_cliente` referencia a `clientes.id_cliente`.
- `usuarios.id_rol` referencia a `roles.id_rol`.
- `historial_sesiones.id_usuario` referencia a `usuarios.id_usuario`.
- `envios.id_cliente` referencia a `clientes.id_cliente`.
- `tramos.id_envio` referencia a `envios.id_envio`.
- `envio_contenedores` relaciona muchos contenedores históricos con un envío.
- `pagos.id_factura` referencia a `facturas.id_factura`.

La identidad de una cuenta corriente o factura se representa por
`(tipo_actor, id_actor)`, porque clientes, proveedores y operadores tienen
secuencias independientes. La relación `envio_contenedores` conserva
`fecha_asignacion` y `fecha_liberacion`, lo que permite mantener trazabilidad.

Restricciones e índices principales:

- Claves primarias en todas las entidades.
- CUIT y email únicos.
- Código internacional e identificación de vehículo únicos.
- `CHECK` para estados, tipos de actor, importes y montos positivos.
- Índices de facturas por actor, envío y fecha.
- Índices de pagos por factura y fecha.
- Índices de sesiones por usuario y estado.
- Índice parcial único sobre `envio_contenedores(id_contenedor)` cuando
  `fecha_liberacion IS NULL`, evitando que un contenedor activo pertenezca a
  dos envíos simultáneamente.
- Restricción única de cierre por período, actor y tipo.

El script utiliza `CREATE TABLE IF NOT EXISTS`, índices `IF NOT EXISTS` y
alteraciones compatibles con versiones anteriores. Actualmente no se aplica
particionamiento físico en PostgreSQL; el volumen del trabajo práctico se
resuelve con índices y con la colección time-series de MongoDB.

### 2.2 Modelo físico documental

Colecciones e índices configurados por `scripts/init_mongo.js`:

| Colección | Índices y propósito |
|---|---|
| `sensores` | `id_sensor` único; `id_contenedor` para asociación |
| `lecturas_sensores` | time-series con `fecha_hora`, `id_sensor` como `metaField`, índices por sensor/contenedor y `2dsphere` para GPS |
| `eventos_logisticos` | `id_evento` único; `id_envio` y fecha |
| `incidentes` | `id_incidente` único; envío/estado, sensor/tipo/estado y fecha |
| `reglas_alertas` | `id_regla` único; tipo y activación |
| `alertas` | `id_alerta` único; sensor/tipo/estado, incidente/estado y contenedor/estado |
| `mensajes` | `id_mensaje` único; grupo/fecha y conversación privada |
| `grupos_trabajo` | `id_grupo` único; integrantes |
| `predicciones_riesgo` | índice por `id_envio` |
| `reportes` | `id_reporte` único disperso; fecha y categoría/tipo |

Ejemplo de lectura almacenada:

```json
{
  "id_lectura": "LEC-001",
  "id_sensor": "SENS-101",
  "id_contenedor": "CONT-001",
  "id_envio": "ENV-1001",
  "fecha_hora": "2026-10-24T15:00:00Z",
  "temperatura": 4.1,
  "humedad": 62.5,
  "vibracion": 0.08,
  "posicion_gps": {
    "type": "Point",
    "coordinates": [-58.3816, -34.6037]
  },
  "nivel_bateria": 95
}
```

La colección de lecturas está particionada lógicamente por `id_sensor` y
ordenada temporalmente por `fecha_hora` mediante el modelo time-series. MongoDB
administra internamente los buckets; no se crean particiones manuales.

### 2.3 Modelo físico de grafos

Neo4j aplica restricciones de unicidad para:

```cypher
CREATE CONSTRAINT IF NOT EXISTS
FOR (e:Envio) REQUIRE e.id_envio IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS
FOR (cont:Contenedor) REQUIRE cont.id_contenedor IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS
FOR (s:Sensor) REQUIRE s.id_sensor IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS
FOR (u:Ubicacion) REQUIRE u.nombre IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS
FOR (v:Vehiculo) REQUIRE v.identificacion IS UNIQUE;
```

Relaciones implementadas:

- `(Cliente)-[:SOLICITA]->(Envio)`
- `(Envio)-[:TIENE_ORIGEN|TIENE_DESTINO]->(Ubicacion)`
- `(Envio)-[:COMPUESTO_POR]->(Tramo)`
- `(Tramo)-[:CONECTA_A]->(Tramo)`
- `(Tramo)-[:DESDE|HASTA]->(Ubicacion)`
- `(Envio)-[:ASIGNADO_A]->(Operador)`
- `(Envio)-[:TRANSPORTADO_POR]->(Vehiculo)`
- `(Contenedor)-[:PERTENECE_A]->(Envio)`
- `(Contenedor)-[:MONITOREADO_POR]->(Sensor)`
- `(Sensor)-[:REGISTRA]->(Lectura)`

Los identificadores compartidos (`id_envio`, `id_contenedor`, `id_sensor`) se
utilizan para correlacionar el grafo con PostgreSQL y MongoDB.

### 2.4 Modelo físico clave-valor

Las claves utilizadas por los repositorios Redis son:

| Clave | Estructura | TTL/uso |
|---|---|---|
| `sesion:<token>` | String JSON | TTL de la sesión, por defecto 3600 segundos |
| `sesiones:activas` | Set | Índice de tokens activos |
| `sesiones:usuario:<id>` | Set | Tokens del usuario |
| `contenedor:posicion:<id>` | Hash | Última latitud, longitud y metadatos |
| `contenedores:geo` | GEO | Búsqueda de contenedores cercanos |
| `prediccion:riesgo:<id_envio>` | String JSON | TTL de 86400 segundos |
| `analytics:<clave>` | String JSON | TTL analítico, por defecto 3600 segundos |

---

## 3. Arquitectura y desarrollo de la aplicación

La aplicación se ejecuta con `npm start` y presenta una CLI interactiva. La
arquitectura está separada en capas:

- **Bootstrap:** `src/index.js`, inicialización y cierre de conexiones.
- **CLI:** `src/cli/`, autenticación, menú principal y handlers por dominio.
- **Services:** reglas de negocio y casos de uso.
- **Repositories:** acceso a PostgreSQL, MongoDB, Neo4j y Redis.
- **Configuración:** `src/config/database.js`.
- **Validación:** `src/utils/validation.js`.

Las fachadas `LogisticsService` y `AnalyticsService` delegan en servicios
especializados. Entre ellos se encuentran creación, consultas, asignaciones y
estados de envíos; monitoreo, riesgo, analítica comercial, red logística,
temperatura y desempeño. `ContenedorRepository` mantiene CRUD de PostgreSQL,
`ShipmentContainerRepository` mantiene relaciones y
`ContenedorAssignmentService` aplica las reglas de asignación y sincronización
del grafo.

Se aplican validaciones de entrada, errores explícitos, mensajes de consola y
advertencias cuando una proyección o caché secundaria no está disponible. Las
contraseñas se almacenan mediante `bcrypt` y las sesiones se auditan en
PostgreSQL además de mantenerse activas en Redis.

Funcionalidades implementadas:

- CRUD de actores, contenedores, usuarios y roles.
- Sesiones activas, cierre individual y cierre global.
- Alta, modificación, estados, cancelación y eliminación de envíos.
- Asignación y liberación de contenedores y sensores.
- Registro e histórico de telemetría.
- Reglas configurables, alertas e incidentes.
- Mensajería privada y grupal.
- Facturación, pagos, cuentas corrientes y cierres.
- Reportes parametrizados.
- Rankings de clientes y rutas.
- Ruta completa e historial de movimientos en Neo4j.
- Predicción de riesgo y detección de anomalías de temperatura.

---

## 4. Sincronización y consistencia entre motores

La sincronización se realiza desde los servicios de
aplicación mediante operaciones directas, con PostgreSQL como fuente de verdad
para los datos transaccionales.

### Alta y cambios de envíos

1. Se valida el cliente, el envío y los contenedores en PostgreSQL.
2. Se persiste el envío y sus relaciones en PostgreSQL.
3. Se actualiza o proyecta la representación correspondiente en Neo4j.
4. Se invalidan las claves Redis relacionadas con el envío o su riesgo.
5. Si una proyección secundaria falla, el servicio registra una advertencia y
   aplica compensaciones cuando corresponde.

### Ingreso de telemetría

1. Se valida que existan el sensor, el contenedor y, si se informa, el envío.
2. La lectura se guarda en MongoDB.
3. Se actualiza la última posición en Redis cuando hay coordenadas.
4. Se intenta proyectar la lectura en Neo4j para el historial de movimientos.
5. Se evalúan las reglas activas y se generan alertas o incidentes.

MongoDB es la fuente de verdad de la telemetría; Redis y Neo4j son
proyecciones derivadas para consultas rápidas y navegación.

### Problemas de consistencia posibles

- PostgreSQL puede confirmar una operación y Neo4j o Redis estar
  momentáneamente indisponibles.
- Un documento de MongoDB puede conservar un identificador de envío eliminado
  o modificado si la aplicación no actualiza la referencia.
- Redis puede perder cachés por expiración o reinicio.
- La misma operación puede repetirse si el usuario reintenta después de un
  error de red.

### Estrategias aplicadas

- PostgreSQL conserva la operación principal y las restricciones de negocio.
- Se usan identificadores compartidos para correlacionar motores.
- Las operaciones de actualización del grafo utilizan patrones idempotentes
  como `MERGE` cuando corresponde.
- Las cachés se invalidan ante cambios de estados, incidentes o envíos.
- Se utilizan métodos de compensación para liberar asignaciones cuando falla
  una etapa posterior.
- Las proyecciones secundarias son best-effort y registran advertencias sin
  presentar una proyección incompleta como fuente principal.
- Las consultas que dependen de Redis verifican su disponibilidad y fallan de
  forma explícita cuando la sesión requiere Redis.

---

## 5. Procesos y consultas requeridos

La CLI expone los procesos solicitados por la consigna:

- Envíos por país, estado y cliente.
- Envíos demorados e incidentes abiertos.
- Tiempos mínimos, máximos y promedio por cliente.
- Promedio de incidentes y costos por medio de transporte.
- Ranking de rutas con incidentes.
- Ranking de clientes por volumen transportado o facturado.
- Ruta completa de un envío.
- Red de relaciones logísticas.
- Historial de movimientos de un contenedor.
- Facturación automática y registro de pagos.
- Cierre mensual de cuentas corrientes.
- Predicción de riesgos.
- Detección de anomalías de temperatura.
- Detección de sensores inactivos mediante reglas configurables.

Los procesos periódicos se implementan como operaciones invocables desde la
CLI o desde los servicios; el proyecto no contiene un scheduler persistente
ejecutándose en segundo plano.

---

## 6. Casos de prueba y datos de prueba

Los scripts de inicialización incluyen datos de prueba para los cuatro motores.
Los casos mínimos a verificar son:

1. Autenticación correcta, contraseña inválida y bloqueo por intentos.
2. Creación, modificación, baja lógica y eliminación de un actor.
3. Creación de un envío y asignación exclusiva de un contenedor.
4. Rechazo de asignar un contenedor activo a dos envíos.
5. Registro de una lectura válida y rechazo de sensor inactivo.
6. Generación de alerta por temperatura fuera de umbral.
7. Consulta histórica de lecturas por sensor y contenedor.
8. Consulta de posición actual y posiciones cercanas mediante Redis GEO.
9. Reconstrucción de una ruta y movimientos de un contenedor en Neo4j.
10. Emisión de factura, pago y actualización de cuenta corriente.
11. Cierre mensual único para un actor y período.
12. Uso y expiración de caché de riesgo y analítica.
13. Manejo de indisponibilidad de una base secundaria sin ocultar el error.

La validación técnica del código se realiza con `node --check` sobre `src`,
importación de los módulos de la CLI y `git diff --check`. La inicialización
completa se ejecuta con `npm run seed` después de levantar Docker Compose.

---

## 7. Anexo: definición física detallada

Este anexo transcribe el modelo implementado en los scripts de inicialización.
Los tipos y restricciones indicados corresponden a PostgreSQL; MongoDB y
Neo4j utilizan esquemas flexibles, por lo que allí se documentan los campos
observados en los documentos y nodos semilla, además de sus índices y
restricciones.

### 7.1 PostgreSQL: tablas, columnas y claves

| Tabla | Columnas y tipos | Claves y restricciones |
|---|---|---|
| `clientes` | `id_cliente SERIAL`, `razon_social VARCHAR(150)`, `cuit VARCHAR(20)`, `email VARCHAR(100)`, `telefono VARCHAR(50)`, `direccion VARCHAR(255)`, `pais VARCHAR(100)`, `estado VARCHAR(50)`, `saldo NUMERIC(12,2)`, `fecha_registro TIMESTAMP` | PK `id_cliente`; `cuit` UNIQUE; `razon_social`, `cuit`, `email`, `pais` NOT NULL |
| `proveedores` | `id_proveedor SERIAL`, `razon_social VARCHAR(150)`, `cuit VARCHAR(20)`, `email VARCHAR(100)`, `telefono VARCHAR(50)`, `direccion VARCHAR(255)`, `pais VARCHAR(100)`, `estado VARCHAR(50)`, `saldo NUMERIC(12,2)`, `fecha_registro TIMESTAMP` | PK `id_proveedor`; `cuit` UNIQUE |
| `operadores` | `id_operador SERIAL`, `razon_social VARCHAR(150)`, `cuit VARCHAR(20)`, `email VARCHAR(100)`, `telefono VARCHAR(50)`, `direccion VARCHAR(255)`, `pais VARCHAR(100)`, `estado VARCHAR(50)`, `saldo NUMERIC(12,2)`, `fecha_registro TIMESTAMP` | PK `id_operador`; `cuit` UNIQUE |
| `roles` | `id_rol SERIAL`, `descripcion VARCHAR(100)`, `nivel_permisos INT`, `estado VARCHAR(50)`, `permisos JSONB`, `fecha_creacion TIMESTAMP` | PK `id_rol`; valores por defecto para nivel, estado, permisos y fecha |
| `usuarios` | `id_usuario SERIAL`, `id_cliente INT`, `nombre VARCHAR(100)`, `apellido VARCHAR(100)`, `id_rol INT`, `email VARCHAR(100)`, `password_hash VARCHAR(255)`, `estado VARCHAR(50)`, `fecha_ultimo_acceso TIMESTAMP`, `sesion_activa BOOLEAN` | PK `id_usuario`; `email` UNIQUE; FK `id_cliente` a `clientes` con `SET NULL`; FK `id_rol` a `roles` |
| `historial_sesiones` | `id_sesion SERIAL`, `id_usuario INT`, `id_rol INT`, `token VARCHAR(64)`, `ip_origen VARCHAR(45)`, `fecha_inicio TIMESTAMP`, `fecha_fin TIMESTAMP`, `fecha_ultima_actividad TIMESTAMP`, `estado VARCHAR(50)` | PK `id_sesion`; FK `id_usuario` con `CASCADE`; FK `id_rol` con `SET NULL`; token UNIQUE parcial; índice `(id_usuario, estado)` |
| `contenedores` | `id_contenedor VARCHAR(50)`, `codigo_internacional VARCHAR(100)`, `tipo VARCHAR(50)`, `capacidad NUMERIC(10,2)`, `estado VARCHAR(50)` | PK `id_contenedor`; `codigo_internacional` UNIQUE |
| `vehiculos` | `id_vehiculo VARCHAR(50)`, `tipo VARCHAR(50)`, `identificacion VARCHAR(100)`, `empresa_operadora VARCHAR(150)`, `estado VARCHAR(50)` | PK `id_vehiculo`; `identificacion` UNIQUE |
| `cuentas_corrientes` | `id_cuenta SERIAL`, `id_actor INT`, `tipo_actor VARCHAR(20)`, `saldo NUMERIC(12,2)`, `fecha_actualizacion TIMESTAMP` | PK `id_cuenta`; UNIQUE `(tipo_actor,id_actor)`; `tipo_actor` limitado a CLIENTE, PROVEEDOR u OPERADOR |
| `facturas` | `id_factura SERIAL`, `id_cliente INT`, `tipo_factura VARCHAR(20)`, `tipo_actor VARCHAR(20)`, `numero_comprobante VARCHAR(50)`, `concepto VARCHAR(255)`, `id_envio VARCHAR(50)`, `fecha_emision TIMESTAMP`, `importe_total NUMERIC(12,2)`, `estado VARCHAR(50)` | PK `id_factura`; importe positivo; estados PENDIENTE/PAGADA/ANULADA; índices por actor, envío y fecha; comprobante UNIQUE parcial |
| `pagos` | `id_pago SERIAL`, `id_factura INT`, `tipo_pago VARCHAR(20)`, `referencia_comprobante VARCHAR(100)`, `fecha TIMESTAMP`, `monto NUMERIC(12,2)`, `medio_pago VARCHAR(50)` | PK `id_pago`; FK `id_factura` con `CASCADE`; monto positivo; índice por factura y fecha |
| `cierres_cuentas_corrientes` | `id_cierre SERIAL`, `periodo VARCHAR(7)`, `id_actor INT`, `tipo_actor VARCHAR(20)`, `saldo_inicial NUMERIC(12,2)`, `total_debe NUMERIC(12,2)`, `total_haber NUMERIC(12,2)`, `saldo_final NUMERIC(12,2)`, `fecha_cierre TIMESTAMP`, `estado VARCHAR(20)` | PK `id_cierre`; UNIQUE `(periodo,tipo_actor,id_actor)` |
| `envios` | `id_envio VARCHAR(50)`, `id_cliente INT`, `fecha_creacion TIMESTAMP`, `fecha_entrega TIMESTAMP`, `origen VARCHAR(100)`, `destino VARCHAR(100)`, `estado VARCHAR(50)`, `prioridad VARCHAR(20)` | PK `id_envio`; FK `id_cliente` a `clientes`; origen y destino NOT NULL |
| `envio_contenedores` | `id_envio VARCHAR(50)`, `id_contenedor VARCHAR(50)`, `fecha_asignacion TIMESTAMP`, `fecha_liberacion TIMESTAMP` | PK `(id_envio,id_contenedor)`; FKs a `envios` y `contenedores` con `CASCADE`; índice por envío; índice UNIQUE parcial por contenedor activo |
| `tramos` | `id_tramo VARCHAR(50)`, `id_envio VARCHAR(50)`, `medio_transporte VARCHAR(50)`, `origen VARCHAR(100)`, `destino VARCHAR(100)`, `costo NUMERIC(12,2)`, `fecha_salida TIMESTAMP`, `fecha_llegada_estimada TIMESTAMP` | PK `id_tramo`; FK `id_envio` con `CASCADE` |

### 7.2 MongoDB: colecciones y documentos

MongoDB mantiene documentos BSON y no impone un esquema rígido. Los campos
principales implementados son:

| Colección | Campos del documento | Índices |
|---|---|---|
| `sensores` | `id_sensor`, `tipo`, `fabricante`, `fecha_instalacion`, `estado`, `id_contenedor` | UNIQUE `id_sensor`; `id_contenedor` |
| `lecturas_sensores` | `id_lectura`, `id_sensor`, `id_contenedor`, `id_envio`, `fecha_hora`, `temperatura`, `humedad`, `vibracion`, `posicion_gps` GeoJSON, `nivel_bateria` | Time-series con `fecha_hora`, metaField `id_sensor`, granularidad `seconds`; índices sensor/fecha, contenedor/fecha y `2dsphere` |
| `eventos_logisticos` | `id_evento`, `id_envio`, `fecha_hora`, `tipo_evento`, `ubicacion`, `descripcion` | UNIQUE `id_evento`; `(id_envio,fecha_hora)` |
| `incidentes` | `id_incidente`, `id_envio`, `id_sensor`, `id_contenedor`, `tipo`, `severidad`, `estado`, `descripcion`, `fecha` | UNIQUE `id_incidente`; envío/estado; sensor/tipo/estado; fecha |
| `reglas_alertas` | `id_regla`, `tipo`, `condicion`, `umbral`, `severidad`, `activa`, `descripcion`, `fecha_creacion` | UNIQUE `id_regla`; `(tipo,activa)` |
| `alertas` | `id_alerta`, `id_sensor`, `id_contenedor`, `id_envio`, `tipo`, `severidad`, `estado`, `motivo`, `valor_detectado`, `umbral_aplicado`, `id_regla`, `mensaje`, `fecha` | UNIQUE `id_alerta`; sensor/tipo/estado; incidente/estado; contenedor/estado |
| `mensajes` | `id_mensaje`, `remitente`, `destinatario`, `id_grupo`, `contenido`, `tipo`, `formato`, `estado`, `fecha` | UNIQUE `id_mensaje`; tipo/fecha; grupo/fecha; remitente/destinatario/fecha |
| `grupos_trabajo` | `id_grupo`, `nombre`, `integrantes` | UNIQUE `id_grupo`; `integrantes` |
| `predicciones_riesgo` | `id_prediccion`, `id_envio`, `riesgo_climatico`, `riesgo_operativo`, `probabilidad_demora`, `factores`, `fecha_calculo` | `id_envio` |
| `reportes` | `id_reporte`, `usuario`, `tipo`, `categoria`, `parametros`, `datos`, `metricas`, `fecha_generacion` | UNIQUE disperso `id_reporte`; fecha de generación; categoría/tipo |

Los campos `id_*` son referencias lógicas compartidas con PostgreSQL y
Neo4j. No son claves foráneas MongoDB; la integridad entre motores se valida
en los servicios de la aplicación.

### 7.3 Neo4j: nodos, propiedades y relaciones

| Etiqueta | Propiedades implementadas | Restricción |
|---|---|---|
| `Cliente` | `id_cliente`, `razon_social`, `pais` | UNIQUE `id_cliente` |
| `Envio` | `id_envio`, `estado`, `prioridad` | UNIQUE `id_envio` |
| `Ubicacion` | `nombre`, `pais` | UNIQUE `nombre` |
| `Operador` | `id_actor`, `nombre` | UNIQUE `nombre` |
| `Vehiculo` | `id_vehiculo`, `tipo`, `identificacion` | UNIQUE `identificacion` |
| `Contenedor` | `id_contenedor`, `codigo_internacional`, `estado` | UNIQUE `id_contenedor` |
| `Sensor` | `id_sensor`, `tipo` | UNIQUE `id_sensor` |
| `Tramo` | `id_tramo`, `orden`, `medio` | Sin restricción propia |
| `Lectura` | `id_lectura`, `timestamp`, `fecha_hora`, `temperatura`, `humedad`, `vibracion`, `nivel_bateria`, `latitud`, `longitud`, `evento`, `ubicacion`, `id_envio` | Sin restricción propia |

Relaciones: `SOLICITA`, `TIENE_ORIGEN`, `TIENE_DESTINO`,
`ASIGNADO_A`, `OPERA_VEHICULO`, `TRANSPORTADO_POR`, `COMPUESTO_POR`,
`CONECTA_A`, `DESDE`, `HASTA`, `PERTENECE_A`, `MONITOREADO_POR` y
`REGISTRA`. Neo4j no utiliza particionamiento en esta implementación.

### 7.4 Redis: claves y estructuras

| Patrón de clave | Tipo Redis | Campos o contenido | Expiración |
|---|---|---|---|
| `sesion:<token>` | String | JSON de sesión autenticada | TTL de sesión, normalmente 3600 s |
| `sesiones:activas` | Set | Tokens activos | Sin TTL propio |
| `sesiones:usuario:<id>` | Set | Tokens del usuario | Sin TTL propio |
| `contenedor:posicion:<id>` | Hash | `latitud`, `longitud`, `id_envio`, `id_sensor`, `actualizado_en` | Sin TTL obligatorio |
| `contenedores:geo` | GEO | Coordenadas de contenedores | Sin TTL propio |
| `prediccion:riesgo:<id_envio>` | String JSON | Predicción y factores | 86400 s |
| `analytics:<clave>` | String JSON | Resultado analítico serializado | Normalmente 3600 s |

Redis no contiene claves foráneas ni restricciones relacionales; sus índices
son provistos por Sets y por la estructura GEO. Las posiciones y cachés son
proyecciones reconstruibles, no la fuente principal de información.

---

## 8. Entregables relacionados

- Este informe: `resolucion_tecnica_y_modelado.md`.
- Consignas: `trabajo_practico_consignas.md`.
- Código fuente: `src/`.
- Esquema PostgreSQL: `scripts/init_postgres.sql`.
- Inicialización MongoDB: `scripts/init_mongo.js`.
- Inicialización Neo4j: `scripts/init_neo4j.cypher`.
- Seed unificado: `scripts/seed_all.js`.
- Infraestructura: `docker-compose.yml`.
