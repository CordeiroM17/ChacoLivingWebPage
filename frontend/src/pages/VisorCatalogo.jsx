import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { catalogosApi, paginaUrl } from "../api/catalogos";
import { fotoUrl } from "../api/fotos";
import Aviso from "../components/Aviso";

const UMBRAL_SWIPE = 50; // px mínimos de desplazamiento para contar como página

// Overlay fijo a pantalla completa (tapa el header y el nav, no solo el
// contenido): se comporta como un popup en vez de una vista más de la app.
export default function VisorCatalogo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // La grilla de Catálogos ya tiene el catálogo entero cuando se toca una
  // tarjeta, así que lo manda en el state de la navegación. Sin esto había que
  // esperar un GET /catalogos/{id} antes de siquiera *empezar* a bajar la
  // primera página: dos viajes en serie para abrir algo que ya estaba en
  // memoria. Se sigue pidiendo a la API solo cuando no viene por ese camino
  // (link directo, recargar la página, volver con el historial).
  const precargado =
    location.state?.catalogo?.id === Number(id) ? location.state.catalogo : null;

  const [catalogo, setCatalogo] = useState(precargado);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(!precargado);
  const [aviso, setAviso] = useState(null);
  const inicioToqueX = useRef(null);

  useEffect(() => {
    if (precargado) return;
    setCargando(true);
    setAviso(null);
    catalogosApi
      .obtener(id)
      .then((c) => {
        setCatalogo(c);
        setPagina(1);
      })
      .catch((err) => setAviso({ tipo: "error", mensaje: err.message || "No se pudo abrir el catálogo." }))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Precarga la página siguiente y la anterior para que el swipe se sienta
  // instantáneo; el navegador las deja en caché (son inmutables, ver main.py).
  useEffect(() => {
    if (!catalogo) return;
    [pagina - 1, pagina + 1].forEach((n) => {
      if (n < 1 || n > catalogo.total_paginas) return;
      const img = new Image();
      img.src = fotoUrl(paginaUrl(catalogo, n));
    });
  }, [catalogo, pagina]);

  useEffect(() => {
    function alTeclado(e) {
      if (e.key === "ArrowRight") irA(pagina + 1);
      else if (e.key === "ArrowLeft") irA(pagina - 1);
      else if (e.key === "Escape") navigate("/catalogos");
    }
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, catalogo]);

  function irA(n) {
    if (!catalogo || n < 1 || n > catalogo.total_paginas) return;
    setPagina(n);
  }

  function alEmpezarToque(e) {
    // Con dos dedos en pantalla es un pinch-to-zoom, no un swipe: no se
    // registra arranque, así el pellizco queda libre para el zoom nativo.
    inicioToqueX.current = e.touches.length === 1 ? e.touches[0].clientX : null;
  }

  function alMoverToque(e) {
    if (e.touches.length > 1) inicioToqueX.current = null;
  }

  function alTerminarToque(e) {
    // Si queda algún dedo apoyado (venía de un pinch) tampoco es un swipe.
    if (inicioToqueX.current === null || e.touches.length > 0) return;
    const delta = e.changedTouches[0].clientX - inicioToqueX.current;
    inicioToqueX.current = null;
    if (delta <= -UMBRAL_SWIPE) irA(pagina + 1);
    else if (delta >= UMBRAL_SWIPE) irA(pagina - 1);
  }

  return (
    <div className="visor-catalogo vista-entra">
      <div className="visor-cabecera">
        <span className="visor-titulo">{catalogo?.nombre || ""}</span>
        <Link className="visor-cerrar" to="/catalogos" aria-label="Cerrar catálogo">
          ×
        </Link>
      </div>

      {cargando ? (
        <p className="visor-mensaje">Cargando...</p>
      ) : !catalogo ? (
        <div className="visor-mensaje">
          <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />
        </div>
      ) : (
        <>
          <div
            className="visor-lienzo"
            onTouchStart={alEmpezarToque}
            onTouchMove={alMoverToque}
            onTouchEnd={alTerminarToque}
          >
            <button
              type="button"
              className="visor-flecha visor-flecha-izq"
              onClick={() => irA(pagina - 1)}
              disabled={pagina <= 1}
              aria-label="Página anterior"
            >
              ‹
            </button>

            <img
              key={pagina}
              className="visor-pagina"
              src={fotoUrl(paginaUrl(catalogo, pagina))}
              alt={`Página ${pagina} de ${catalogo.total_paginas}`}
            />

            <button
              type="button"
              className="visor-flecha visor-flecha-der"
              onClick={() => irA(pagina + 1)}
              disabled={pagina >= catalogo.total_paginas}
              aria-label="Página siguiente"
            >
              ›
            </button>
          </div>

          <p className="visor-contador">
            Página {pagina} de {catalogo.total_paginas}
          </p>
        </>
      )}
    </div>
  );
}
