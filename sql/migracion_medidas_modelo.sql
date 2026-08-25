-- Migración: profundidad/altura/ancho obligatorios en modelos.
-- Correr una sola vez contra una base que ya tenía la tabla `modelos` (local
-- o Railway). En una base nueva no hace falta: sql/schema.sql ya la incluye.

ALTER TABLE modelos ADD COLUMN IF NOT EXISTS profundidad_cm NUMERIC(6,1);
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS altura_cm NUMERIC(6,1);
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS ancho_cm NUMERIC(6,1);

-- Backfill de los modelos que ya existían: no hay forma de saber su medida
-- real, así que quedan en "1cm" a propósito — un valor obviamente falso que
-- salta a la vista en la lista de Modelos hasta corregirlo a mano.
UPDATE modelos SET profundidad_cm = 1 WHERE profundidad_cm IS NULL;
UPDATE modelos SET altura_cm = 1 WHERE altura_cm IS NULL;
UPDATE modelos SET ancho_cm = 1 WHERE ancho_cm IS NULL;

ALTER TABLE modelos ALTER COLUMN profundidad_cm SET NOT NULL;
ALTER TABLE modelos ALTER COLUMN altura_cm SET NOT NULL;
ALTER TABLE modelos ALTER COLUMN ancho_cm SET NOT NULL;

ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_profundidad_check;
ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_altura_check;
ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_ancho_check;
ALTER TABLE modelos ADD CONSTRAINT modelos_profundidad_check CHECK (profundidad_cm > 0);
ALTER TABLE modelos ADD CONSTRAINT modelos_altura_check CHECK (altura_cm > 0);
ALTER TABLE modelos ADD CONSTRAINT modelos_ancho_check CHECK (ancho_cm > 0);
