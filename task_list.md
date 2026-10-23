# 🔍 Lo que le falta al programa para cumplir la consigna
> Estado actual analizado al 21/10/2026 — basado en el código fuente del proyecto.

---

## ✅ Lo que ya está implementado (resumen)

- Infraestructura: `docker-compose.yml`, `.env`, `database.js` con conexión a las 4 BDs.
- Scripts DDL de PostgreSQL (todas las tablas) + seed data completo.
- Scripts de inicialización de MongoDB y Neo4j con datos de prueba.
- CRUD completo de **actores/clientes** (crear, listar, obtener, actualizar, eliminar).
- **Facturación y pagos** con transacción ACID (BEGIN/COMMIT/ROLLBACK).
- **Cuentas corrientes** (débito al facturar, crédito al pagar).
- **Ingesta de telemetría IoT** en MongoDB + actualización de caché en Redis.
- **Detección de anomalías de temperatura** via aggregation pipeline en MongoDB.
- **Incidentes automáticos** al superar umbral de temperatura.
- **Eventos logísticos** en MongoDB al crear un envío.
- **Mensajería privada** (enviar y leer mensajes entre dos usuarios).
- **Ruta completa de un envío** vía Neo4j Cypher.
- **Red de relaciones** (clientes-operadores-envíos) vía Neo4j.
- **Caché GPS Redis**: actualización y consulta de posición de contenedores.
- **Caché de predicción de riesgo** con TTL 24h en Redis.
- **Creación políglota de envíos** (PG + Neo4j + MongoDB en un solo flujo).
- **Ranking de clientes por volumen facturado**.
- Menú de consola con 10 opciones + servidor Express (frontend web).

---

## ❌ Lo que falta

### 1. 🔐 Gestión de Usuarios, Roles y Sesiones

La tabla `usuarios`, `roles` e `historial_sesiones` **existen en la BD pero no hay ninguna lógica ni menú que los use**.

- [ ] Implementar **login de usuario** (validar email + contraseña; guardar sesión en Redis con TTL).
- [ ] Implementar **logout** (cerrar sesión de Redis + registrar `fecha_fin` en `historial_sesiones`).
- [ ] Implementar **CRUD de usuarios** (crear, listar, cambiar contraseña, activar/desactivar).
- [ ] Implementar **CRUD de roles** (crear, listar, modificar permisos).
- [ ] Las contraseñas en el seed están en texto plano (`admin123`). Implementar **hash de contraseñas** (bcrypt o similar).
- [ ] Agregar **opción en el menú** para gestionar usuarios, roles y sesiones.

> **Consigna:** *"Administración de usuarios y roles. Gestión de sesiones activas."*

---

### 2. 📦 Gestión de Contenedores y Sensores

La tabla `contenedores` existe, los sensores están en MongoDB, pero no hay menú ni funciones para operarlos.

- [x] Implementar **CRUD de contenedores** (alta, baja lógica, modificar estado, listar).
- [ ] Implementar **CRUD de sensores** (registrar sensor, asociarlo a un contenedor, cambiar estado).
- [ ] Implementar **listado de sensores inactivos** (útil para el proceso periódico).
- [ ] Agregar opción en el menú de consola para gestionar contenedores y sensores.

> **Consigna:** *"Gestión de contenedores. Asociación de sensores a contenedores. Control de estado de sensores."*

---

### 3. 🗺️ Seguimiento de Trayectos (Tramos)

Los tramos se crean dentro del flujo de envío, pero no hay operaciones independientes.

- [ ] Implementar consulta de **seguimiento de estado de un envío** (listar sus tramos con fechas).
- [ ] Implementar **actualización de estado de un envío** (CREADO → EN_TRANSITO → EN_ADUANA → ENTREGADO).
- [ ] Implementar **reconstrucción del recorrido completo de un contenedor** (historial de eventos en MongoDB + posiciones GPS).
- [ ] Agregar opción en el menú para consultar trayectos de un envío.

> **Consigna:** *"Seguimiento de trayectos. Reconstrucción del recorrido de un contenedor."*

---

### 4. 💬 Mensajería Grupal

La mensajería privada está implementada, pero la grupal **no**.

- [ ] Implementar **envío de mensajes a grupos de trabajo** (usar `id_grupo` en la colección `mensajes`).
- [ ] Implementar **listado del historial de un grupo de trabajo** (leer mensajes por `id_grupo`).
- [ ] Implementar **CRUD de grupos de trabajo** (crear grupo, agregar/quitar integrantes).
- [ ] Agregar opción en el menú para mensajería grupal y gestión de grupos.

> **Consigna:** *"Mensajería privada y grupal. Historial de conversaciones."*

