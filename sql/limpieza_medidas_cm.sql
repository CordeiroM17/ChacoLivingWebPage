-- Limpieza: saca las columnas de medidas en centímetros de `modelos`.
--
-- Hace falta solo si se llegó a correr una versión intermedia de la migración
-- que las creaba: quedan las seis columnas (cm y m) conviviendo, y como las de
-- cm son NOT NULL y el backend ya no las conoce, cualquier alta de modelo
-- falla con "null value in column profundidad_cm violates not-null constraint".
--
-- Si `modelos` no tiene columnas en cm, este script no hace nada.

BEGIN;

-- Antes de descartarlas: si alguna fila tiene una medida real en cm y la de
-- metros todavía está en el 0.01 de relleno, se conserva el dato pasándolo a
-- metros. Va en SQL dinámico porque Postgres valida los nombres de columna al
-- parsear la sentencia: nombrar `profundidad_cm` en una base que no la tiene
-- sería un error de sintaxis, aunque la condición nunca llegara a cumplirse.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'modelos' AND column_name = 'profundidad_cm') THEN
        EXECUTE $sql$
            UPDATE modelos
               SET profundidad_m = CASE WHEN profundidad_m = 0.01
                                        THEN profundidad_cm / 100.0 ELSE profundidad_m END,
                   altura_m      = CASE WHEN altura_m = 0.01
                                        THEN altura_cm / 100.0 ELSE altura_m END,
                   ancho_m       = CASE WHEN ancho_m = 0.01
                                        THEN ancho_cm / 100.0 ELSE ancho_m END
        $sql$;
    END IF;
END $$;

ALTER TABLE modelos DROP COLUMN IF EXISTS profundidad_cm;
ALTER TABLE modelos DROP COLUMN IF EXISTS altura_cm;
ALTER TABLE modelos DROP COLUMN IF EXISTS ancho_cm;

-- Lo mismo para los ítems, por si alguna versión intermedia se las agregó.
ALTER TABLE pedido_items DROP COLUMN IF EXISTS ancho_cm;
ALTER TABLE pedido_items DROP COLUMN IF EXISTS altura_cm;
ALTER TABLE pedido_items DROP COLUMN IF EXISTS profundidad_cm;

COMMIT;
