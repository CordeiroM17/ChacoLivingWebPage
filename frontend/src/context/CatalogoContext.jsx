import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { modelosApi } from "../api/modelos";
import { listaModelosSchema } from "../schemas/modelo.js";
import { haySesion } from "../utils/sesion";
import { CatalogoContext } from "./catalogo.js";

// El catálogo de modelos cambia poco y lo necesitan dos pantallas (Tomar pedido
// y Modelos). En vez de pedirlo cada vez que se navega, vive en memoria y se
// respalda en localStorage: al abrir la app se muestra al instante lo cacheado
// y se revalida una sola vez contra el backend, en segundo plano.
//
// Ojo: esta caché es solo de presentación. Lo que se manda al confirmar un
// pedido lo vuelve a validar el backend contra la base (modelo existente y
// activo, precios y cantidades en rango), porque localStorage es editable a
// mano desde la consola del navegador.

const CACHE_KEY = "chaco_catalogo_modelos_v1";

function leerCache() {
  try {
    const guardado = localStorage.getItem(CACHE_KEY);
    if (!guardado) return null;
    // La caché se valida con el mismo esquema que las respuestas de la API: si
    // quedó de una versión vieja o alguien la editó a mano, se descarta entera y
    // se espera la revalidación en vez de renderizar datos rotos.
    const datos = listaModelosSchema.safeParse(JSON.parse(guardado)?.modelos);
    return datos.success ? datos.data : null;
  } catch {
    return null;
  }
}

function guardarCache(modelos) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ modelos, guardadoEn: Date.now() }));
  } catch {
    // localStorage lleno o bloqueado: el catálogo sigue funcionando en memoria
  }
}

export function CatalogoProvider({ children }) {
  const cacheInicial = useRef(leerCache()).current;
  const [modelos, setModelos] = useState(cacheInicial ?? []);
  // Solo se muestra "cargando" cuando no hay nada cacheado para mostrar mientras
  // tanto; si lo hay, la pantalla aparece llena de entrada.
  const [cargando, setCargando] = useState(!cacheInicial);
  const [error, setError] = useState(null);
  const yaRevalido = useRef(false);
  const hayDatos = useRef(Boolean(cacheInicial));

  const refrescar = useCallback(async () => {
    try {
      const datos = await modelosApi.listar(false);
      hayDatos.current = true;
      setModelos(datos);
      setError(null);
      return datos;
    } catch (err) {
      setError(err.message || "No se pudieron cargar los modelos.");
      throw err;
    } finally {
      setCargando(false);
    }
  }, []);

  // Una sola revalidación por sesión de app, no por navegación entre secciones.
  // Si todavía no hay sesión (pantalla de login), ni se intenta: evita un
  // 401 desperdiciado antes de que la persona termine de iniciar sesión.
  // Login.jsx llama a refrescar() a mano apenas hay token.
  useEffect(() => {
    if (yaRevalido.current || !haySesion()) return;
    yaRevalido.current = true;
    refrescar().catch(() => {});
  }, [refrescar]);

  // Se persiste recién cuando hay datos reales, para no pisar la caché con un
  // array vacío durante el primer render.
  useEffect(() => {
    if (!hayDatos.current) return;
    guardarCache(modelos);
  }, [modelos]);

  // Reemplaza (o agrega) un modelo con la respuesta del POST/PATCH, sin volver a
  // pedir la lista completa. Ordena por nombre, igual que GET /modelos.
  const aplicarModelo = useCallback((actualizado) => {
    hayDatos.current = true;
    setModelos((prev) =>
      [...prev.filter((m) => m.id !== actualizado.id), actualizado].sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      )
    );
  }, []);

  const modelosActivos = useMemo(() => modelos.filter((m) => m.activo), [modelos]);

  const valor = useMemo(
    () => ({ modelos, modelosActivos, cargando, error, refrescar, aplicarModelo }),
    [modelos, modelosActivos, cargando, error, refrescar, aplicarModelo]
  );

  return <CatalogoContext.Provider value={valor}>{children}</CatalogoContext.Provider>;
}
