# TPO Persistencia Políglota - Grupo 12

**Ingeniería de Datos II - UADE**

Aplicación de consola para la gestión de logística internacional, envíos y
monitoreo de cargas con sensores IoT. El sistema combina cuatro paradigmas de
persistencia:

- **PostgreSQL:** actores (clientes, proveedores y operadores), usuarios,
  roles, sesiones, contenedores, envíos, facturación, pagos y cuentas
  corrientes.
- **MongoDB:** sensores, lecturas de telemetría, eventos, incidentes, alertas,
  mensajes y reportes.
- **Neo4j:** rutas, tramos, relaciones entre actores y consultas sobre la red
  logística.
- **Redis:** sesiones con TTL, últimas posiciones GPS, predicciones de riesgo
  y cachés analíticas.

## Requisitos

- Docker Desktop y Docker Compose.
- Node.js 18 o superior.

## Instalación y puesta en marcha

Ejecutá los siguientes comandos desde la raíz del proyecto:

```bash
docker compose up -d
npm install
npm run seed
npm start
```

`npm start` verifica las conexiones, solicita autenticación y abre el menú
principal de la aplicación.

### Reinicializar las bases de datos

Si PostgreSQL fue creado con un esquema incompatible, recreá los volúmenes y
volvé a ejecutar la puesta en marcha. Esta operación elimina los datos
persistidos:

```bash
docker compose down -v
docker compose up -d
npm run seed
```

El seed unificado:

- aplica el esquema y los datos base de PostgreSQL;
- recrea las colecciones y los datos base de MongoDB;
- borra y recrea el grafo de Neo4j;
- carga en Redis las últimas posiciones GPS iniciales.

Para MongoDB, `npm run seed` usa `mongosh` instalado en el equipo o, si no está
disponible, lo ejecuta dentro del contenedor `tpo_mongo`. Neo4j se inicializa
con el driver de Node.js. Ambos servicios pueden tardar unos segundos en estar
listos; el script reintenta las conexiones automáticamente.

## Acceso inicial

El seed de PostgreSQL crea el usuario administrador:

```text
Email: admin@logistica.com
Contraseña: admin123
```

El usuario administrador puede acceder al módulo de usuarios, roles y
sesiones. La aplicación permite tres intentos de autenticación y registra la
sesión con un TTL de una hora en Redis. Desde el menú también se puede cerrar
la sesión actual y volver a autenticarse.

## Menú principal

Luego de iniciar sesión, están disponibles:

1. Gestión de clientes, proveedores y operadores.
2. ABM de contenedores.
3. Gestión comercial y financiera: facturas, pagos, cuentas corrientes,
   cierres mensuales y facturación automática.
4. Telemetría IoT: sensores, lecturas y consultas de telemetría.
5. Histórico de lecturas y detección de anomalías.
6. Gestión de incidentes y alertas.
7. Mensajería y chat.
8. Consulta de la ruta completa de un envío.
9. Consulta de la red de relaciones.
10. Consulta de la última posición GPS en caché.
11. ABM y gestión de estados de envíos.
12. Cálculo y consulta de predicciones de riesgo.
13. Ranking de clientes.
14. Reportes operativos y analíticos.
15. Ranking de rutas con mayor cantidad de incidentes.
16. Análisis histórico de desempeño.
17. ABM de usuarios, roles y sesiones (solo para administradores).
18. Cierre de sesión y nueva autenticación.

## Configuración

La aplicación carga variables opcionales desde `.env`. Si no se especifican,
usa los valores locales definidos en `src/config/database.js`:

| Variable | Valor predeterminado |
| --- | --- |
| `PG_HOST` | `localhost` |
| `PG_PORT` | `5432` |
| `PG_USER` | `admin` |
| `PG_PASSWORD` | `password123` |
| `PG_DATABASE` | `tpo_logistica` |
| `MONGO_DB_NAME` | `tpo_telemetria` |
| `NEO4J_URI` | `bolt://localhost:7687` |
| `NEO4J_USER` | `neo4j` |
| `NEO4J_PASSWORD` | `password123` |
| `REDIS_URL` | `redis://localhost:6379` |

Las credenciales anteriores coinciden con `docker-compose.yml`. Para un
entorno distinto, definí las variables correspondientes antes de ejecutar la
aplicación o el seed.

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia la aplicación interactiva. |
| `npm run cli` | Alias de `npm start`. |
| `npm run seed` | Inicializa o actualiza los datos semilla de las bases. |

## Estructura del proyecto

```text
.
├── docker-compose.yml
├── package.json
├── scripts/
│   ├── init_postgres.sql
│   ├── init_mongo.js
│   ├── init_neo4j.cypher
│   └── seed_all.js
└── src/
    ├── index.js
    ├── config/
    │   └── database.js
    ├── cli/
    │   ├── mainMenu.js
    │   ├── authCli.js
    │   └── *Handlers.js
    ├── repositories/
    │   └── Repositorios para PostgreSQL, MongoDB, Neo4j y Redis
    ├── services/
    │   └── Servicios de negocio, asignación, analítica y riesgo
    └── utils/
        └── validation.js
```

Las conexiones se inicializan en `src/config/database.js`; `src/index.js`
coordina el arranque, la autenticación, el menú y el cierre ordenado de los
recursos.
