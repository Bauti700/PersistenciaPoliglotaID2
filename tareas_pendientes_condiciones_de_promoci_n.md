# Condiciones Necesarias para Promocionar - Tareas Pendientes

A continuación se listan todos los puntos que deben estar presentes y operativos (con datos para dar resultado) para la promoción del trabajo práctico.
*Nota:* Siguiendo la consigna de cátedra, la plataforma opera como una aplicación integral por consola (CLI interactiva).

## 🛠️ ABMs y Gestión Base
- [x] ABM Clientes (PostgreSQL - CRUD completo y menú CLI).
- [ ] ABM Usuarios y Roles.
- [ ] ABM Sesiones activas (Lógica básica en Redis con TTL).
- [ ] ABM Proveedores.
- [ ] ABM Operadores Logísticos.
- [ ] ABM Envíos -> contenedores -> sensores (Alta políglota de envíos lista en CLI; falta asignación explícita de sensores).
- [x] ABM de contenedores (PostgreSQL - CRUD completo con baja lógica y menú CLI).
- [ ] ABM de sensores de un contenedor (Listado y registro básico en MongoDB; falta edición/baja y asignación a contenedor).
- [ ] ABM Reglas y Alertas (Detección de umbral >8°C e incidentes).

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
- [ ] Reconstrucción del recorrido de un contenedor (Neo4j tiene tramos de envío; falta recorrido geográfico del contenedor).
- [ ] Visualización geográfica de posiciones GPS (contenedor) (Coordenadas en Redis).
- [ ] Control de estado de sensores.
- [ ] Alertas de estado de los sensores.
- [x] Gestión de trayectos de cada envío (seguimiento) (Neo4j - Topología de tramos, origen y destino).
- [x] Detección de incidentes (LogisticsService + MongoDB colección incidentes).
- [x] Generación de alertas (Disparo ante temperatura >8°C e incidentes).

## 🧠 Inteligencia Analítica
- [x] Ranking de rutas con mayor cantidad de incidentes (MongoDB + PostgreSQL + Redis - Correlación de incidentes por envío con rutas, nivel de riesgo y caché Redis 1h - Menú CLI opción 15).
- [x] Ranking de clientes por volumen transportado (PostgreSQL - Menú CLI).
- [x] Predicción de atrasos / riesgos (LogisticsService con caché en Redis de 24h).
- [x] Red de relaciones entre clientes, operadores y envíos (Neo4j - Menú CLI).
- [x] Análisis histórico de desempeño (PostgreSQL + MongoDB + Redis - Tiempos promedio/mín/máx de entrega por cliente, puntualidad OTD, costos por transporte, confiabilidad de operadores y auditoría en MongoDB - Menú CLI opción 16).
- [x] Detección de anomalías de temperatura (MongoDB Aggregation Pipeline en CLI).

## 📊 Reportes Operativos y Analíticos
- [ ] Creación de reportes operativos y analíticos parametrizados (facturables).
- [x] Creación de reportes de análisis predictivos (atrasos y riesgos) (LogisticsService / Redis).
- [ ] Creación de reportes de Envíos (país - estado – cliente - demorados - incidentes abiertos).
- [ ] Reporte analítico de Tiempos máximos y mínimos de envío por cliente.
- [ ] Reporte analítico de Promedio de incidentes por país / estado / cliente.
- [ ] Reporte analítico de Tiempos promedio de entrega.
- [ ] Reporte analítico de Costos por tipo de transporte.

## 💬 Comunicación
- [x] Servicio de Mensajería con las partes (MongoDB - Colección mensajes con consulta y envío interactivo por CLI).
