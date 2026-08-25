-- Migración: profundidad/altura/ancho obligatorios en modelos, en metros.
-- Misma unidad que los ítems del pedido: al elegir un modelo, sus medidas se
-- copian tal cual al ítem, sin conversión de por medio.
-- Correr una sola vez contra una base que ya tenía la tabla `modelos` (local
-- o Railway). En una base nueva no hace falta: sql/schema.sql ya la incluye.
--
-- Para producción está todo junto en migracion_produccion_0_0_3.sql; este
-- archivo queda como el paso suelto.

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

-- Restos de una versión intermedia de desarrollo que las guardaba en
-- centímetros. En producción nunca existieron.
ALTER TABLE modelos DROP COLUMN IF EXISTS profundidad_cm;
ALTER TABLE modelos DROP COLUMN IF EXISTS altura_cm;
ALTER TABLE modelos DROP COLUMN IF EXISTS ancho_cm;
