# Ingeniería de Datos II - Trabajo Practico (Persistencia Poliglota)

**Objetivo:** Construir una plataforma integral de gestión de logística internacional y monitoreo de cargas inteligentes, destinada al seguimiento de envíos terrestres, marítimos y aéreos mediante dispositivos IoT.

La solución deberá permitir:
- Gestionar clientes, operadores logísticos y proveedores (CRUD).
- Registrar envíos y sus trayectos.
- Monitorear sensores instalados en contenedores.
- Detectar incidentes y generar alertas automáticas.
- Gestionar comunicaciones entre los actores involucrados (chat privado / publico).
- Generar reportes operativos y analíticos parametrizados.
- Administrar facturación, pagos y cuentas corrientes de los clientes, proveedores y operadores logísticos.
- Mantener trazabilidad y seguimiento completo de eventos logísticos.
- Proporcionar análisis predictivos sobre atrasos y riesgos.

## Se pide

### 1. Persistencia Políglota
Definir y justificar la utilización de distintos motores de bases de datos. Para cada elección se deberá indicar:
- Tipo de base de datos.
- Casos de uso.
- Ventajas.
- Desventajas.
- Justificación técnica.

Utilizar al menos tres paradigmas distintos de base de datos para desarrollar la solución entre los que se detallan a continuación:
- Relacional.
- Documental.
- Objetos.
- Clave-Valor
- Grafos.
- Tabular.

### 2. Modelado
Diseñar los modelos físicos necesarios para cada tecnología utilizada, debiendo entregar para cada uno:
- Modelo físico.
- Relaciones.
- Índices.
- Restricciones.
- Estrategias de particionamiento cuando corresponda.

### 3. Desarrollo de la Aplicación
Implementar una aplicación funcional que permita la operación completa del negocio, con todas las características y condiciones solicitadas a lo largo del enunciado.
*Importante:* Se pide la implementación de una aplicación, no de una API Rest o página web, etc. La misma puede ser desarrollada en Java o en Python a gusto del alumno, aplicando los patrones y buenas practicas vistas en la carrera y la materia.

## Principales Entidades

**Cliente**
- ID Cliente
- Razón Social
- CUIT
- Email
- Teléfono
- Dirección
- País
- Estado
- Fecha de registro

**Usuario**
- ID Usuario
- Cliente
- Nombre
- Apellido
- Rol
- Email
- Contraseña encriptada
- Estado
- Sesión

**Rol**
- ID Rol
- Descripción
- Nivel de permisos
- Estado

**Sesión**
- ID Sesión
- Usuario
- Fecha inicio
- Fecha fin
- Estado

**Contenedor**
- ID Contenedor
- Código internacional
- Tipo
- Capacidad
- Estado

**SensorIoT**
- ID Sensor
- Tipo
- Fabricante
- Fecha de instalación
- Estado
- Contenedor asociado

**LecturaSensor**
- ID Lectura
- Sensor
- Fecha y hora
- Temperatura
- Humedad
- Vibración
- Posición GPS
- Nivel de batería

**Envío**
- ID Envío
- Cliente
- Fecha de creación
- Origen
- Destino
- Estado
- Prioridad

**Tramo**
- ID Tramo
- Envío
- Medio de transporte
- Origen
- Destino
- Fecha de salida
- Fecha de llegada estimada

**Vehículo**
- ID Vehículo
- Tipo
- Identificación
- Empresa operadora
- Estado

**Evento Logístico**
- ID Evento
- Envío
- Fecha y hora
- Tipo de evento (Ej: Carga iniciada, En tránsito, Aduana, Retraso, Descarga, Entregado)
- Ubicación
- Descripción

**Incidente**
- ID Incidente
- Envío
- Tipo
- Severidad
- Estado
- Descripción
- Fecha

**Alerta**
- ID Alerta
- Sensor
- Evento
- Mensaje
- Tipo
- Fecha
- Estado

**Mensaje**
- ID Mensaje
- Remitente
- Destinatario
- Contenido
- Tipo
- Formato
- Estado

**Grupo DeTrabajo**
- ID Grupo
- Nombre
- Integrantes

**Reporte**
- ID Reporte
- Usuario
- Tipo
- Fecha y hora
- Fecha de generación

**Factura**
- ID Factura
- Cliente
- Fecha de emisión
- Importe total
- Estado

**Pago**
- ID Pago
- Factura
- Fecha
- Monto
- Medio de pago

**Cuenta Corriente**
- ID Cuenta
- Cliente
- Saldo
- Fecha de actualización

**Predicción de Riesgo**
- ID Predicción
- Envío
- Riesgo climático
- Riesgo operativo
- Fecha de cálculo
- Probabilidad de demora

*(De ser necesario puede agregar mas propiedades a cada entidad descripta anteriormente, justificando su inclusión. Si lo considera necesario puede agregar mas entidades a esta modelo).*

## Requisitos Funcionales

**Gestión Operativa:**
- Alta, baja y modificación de clientes.
- Administración de usuarios y roles.
- Gestión de sesiones activas.
- Gestión de contenedores.
- Asociación de sensores a contenedores.
- Registro de envíos.
- Seguimiento de trayectos.

**Monitoreo:**
- Registro continuo de lecturas IoT.
- Consulta histórica de lecturas.
- Visualización geográfica de posiciones GPS.
- Control de estado de sensores.

**Trazabilidad:**
- Historial completo de eventos.
- Seguimiento temporal de cada envío.
- Reconstrucción del recorrido de un contenedor.

**Comunicación:**
- Mensajería privada y grupal.
- Historial de conversaciones.

**Gestión Comercial:**
- Solicitud de reportes.
- Facturación automática.
- Registro de pagos.
- Gestión de cuentas corrientes.

**Inteligencia Analítica:**
- Ranking de rutas con mayor cantidad de incidentes.
- Ranking de clientes por volumen transportado.
- Predicción de atrasos.
- Análisis histórico de desempeño.
- Detección de anomalías de temperatura.

## Procesos a Implementar:

**Reportes Operativos:**
- Envíos por país / estado / cliente.
- Envíos demorados.
- Incidentes abiertos.

**Reportes Analíticos:**
- Tiempos máximos y mínimos de envío por cliente.
- Promedio de incidentes por país / estado / cliente.
- Tiempos promedio de entrega.
- Costos por tipo de transporte.

**Consultas Avanzadas:**
- Ruta completa de un envío.
- Red de relaciones entre clientes, operadores y envíos.
- Historial completo de movimientos de un contenedor.

**Procesos Periódicos:**
- Generación automática de facturas.
- Detección de sensores inactivos.
- Cierre mensual de cuentas corrientes.
- Predicción diaria de riesgos.

## Desafío de Complejidad Adicional
Cada grupo deberá justificar específicamente:
1. Qué información almacenarían en una base relacional.
2. Qué información almacenarían en una base documental.
3. Qué información almacenarían en una base de grafos.
4. Cómo sincronizarían los datos entre las distintas bases.
5. Qué problemas de consistencia pueden aparecer.
6. Qué estrategias implementarían para resolverlos.

## Restricciones Técnicas
**Arquitectura:**
- Separación por capas.
- Patrones y buenas prácticas.
- Manejo o control de errores.
- Registro de logs.

**Calidad:**
- Casos de prueba.
- Datos de prueba.
- Controles de integridad.
- Documentación técnica.

## Entregables
1. Informe técnico.
2. Justificación de persistencia políglota.
3. Modelos físicos de todas las bases utilizadas.
4. Scripts de creación de bases de datos.
5. Código fuente completo.