-- Migración: reemplaza el texto libre "medidas" de cada ítem del pedido por
-- tres medidas numéricas en metros (ancho/altura/profundidad), precargadas
-- desde el modelo pero editables por ítem. A diferencia de las medidas del
-- modelo (en cm), estas van directo en metros — sin conversión de por medio.
-- Correr una sola vez contra una base que ya tenía la tabla `pedido_items`
-- (local o Railway). En una base nueva no hace falta: sql/schema.sql ya la
-- incluye.

ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS ancho_m NUMERIC(4,2);
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS altura_m NUMERIC(4,2);
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS profundidad_m NUMERIC(4,2);

-- Los ítems que ya existían quedan sin estas medidas (igual que tela/color,
-- son nullable a nivel de base — lo obligatorio lo exige la API, no la
-- columna). No hay forma de parsear el texto libre viejo de "medidas" a tres
-- números confiables, así que no se intenta.
ALTER TABLE pedido_items DROP COLUMN IF EXISTS medidas;
ALTER TABLE pedido_items DROP COLUMN IF EXISTS ancho_cm;
ALTER TABLE pedido_items DROP COLUMN IF EXISTS altura_cm;
ALTER TABLE pedido_items DROP COLUMN IF EXISTS profundidad_cm;
