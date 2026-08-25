import { z } from "zod";
import {
  MAX_DESCRIPCION,
  MAX_FOTO_URL,
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
  foto_url: z.string().nullable(),
  activo: z.boolean(),
  creado_en: z.string(),
});

export const listaModelosSchema = z.array(modeloSchema);

// ---------- Lo que le mandamos a la API ----------

const fotoUrlDto = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((valor) => (typeof valor === "string" ? valor.trim() : ""))
  .transform((valor) => valor || null)
  .refine(
    (valor) => valor === null || (valor.length <= MAX_FOTO_URL && PATRON_FOTO.test(valor)),
    "La foto debe ser una imagen subida a este servidor."
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
  foto_url: fotoUrlDto,
});

/** Arma el DTO desde el estado del formulario. Devuelve el resultado de `safeParse`. */
export function construirModeloDto(formulario) {
  return modeloDtoSchema.safeParse(formulario);
}

/** DTO del cambio de estado activo/inactivo (el "borrado" lógico). */
export const modeloActivoDtoSchema = z.object({ activo: z.boolean() });
