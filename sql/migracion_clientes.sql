-- Migración: lista global de clientes (Fase 1).
-- Crea la tabla `clientes`, agrega `pedidos.cliente_id` + `pedidos.creado_por`, y
-- hace el backfill: un cliente por cada nombre distinto que ya aparece en los
-- pedidos, y linkea cada pedido a su cliente.
--
-- Correr una sola vez contra una base que ya tenía `pedidos` (local o Railway).
-- En una base nueva no hace falta: sql/schema.sql ya lo incluye.
-- Va entera dentro de una transacción y es idempotente (se puede reintentar).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    contacto TEXT,
    direccion TEXT,
    tipo_factura TEXT,
    email TEXT,
    localidad TEXT,
    cuit TEXT,
    notas TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_tipo_factura_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_tipo_factura_check
    CHECK (tipo_factura IS NULL OR tipo_factura IN ('A','B','C'));

CREATE INDEX IF NOT EXISTS idx_clientes_nombre_trgm
    ON clientes USING GIN (nombre gin_trgm_ops);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id INT
    REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS creado_por TEXT;
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id);

-- Backfill: solo la primera vez (si `clientes` está vacía). Un cliente por
-- nombre distinto (case-insensitive, sin espacios), tomando contacto / dirección
-- / tipo de factura / correo del pedido MÁS RECIENTE con ese nombre. Los
-- centinela 'Sin especificar' (de migraciones viejas) se pasan a NULL en vez de
-- copiarse. Los nombres escritos distinto quedan como clientes separados: se
-- corrige a mano después (el snapshot cliente_* del pedido queda intacto igual).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM clientes) THEN
        INSERT INTO clientes (nombre, contacto, direccion, tipo_factura, email)
        SELECT DISTINCT ON (lower(btrim(p.cliente_nombre)))
               btrim(p.cliente_nombre),
               NULLIF(btrim(p.cliente_contacto), 'Sin especificar'),
               NULLIF(btrim(p.cliente_direccion), 'Sin especificar'),
               p.cliente_tipo_factura,
               p.cliente_email
          FROM pedidos p
         WHERE btrim(p.cliente_nombre) <> ''
           AND lower(btrim(p.cliente_nombre)) <> 'sin especificar'
         ORDER BY lower(btrim(p.cliente_nombre)), p.fecha_pedido DESC, p.id DESC;
    END IF;
END $$;

UPDATE pedidos p
   SET cliente_id = c.id
  FROM clientes c
 WHERE p.cliente_id IS NULL
   AND lower(btrim(p.cliente_nombre)) = lower(btrim(c.nombre));

COMMIT;
