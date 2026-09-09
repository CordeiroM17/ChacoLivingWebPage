-- Esquema de base de datos: Sistema de gestión de pedidos, Fábrica de sillones
-- Ver CLAUDE.md sección 3

-- pg_trgm: permite indexar búsquedas por substring (ILIKE '%texto%'), que un
-- índice B-tree normal no puede aprovechar.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE modelos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_base NUMERIC(12,2) NOT NULL,
    profundidad_m NUMERIC(4,2) NOT NULL CHECK (profundidad_m > 0),
    altura_m NUMERIC(4,2) NOT NULL CHECK (altura_m > 0),
    ancho_m NUMERIC(4,2) NOT NULL CHECK (ancho_m > 0),
    -- Fotos del modelo en orden; la primera es la portada. Array en vez de
    -- tabla aparte: reordenar/quitar es reescribir la fila entera.
    fotos TEXT[] NOT NULL DEFAULT '{}',
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE catalogos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    portada_url TEXT NOT NULL,
    total_paginas INT NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT now()
);

-- Lista global de clientes, compartida entre solapas. El pedido guarda su propio
-- snapshot de estos datos (cliente_* en `pedidos`); esta tabla es la fuente para
-- autocompletar y para agrupar los pedidos de la misma persona.
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    contacto TEXT,
    direccion TEXT,
    tipo_factura TEXT CONSTRAINT clientes_tipo_factura_check
        CHECK (tipo_factura IS NULL OR tipo_factura IN ('A','B','C')),
    email TEXT,
    localidad TEXT,
    cuit TEXT,
    notas TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    cliente_id INT REFERENCES clientes(id) ON DELETE SET NULL,
    cliente_nombre TEXT NOT NULL,
    cliente_contacto TEXT NOT NULL,
    cliente_direccion TEXT NOT NULL,
    cliente_tipo_factura TEXT NOT NULL CHECK (cliente_tipo_factura IN ('A','B','C')),
    cliente_email TEXT,
    -- Mail del JWT de quien cargó el pedido (hook para multiusuario futuro).
    creado_por TEXT,
    fecha_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_prometida DATE NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente','en_proceso','listo','entregado','cancelado')),
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    notas TEXT,
    comprobante_url TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    modelo_id INT NOT NULL REFERENCES modelos(id),
    cantidad INT NOT NULL DEFAULT 1,
    tela TEXT,
    color TEXT,
    ancho_m NUMERIC(4,2),
    altura_m NUMERIC(4,2),
    profundidad_m NUMERIC(4,2),
    precio_unitario NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);

-- El buscador de "Ver pedidos" filtra por ILIKE '%texto%' en estas dos
-- columnas; un GIN + pg_trgm es lo único que ese patrón puede aprovechar.
CREATE INDEX idx_pedidos_cliente_trgm ON pedidos USING GIN (cliente_nombre gin_trgm_ops);
CREATE INDEX idx_pedidos_codigo_trgm ON pedidos USING GIN (codigo gin_trgm_ops);

-- Mismo motivo para el buscador de la sección Clientes.
CREATE INDEX idx_clientes_nombre_trgm ON clientes USING GIN (nombre gin_trgm_ops);
CREATE INDEX idx_pedidos_cliente_id ON pedidos(cliente_id);
