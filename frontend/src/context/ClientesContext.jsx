import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clientesApi } from "../api/clientes";
import { listaClientesSchema } from "../schemas/cliente.js";
import { haySesion } from "../utils/sesion";
import { ClientesContext } from "./clientes.js";

// La lista de clientes se necesita en dos pantallas (Tomar pedido y Clientes) y
// cambia poco. En vez de pedirla cada vez que se navega, vive en memoria y se
// respalda en localStorage: al abrir la app se muestra al instante lo cacheado y
// se revalida una sola vez contra el backend, en segundo plano.
//
// Es solo caché de presentación. El backend re-valida todo al confirmar un
// pedido (que el cliente exista y esté activo), porque localStorage es editable
// a mano desde la consola del navegador.

const CACHE_KEY = "chaco_clientes_v1";

function leerCache() {
  try {
    const guardado = localStorage.getItem(CACHE_KEY);
    if (!guardado) return null;
    const datos = listaClientesSchema.safeParse(JSON.parse(guardado)?.clientes);
    return datos.success ? datos.data : null;
  } catch {
    return null;
  }
}

function guardarCache(clientes) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ clientes, guardadoEn: Date.now() }));
  } catch {
    // localStorage lleno o bloqueado: la lista sigue funcionando en memoria
  }
}

export function ClientesProvider({ children }) {
  const cacheInicial = useRef(leerCache()).current;
  const [clientes, setClientes] = useState(cacheInicial ?? []);
  const [cargando, setCargando] = useState(!cacheInicial);
  const [error, setError] = useState(null);
  const yaRevalido = useRef(false);
  const hayDatos = useRef(Boolean(cacheInicial));

  const refrescar = useCallback(async () => {
    try {
      const { items } = await clientesApi.listar();
      hayDatos.current = true;
      setClientes(items);
      setError(null);
      return items;
    } catch (err) {
      setError(err.message || "No se pudieron cargar los clientes.");
      throw err;
    } finally {
      setCargando(false);
    }
  }, []);

  // Una sola revalidación por sesión de app, no por navegación. Si todavía no
  // hay sesión (pantalla de login), ni se intenta.
  useEffect(() => {
    if (yaRevalido.current || !haySesion()) return;
    yaRevalido.current = true;
    refrescar().catch(() => {});
  }, [refrescar]);

  useEffect(() => {
    if (!hayDatos.current) return;
    guardarCache(clientes);
  }, [clientes]);

  // Reemplaza (o agrega) un cliente con la respuesta del POST/PATCH, sin volver
  // a pedir la lista completa ni reordenar el resto (mismo criterio que el
  // catálogo de modelos).
  const aplicarCliente = useCallback((actualizado) => {
    hayDatos.current = true;
    setClientes((prev) => {
      const yaExiste = prev.some((c) => c.id === actualizado.id);
      return yaExiste
        ? prev.map((c) => (c.id === actualizado.id ? actualizado : c))
        : [...prev, actualizado];
    });
  }, []);

  const clientesActivos = useMemo(() => clientes.filter((c) => c.activo), [clientes]);

  const valor = useMemo(
    () => ({ clientes, clientesActivos, cargando, error, refrescar, aplicarCliente }),
    [clientes, clientesActivos, cargando, error, refrescar, aplicarCliente]
  );

  return <ClientesContext.Provider value={valor}>{children}</ClientesContext.Provider>;
}
