# TPO Persistencia Políglota - Grupo 12
**Ingeniería de Datos II - UADE**

Plataforma integral de gestión logística internacional y monitoreo de cargas inteligentes con dispositivos IoT utilizando cuatro paradigmas de bases de datos:
1. **Relacional:** PostgreSQL (Clientes, Contenedores, Facturación, Pagos, Cuentas Corrientes).
2. **Documental:** MongoDB (Telemetría de Sensores IoT, Eventos, Incidentes, Alertas, Chat).
3. **Grafos:** Neo4j (Rutas, Envíos, Tramos, Redes entre Clientes y Operadores).
4. **Clave-Valor:** Redis (Caché de última ubicación GPS, Sesiones con TTL, Predicción de Riesgo).

---

## 🚀 Requisitos Previos

1. **Docker Desktop** (para levantar los 4 motores de bases de datos).
2. **Node.js** (v18 o superior).

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Iniciar los contenedores de las bases de datos
Abre una terminal en la raíz del proyecto y ejecuta:
```bash
docker compose up -d
```
Esto descargará y levantará:
- PostgreSQL en el puerto `5432`
- MongoDB en el puerto `27017`
- Neo4j en los puertos `7474` (HTTP) y `7687` (Bolt)
- Redis en el puerto `6379`

### 2. Poblar datos iniciales (opcional si es primera vez)
```bash
npm run seed
```

### 3. Instalar dependencias del proyecto
```bash
npm install
```

### 4. Iniciar la Aplicación por Consola (Menú Interactivo CLI)
```bash
npm start
```

---

## 📂 Estructura del Proyecto

```text
├── docker-compose.yml           # Definición de PostgreSQL, Mongo, Neo4j y Redis
├── package.json                 # Dependencias (pg, mongodb, neo4j-driver, redis)
├── .env                         # Variables de entorno y cadenas de conexión
├── scripts/
│   ├── init_postgres.sql        # Esquema DDL y datos de prueba SQL
│   ├── init_mongo.js            # Colecciones e índices para MongoDB
│   ├── init_neo4j.cypher        # Creación de grafos y relaciones en Neo4j
│   └── seed_all.js              # Inicialización unificada de datos
└── src/
    ├── config/
    │   └── database.js          # Conexiones centralizadas a los 4 motores
    ├── repositories/
    │   ├── postgresRepository.js# CRUD Clientes, Contenedores, Facturación, CC
    │   ├── mongoRepository.js   # Ingesta IoT, anomalías, incidentes y chat
    │   ├── neo4jRepository.js   # Trazabilidad de rutas y red de transporte
    │   └── redisRepository.js   # Sesiones TTL, última posición GPS y caché
    ├── services/
    │   └── logisticsService.js  # Lógica de sincronización políglota
    └── index.js                 # Aplicación interactiva por consola (Menú Principal)
```
