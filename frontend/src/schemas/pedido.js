import { z } from "zod";
import {
  ESTADOS_VALIDOS,
  MAX_CANTIDAD,
  MAX_CONTACTO,
  MAX_ITEMS,
  MAX_MONTO,
  MAX_NOMBRE,
  MAX_NOTAS,
  MAX_TEXTO_ITEM,
} from "./limites.js";
import {
  fechaISO,
  fechaISOOpcional,
  monto,
  numeroDesdeInput,
  primerCampo,
  textoObligatorio,
  textoOpcional,
} from "./comunes.js";

// ---------- Lo que devuelve la API ----------

const modeloResumenSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string(),
  foto_url: z.string().nullable(),
});

const itemRespuestaSchema = z.object({
  id: z.number().int().positive(),
  modelo_id: z.number().int().positive(),
  modelo: modeloResumenSchema,
  cantidad: z.number().int(),
  tela: z.string().nullable(),
  color: z.string().nullable(),
  medidas: z.string().nullable(),
  precio_unitario: z.number(),
  subtotal: z.number(),
});

/** Un pedido en la lista de GET /pedidos (sin ítems). */
export const pedidoResumenSchema = z.object({
  id: z.number().int().positive(),
  codigo: z.string(),
  cliente_nombre: z.string(),
  cliente_contacto: z.string().nullable(),
  fecha_pedido: z.string(),
  fecha_prometida: z.string().nullable(),
  estado: z.enum(ESTADOS_VALIDOS),
  total: z.number(),
  notas: z.string().nullable(),
  comprobante_url: z.string().nullable(),
  creado_en: z.string(),
});

/** Respuesta paginada de GET /pedidos: la página pedida más el total real. */
export const pedidosPaginadosSchema = z.object({
  items: z.array(pedidoResumenSchema),
  total: z.number().int().nonnegative(),
});

/** El pedido completo de GET /pedidos/{id}, POST /pedidos y PATCH /pedidos/{id}. */
export const pedidoDetalleSchema = pedidoResumenSchema.extend({
  items: z.array(itemRespuestaSchema),
});

// ---------- El contrato de lo que sale hacia la API ----------
//
// Esta es la forma exacta que espera el backend. `strictObject` falla si sobra
// un campo: es la red que garantiza que no se filtre nada del estado de la UI
// (como `key` o `telaOtra`) hacia la petición.

const itemApiSchema = z.strictObject({
  modelo_id: z.number().int().positive(),
  cantidad: z.number().int().min(1).max(MAX_CANTIDAD),
  tela: z.string().max(MAX_TEXTO_ITEM).nullable(),
  color: z.string().max(MAX_TEXTO_ITEM).nullable(),
  medidas: z.string().max(MAX_TEXTO_ITEM).nullable(),
  precio_unitario: z.number().min(0).max(MAX_MONTO),
});

const pedidoApiSchema = z
  .strictObject({
    cliente_nombre: z.string().min(1).max(MAX_NOMBRE),
    cliente_contacto: z.string().max(MAX_CONTACTO).nullable(),
    fecha_pedido: z.string(),
    fecha_prometida: z.string().nullable(),
    notas: z.string().max(MAX_NOTAS).nullable(),
    items: z.array(itemApiSchema).min(1).max(MAX_ITEMS),
  })
  .refine(
    (pedido) => !pedido.fecha_prometida || pedido.fecha_prometida >= pedido.fecha_pedido,
    {
      error: "La entrega prometida no puede ser anterior a la fecha del pedido.",
      path: ["fecha_prometida"],
    }
  );

// ---------- El DTO: del formulario al cuerpo de la petición ----------

/**
 * Un ítem del formulario convertido en ítem de la API.
 *
 * Entra lo que maneja la pantalla (todo string, con `key` y `telaOtra` que son
 * solo de la UI) y sale lo que viaja por la red. Los campos no declarados se
 * descartan solos, y el `.pipe` final verifica que no haya quedado ninguno.
 */
export const itemDtoSchema = z
  .object({
    modelo_id: numeroDesdeInput({
      etiqueta: "El modelo",
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
      entero: true,
    }),
    cantidad: numeroDesdeInput({
      etiqueta: "La cantidad",
      min: 1,
      max: MAX_CANTIDAD,
      entero: true,
    }),
    tela: z.string().nullish(),
    telaOtra: z.string().nullish(),
    color: textoOpcional(MAX_TEXTO_ITEM, "El color"),
    medidas: textoOpcional(MAX_TEXTO_ITEM, "Las medidas"),
    precio_unitario: monto({ etiqueta: "El precio unitario", max: MAX_MONTO }),
  })
  .transform(({ tela, telaOtra, ...resto }) => {
    // "otra" es una opción del selector, no una tela: se reemplaza por el texto
    // libre que escribió el usuario.
    const elegida = tela === "otra" ? telaOtra : tela;
    return { ...resto, tela: (elegida ?? "").trim().slice(0, MAX_TEXTO_ITEM) || null };
  })
  .pipe(itemApiSchema);

/** Los campos del paso 1 del formulario. */
const clienteSchema = z.object({
  clienteNombre: textoObligatorio(MAX_NOMBRE, "El nombre del cliente"),
  clienteContacto: textoOpcional(MAX_CONTACTO, "El contacto"),
  fechaPedido: fechaISO,
  fechaPrometida: fechaISOOpcional,
});

/** Los ítems del paso 2. */
const itemsSchema = z
  .array(itemDtoSchema)
  .min(1, "El pedido debe tener al menos un ítem.")
  .max(MAX_ITEMS, `El pedido no puede tener más de ${MAX_ITEMS} ítems.`);

/** Valida solo el paso de cliente, para no dejar avanzar con datos incompletos. */
export function validarPasoCliente(datos) {
  return clienteSchema
    .refine(
      (d) => !d.fechaPrometida || d.fechaPrometida >= d.fechaPedido,
      {
        error: "La entrega prometida no puede ser anterior a la fecha del pedido.",
        path: ["fechaPrometida"],
      }
    )
    .safeParse(datos);
}

/** Valida solo los ítems, con las mismas reglas que usa el DTO final. */
export function validarPasoItems(items) {
  return itemsSchema.safeParse(items);
}

/**
 * DTO del pedido completo. Toma el borrador tal como vive en el estado de React
 * (y en localStorage) y devuelve el cuerpo de `POST /pedidos`.
 */
export const pedidoDtoSchema = clienteSchema
  .extend({
    notas: textoOpcional(MAX_NOTAS, "Las notas"),
    items: itemsSchema,
  })
  .transform((borrador) => ({
    cliente_nombre: borrador.clienteNombre,
    cliente_contacto: borrador.clienteContacto,
    fecha_pedido: borrador.fechaPedido,
    fecha_prometida: borrador.fechaPrometida,
    notas: borrador.notas,
    items: borrador.items,
  }))
  .pipe(pedidoApiSchema);

/** Arma el DTO desde el borrador. Devuelve el resultado de `safeParse`. */
export function construirPedidoDto(borrador) {
  return pedidoDtoSchema.safeParse(borrador);
}

/** DTO del cambio de estado desde el detalle del pedido. */
export const estadoDtoSchema = z.object({
  estado: z.enum(ESTADOS_VALIDOS, "El estado elegido no es válido."),
});

/**
 * A qué paso del formulario pertenece el primer error, para mandar al usuario
 * ahí en vez de dejarlo mirando un mensaje sin contexto.
 */
export function pasoDelError(error) {
  return primerCampo(error)[0] === "items" ? 1 : 0;
}
