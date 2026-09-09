import { z } from "zod";
import {
  MAX_DESCRIPCION,
  MAX_FOTO_URL,
  MAX_FOTOS_MODELO,
  MAX_MEDIDA_M,
  MAX_MONTO,
  MAX_NOMBRE,
  PATRON_FOTO,
} from "./limites.js";
import { medidaMetros, monto, textoObligatorio, textoOpcional } from "./comunes.js";

// ---------- Lo que devuelve la API ----------

/** Un modelo tal como lo devuelve GET/POST/PATCH /modelos. */
export const modeloSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  precio_base: z.number(),
  profundidad_m: z.number(),
  altura_m: z.number(),
  ancho_m: z.number(),
  fotos: z.array(z.string()),
  // Portada que arma el backend (fotos[0] o null). Se conserva porque la lista
  // de modelos, los ítems del pedido y el comprobante la leen tal cual.
  foto_url: z.string().nullable(),
  activo: z.boolean(),
  creado_en: z.string(),
});

export const listaModelosSchema = z.array(modeloSchema);

// ---------- Lo que le mandamos a la API ----------

const fotosDto = z
  .array(z.string())
  .optional()
  .transform((arr) => (arr ?? []).map((s) => s.trim()).filter(Boolean))
  .refine(
    (arr) => arr.length <= MAX_FOTOS_MODELO,
    `No puede haber más de ${MAX_FOTOS_MODELO} fotos por modelo.`
  )
  .refine(
    (arr) => arr.every((s) => s.length <= MAX_FOTO_URL && PATRON_FOTO.test(s)),
    "Cada foto debe ser una imagen subida a este servidor."
  );

/**
 * DTO de alta/edición de modelo.
 *
 * Recibe el formulario crudo (precio como string, campos vacíos como "") y
 * devuelve exactamente el cuerpo que espera la API. Los campos que el formulario
 * tenga de más se descartan: `z.object` se queda solo con lo declarado.
 */
export const modeloDtoSchema = z.object({
  nombre: textoObligatorio(MAX_NOMBRE, "El nombre"),
  descripcion: textoOpcional(MAX_DESCRIPCION, "La descripción"),
  precio_base: monto({ etiqueta: "El precio", max: MAX_MONTO }),
  profundidad_m: medidaMetros("La profundidad", MAX_MEDIDA_M),
  altura_m: medidaMetros("La altura", MAX_MEDIDA_M),
  ancho_m: medidaMetros("El ancho", MAX_MEDIDA_M),
  fotos: fotosDto,
});

/** Arma el DTO desde el estado del formulario. Devuelve el resultado de `safeParse`. */
export function construirModeloDto(formulario) {
  return modeloDtoSchema.safeParse(formulario);
}

/** DTO del cambio de estado activo/inactivo (el "borrado" lógico). */
export const modeloActivoDtoSchema = z.object({ activo: z.boolean() });
