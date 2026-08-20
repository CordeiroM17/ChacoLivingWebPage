import { createContext, useContext } from "react";

// El contexto y su hook viven en un archivo aparte del provider: React Fast
// Refresh solo funciona si un archivo .jsx exporta únicamente componentes.
export const CatalogoContext = createContext(null);

export function useCatalogo() {
  const contexto = useContext(CatalogoContext);
  if (!contexto) {
    throw new Error("useCatalogo debe usarse dentro de un CatalogoProvider");
  }
  return contexto;
}
