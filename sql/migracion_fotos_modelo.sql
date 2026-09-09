-- Migración: varias fotos por modelo.
-- Reemplaza la columna `foto_url` (una sola foto) por `fotos TEXT[]` (varias, en
-- orden, la primera es la portada).
-- Correr una sola vez contra una base que ya tenía la tabla `modelos` (local o
-- Railway). En una base nueva no hace falta: sql/schema.sql ya la incluye.
--
-- Va entera dentro de una transacción y es idempotente (se puede reintentar).

BEGIN;

ALTER TABLE modelos ADD COLUMN IF NOT EXISTS fotos TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: la foto única que tenía cada modelo pasa a ser su portada (único
-- elemento del array). Solo si `foto_url` todavía existe y la fila no tiene ya
-- fotos cargadas (por si la migración se corre dos veces).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'modelos' AND column_name = 'foto_url') THEN
        EXECUTE $sql$
            UPDATE modelos
               SET fotos = ARRAY[foto_url]
             WHERE foto_url IS NOT NULL AND foto_url <> '' AND fotos = '{}'
        $sql$;
    END IF;
END $$;

ALTER TABLE modelos DROP COLUMN IF EXISTS foto_url;

COMMIT;
