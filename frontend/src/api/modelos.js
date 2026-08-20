import { api } from "./client";
import { validarRespuesta } from "../schemas/comunes.js";
import { listaModelosSchema, modeloSchema } from "../schemas/modelo.js";

// Cada respuesta se valida contra su esquema antes de entrar a la app: si el
// backend cambia de forma, el error se ve acá y no como un `undefined` reventando
// en medio del render.

export const modelosApi = {
  listar: async (soloActivos = false) =>
    validarRespuesta(
      listaModelosSchema,
      await api.get(`/modelos${soloActivos ? "?activos=true" : ""}`),
      "el catálogo de modelos"
    ),

  crear: async (dto) =>
    validarRespuesta(modeloSchema, await api.post("/modelos", dto), "el modelo creado"),

  editar: async (id, dto) =>
    validarRespuesta(
      modeloSchema,
      await api.patch(`/modelos/${id}`, dto),
      "el modelo editado"
    ),
};
