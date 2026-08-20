import { borrarToken, obtenerToken } from "../utils/sesion";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

async function request(path, options = {}) {
  const token = obtenerToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // La sesión venció o el token dejó de ser válido: no tiene sentido seguir
    // reintentando, hay que volver a iniciar sesión.
    borrarToken();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    throw new Error("La sesión expiró. Iniciá sesión de nuevo.");
  }

  if (!res.ok) {
    let detail = "Ocurrió un error inesperado.";
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
};
