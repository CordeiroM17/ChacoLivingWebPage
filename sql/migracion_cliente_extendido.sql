-- Migración: dirección de envío, tipo de factura y correo en pedidos +
-- contacto y entrega prometida pasan a obligatorios.
-- Correr una sola vez contra una base que ya tenía la tabla `pedidos` (local
-- o Railway). En una base nueva no hace falta: sql/schema.sql ya la incluye.

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_direccion TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_tipo_factura TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_email TEXT;

-- Backfill de los pedidos que ya existían: no hay forma de saber su dirección
-- o tipo de factura real, así que quedan con un valor visible de "dato viejo,
-- sin cargar" en vez de inventar algo. Se puede corregir a mano después.
UPDATE pedidos SET cliente_direccion = 'Sin especificar' WHERE cliente_direccion IS NULL;
UPDATE pedidos SET cliente_tipo_factura = 'C' WHERE cliente_tipo_factura IS NULL;
UPDATE pedidos SET cliente_contacto = 'Sin especificar' WHERE cliente_contacto IS NULL;
UPDATE pedidos SET fecha_prometida = fecha_pedido WHERE fecha_prometida IS NULL;

ALTER TABLE pedidos ALTER COLUMN cliente_direccion SET NOT NULL;
ALTER TABLE pedidos ALTER COLUMN cliente_tipo_factura SET NOT NULL;
ALTER TABLE pedidos ALTER COLUMN cliente_contacto SET NOT NULL;
ALTER TABLE pedidos ALTER COLUMN fecha_prometida SET NOT NULL;

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_tipo_factura_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_tipo_factura_check
    CHECK (cliente_tipo_factura IN ('A','B','C'));
