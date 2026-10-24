# PROPUESTA DE PERSISTENCIA POLÍGLOTA – GRUPO 12

Para la plataforma de gestión logística internacional y monitoreo IoT, seleccionamos cuatro paradigmas de bases de datos especializados para cubrir los requisitos del sistema:
1. Relacional (SQL) – PostgreSQL
2. Documental (NoSQL) – MongoDB
3. Grafos (NoSQL) – Neo4j
4. Clave-Valor (NoSQL) – Redis

---

## 1. Definición de las Distintas Bases de Datos

### Base de Datos Relacional
- **Tecnología utilizada:** PostgreSQL
- **Casos de uso asignados:**
  - Gestión transaccional y comercial (Cliente, Usuario, Rol, Factura, Pago, Cuenta Corriente).
  - Administración de la flota y los activos (Contenedor, Vehículo).
- **Ventajas:**
  - Cumplimiento estricto de propiedades ACID (otorga consistencia financiera en facturación y pagos).
  - Garantía de integridad referencial mediante claves foráneas y restricciones del esquema.
  - Lenguaje de consulta estandarizado y amplio soporte de ORMs (Hibernate/JPA).
- **Desventajas:**
  - Escalabilidad horizontal más compleja y costosa en comparación con motores NoSQL.
  - Esquema rígido que dificulta cambios estructurales dinámicos.
- **Justificación técnica:** Las operaciones de facturación, registro de pagos y saldos en cuentas corrientes no admiten inconsistencias. El modelo relacional permite garantizar transaccionalidad ACID en el módulo financiero y contable.

### Base de Datos Documental
- **Tecnología utilizada:** MongoDB
- **Casos de uso asignados:**
  - Monitoreo IoT y telemetría (LecturaSensor: captura masiva de temperatura, humedad, GPS, vibración).
  - Trazabilidad e historial operativo (EventoLogistico, Incidente, Alerta).
  - Módulo de comunicación y reportes (Mensaje, GrupoDeTrabajo, Reporte).
- **Ventajas:**
  - Esquema flexible, ideal para adaptar lecturas de sensores IoT o mensajes.
  - Alta velocidad de escritura e ingesta masiva de datos en tiempo real.
  - Facilidad para almacenar estructuras complejas encajadas en un solo documento JSON/BSON.
- **Desventajas:**
  - Menor soporte nativo para transacciones complejas multidocumento.
  - Duplicación potencial de datos para evitar JOINs.
- **Justificación técnica:** Las lecturas IoT representan datos temporales de alta frecuencia y volumen que saturaría un motor relacional. MongoDB permite la absorción rápida, escalamiento horizontal mediante sharding y almacenamiento flexible.

### Base de Datos de Grafos
- **Tecnología utilizada:** Neo4j
- **Casos de uso asignados:**
  - Logística y trayectos (Envío, Tramo, Origen, Destino, Vehículo, Empresa Operadora).
  - Análisis de redes y patrones (mapeo de relaciones entre Cliente, Operador Logístico, Proveedor, Ruta).
  - Consultas avanzadas de trazabilidad (reconstrucción del recorrido completo).
- **Ventajas:**
  - Navegación eficiente entre nodos sin el costo computacional de JOINs relacionales.
  - Lenguaje expresivo de consultas orientado a caminos y redes (Cypher).
  - Ideal para detectar cuellos de botella, demoras recurrentes y análisis de impacto en la cadena de suministro.
- **Desventajas:**
  - Rendimiento subóptimo para agregaciones masivas simples o procesamiento transaccional financiero.
- **Justificación técnica:** Representar la red de relaciones entre clientes, operadores y envíos mediante grafos resulta superior a realizar recursiones complejas o múltiples JOINs en SQL.

### Base de Datos Clave-Valor
- **Tecnología utilizada:** Redis
- **Casos de uso asignados:**
  - Control de acceso y seguridad (gestión de tokens y sesiones activas).
  - Caché de última posición conocida (coordenada GPS reciente por contenedor o sensor).
  - Almacenamiento temporal para cálculos analíticos y predicción de riesgo.
- **Ventajas:**
  - Operación en memoria RAM con tiempos de respuesta de milisegundos.
  - Soporte nativo de Time-To-Live (TTL) para la expiración de sesiones e invalidación de caché.
  - Estructuras de datos avanzadas (Hashes, Sets, Sorted Sets).
- **Desventajas:**
  - Capacidad dependiente de la memoria RAM disponible.
  - Requiere configuración explícita (AOF/RDB) para evitar pérdida de datos en reinicios.
- **Justificación técnica:** La gestión de sesiones y la consulta en tiempo real de la ubicación de miles de contenedores requiere respuestas inmediatas que se resuelven eficientemente en memoria RAM.

