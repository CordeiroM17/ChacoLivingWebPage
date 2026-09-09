import { useMemo, useRef, useState } from "react";

const MAX_SUGERENCIAS = 8;

// Campo de cliente con autocompletar sobre la lista global (en memoria).
//  - Elegir uno de la lista prellena contacto/dirección/tipo/correo (editables).
//  - Escribir un nombre que no está: al confirmar el pedido el backend lo crea
//    y lo agrega a la lista para la próxima.
export default function ClienteAutocomplete({
  nombre,
  clienteId,
  clientes,
  onEscribir,
  onElegir,
}) {
  const [abierto, setAbierto] = useState(false);
  const cierreRef = useRef(null);

  const elegido = clienteId !== "" && clienteId != null;

  const query = nombre.trim().toLowerCase();
  const sugerencias = useMemo(() => {
    if (!query) return [];
    return clientes
      .filter((c) =>
        [c.nombre, c.contacto, c.localidad]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(query))
      )
      .slice(0, MAX_SUGERENCIAS);
  }, [clientes, query]);

  const hayExacto = clientes.some((c) => c.nombre.trim().toLowerCase() === query);
  const mostrarLista = abierto && !elegido && query.length >= 1;

  function alBlur() {
    // Da tiempo a que el click en una opción se registre antes de cerrar.
    cierreRef.current = setTimeout(() => setAbierto(false), 120);
  }
  function alFocus() {
    clearTimeout(cierreRef.current);
    setAbierto(true);
  }

  return (
    <label className="campo typeahead">
      Cliente *
      <input
        type="text"
        value={nombre}
        onChange={(e) => onEscribir(e.target.value)}
        onFocus={alFocus}
        onBlur={alBlur}
        onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
        placeholder="Buscar un cliente o escribir uno nuevo"
        autoComplete="off"
        required
      />
      {elegido && (
        <span className="typeahead-marca">✓ Cliente de la lista · escribí para cambiar</span>
      )}

      {mostrarLista && (
        <ul className="typeahead-opciones" role="listbox">
          {sugerencias.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="typeahead-opcion"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onElegir(c);
                  setAbierto(false);
                }}
              >
                <strong>{c.nombre}</strong>
                {(c.contacto || c.localidad) && (
                  <span>{[c.contacto, c.localidad].filter(Boolean).join(" · ")}</span>
                )}
              </button>
            </li>
          ))}
          {!hayExacto && (
            <li className="typeahead-nuevo">
              «{nombre.trim()}» es un cliente nuevo — se guarda al confirmar el pedido.
            </li>
          )}
          {sugerencias.length === 0 && hayExacto && (
            <li className="typeahead-nuevo">Ese cliente ya está en la lista.</li>
          )}
        </ul>
      )}
    </label>
  );
}
