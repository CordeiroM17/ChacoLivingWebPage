import { z } from "zod";
import { api } from "./client";
import { validarRespuesta } from "../schemas/comunes.js";
import { clienteSchema, clientesPaginadosSchema } from "../schemas/cliente.js";

export const LIMITE_CLIENTES = 500; // la lista se trae entera al frontend (typeahead)

const filtrosSchema = z.object({
  buscar: z.string().trim().max(100).catch(""),
  activos: z.union([z.literal(""), z.literal("true"), z.literal("false")]).catch(""),
  limit: z.coerce.number().int().min(1).max(LIMITE_CLIENTES).catch(LIMITE_CLIENTES),
  offset: z.coerce.number().int().min(0).catch(0),
});

function armarQuery(filtros) {
  const limpios = filtrosSchema.parse({
    buscar: filtros.buscar ?? "",
    activos: filtros.activos ?? "",
    limit: filtros.limit ?? LIMITE_CLIENTES,
    offset: filtros.offset ?? 0,
  });
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(limpios)) {
    if (valor) params.set(clave, valor);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const clientesApi = {
  listar: async (filtros = {}, options) =>
    validarRespuesta(
      clientesPaginadosSchema,
      await api.get(`/clientes${armarQuery(filtros)}`, options),
      "la lista de clientes"
    ),

  crear: async (dto) =>
    validarRespuesta(clienteSchema, await api.post("/clientes", dto), "el cliente creado"),

  editar: async (id, dto) =>
    validarRespuesta(
      clienteSchema,
      await api.patch(`/clientes/${id}`, dto),
      "el cliente editado"
    ),
};
