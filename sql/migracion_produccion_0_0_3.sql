-- Migración a 0.0.3 — correr UNA sola vez en la base de producción (Railway),
-- ANTES del redeploy. Reúne, en el orden correcto, todo lo que cambió desde el
-- esquema con el que se creó esa base:
--
--   1. tabla `catalogos` (nueva)
--   2. datos extendidos del cliente en `pedidos`
--   3. medidas obligatorias en `modelos`
--   4. medidas por ítem, en metros, en `pedido_items`
--
-- Va entera dentro de una transacción: si algo falla, no queda nada a medias.
-- Es idempotente (se puede repetir sin romper nada) por si hay que reintentar.

BEGIN;

-- ---------- 1. Catálogos (tabla nueva) ----------

CREATE TABLE IF NOT EXISTS catalogos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    portada_url TEXT NOT NULL,
    total_paginas INT NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------- 2. Cliente: dirección, tipo de factura y correo ----------

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_direccion TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_tipo_factura TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_email TEXT;

-- Los pedidos que ya existen no tienen estos datos y no hay forma de saberlos.
-- Quedan con un valor que se ve como "dato viejo, sin cargar" en vez de
-- inventar algo; se corrigen a mano desde la app cuando haga falta.
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

-- ---------- 3. Medidas del modelo (en metros, obligatorias) ----------
--
-- Misma unidad que los ítems del pedido: al elegir un modelo, sus medidas se
-- copian tal cual al ítem, sin ninguna conversión de por medio.

ALTER TABLE modelos ADD COLUMN IF NOT EXISTS profundidad_m NUMERIC(4,2);
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS altura_m NUMERIC(4,2);
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS ancho_m NUMERIC(4,2);

-- 0.01 m a propósito: un valor obviamente falso que salta a la vista en la
-- lista de Modelos, para que no pase por real hasta corregirlo a mano.
UPDATE modelos SET profundidad_m = 0.01 WHERE profundidad_m IS NULL;
UPDATE modelos SET altura_m = 0.01 WHERE altura_m IS NULL;
UPDATE modelos SET ancho_m = 0.01 WHERE ancho_m IS NULL;

ALTER TABLE modelos ALTER COLUMN profundidad_m SET NOT NULL;
ALTER TABLE modelos ALTER COLUMN altura_m SET NOT NULL;
ALTER TABLE modelos ALTER COLUMN ancho_m SET NOT NULL;

ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_profundidad_check;
ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_altura_check;
ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_ancho_check;
ALTER TABLE modelos ADD CONSTRAINT modelos_profundidad_check CHECK (profundidad_m > 0);
ALTER TABLE modelos ADD CONSTRAINT modelos_altura_check CHECK (altura_m > 0);
ALTER TABLE modelos ADD CONSTRAINT modelos_ancho_check CHECK (ancho_m > 0);

-- ---------- 4. Medidas por ítem del pedido (en metros) ----------

ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS ancho_m NUMERIC(4,2);
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS altura_m NUMERIC(4,2);
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS profundidad_m NUMERIC(4,2);

-- El texto libre viejo de "medidas" no se puede partir en tres números
-- confiables, así que no se intenta: los ítems ya existentes quedan sin
-- medidas (son nullable en la base; lo obligatorio lo exige la API).
ALTER TABLE pedido_items DROP COLUMN IF EXISTS medidas;

COMMIT;
