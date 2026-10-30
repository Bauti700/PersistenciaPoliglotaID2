# Condiciones Necesarias para Promocionar - Tareas Pendientes

A continuación se listan todos los puntos que deben estar presentes y operativos (con datos para dar resultado) para la promoción del trabajo práctico.
*Nota:* Siguiendo la consigna de cátedra, la plataforma opera como una aplicación integral por consola (CLI interactiva).

## 🛠️ ABMs y Gestión Base
- [x] ABM Clientes (PostgreSQL - CRUD completo y menú CLI).
- [x] ABM Usuarios y Roles (PostgreSQL - CRUD de usuarios/roles con bcrypt, menú CLI).
- [x] ABM Sesiones activas (Redis con TTL, listado/cierre por sesión/usuario y cierre masivo).
- [ ] ABM Proveedores.
- [ ] ABM Operadores Logísticos.
- [x] ABM Envíos -> contenedores -> sensores (Alta políglota de envíos con asignación explícita en CLI).
- [x] ABM de contenedores (PostgreSQL - CRUD completo con baja lógica y menú CLI).
- [x] ABM de sensores de un contenedor (Listado, registro, edición, baja, activación y asignación a contenedor/envío).
- [x] ABM Reglas y Alertas (Detección de umbral >8°C, batería baja, inactividad y gestión de alertas).

## 💰 Gestión Comercial y Financiera
- [x] Cuenta Corriente - Facturación y Cobros (clientes) (PostgreSQL - Emisión, imputación en CC y saldos).
- [x] Cuenta Corriente - Facturación y Pagos (proveedores y operadores logísticos) (PostgreSQL - Recepción de facturas externas ya hechas, imputación en CC y pagos con cancelación de pasivos).
- [x] Gestión de cuentas corrientes (Clientes, Proveedores y Operadores Logísticos - Consulta individual y listado general filtrado en CLI).
- [x] Facturación automática (PostgreSQL + MongoDB - Cálculo automático de tarifas por tramos/prioridad ante entrega/cierre de envío y proceso masivo por lote).
- [x] Registro de pagos (PostgreSQL - Cobros a clientes y pagos a proveedores/operadores con acreditación/débito en CC y actualización de estado de factura).
- [x] Cierre mensual de cuentas corrientes (PostgreSQL + MongoDB - Tabla `cierres_cuentas_corrientes` con saldo inicial, débitos, créditos, saldo final y auditoría documental en MongoDB).
- [x] Solicitud de reportes comerciales parametrizados (PostgreSQL + MongoDB - Reportes parametrizados por rango de fechas, tipo de actor, tipo de comprobante y estado con métricas y persistencia en colección `reportes`).


## 📡 Monitoreo, Trazabilidad e IoT
- [x] Monitorear envíos - sensores - contenedores - Eventos (MongoDB + Redis + Menú CLI).
- [x] Registro continuo de lecturas IoT (MongoDB - Time-series / Histórico).
- [x] Consulta histórica de lecturas (contenedor / sensores) (MongoDB + Menú CLI).
- [x] Reconstrucción del recorrido de un contenedor (Neo4j - Tramos y relaciones por contenedor/envío).
- [x] Visualización geográfica de posiciones GPS (contenedor) (Coordenadas en Redis con listado y búsqueda por cercanía).
- [x] Control de estado de sensores (ABM: alta/edición/baja/activación, listado por contenedor).
- [x] Alertas de estado de los sensores (Batería baja < 20%, sin lecturas > 2 horas, inactividad).
- [x] Gestión de trayectos de cada envío (seguimiento) (Neo4j - Topología de tramos, origen y destino).
- [x] Detección de incidentes (LogisticsService + MongoDB colección incidentes).
- [x] Generación de alertas (Disparo ante temperatura >8°C, incidentes y estado de sensores).

## 🧠 Inteligencia Analítica
- [x] Ranking de rutas con mayor cantidad de incidentes (MongoDB + PostgreSQL + Redis - Correlación de incidentes por envío con rutas, nivel de riesgo y caché Redis 1h - Menú CLI opción 15).
- [x] Ranking de clientes por volumen transportado (PostgreSQL - Menú CLI).
- [x] Predicción de atrasos / riesgos (LogisticsService con caché en Redis de 24h).
- [x] Red de relaciones entre clientes, operadores y envíos (Neo4j - Menú CLI).
- [x] Análisis histórico de desempeño (PostgreSQL + MongoDB + Redis - Tiempos promedio/mín/máx de entrega por cliente, puntualidad OTD, costos por transporte, confiabilidad de operadores y auditoría en MongoDB - Menú CLI opción 16).
- [x] Detección de anomalías de temperatura (MongoDB Aggregation Pipeline en CLI).

## 📊 Reportes Operativos y Analíticos
- [x] Creación de reportes operativos y analíticos parametrizados (facturables).
- [x] Creación de reportes de análisis predictivos (atrasos y riesgos) (LogisticsService / Redis).
- [x] Creación de reportes de Envíos (país - estado – cliente - demorados - incidentes abiertos).
- [x] Reporte analítico de Tiempos máximos y mínimos de envío por cliente.
- [x] Reporte analítico de Promedio de incidentes por país / estado / cliente.
- [x] Reporte analítico de Tiempos promedio de entrega.
- [x] Reporte analítico de Costos por tipo de transporte.

## 💬 Comunicación
- [x] Servicio de Mensajería con las partes (MongoDB - Colección mensajes con consulta y envío interactivo por CLI).
