// No pasa por client.js: en el momento del login todavía no hay token que
// adjuntar, es justo lo que este llamado va a conseguir.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export const authApi = {
  loginConGoogle: async (credential) => {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      let detail = "No se pudo iniciar sesión.";
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