---

## 2. Modelado Físico

| Motor | Paradigma | Enfoque Principal |
|---|---|---|
| **PostgreSQL** | Relacional | Transacciones, datos maestros, facturación y contabilidad. |
| **MongoDB** | Documental | Ingesta masiva de telemetría IoT, logs de eventos y reportes. |
| **Neo4j** | Grafos | Topología de red logística, trazabilidad de rutas y relaciones. |
| **Redis** | Clave-Valor | Caché en memoria de alto rendimiento, sesiones y geolocalización. |

### 1. Modelo Físico Relacional (PostgreSQL)

```sql
CREATE TABLE actores (
    id_actor SERIAL PRIMARY KEY,
    tipo_actor VARCHAR(20) CHECK (tipo_actor IN ('CLIENTE', 'PROVEEDOR', 'OPERADOR')),
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(13) NOT NULL UNIQUE
);

CREATE TABLE historial_sesiones (
    id_sesion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    ip_origen VARCHAR(45),
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP
);

CREATE TABLE cuentas_corrientes (
    id_cuenta SERIAL PRIMARY KEY,
    id_actor INT NOT NULL REFERENCES actores(id_actor),
    saldo NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE facturas (
    id_factura SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL REFERENCES actores(id_actor),
    tipo_factura VARCHAR(20) DEFAULT 'EMITIDA' CHECK (tipo_factura IN ('EMITIDA', 'RECIBIDA')),
    numero_comprobante VARCHAR(50),
    concepto VARCHAR(255),
    id_envio VARCHAR(50),
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    importe_total NUMERIC(12, 2) NOT NULL,
    estado VARCHAR(50) DEFAULT 'PENDIENTE'
);

CREATE TABLE pagos (
    id_pago SERIAL PRIMARY KEY,
    id_factura INT NOT NULL REFERENCES facturas(id_factura) ON DELETE CASCADE,
    tipo_pago VARCHAR(20) DEFAULT 'COBRO_CLIENTE' CHECK (tipo_pago IN ('COBRO_CLIENTE', 'PAGO_PROVEEDOR', 'PAGO_OPERADOR')),
    referencia_comprobante VARCHAR(100),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    monto NUMERIC(12, 2) NOT NULL,
    medio_pago VARCHAR(50) NOT NULL
);

CREATE TABLE cierres_cuentas_corrientes (
    id_cierre SERIAL PRIMARY KEY,
    periodo VARCHAR(7) NOT NULL,
    id_actor INT NOT NULL REFERENCES actores(id_actor) ON DELETE CASCADE,
    saldo_inicial NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_debe NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_haber NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    saldo_final NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fecha_cierre TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'CERRADO',
    CONSTRAINT uq_cierre_actor_periodo UNIQUE (periodo, id_actor)
);

CREATE TABLE envios (
    id_envio VARCHAR(50) PRIMARY KEY,
    id_cliente INT NOT NULL REFERENCES actores(id_actor),
    estado VARCHAR(50) NOT NULL,
    pais_origen VARCHAR(100),
    pais_destino VARCHAR(100),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tramos (
    id_tramo VARCHAR(50) PRIMARY KEY,
    id_envio VARCHAR(50) NOT NULL REFERENCES envios(id_envio),
    medio_transporte VARCHAR(50),
    fecha_salida TIMESTAMP
);
```

### 2. Modelo Físico Documental (MongoDB)

**Colección: sensores (Metadatos del sensor)**
```json
{
  "_id": "ObjectId",
  "id_sensor": "SENS-8812",
  "tipo": "Temperatura/GPS",
  "fabricante": "IoTCorp",
  "estado": "Activo"
}
```

**Colección: lecturas_sensores (Series temporales y telemetría)**
```json
{
  "id_sensor": "SENS-8812",
  "fecha_hora": "2024-03-29T10:30:00Z",
  "telemetria": { 
    "temperatura": 4.2, 
    "humedad": 65.0 
  },
  "posicion_gps": { 
    "type": "Point", 
    "coordinates": [-58.38, -34.60] 
  }
}
```

**Colección: predicciones_riesgo (Persistencia analítica)**
```json
{
  "id_envio": "ENV-5510",
  "fecha_calculo": "2024-03-29T10:30:00Z",
  "riesgo_climatico": "Alto",
  "factores": ["Tormenta en tránsito", "Demora en aduana"]
}
```

