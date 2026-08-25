import { z } from "zod";

// Piezas reutilizables para los esquemas. Todos los mensajes van en español y
// están redactados para mostrarse tal cual al usuario.

/** Texto obligatorio: recorta espacios y rechaza lo que queda vacío. */
export function textoObligatorio(maximo, etiqueta) {
  return z
    .string({ error: `${etiqueta} es un dato obligatorio.` })
    .trim()
    .min(1, `${etiqueta} no puede quedar sin completar.`)
    .max(maximo, `${etiqueta} supera el máximo de ${maximo} caracteres.`);
}

/**
 * Texto opcional: recorta espacios y normaliza "" / undefined a null, que es lo
 * que espera el backend para "sin dato".
 */
export function textoOpcional(maximo, etiqueta) {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((valor) => (typeof valor === "string" ? valor.trim() : ""))
    .refine(
      (valor) => valor.length <= maximo,
      `${etiqueta} supera el máximo de ${maximo} caracteres.`
    )
    .transform((valor) => valor || null);
}

/**
 * Número que viene de un <input>, o sea siempre string.
 *
 * `z.coerce.number()` no sirve solo: convierte "" en 0 en silencio, con lo cual
 * un precio sin completar se guardaría como cero. Acá el vacío se rechaza
 * explícitamente antes de coaccionar.
 */
export function numeroDesdeInput({ etiqueta, min = 0, max, entero = false, decimales }) {
  const numero = entero
    ? z
        .number({ error: `${etiqueta} debe ser un número válido.` })
        .int(`${etiqueta} debe ser un número entero.`)
        .min(min, `${etiqueta} no puede ser menor que ${min}.`)
        .max(max, `${etiqueta} no puede superar ${max}.`)
    : z
        .number({ error: `${etiqueta} debe ser un número válido.` })
        .min(min, `${etiqueta} no puede ser menor que ${min}.`)
        .max(max, `${etiqueta} no puede superar ${max}.`);

  const base = z
    .union([z.string(), z.number()])
    .transform((valor) => (typeof valor === "string" ? valor.trim() : valor))
    .refine((valor) => valor !== "", `${etiqueta} es un dato obligatorio.`)
    .transform((valor) => Number(valor))
    .pipe(numero);

  // Los montos se redondean a centavos: la columna de la base es NUMERIC(12,2),
  // así que mandar más decimales sería mostrar un número y guardar otro.
  if (decimales === undefined) return base;
  const factor = 10 ** decimales;
  return base.transform((valor) => Math.round(valor * factor) / factor);
}

/** Monto en pesos: número no negativo, acotado y redondeado a centavos. */
export function monto({ etiqueta, max }) {
  return numeroDesdeInput({ etiqueta, min: 0, max, decimales: 2 });
}

/** Medida en metros: mayor que cero (nunca 0 ni negativa), acotada, dos decimales. */
export function medidaMetros(etiqueta, max) {
  return numeroDesdeInput({ etiqueta, min: 0.01, max, decimales: 2 });
}

/**
 * Correo electrónico opcional: "" y undefined se normalizan a null. Solo
 * valida la forma (no DNS ni MX), igual que el backend.
 */
export function correoOpcional(maximo, etiqueta) {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((valor) => (typeof valor === "string" ? valor.trim() : ""))
    .transform((valor) => valor || null)
    .refine(
      (valor) => valor === null || valor.length <= maximo,
      `${etiqueta} supera el máximo de ${maximo} caracteres.`
    )
    .refine(
      (valor) => valor === null || z.email().safeParse(valor).success,
      `${etiqueta} no tiene un formato válido.`
    );
}

/** Fecha en formato ISO (YYYY-MM-DD), que es lo que producen los <input type="date">. */
export const fechaISO = z.iso.date("La fecha tiene un formato inválido.");

/** Primer mensaje de error de un resultado de `safeParse`, listo para mostrar. */
export function primerMensaje(error, respaldo = "Hay datos inválidos en el formulario.") {
  return error?.issues?.[0]?.message || respaldo;
}

/** Ruta del primer error, ej. ["items", 2, "precio_unitario"]. */
export function primerCampo(error) {
  return error?.issues?.[0]?.path ?? [];
}

/**
 * Valida la respuesta de la API contra su esquema.
 *
 * Si el backend cambia de forma, es preferible un error claro acá que un
 * `undefined` reventando en medio del render. Los campos que la app no usa se
 * descartan solos: `z.object` se queda solo con lo declarado.
 */
export function validarRespuesta(esquema, datos, contexto) {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    console.error(`Respuesta inesperada de la API (${contexto}):`, resultado.error.issues);
    throw new Error(
      `El servidor devolvió ${contexto} en un formato inesperado. Actualizá la página.`
    );
  }
  return resultado.data;
}
