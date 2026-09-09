import { createContext, useContext } from "react";

// El contexto y su hook viven en un archivo aparte del provider: React Fast
// Refresh solo funciona si un archivo .jsx exporta únicamente componentes.
export const ClientesContext = createContext(null);

export function useClientes() {
  const contexto = useContext(ClientesContext);
  if (!contexto) {
    throw new Error("useClientes debe usarse dentro de un ClientesProvider");
  }
  return contexto;
}
