import { z } from "zod";
import {
  MAX_CLIENTE_NOTAS,
  MAX_CONTACTO,
  MAX_CUIT,
  MAX_DIRECCION,
  MAX_EMAIL,
  MAX_LOCALIDAD,
  MAX_NOMBRE,
  TIPOS_FACTURA_VALIDOS,
} from "./limites.js";
import { correoOpcional, textoObligatorio, textoOpcional } from "./comunes.js";

// ---------- Lo que devuelve la API ----------

/** Un cliente tal como lo devuelve GET/POST/PATCH /clientes. */
export const clienteSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string(),
  contacto: z.string().nullable(),
  direccion: z.string().nullable(),
  tipo_factura: z.string().nullable(),
  email: z.string().nullable(),
  localidad: z.string().nullable(),
  cuit: z.string().nullable(),
  notas: z.string().nullable(),
  activo: z.boolean(),
  creado_en: z.string(),
});

export const listaClientesSchema = z.array(clienteSchema);

/** Respuesta paginada de GET /clientes. */
export const clientesPaginadosSchema = z.object({
  items: listaClientesSchema,
  total: z.number().int().nonnegative(),
});

// ---------- Lo que le mandamos a la API ----------

const tipoFacturaDto = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .transform((v) => v || null)
  .refine(
    (v) => v === null || TIPOS_FACTURA_VALIDOS.includes(v),
    "El tipo de factura no es válido."
  );

/**
 * DTO de alta/edición de cliente.
 *
 * Recibe el formulario crudo (todo string, vacíos como "") y devuelve el cuerpo
 * exacto que espera la API. Los campos de más se descartan.
 */
export const clienteDtoSchema = z.object({
  nombre: textoObligatorio(MAX_NOMBRE, "El nombre"),
  contacto: textoOpcional(MAX_CONTACTO, "El contacto"),
  direccion: textoOpcional(MAX_DIRECCION, "La dirección"),
  tipo_factura: tipoFacturaDto,
  email: correoOpcional(MAX_EMAIL, "El correo electrónico"),
  localidad: textoOpcional(MAX_LOCALIDAD, "La localidad"),
  cuit: textoOpcional(MAX_CUIT, "El CUIT"),
  notas: textoOpcional(MAX_CLIENTE_NOTAS, "Las notas"),
});

/** Arma el DTO desde el estado del formulario. Devuelve el resultado de `safeParse`. */
export function construirClienteDto(formulario) {
  return clienteDtoSchema.safeParse(formulario);
}

/** DTO del cambio de estado activo/inactivo (el "borrado" lógico). */
export const clienteActivoDtoSchema = z.object({ activo: z.boolean() });
