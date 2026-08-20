import { z } from "zod";
import { api } from "./client";
import { validarRespuesta } from "../schemas/comunes.js";
import { ESTADOS_VALIDOS } from "../schemas/limites.js";
import { pedidoDetalleSchema, pedidosPaginadosSchema } from "../schemas/pedido.js";

export const LIMITE_PEDIDOS = 50;

// Los filtros también se validan: lo que no encaja se descarta en vez de viajar
// en la querystring. `.catch()` hace que un filtro raro se ignore sin romper la
// búsqueda entera.
const filtrosSchema = z.object({
  buscar: z.string().trim().max(100).catch(""),
  estado: z.enum(ESTADOS_VALIDOS).or(z.literal("")).catch(""),
  desde: z.iso.date().or(z.literal("")).catch(""),
  hasta: z.iso.date().or(z.literal("")).catch(""),
  limit: z.coerce.number().int().min(1).max(200).catch(LIMITE_PEDIDOS),
  offset: z.coerce.number().int().min(0).catch(0),
});

function armarQuery(filtros) {
  const limpios = filtrosSchema.parse({
    buscar: filtros.buscar ?? "",
    estado: filtros.estado ?? "",
    desde: filtros.desde ?? "",
    hasta: filtros.hasta ?? "",
    limit: filtros.limit ?? LIMITE_PEDIDOS,
    offset: filtros.offset ?? 0,
  });

  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(limpios)) {
    if (valor) params.set(clave, valor);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const pedidosApi = {
  listar: async (filtros = {}, options) =>
    validarRespuesta(
      pedidosPaginadosSchema,
      await api.get(`/pedidos${armarQuery(filtros)}`, options),
      "la lista de pedidos"
    ),

  obtener: async (id) =>
    validarRespuesta(pedidoDetalleSchema, await api.get(`/pedidos/${id}`), "el pedido"),

  crear: async (dto) =>
    validarRespuesta(pedidoDetalleSchema, await api.post("/pedidos", dto), "el pedido creado"),

  editar: async (id, dto) =>
    validarRespuesta(
      pedidoDetalleSchema,
      await api.patch(`/pedidos/${id}`, dto),
      "el pedido editado"
    ),
};
