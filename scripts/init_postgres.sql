-- =============================================================================
-- ESQUEMA RELACIONAL (POSTGRESQL) - TPO PERSISTENCIA POLÍGLOTA GRUPO 12
-- =============================================================================

CREATE TABLE IF NOT EXISTS actores (
    id_actor SERIAL PRIMARY KEY,
    tipo_actor VARCHAR(20) NOT NULL CHECK (tipo_actor IN ('CLIENTE', 'PROVEEDOR', 'OPERADOR')),
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL,
    telefono VARCHAR(50),
    direccion VARCHAR(255),
    pais VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'ACTIVO',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id_rol SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL,
    nivel_permisos INT DEFAULT 1,
    estado VARCHAR(50) DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_cliente INT REFERENCES actores(id_actor) ON DELETE SET NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    id_rol INT REFERENCES roles(id_rol),
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    estado VARCHAR(50) DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS historial_sesiones (
    id_sesion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    ip_origen VARCHAR(45),
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'CERRADA'
);

CREATE TABLE IF NOT EXISTS contenedores (
    id_contenedor VARCHAR(50) PRIMARY KEY,
    codigo_internacional VARCHAR(100) NOT NULL UNIQUE,
    tipo VARCHAR(50) NOT NULL,
    capacidad NUMERIC(10, 2) NOT NULL,
    estado VARCHAR(50) DEFAULT 'DISPONIBLE'
);

CREATE TABLE IF NOT EXISTS vehiculos (
    id_vehiculo VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    identificacion VARCHAR(100) NOT NULL UNIQUE,
    empresa_operadora VARCHAR(150) NOT NULL,
    estado VARCHAR(50) DEFAULT 'OPERATIVO'
);

CREATE TABLE IF NOT EXISTS cuentas_corrientes (
    id_cuenta SERIAL PRIMARY KEY,
    id_actor INT NOT NULL UNIQUE REFERENCES actores(id_actor) ON DELETE CASCADE,
    saldo NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facturas (
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

CREATE TABLE IF NOT EXISTS pagos (
    id_pago SERIAL PRIMARY KEY,
    id_factura INT NOT NULL REFERENCES facturas(id_factura) ON DELETE CASCADE,
    tipo_pago VARCHAR(20) DEFAULT 'COBRO_CLIENTE' CHECK (tipo_pago IN ('COBRO_CLIENTE', 'PAGO_PROVEEDOR', 'PAGO_OPERADOR')),
    referencia_comprobante VARCHAR(100),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    monto NUMERIC(12, 2) NOT NULL,
    medio_pago VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS cierres_cuentas_corrientes (
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

CREATE TABLE IF NOT EXISTS envios (
    id_envio VARCHAR(50) PRIMARY KEY,
    id_cliente INT NOT NULL REFERENCES actores(id_actor),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega TIMESTAMP,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'CREADO',
    prioridad VARCHAR(20) DEFAULT 'MEDIA'
);

CREATE TABLE IF NOT EXISTS tramos (
    id_tramo VARCHAR(50) PRIMARY KEY,
    id_envio VARCHAR(50) NOT NULL REFERENCES envios(id_envio) ON DELETE CASCADE,
    medio_transporte VARCHAR(50) NOT NULL,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    costo NUMERIC(12, 2) DEFAULT 15000.00,
    fecha_salida TIMESTAMP,
    fecha_llegada_estimada TIMESTAMP
);

-- =============================================================================
-- DATOS SEMILLA (SEED DATA)
-- =============================================================================

INSERT INTO roles (descripcion, nivel_permisos, estado) VALUES
('ADMIN', 10, 'ACTIVO'),
('OPERADOR', 5, 'ACTIVO'),
('CLIENTE', 1, 'ACTIVO')
ON CONFLICT DO NOTHING;

INSERT INTO actores (tipo_actor, razon_social, cuit, email, telefono, direccion, pais) VALUES
('CLIENTE', 'Importadora Andina S.A.', '30-71123456-8', 'contacto@andina.com', '+54 11 4321-8765', 'Av. Córdoba 1234', 'Argentina'),
('CLIENTE', 'Global Traders Ltd', '30-99887766-4', 'ops@globaltraders.com', '+55 11 9876-5432', 'Rua das Flores 45', 'Brasil'),
('OPERADOR', 'Logística Express del Plata', '30-55667788-1', 'transporte@expressplata.com', '+54 11 4987-1234', 'Puerto Nuevo Dársena E', 'Argentina'),
('PROVEEDOR', 'Sensores del Sur Corp', '30-44332211-9', 'ventas@sensoresdelsur.com', '+54 11 5555-0100', 'Parque Industrial Pilar', 'Argentina')
ON CONFLICT DO NOTHING;

INSERT INTO usuarios (id_cliente, nombre, apellido, id_rol, email, password_hash) VALUES
(1, 'Martín', 'Gómez', 1, 'admin@logistica.com', 'admin123'),
(1, 'Lucía', 'Fernández', 3, 'lucia@andina.com', 'lucia123'),
(3, 'Carlos', 'Navarro', 2, 'carlos@expressplata.com', 'carlos123')
ON CONFLICT DO NOTHING;

INSERT INTO cuentas_corrientes (id_actor, saldo) VALUES
(1, 150000.00),
(2, -25000.00),
(3, 0.00),
(4, 80000.00)
ON CONFLICT DO NOTHING;

INSERT INTO contenedores (id_contenedor, codigo_internacional, tipo, capacidad, estado) VALUES
('CONT-001', 'MSCU-908123-1', 'Reefer (Refrigerado)', 28000.00, 'EN_TRANSITO'),
('CONT-002', 'CMAU-554129-4', 'Dry (Carga Seca)', 30480.00, 'DISPONIBLE')
ON CONFLICT DO NOTHING;

INSERT INTO vehiculos (id_vehiculo, tipo, identificacion, empresa_operadora, estado) VALUES
('VEH-TRUCK-01', 'Camión Semirremolque', 'AF-204-ZX', 'Logística Express del Plata', 'OPERATIVO'),
('VEH-SHIP-01', 'Buque Portacontenedores', 'IMO-9481234', 'Maersk Line', 'OPERATIVO')
ON CONFLICT DO NOTHING;

INSERT INTO envios (id_envio, id_cliente, origen, destino, estado, prioridad) VALUES
('ENV-1001', 1, 'Buenos Aires, Argentina', 'San Pablo, Brasil', 'EN_TRANSITO', 'ALTA'),
('ENV-1002', 2, 'Montevideo, Uruguay', 'Santiago, Chile', 'CREADO', 'MEDIA')
ON CONFLICT DO NOTHING;

INSERT INTO tramos (id_tramo, id_envio, medio_transporte, origen, destino, fecha_salida, fecha_llegada_estimada) VALUES
('TR-1001-1', 'ENV-1001', 'Terrestre', 'Buenos Aires', 'Puerto de Santos', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '1 day'),
('TR-1001-2', 'ENV-1001', 'Terrestre', 'Puerto de Santos', 'San Pablo', CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '2 days')
ON CONFLICT DO NOTHING;

INSERT INTO facturas (id_factura, id_cliente, tipo_factura, numero_comprobante, concepto, id_envio, importe_total, estado) VALUES
(1, 1, 'EMITIDA', 'FC-0001-00000001', 'Flete internacional Buenos Aires - San Pablo', 'ENV-1001', 45000.00, 'PAGADA'),
(2, 1, 'EMITIDA', 'FC-0001-00000002', 'Flete complementario aduanero', 'ENV-1001', 62000.00, 'PENDIENTE'),
(3, 3, 'RECIBIDA', 'OP-0001-000451', 'Flete tramo terrestre ENV-1001', 'ENV-1001', 35000.00, 'PENDIENTE'),
(4, 4, 'RECIBIDA', 'PR-0002-000129', 'Lote 10 Sensores IoT modelo SENS-88', NULL, 80000.00, 'PAGADA')
ON CONFLICT DO NOTHING;

INSERT INTO pagos (id_pago, id_factura, tipo_pago, monto, medio_pago, referencia_comprobante) VALUES
(1, 1, 'COBRO_CLIENTE', 45000.00, 'TRANSFERENCIA_BANCARIA', 'TRF-SANT-11029'),
(2, 4, 'PAGO_PROVEEDOR', 80000.00, 'TRANSFERENCIA_BANCARIA', 'TRF-BBVA-99412')
ON CONFLICT DO NOTHING;

