import { obtenerToken } from "../utils/sesion";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
const ORIGEN = API_BASE.replace(/\/api\/?$/, "");

export function fotoUrl(url) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${ORIGEN}${url}`;
}

export async function descargarArchivo(url, nombreArchivo) {
  const respuesta = await fetch(fotoUrl(url));
  if (!respuesta.ok) throw new Error("No se pudo descargar el archivo.");
  const blob = await respuesta.blob();
  const blobUrl = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = blobUrl;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(blobUrl);
}

export const fotosApi = {
  subir: async (archivo) => {
    const formData = new FormData();
    formData.append("archivo", archivo);
    const token = obtenerToken();
    const res = await fetch(`${API_BASE}/fotos`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      let detail = "No se pudo subir la imagen.";
      try {
        const data = await res.json();
        detail = data.detail || detail;
      } catch {
        // respuesta sin cuerpo JSON
      }
      throw new Error(detail);
    }
    return res.json();
  },
};