**Colección: reportes (Auditoría contable y reportes parametrizados)**
```json
{
  "id_reporte": "REP-COM-1730000000",
  "usuario": "admin@logistica.com",
  "tipo": "REPORTE_COMERCIAL_PARAMETRIZADO",
  "categoria": "FACTURACION_Y_COBROS",
  "parametros": {
    "fecha_desde": "2026-10-01",
    "fecha_hasta": "2026-10-31",
    "tipo_actor": "CLIENTE",
    "estado": "PENDIENTE"
  },
  "resumen": {
    "total_facturas": 12,
    "importe_total_facturado": 540000.00,
    "saldo_pendiente_total": 120000.00
  },
  "fecha_generacion": "2026-10-24T18:00:00Z"
}
```

### 3. Modelo Físico de Grafos (Neo4j)

```cypher
CREATE CONSTRAINT FOR (e:Envio) REQUIRE e.id_envio IS UNIQUE;
CREATE CONSTRAINT FOR (u:Ubicacion) REQUIRE u.nombre IS UNIQUE;

CREATE 
  (c1:Cliente {id_cliente: 101}),
  (e1:Envio {id_envio: "ENV-5510"}),
  (u1:Ubicacion {nombre: "Buenos Aires"}),
  (u2:Ubicacion {nombre: "San Pablo"}),
  (op1:Operador {nombre: "Logística Express"}),
  
  (c1)-[:SOLICITA]->(e1),
  (e1)-[:TIENE_ORIGEN]->(u1),
  (e1)-[:TIENE_DESTINO]->(u2),
  (e1)-[:TRAMO]->(u2),
  (e1)-[:ASIGNADO_A]->(op1);
```

### 4. Modelo Físico Clave-Valor (Redis)
- **Sesión Activa:** HASH en `sesion:<id_sesion>` (con expiración por TTL).
- **Estado y Posición de Sensor:** HASH en `sensor:estado:<id_sensor>`.
- **Predicción de Riesgo (Caché):** STRING en `prediccion:envio:<id_envio>` (TTL de 24 horas).
- **Última Posición Contenedor:** GEO en `posiciones:contenedores`.

---

## 3. Desafíos de Complejidad Adicional

### 1. Distribución de la Información
- **PostgreSQL:** Actores comerciales (Clientes, Proveedores, Operadores), facturación, pagos, cuentas corrientes, historial de sesiones y proyecciones de envíos/tramos para reportes tabulares por país o estado.
- **MongoDB:** Administación de sensores, lecturas de telemetría IoT, eventos logísticos, historial de alertas/mensajes y almacenamiento persistente del histórico de predicciones de riesgo.
- **Neo4j:** Topología del grafo, conexiones origen-destino y trazabilidad de los transbordos e interacciones logísticas.
- **Redis:** Sesiones activas, predicción de riesgo cacheadas a 24 horas, última posición GPS de la flota e invalidación rápida de estados.

### 2. Disposición en la Aplicación
Para el entorno de desarrollo y ejecución local, la infraestructura se organiza mediante **Docker Compose**.
Cada base de datos se despliega en su propio contenedor aislado dentro de una red privada virtual (docker network). Esto previene conflictos de puertos en el sistema operativo anfitrión y permite la persistencia mediante volúmenes montados.

### 3. Sincronización de Datos y Manejo de Consistencia
Para mitigar el acoplamiento directo y prevenir fallos en cascada entre servicios, implementamos el patrón **Transactional Outbox** junto con una arquitectura orientada a eventos.
- **Transaccionalidad Local:** Al registrar un Envio en PostgreSQL, dentro de la misma transacción SQL se inserta un evento en la tabla `outbox_events`.
- **Publicación Asíncrona:** Un proceso worker en segundo plano lee la tabla `outbox_events` y publica el mensaje (`ENVIO_CREADO`) en el bróker (RabbitMQ).
- **Consumo y Proyección:** Los suscriptores consumen el evento y actualizan de forma independiente:
  - **Neo4j:** Crea nodos y relaciones utilizando cláusulas idempotentes (`MERGE`).
  - **MongoDB:** Inicializa el documento de trazabilidad e historial.
  - **Redis:** Invalida o actualiza las llaves de caché correspondientes.

### Resolución de Inconsistencias
- **Consistencia Eventual:** Se acepta una latencia de milisegundos en la propagación de cambios desde PostgreSQL hacia los motores NoSQL, la cual se gestiona en la interfaz con estados asíncronos.
- **Tolerancia a Fallos:** Si una base secundaria (ej. Neo4j) no está disponible, el bróker retiene los mensajes. Al restablecer el servicio, los eventos se procesan en orden sin pérdida de información.
- **Manejo de Excepciones:** Se dispone de una cola de mensajes no procesados (Dead Letter Queue - DLQ) para aislar eventos con errores persistentes y permitir su inspección o reprocesamiento manual.