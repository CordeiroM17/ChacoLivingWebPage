import { z } from "zod";
import { MAX_NOMBRE_CATALOGO, TAMANO_MAXIMO_PDF } from "./limites.js";
import { textoObligatorio } from "./comunes.js";

// ---------- Lo que devuelve la API ----------

/** Un catálogo tal como lo devuelve GET/POST /catalogos. */
export const catalogoSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string(),
  portada_url: z.string(),
  total_paginas: z.number().int().positive(),
  creado_en: z.string(),
});

export const listaCatalogosSchema = z.array(catalogoSchema);

/**
 * URL de una página del catálogo. Vive acá, junto al esquema, porque se deduce
 * del mismo contrato: arma el nombre igual que el backend
 * (catalogos_render.py:pagina_url) pero saca la extensión de `portada_url` en
 * vez de asumirla fija, así un catálogo subido con otro formato de imagen
 * sigue viéndose aunque el backend cambie el formato más adelante.
 */
export function paginaUrl(catalogo, numero) {
  const num = String(numero).padStart(4, "0");
  const extension = catalogo.portada_url.match(/\.(\w+)$/)?.[1] || "jpg";
  return `/uploads/catalogos/${catalogo.id}/pagina-${num}.${extension}`;
}

// ---------- Lo que le mandamos a la API ----------

/**
 * DTO de alta de catálogo. A diferencia del resto de la app esto no viaja como
 * JSON: se arma un FormData (nombre + archivo) porque es un multipart/form-data.
 * Igual se valida acá antes de armar la request, para dar el error en el
 * formulario y no recién cuando responde el servidor.
 */
export const catalogoDtoSchema = z.object({
  nombre: textoObligatorio(MAX_NOMBRE_CATALOGO, "El nombre"),
  archivo: z
    .instanceof(File, { error: "Elegí un archivo PDF." })
    .refine((archivo) => archivo.type === "application/pdf", "El catálogo debe ser un PDF.")
    .refine(
      (archivo) => archivo.size <= TAMANO_MAXIMO_PDF,
      "El PDF no puede superar 60MB."
    ),
});

export function construirCatalogoDto(formulario) {
  return catalogoDtoSchema.safeParse(formulario);
}
