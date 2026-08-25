import { api } from "./client";
import { obtenerToken } from "../utils/sesion";
import { validarRespuesta } from "../schemas/comunes.js";
import { catalogoSchema, listaCatalogosSchema } from "../schemas/catalogo.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export { paginaUrl } from "../schemas/catalogo.js";

// Última lista traída en esta sesión de app. Los catálogos cambian muy poco
// (se sube uno cada tanto), así que volver de una sección y entrar de nuevo no
// tiene por qué dejar la pantalla vacía esperando la red: se muestra esto al
// instante y se revalida en segundo plano, igual que hace CatalogoContext con
// los modelos. Vive solo en memoria a propósito — es una comodidad de
// navegación, no una caché que haya que invalidar.
let listaEnMemoria = null;

export function catalogosCacheados() {
  return listaEnMemoria;
}

export const catalogosApi = {
  listar: async () => {
    const datos = validarRespuesta(
      listaCatalogosSchema,
      await api.get("/catalogos"),
      "los catálogos"
    );
    listaEnMemoria = datos;
    return datos;
  },

  obtener: async (id) =>
    validarRespuesta(catalogoSchema, await api.get(`/catalogos/${id}`), "el catálogo"),

  // No pasa por client.js: es multipart, no JSON, así que arma su propia request.
  subir: async ({ nombre, archivo }) => {
    const formData = new FormData();
    formData.append("nombre", nombre);
    formData.append("archivo", archivo);
    const token = obtenerToken();
    const res = await fetch(`${API_BASE}/catalogos`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      let detail = "No se pudo subir el catálogo.";
      try {
        const data = await res.json();
        detail = data.detail || detail;
      } catch {
        // respuesta sin cuerpo JSON
      }
      throw new Error(detail);
    }
    const nuevo = validarRespuesta(catalogoSchema, await res.json(), "el catálogo subido");
    if (listaEnMemoria) listaEnMemoria = [nuevo, ...listaEnMemoria];
    return nuevo;
  },
};
