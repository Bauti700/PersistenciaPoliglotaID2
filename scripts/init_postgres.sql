-- =============================================================================
-- ESQUEMA RELACIONAL (POSTGRESQL) - TPO PERSISTENCIA POLÍGLOTA GRUPO 12
-- =============================================================================

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente SERIAL PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL,
    telefono VARCHAR(50),
    direccion VARCHAR(255),
    pais VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'ACTIVO',
    saldo NUMERIC(12, 2) DEFAULT 0.00,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL,
    telefono VARCHAR(50),
    direccion VARCHAR(255),
    pais VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'ACTIVO',
    saldo NUMERIC(12, 2) DEFAULT 0.00,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operadores (
    id_operador SERIAL PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    cuit VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL,
    telefono VARCHAR(50),
    direccion VARCHAR(255),
    pais VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'ACTIVO',
    saldo NUMERIC(12, 2) DEFAULT 0.00,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id_rol SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL,
    nivel_permisos INT DEFAULT 1,
    estado VARCHAR(50) DEFAULT 'ACTIVO',
    permisos JSONB DEFAULT '{}'::jsonb,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_cliente INT REFERENCES clientes(id_cliente) ON DELETE SET NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    id_rol INT REFERENCES roles(id_rol),
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    estado VARCHAR(50) DEFAULT 'ACTIVO',
    fecha_ultimo_acceso TIMESTAMP,
    sesion_activa BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS historial_sesiones (
    id_sesion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_rol INT REFERENCES roles(id_rol) ON DELETE SET NULL,
    token VARCHAR(64),
    ip_origen VARCHAR(45),
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    fecha_ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'CERRADA'
);

-- Compatibilidad con bases creadas antes de incorporar seguridad e historial.
ALTER TABLE roles ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '{}'::jsonb;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_ultimo_acceso TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_activa BOOLEAN DEFAULT FALSE;
ALTER TABLE historial_sesiones ADD COLUMN IF NOT EXISTS id_rol INT REFERENCES roles(id_rol) ON DELETE SET NULL;
ALTER TABLE historial_sesiones ADD COLUMN IF NOT EXISTS token VARCHAR(64);
ALTER TABLE historial_sesiones ADD COLUMN IF NOT EXISTS fecha_ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS uq_historial_sesiones_token
    ON historial_sesiones (token)
    WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_historial_sesiones_usuario_estado
    ON historial_sesiones (id_usuario, estado);

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

-- La identidad de un actor es (tipo_actor, id_actor): clientes, proveedores y
-- operadores tienen secuencias independientes, por lo que el mismo ID puede
-- repetirse entre tablas y siempre debe acompañarse del tipo.
CREATE TABLE IF NOT EXISTS cuentas_corrientes (
    id_cuenta SERIAL PRIMARY KEY,
    id_actor INT NOT NULL,
    tipo_actor VARCHAR(20) NOT NULL DEFAULT 'CLIENTE' CHECK (tipo_actor IN ('CLIENTE', 'PROVEEDOR', 'OPERADOR')),
    saldo NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cuenta_corriente_actor UNIQUE (tipo_actor, id_actor)
);

CREATE TABLE IF NOT EXISTS facturas (
    id_factura SERIAL PRIMARY KEY,
    -- ID del actor emisor/receptor (cliente, proveedor u operador).
    -- Se combina siempre con tipo_actor para resolver la identidad.
    id_cliente INT NOT NULL,
    tipo_factura VARCHAR(20) DEFAULT 'EMITIDA' CHECK (tipo_factura IN ('EMITIDA', 'RECIBIDA')),
    tipo_actor VARCHAR(20) NOT NULL DEFAULT 'CLIENTE' CHECK (tipo_actor IN ('CLIENTE', 'PROVEEDOR', 'OPERADOR')),
    numero_comprobante VARCHAR(50),
    concepto VARCHAR(255),
    id_envio VARCHAR(50),
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    importe_total NUMERIC(12, 2) NOT NULL CONSTRAINT chk_facturas_importe_positivo CHECK (importe_total > 0),
    estado VARCHAR(50) DEFAULT 'PENDIENTE' CONSTRAINT chk_facturas_estado CHECK (estado IN ('PENDIENTE', 'PAGADA', 'ANULADA')),
    CONSTRAINT chk_factura_emitida_cliente CHECK (tipo_factura <> 'EMITIDA' OR tipo_actor = 'CLIENTE')
);

CREATE INDEX IF NOT EXISTS idx_facturas_actor ON facturas (tipo_actor, id_cliente);
CREATE INDEX IF NOT EXISTS idx_facturas_envio ON facturas (id_envio);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas (fecha_emision);
CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_comprobante
    ON facturas (tipo_actor, tipo_factura, numero_comprobante)
    WHERE numero_comprobante IS NOT NULL;

CREATE TABLE IF NOT EXISTS pagos (
    id_pago SERIAL PRIMARY KEY,
    id_factura INT NOT NULL REFERENCES facturas(id_factura) ON DELETE CASCADE,
    tipo_pago VARCHAR(20) DEFAULT 'COBRO_CLIENTE' CHECK (tipo_pago IN ('COBRO_CLIENTE', 'PAGO_PROVEEDOR', 'PAGO_OPERADOR')),
    referencia_comprobante VARCHAR(100),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    monto NUMERIC(12, 2) NOT NULL CONSTRAINT chk_pagos_monto_positivo CHECK (monto > 0),
    medio_pago VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pagos_factura ON pagos (id_factura);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos (fecha);

CREATE TABLE IF NOT EXISTS cierres_cuentas_corrientes (
    id_cierre SERIAL PRIMARY KEY,
    periodo VARCHAR(7) NOT NULL,
    id_actor INT NOT NULL,
    tipo_actor VARCHAR(20) NOT NULL DEFAULT 'CLIENTE' CHECK (tipo_actor IN ('CLIENTE', 'PROVEEDOR', 'OPERADOR')),
    saldo_inicial NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_debe NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_haber NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    saldo_final NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fecha_cierre TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'CERRADO',
    CONSTRAINT uq_cierre_actor_periodo UNIQUE (periodo, tipo_actor, id_actor)
);

CREATE TABLE IF NOT EXISTS envios (
    id_envio VARCHAR(50) PRIMARY KEY,
    id_cliente INT NOT NULL REFERENCES clientes(id_cliente),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega TIMESTAMP,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    estado VARCHAR(50) DEFAULT 'CREADO',
    prioridad VARCHAR(20) DEFAULT 'MEDIA'
);

-- Composición del envío: todo envío se compone de contenedores enteros.
-- La fecha_liberacion permite conservar el histórico y, a la vez, garantizar
-- con un índice parcial que un contenedor no esté activo en dos envíos.
CREATE TABLE IF NOT EXISTS envio_contenedores (
    id_envio VARCHAR(50) NOT NULL REFERENCES envios(id_envio) ON DELETE CASCADE,
    id_contenedor VARCHAR(50) NOT NULL REFERENCES contenedores(id_contenedor) ON DELETE CASCADE,
    fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_liberacion TIMESTAMP,
    PRIMARY KEY (id_envio, id_contenedor)
);

CREATE INDEX IF NOT EXISTS idx_envio_contenedores_envio
    ON envio_contenedores (id_envio);
CREATE UNIQUE INDEX IF NOT EXISTS uq_envio_contenedor_activo
    ON envio_contenedores (id_contenedor)
    WHERE fecha_liberacion IS NULL;

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

INSERT INTO roles (descripcion, nivel_permisos, estado, permisos)
SELECT v.descripcion, v.nivel_permisos, v.estado, v.permisos::jsonb
FROM (VALUES
  ('ADMIN',    10, 'ACTIVO', '{"admin":true,"seguridad":true,"usuarios":true,"roles":true,"sesiones":true,"envios":true,"alertas":true,"finanzas":true}'),
  ('USUARIO',   1, 'ACTIVO', '{}')
) AS v(descripcion, nivel_permisos, estado, permisos)
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.descripcion = v.descripcion
);

-- Solo se admiten los roles administrativos y de usuario. Se eliminan los
-- roles restantes que no tengan usuarios asignados (si los tuvieran, la FK
-- impediría el borrado y se conservan para no romper usuarios existentes).
DELETE FROM roles r
WHERE UPPER(r.descripcion) NOT IN ('ADMIN', 'ADMINISTRADOR', 'USUARIO')
  AND NOT EXISTS (
    SELECT 1 FROM usuarios u WHERE u.id_rol = r.id_rol
  );

-- Garantiza que el rol ADMIN conserve todos los permisos aunque ya existiera.
UPDATE roles
SET permisos = '{"admin":true,"seguridad":true,"usuarios":true,"roles":true,"sesiones":true,"envios":true,"alertas":true,"finanzas":true}'::jsonb
WHERE UPPER(descripcion) IN ('ADMIN', 'ADMINISTRADOR');

INSERT INTO clientes (id_cliente, razon_social, cuit, email, telefono, direccion, pais, saldo) VALUES
(1, 'Importadora Andina S.A.', '30-71123456-8', 'contacto@andina.com', '+54 11 4321-8765', 'Av. Córdoba 1234', 'Argentina', 150000.00),
(2, 'Global Traders Ltd', '30-99887766-4', 'ops@globaltraders.com', '+55 11 9876-5432', 'Rua das Flores 45', 'Brasil', -25000.00),
(3, 'Andes Pharma S.A.', '30-66778899-5', 'logistica@andespharma.com', '+54 261 445-8899', 'Av. San Martín 850', 'Argentina', 0.00),
(4, 'Pacific Imports SpA', '76-12345678-9', 'operaciones@pacificimports.cl', '+56 2 2345-6789', 'Av. Providencia 2200', 'Chile', 0.00)
ON CONFLICT (cuit) DO NOTHING;

INSERT INTO operadores (id_operador, razon_social, cuit, email, telefono, direccion, pais, saldo) VALUES
(1, 'Logística Express del Plata', '30-55667788-1', 'transporte@expressplata.com', '+54 11 4987-1234', 'Puerto Nuevo Dársena E', 'Argentina', 0.00)
ON CONFLICT (cuit) DO UPDATE SET razon_social = EXCLUDED.razon_social;

INSERT INTO proveedores (id_proveedor, razon_social, cuit, email, telefono, direccion, pais, saldo) VALUES
(1, 'Sensores del Sur Corp', '30-44332211-9', 'ventas@sensoresdelsur.com', '+54 11 5555-0100', 'Parque Industrial Pilar', 'Argentina', 80000.00)
ON CONFLICT (cuit) DO NOTHING;

INSERT INTO proveedores (razon_social, cuit, email, telefono, direccion, pais, estado, saldo, fecha_registro) VALUES
('Naviera del Atlántico Sur S.A.', '30-71234567-1', 'operaciones@atlanticosur.com', '+54 11 5278-4100', 'Av. Alicia Moreau de Justo 550, Buenos Aires', 'Argentina', 'ACTIVO', 125000.00, CURRENT_TIMESTAMP - INTERVAL '11 months'),
('Brasil Cargo Aéreo Ltda.', '30-76543210-9', 'cargas@brasilcargo.com.br', '+55 11 2445-7800', 'Rodovia Hélio Smidt, s/n, Guarulhos, São Paulo', 'Brasil', 'ACTIVO', 0.00, CURRENT_TIMESTAMP - INTERVAL '9 months'),
('Agencia Aduanera Pacífico SpA', '30-90123456-2', 'contacto@aduanaspacifico.cl', '+56 32 221-6400', 'Av. Errázuriz 1054, Valparaíso', 'Chile', 'ACTIVO', 48750.00, CURRENT_TIMESTAMP - INTERVAL '7 months'),
('Transportes Terrestres del Uruguay S.A.', '30-45678901-9', 'trafico@tturuguay.com.uy', '+598 2 601-4820', 'Camino Bajo de la Petisa 4890, Montevideo', 'Uruguay', 'ACTIVO', 215000.00, CURRENT_TIMESTAMP - INTERVAL '5 months'),
('Shanghai East Gate Logistics Co.', '30-34567890-1', 'warehouse@eastgatelogistics.cn', '+86 21 5868 2470', 'No. 88 Waigaoqiao Free Trade Zone, Pudong, Shanghai', 'China', 'ACTIVO', 0.00, CURRENT_TIMESTAMP - INTERVAL '3 months'),
('Miami Gateway Port Services LLC', '30-23456789-2', 'service@miamigatewayport.com', '+1 305 555 0186', '1015 North America Way, Miami, Florida', 'Estados Unidos', 'ACTIVO', 390000.00, CURRENT_TIMESTAMP - INTERVAL '2 months'),
('Almacenes y Carga Ibérica S.L.', '30-87654321-0', 'logistica@cargaiberica.es', '+34 96 367 4280', 'Calle del Muelle de la Aduana 7, Valencia', 'España', 'ACTIVO', 67250.00, CURRENT_TIMESTAMP - INTERVAL '1 month')
ON CONFLICT (cuit) DO NOTHING;

-- Contraseñas hasheadas con bcrypt (cost=10) y distintas para cada usuario:
--   admin@logistica.com          -> admin123  (Rol: ADMIN)
--   juan.perez@logistica.com     -> juan123   (Rol: USUARIO)
--   maria.gonzalez@logistica.com -> maria123  (Rol: USUARIO)
--   carlos.lopez@logistica.com   -> carlos123 (Rol: USUARIO)
INSERT INTO usuarios (id_cliente, nombre, apellido, id_rol, email, password_hash, estado)
SELECT 1,    'Martín',  'Gómez',     (SELECT id_rol FROM roles WHERE descripcion = 'ADMIN' LIMIT 1),    'admin@logistica.com',          '$2a$10$0kEZBXs0SW9ae95Vt8eP/.lJpa4P1NCmN.7G4WweO6uPvMG8CvSzq', 'ACTIVO'
UNION ALL
SELECT NULL, 'Juan',    'Pérez',     (SELECT id_rol FROM roles WHERE descripcion = 'USUARIO' LIMIT 1),  'juan.perez@logistica.com',     '$2a$10$XhFtHGkNyxXCJIEpKrdQv.jrkgsMx5YHXcyH6CR4Lac0ExmmeXl4q', 'ACTIVO'
UNION ALL
SELECT NULL, 'María',   'González',  (SELECT id_rol FROM roles WHERE descripcion = 'USUARIO' LIMIT 1),  'maria.gonzalez@logistica.com', '$2a$10$GO0cJCxVTIYoHsflS5eUfOQVojQA/TxzsA5vLLUX3Ok1X6MlvyoOm', 'ACTIVO'
UNION ALL
SELECT NULL, 'Carlos',  'López',     (SELECT id_rol FROM roles WHERE descripcion = 'USUARIO' LIMIT 1),  'carlos.lopez@logistica.com',   '$2a$10$Emh9.PoIl59Din8sywPp1.CEclhzFXUMw45htSxHcU.t4ZRqKdepa', 'ACTIVO'
ON CONFLICT (email) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    apellido = EXCLUDED.apellido,
    id_rol = EXCLUDED.id_rol,
    password_hash = EXCLUDED.password_hash,
    estado = EXCLUDED.estado;

-- Saldos de arrastre coherentes con las facturas y pagos semilla:
--   CLIENTE 1:  -62.000 (factura EMITIDA pendiente)
--   CLIENTE 2:  -25.000 (saldo de arrastre sin movimientos semilla)
--   OPERADOR 1:  35.000 (factura RECIBIDA pendiente)
--   PROVEEDOR 1:      0 (factura RECIBIDA ya pagada)
-- Los actores se resuelven por CUIT para que el seed funcione también sobre
-- volúmenes creados con versiones anteriores, donde los IDs pueden no ser 1.
-- Se descartan cuentas huérfanas de seeds previos antes de recrear las válidas.
DELETE FROM cuentas_corrientes cc
WHERE NOT EXISTS (
    SELECT 1 FROM clientes c
    WHERE cc.tipo_actor = 'CLIENTE' AND c.id_cliente = cc.id_actor
)
AND NOT EXISTS (
    SELECT 1 FROM proveedores p
    WHERE cc.tipo_actor = 'PROVEEDOR' AND p.id_proveedor = cc.id_actor
)
AND NOT EXISTS (
    SELECT 1 FROM operadores o
    WHERE cc.tipo_actor = 'OPERADOR' AND o.id_operador = cc.id_actor
);

INSERT INTO cuentas_corrientes (id_actor, tipo_actor, saldo)
SELECT c.id_cliente, 'CLIENTE', v.saldo
FROM (VALUES
    ('30-71123456-8', -62000.00),
    ('30-99887766-4', -25000.00)
) AS v(cuit, saldo)
JOIN clientes c ON c.cuit = v.cuit
UNION ALL
SELECT o.id_operador, 'OPERADOR', 35000.00
FROM operadores o
WHERE o.cuit = '30-55667788-1'
UNION ALL
SELECT p.id_proveedor, 'PROVEEDOR', 0.00
FROM proveedores p
WHERE p.cuit = '30-44332211-9'
ON CONFLICT (tipo_actor, id_actor) DO NOTHING;

-- Completar la cuenta corriente de cualquier actor que no la tenga.
INSERT INTO cuentas_corrientes (id_actor, tipo_actor, saldo)
SELECT id_cliente, 'CLIENTE', 0.00 FROM clientes
UNION ALL
SELECT id_proveedor, 'PROVEEDOR', 0.00 FROM proveedores
UNION ALL
SELECT id_operador, 'OPERADOR', 0.00 FROM operadores
ON CONFLICT (tipo_actor, id_actor) DO NOTHING;

INSERT INTO contenedores (id_contenedor, codigo_internacional, tipo, capacidad, estado) VALUES
('CONT-001', 'MSCU-908123-1', 'Reefer (Refrigerado)', 28000.00, 'EN_TRANSITO'),
('CONT-002', 'CMAU-554129-4', 'Dry (Carga Seca)', 30480.00, 'EN_TRANSITO'),
('CONT-003', 'TCNU-771204-9', 'Dry (Carga Seca)', 28000.00, 'DISPONIBLE'),
('CONT-004', 'HLXU-332087-2', 'Open Top', 27500.00, 'DISPONIBLE'),
('CONT-005', 'SUDU-118452-0', 'Reefer (Refrigerado)', 26000.00, 'EN_TRANSITO'),
('CONT-006', 'OOLU-445566-7', 'Reefer (Refrigerado)', 27000.00, 'EN_TRANSITO'),
('CONT-007', 'MSCU-778899-3', 'Dry (Carga Seca)', 30000.00, 'EN_TRANSITO'),
('CONT-008', 'TGHU-112233-5', 'Open Top', 25000.00, 'DISPONIBLE')
ON CONFLICT DO NOTHING;

INSERT INTO vehiculos (id_vehiculo, tipo, identificacion, empresa_operadora, estado) VALUES
('VEH-TRUCK-01', 'Camión Semirremolque', 'AF-204-ZX', 'Logística Express del Plata', 'OPERATIVO'),
('VEH-SHIP-01', 'Buque Portacontenedores', 'IMO-9481234', 'Maersk Line', 'OPERATIVO')
ON CONFLICT DO NOTHING;

INSERT INTO envios (id_envio, id_cliente, origen, destino, estado, prioridad, fecha_creacion, fecha_entrega) VALUES
('ENV-1001', 1, 'Buenos Aires, Argentina', 'San Pablo, Brasil', 'EN_TRANSITO', 'ALTA', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL),
('ENV-1002', 2, 'Montevideo, Uruguay', 'Santiago, Chile', 'CREADO', 'MEDIA', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL),
('ENV-1003', 1, 'Buenos Aires, Argentina', 'Santiago, Chile', 'ENTREGADO', 'ALTA', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '7 days'),
('ENV-1004', 2, 'San Pablo, Brasil', 'Montevideo, Uruguay', 'ENTREGADO', 'MEDIA', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '9 days'),
('ENV-1005', 1, 'Buenos Aires, Argentina', 'San Pablo, Brasil', 'EN_TRANSITO', 'ALTA', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL),
('ENV-1006', 3, 'Mendoza, Argentina', 'Lima, Perú', 'EN_TRANSITO', 'ALTA', CURRENT_TIMESTAMP - INTERVAL '3 days', NULL),
('ENV-1007', 4, 'Valparaíso, Chile', 'Buenos Aires, Argentina', 'CREADO', 'BAJA', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL),
('ENV-1008', 2, 'San Pablo, Brasil', 'Asunción, Paraguay', 'ENTREGADO', 'MEDIA', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT DO NOTHING;

-- Cada envío semilla queda compuesto por al menos un contenedor entero.
-- Los envíos entregados conservan la relación como histórico, pero con fecha de
-- liberación para que el contenedor pueda volver a utilizarse.
INSERT INTO envio_contenedores (id_envio, id_contenedor, fecha_asignacion, fecha_liberacion) VALUES
('ENV-1001', 'CONT-001', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL),
('ENV-1002', 'CONT-002', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL),
('ENV-1003', 'CONT-003', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '7 days'),
('ENV-1004', 'CONT-004', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '9 days'),
('ENV-1005', 'CONT-005', CURRENT_TIMESTAMP - INTERVAL '2 days', NULL),
('ENV-1006', 'CONT-006', CURRENT_TIMESTAMP - INTERVAL '3 days', NULL),
('ENV-1007', 'CONT-007', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL),
('ENV-1008', 'CONT-008', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT DO NOTHING;

-- Mantiene coherente el estado del contenedor con su composición activa incluso
-- si el seed se vuelve a ejecutar sobre una base existente.
UPDATE contenedores c
SET estado = 'EN_TRANSITO'
WHERE c.estado = 'DISPONIBLE'
  AND EXISTS (
    SELECT 1
    FROM envio_contenedores ec
    WHERE ec.id_contenedor = c.id_contenedor
      AND ec.fecha_liberacion IS NULL
  );

INSERT INTO tramos (id_tramo, id_envio, medio_transporte, origen, destino, costo, fecha_salida, fecha_llegada_estimada) VALUES
('TR-1001-1', 'ENV-1001', 'Terrestre', 'Buenos Aires', 'Puerto de Santos', 45000.00, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '1 day'),
('TR-1001-2', 'ENV-1001', 'Terrestre', 'Puerto de Santos', 'San Pablo', 45000.00, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '2 days'),
('TR-1002-1', 'ENV-1002', 'Terrestre', 'Montevideo', 'Santiago', 42000.00, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '3 days'),
('TR-1003-1', 'ENV-1003', 'Terrestre', 'Buenos Aires', 'Mendoza', 38000.00, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '9 days'),
('TR-1003-2', 'ENV-1003', 'Terrestre', 'Mendoza', 'Santiago', 38000.00, CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '6 days'),
('TR-1004-1', 'ENV-1004', 'Marítimo', 'San Pablo', 'Puerto de Santos', 72000.00, CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '10 days'),
('TR-1004-2', 'ENV-1004', 'Marítimo', 'Puerto de Santos', 'Montevideo', 72000.00, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '10 days'),
('TR-1005-1', 'ENV-1005', 'Terrestre', 'Buenos Aires', 'San Pablo', 52000.00, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '2 days'),
('TR-1006-1', 'ENV-1006', 'Terrestre', 'Mendoza', 'Paso Internacional', 36000.00, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('TR-1006-2', 'ENV-1006', 'Terrestre', 'Paso Internacional', 'Lima', 58000.00, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '2 days'),
('TR-1007-1', 'ENV-1007', 'Marítimo', 'Valparaíso', 'Buenos Aires', 68000.00, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '8 days'),
('TR-1008-1', 'ENV-1008', 'Terrestre', 'San Pablo', 'Asunción', 47000.00, CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT DO NOTHING;

-- Observar que los IDs 1 de CLIENTE, PROVEEDOR y OPERADOR son válidos porque
-- la identidad completa incluye tipo_actor.
INSERT INTO facturas (id_factura, id_cliente, tipo_factura, tipo_actor, numero_comprobante, concepto, id_envio, importe_total, estado) VALUES
(1, 1, 'EMITIDA', 'CLIENTE',   'FC-0001-00000001', 'Flete internacional Buenos Aires - San Pablo', 'ENV-1001', 45000.00, 'PAGADA'),
(2, 1, 'EMITIDA', 'CLIENTE',   'FC-0001-00000002', 'Flete complementario aduanero', 'ENV-1001', 62000.00, 'PENDIENTE'),
(3, 1, 'RECIBIDA', 'OPERADOR', 'OP-0001-000451', 'Flete tramo terrestre ENV-1001', 'ENV-1001', 35000.00, 'PENDIENTE'),
(4, 1, 'RECIBIDA', 'PROVEEDOR', 'PR-0002-000129', 'Lote 10 Sensores IoT modelo SENS-88', NULL, 80000.00, 'PAGADA')
ON CONFLICT DO NOTHING;

INSERT INTO pagos (id_pago, id_factura, tipo_pago, monto, medio_pago, referencia_comprobante) VALUES
(1, 1, 'COBRO_CLIENTE', 45000.00, 'TRANSFERENCIA_BANCARIA', 'TRF-SANT-11029'),
(2, 4, 'PAGO_PROVEEDOR', 80000.00, 'TRANSFERENCIA_BANCARIA', 'TRF-BBVA-99412')
ON CONFLICT DO NOTHING;

-- Cierre histórico del mes anterior. Se mantiene separado del período actual
-- para que la demo pueda mostrar el histórico y también ejecutar un cierre nuevo.
-- Se resuelven los actores por CUIT para tolerar volúmenes con IDs previos y se
-- descartan cierres huérfanos generados por seeds anteriores.
DELETE FROM cierres_cuentas_corrientes cc
WHERE NOT EXISTS (
    SELECT 1 FROM clientes c
    WHERE cc.tipo_actor = 'CLIENTE' AND c.id_cliente = cc.id_actor
)
AND NOT EXISTS (
    SELECT 1 FROM proveedores p
    WHERE cc.tipo_actor = 'PROVEEDOR' AND p.id_proveedor = cc.id_actor
)
AND NOT EXISTS (
    SELECT 1 FROM operadores o
    WHERE cc.tipo_actor = 'OPERADOR' AND o.id_operador = cc.id_actor
);

INSERT INTO cierres_cuentas_corrientes
    (periodo, id_actor, tipo_actor, saldo_inicial, total_debe, total_haber,
     saldo_final, fecha_cierre, estado)
SELECT
    to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM'),
    a.id_actor,
    a.tipo_actor,
    v.saldo_inicial,
    v.total_debe,
    v.total_haber,
    v.saldo_final,
    CURRENT_TIMESTAMP - INTERVAL '15 days',
    'CERRADO'
FROM (VALUES
    ('30-71123456-8', 'CLIENTE',   0.00, 62000.00,     0.00, -62000.00),
    ('30-99887766-4', 'CLIENTE',   0.00, 25000.00,     0.00, -25000.00),
    ('30-55667788-1', 'OPERADOR',  0.00,     0.00, 35000.00,  35000.00),
    ('30-44332211-9', 'PROVEEDOR', 0.00, 80000.00, 80000.00,      0.00)
) AS v(cuit, tipo_actor, saldo_inicial, total_debe, total_haber, saldo_final)
JOIN (
    SELECT id_cliente AS id_actor, 'CLIENTE' AS tipo_actor, cuit FROM clientes
    UNION ALL
    SELECT id_proveedor AS id_actor, 'PROVEEDOR' AS tipo_actor, cuit FROM proveedores
    UNION ALL
    SELECT id_operador AS id_actor, 'OPERADOR' AS tipo_actor, cuit FROM operadores
) a ON a.cuit = v.cuit AND a.tipo_actor = v.tipo_actor
ON CONFLICT (periodo, tipo_actor, id_actor) DO NOTHING;

-- Los datos semilla usan IDs explícitos: adelantar las secuencias para que las
-- altas nuevas no choquen con la clave primaria.
SELECT setval(pg_get_serial_sequence('clientes', 'id_cliente'),
              COALESCE((SELECT MAX(id_cliente) FROM clientes), 1),
              (SELECT MAX(id_cliente) IS NOT NULL FROM clientes));
SELECT setval(pg_get_serial_sequence('proveedores', 'id_proveedor'),
              COALESCE((SELECT MAX(id_proveedor) FROM proveedores), 1),
              (SELECT MAX(id_proveedor) IS NOT NULL FROM proveedores));
SELECT setval(pg_get_serial_sequence('operadores', 'id_operador'),
              COALESCE((SELECT MAX(id_operador) FROM operadores), 1),
              (SELECT MAX(id_operador) IS NOT NULL FROM operadores));
SELECT setval(pg_get_serial_sequence('facturas', 'id_factura'),
              COALESCE((SELECT MAX(id_factura) FROM facturas), 1),
              (SELECT MAX(id_factura) IS NOT NULL FROM facturas));
SELECT setval(pg_get_serial_sequence('pagos', 'id_pago'),
              COALESCE((SELECT MAX(id_pago) FROM pagos), 1),
              (SELECT MAX(id_pago) IS NOT NULL FROM pagos));
