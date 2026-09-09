import { useEffect, useRef, useState } from "react";
import { fotoUrl } from "../api/fotos";
import { formatoMoneda, formatoMedidas } from "../utils/format";

const UMBRAL_SWIPE = 40; // px mínimos de arrastre para contar como cambio de foto

// Popup a pantalla completa (tapa header y nav, igual que el visor de
// catálogos): resumen de un modelo con todas sus fotos. Las acciones —Editar,
// Activar/Desactivar— viven acá adentro; la lista de Modelos solo abre esto.
export default function ModeloDetalle({ modelo, onCerrar, onEditar, onAlternarActivo }) {
  const [fotoActual, setFotoActual] = useState(0);
  const inicioToqueX = useRef(null);

  const fotos = modelo.fotos ?? [];
  const total = fotos.length;

  function irAFoto(n) {
    if (total === 0) return;
    // Envuelve: de la última pasa a la primera y viceversa, como el carrusel.
    setFotoActual(((n % total) + total) % total);
  }

  // Esc para cerrar, flechas del teclado para cambiar de foto, y bloqueo del
  // scroll de fondo mientras el popup está abierto.
  useEffect(() => {
    function alTeclado(e) {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") irAFoto(fotoActual + 1);
      else if (e.key === "ArrowLeft") irAFoto(fotoActual - 1);
    }
    window.addEventListener("keydown", alTeclado);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = overflowPrevio;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCerrar, fotoActual, total]);

  // Si el modelo cambia (se editó desde el popup) y quedó apuntando a una foto
  // que ya no existe, se vuelve a la primera.
  useEffect(() => {
    if (fotoActual > 0 && fotoActual >= total) setFotoActual(0);
  }, [total, fotoActual]);

  function alEmpezarToque(e) {
    inicioToqueX.current = e.touches.length === 1 ? e.touches[0].clientX : null;
  }

  function alTerminarToque(e) {
    if (inicioToqueX.current === null || e.touches.length > 0) return;
    const delta = e.changedTouches[0].clientX - inicioToqueX.current;
    inicioToqueX.current = null;
    if (delta <= -UMBRAL_SWIPE) irAFoto(fotoActual + 1);
    else if (delta >= UMBRAL_SWIPE) irAFoto(fotoActual - 1);
  }

  const indice = Math.min(fotoActual, Math.max(total - 1, 0));

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
          {total > 0 ? (
            <div className="modal-galeria">
              <div
                className="modal-galeria-lienzo"
                onTouchStart={alEmpezarToque}
                onTouchEnd={alTerminarToque}
              >
                <img
                  key={indice}
                  className="modal-galeria-principal"
                  src={fotoUrl(fotos[indice])}
                  alt={`${modelo.nombre} — foto ${indice + 1}`}
                />
                {total > 1 && (
                  <>
                    <button
                      type="button"
                      className="modal-galeria-flecha izq"
                      onClick={() => irAFoto(indice - 1)}
                      aria-label="Foto anterior"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="modal-galeria-flecha der"
                      onClick={() => irAFoto(indice + 1)}
                      aria-label="Foto siguiente"
                    >
                      ›
                    </button>
                    <span className="modal-galeria-contador">
                      {indice + 1} / {total}
                    </span>
                  </>
                )}
              </div>
              {total > 1 && (
                <div className="modal-galeria-tiras">
                  {fotos.map((f, i) => (
                    <button
                      type="button"
                      key={f}
                      className={`modal-galeria-tira${i === indice ? " activa" : ""}`}
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
