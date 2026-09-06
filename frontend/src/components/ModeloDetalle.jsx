import { useEffect, useState } from "react";
import { fotoUrl } from "../api/fotos";
import { formatoMoneda, formatoMedidas } from "../utils/format";

// Popup a pantalla completa (tapa header y nav, igual que el visor de
// catálogos): resumen de un modelo con todas sus fotos. Las acciones —Editar,
// Activar/Desactivar— viven acá adentro; la lista de Modelos solo abre esto.
export default function ModeloDetalle({ modelo, onCerrar, onEditar, onAlternarActivo }) {
  const [fotoActual, setFotoActual] = useState(0);

  // Esc para cerrar y bloqueo del scroll de fondo mientras está abierto.
  useEffect(() => {
    function alTeclado(e) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", alTeclado);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  const fotos = modelo.fotos ?? [];

  // Si el modelo cambia (se editó desde el popup) y tenía seleccionada una foto
  // que ya no existe, se vuelve a la primera.
  useEffect(() => {
    if (fotoActual > 0 && fotoActual >= fotos.length) setFotoActual(0);
  }, [fotos.length, fotoActual]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${modelo.nombre}`}
      onClick={onCerrar}
    >
      <div className="modal-modelo" onClick={(e) => e.stopPropagation()}>
        <div className="modal-modelo-cabecera">
          <strong className="modal-modelo-titulo">{modelo.nombre}</strong>
          <button
            type="button"
            className="modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="modal-modelo-cuerpo">
          {fotos.length > 0 ? (
            <div className="modal-galeria">
              <img
                className="modal-galeria-principal"
                src={fotoUrl(fotos[Math.min(fotoActual, fotos.length - 1)])}
                alt={`${modelo.nombre} — foto ${fotoActual + 1}`}
              />
              {fotos.length > 1 && (
                <div className="modal-galeria-tiras">
                  {fotos.map((f, i) => (
                    <button
                      type="button"
                      key={f}
                      className={`modal-galeria-tira${i === fotoActual ? " activa" : ""}`}
                      onClick={() => setFotoActual(i)}
                      aria-label={`Ver foto ${i + 1}`}
                    >
                      <img src={fotoUrl(f)} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="modal-galeria-vacia">Sin fotos cargadas</div>
          )}

          <dl className="modal-modelo-datos">
            <div>
              <dt>Precio base</dt>
              <dd>{formatoMoneda(modelo.precio_base)}</dd>
            </div>
            <div>
              <dt>Medidas (A×Al×P)</dt>
              <dd>{formatoMedidas(modelo) || "—"}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <span
                  className={`estado ${
                    modelo.activo ? "estado-entregado" : "estado-cancelado"
                  }`}
                >
                  {modelo.activo ? "Activo" : "Inactivo"}
                </span>
              </dd>
            </div>
            {modelo.descripcion && (
              <div className="modal-modelo-datos-ancho">
                <dt>Descripción</dt>
                <dd>{modelo.descripcion}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="modal-modelo-acciones">
          <button type="button" className="boton-primario" onClick={() => onEditar(modelo)}>
            Editar
          </button>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => onAlternarActivo(modelo)}
          >
            {modelo.activo ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>
    </div>
  );
}