---

### 5. 📊 Reportes Faltantes

Solo está implementado el ranking de clientes por volumen. Faltan los demás reportes exigidos.

- [ ] **Reporte operativo:** Envíos por país / estado.
- [ ] **Reporte operativo:** Envíos demorados (fecha estimada superada sin estado ENTREGADO).
- [ ] **Reporte operativo:** Incidentes abiertos (ya existe `listarIncidentesAbiertos` en Mongo, falta el menú).
- [ ] **Reporte analítico:** Tiempos máximos y mínimos de envío por cliente.
- [ ] **Reporte analítico:** Promedio de incidentes por país / cliente.
- [ ] **Reporte analítico:** Tiempos promedio de entrega.
- [ ] **Reporte analítico:** Costos por tipo de transporte.
- [ ] **Consulta avanzada Neo4j:** Ranking de rutas con mayor cantidad de incidentes (cruzar Mongo + Neo4j).
- [ ] Agregar opción de **módulo de reportes** en el menú de consola.

> **Consigna:** *"Reportes Operativos y Analíticos. Solicitud de reportes."*

---

### 6. 🔁 Procesos Periódicos

Ninguno de los 4 procesos periódicos está implementado.

- [ ] **Proceso: generación automática de facturas** (para envíos entregados sin factura).
- [ ] **Proceso: detección de sensores inactivos** (sensores sin lectura en las últimas N horas → actualizar estado en MongoDB).
- [ ] **Proceso: cierre mensual de cuentas corrientes** (generar resumen y resetear período).
- [ ] **Proceso: predicción diaria de riesgos** (calcular para todos los envíos en tránsito y persistir en MongoDB + Redis).

> **Consigna:** *"Procesos Periódicos: Generación automática de facturas. Detección de sensores inactivos. Cierre mensual de cuentas corrientes. Predicción diaria de riesgos."*

---

### 7. 🚨 Gestión de Alertas

Las alertas se crean en el seed de MongoDB pero no hay código que las gestione.

- [ ] Implementar **registrar alerta** automáticamente al generar un incidente (ya se crea incidente, falta crear la alerta asociada en la colección `alertas`).
- [ ] Implementar **consulta de alertas activas** (pendientes / críticas).
- [ ] Implementar **cierre de alerta** (marcar como resuelta).
- [ ] Agregar opción en el menú para ver alertas activas.

> **Consigna:** *"Detectar incidentes y generar alertas automáticas."*

---

### 8. 🔒 Seguridad y Calidad

- [ ] Las contraseñas en el seed de PostgreSQL están en **texto plano** — implementar hashing (bcrypt).
- [ ] No hay **logs** implementados (la consigna exige registro de logs). Agregar un sistema de logging básico (archivo de log o librería como `winston`).
- [ ] No hay **manejo de errores centralizado** estructurado (solo `console.error` en el catch del menú).
- [ ] Faltan **controles de integridad** en los inputs del menú (validar que un ID exista antes de operar).

> **Consigna:** *"Manejo o control de errores. Registro de logs. Controles de integridad."*

---

### 9. 🧪 Casos de Prueba

No hay ningún archivo de tests en el proyecto.

- [ ] Agregar **casos de prueba** para los repositorios (al menos CRUD de clientes, factura + pago, lectura IoT).
- [ ] Agregar **caso de prueba** para el flujo políglota de creación de envío.
- [ ] Agregar **caso de prueba** para la detección de anomalías de temperatura.

> **Consigna:** *"Casos de prueba. Controles de integridad."*

---

### 10. 📄 Entregables de Documentación

- [ ] **Informe técnico** (descripción de arquitectura, decisiones de diseño, dificultades encontradas).
- [ ] Completar la justificación del **Desafío de Complejidad Adicional** respondiendo los 6 puntos de la consigna (sincronización, consistencia, estrategias de resolución).
- [ ] Documentar los **modelos físicos** de las 4 BDs de forma completa (diagrama o descripción formal).

---

## 📋 Resumen por prioridad

| Prioridad | Tarea |
|---|---|
| 🔴 Alta | Login/logout de usuarios + hash de contraseñas |
| 🔴 Alta | CRUD de contenedores y sensores |
| 🔴 Alta | Procesos periódicos (los 4) |
| 🔴 Alta | Módulo de reportes (operativos + analíticos) |
| 🟡 Media | Mensajería grupal y grupos de trabajo |
| 🟡 Media | Gestión de alertas |
| 🟡 Media | Actualización de estado de envíos y seguimiento de trayectos |
| 🟡 Media | Sistema de logs |
| 🟢 Baja | Casos de prueba |
| 🟢 Baja | Documentación e informe técnico |
