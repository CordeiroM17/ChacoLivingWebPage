import { useEffect, useState } from "react";

const CLAVE_OCULTO = "instalar-app-oculto";

function esStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function esIOS() {
  const ua = window.navigator.userAgent;
  // iPadOS 13+ se hace pasar por "Macintosh"; se lo reconoce por el touch.
  const iPadOS =
    /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadOS;
}

// Banner para instalar la app en la pantalla de inicio.
//   - Android/Chrome: captura beforeinstallprompt y muestra un botón "Instalar".
//   - iPhone/iPad: Safari no expone ese evento -> se muestra la instrucción
//     manual (Compartir -> Agregar a inicio).
// Se puede descartar; la elección queda guardada en localStorage.
export default function InstalarApp() {
  const [evento, setEvento] = useState(null);
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_OCULTO) === "1";
    } catch {
      return false;
    }
  });
  const [instalado, setInstalado] = useState(esStandalone);

  useEffect(() => {
    function alPrompt(e) {
      e.preventDefault();
      setEvento(e);
    }
    function alInstalar() {
      setInstalado(true);
    }
    window.addEventListener("beforeinstallprompt", alPrompt);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPrompt);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  const ios = esIOS();

  if (instalado || oculto) return null;
  // En Android sin evento todavía no hay nada que ofrecer; en iOS siempre se
  // puede mostrar la instrucción manual.
  if (!evento && !ios) return null;

  function descartar() {
    setOculto(true);
    try {
      localStorage.setItem(CLAVE_OCULTO, "1");
    } catch {
      /* modo privado: se vuelve a mostrar la próxima vez, aceptable */
    }
  }

  async function instalar() {
    if (!evento) return;
    evento.prompt();
    await evento.userChoice;
    setEvento(null);
  }

  return (
    <div className="banner-instalar" role="region" aria-label="Instalar aplicación">
      <div className="banner-instalar-texto">
        <strong>Instalá Chaco Living</strong>
        {ios ? (
          <span>
            Tocá <span aria-hidden="true">⎋</span> Compartir y después
            “Agregar a inicio”.
          </span>
        ) : (
          <span>Accedé más rápido desde la pantalla de inicio.</span>
        )}
      </div>
      <div className="banner-instalar-acciones">
        {!ios && (
          <button type="button" className="banner-instalar-boton" onClick={instalar}>
            Instalar
          </button>
        )}
        <button
          type="button"
          className="banner-instalar-cerrar"
          onClick={descartar}
          aria-label="No mostrar de nuevo"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
