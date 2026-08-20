import { z } from "zod";
import {
  MAX_CONTACTO,
  MAX_ITEMS,
  MAX_NOMBRE,
  MAX_NOTAS,
  MAX_TEXTO_ITEM,
} from "./limites.js";

// Validación del borrador que vive en localStorage.
//
// A diferencia del DTO, este esquema es deliberadamente tolerante: el borrador
// es un pedido a medio cargar, con campos vacíos por definición. Lo que valida
// es la *forma*, no que esté completo. Y en vez de descartar todo ante un campo
// raro, usa `.catch()` para reponer el valor por defecto de ese campo: si
// alguien editó el localStorage a mano, o quedó un borrador de una versión vieja
// de la app, se rescata lo que sirve en lugar de perder el pedido entero.
//
// Lo que sí se hace es acotar: un borrador manipulado no puede meter 50.000
// ítems ni un texto de diez megas en el estado de React.

const texto = (maximo) =>
  z
    .string()
    .transform((valor) => valor.slice(0, maximo))
    .catch("");

const numeroTexto = () =>
  z
    .union([z.string(), z.number()])
    .transform((valor) => String(valor).slice(0, 20))
    .catch("");

export const itemBorradorSchema = z.object({
  key: z.string().min(1).catch(() => crypto.randomUUID()),
  modelo_id: numeroTexto(),
  tela: texto(MAX_TEXTO_ITEM),
  telaOtra: texto(MAX_TEXTO_ITEM),
  color: texto(MAX_TEXTO_ITEM),
  medidas: texto(MAX_TEXTO_ITEM),
  cantidad: numeroTexto(),
  precio_unitario: numeroTexto(),
});

export const borradorSchema = z.object({
  paso: z.number().int().min(0).max(3).catch(0),
  clienteNombre: texto(MAX_NOMBRE),
  clienteContacto: texto(MAX_CONTACTO),
  fechaPedido: texto(10),
  fechaPrometida: texto(10),
  notas: texto(MAX_NOTAS),
  items: z
    .array(itemBorradorSchema)
    .transform((items) => items.slice(0, MAX_ITEMS))
    .catch([]),
});

/**
 * Lee y valida el borrador guardado.
 *
 * Devuelve `null` si no hay nada, si el JSON está roto o si lo guardado no es un
 * objeto — en cualquiera de esos casos se arranca un pedido limpio.
 */
export function parsearBorrador(crudo) {
  if (!crudo) return null;

  let datos;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return null;
  }

  const resultado = borradorSchema.safeParse(datos);
  return resultado.success ? resultado.data : null;
}
