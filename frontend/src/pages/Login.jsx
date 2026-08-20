import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useCatalogo } from "../context/catalogo";
import { guardarToken } from "../utils/sesion";
import Aviso from "../components/Aviso";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const contenedorBotonRef = useRef(null);
  const [aviso, setAviso] = useState(null);
  const [validando, setValidando] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { refrescar } = useCatalogo();

  async function manejarCredencial(respuesta) {
    setValidando(true);
    setAviso(null);
    try {
      const { access_token } = await authApi.loginConGoogle(respuesta.credential);
      guardarToken(access_token);
      // El catálogo se pidió antes de tener sesión y falló (401); ahora que
      // hay token, se vuelve a pedir en vez de esperar a que otra pantalla
      // lo dispare.
      refrescar().catch(() => {});
      const destino = location.state?.desde || "/";
      navigate(destino, { replace: true });
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo iniciar sesión." });
      setValidando(false);
    }
  }

  useEffect(() => {
    if (!CLIENT_ID) return;

    // El script de Google (index.html) carga con async/defer: puede no estar
    // listo todavía cuando este componente monta. Se espera a que aparezca.
    let cancelado = false;
    const intervalo = setInterval(() => {
      if (cancelado || !window.google?.accounts?.id) return;
      clearInterval(intervalo);

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: manejarCredencial,
      });
      if (contenedorBotonRef.current) {
        window.google.accounts.id.renderButton(contenedorBotonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          locale: "es",
          width: 280,
        });
      }
    }, 100);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pagina pagina-login">
      <div className="tarjeta tarjeta-login">
        <h1>Chaco Living</h1>
        <p className="login-subtitulo">Iniciá sesión para tomar y consultar pedidos.</p>

        <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />

        {!CLIENT_ID ? (
          <Aviso
            tipo="error"
            mensaje="Falta configurar VITE_GOOGLE_CLIENT_ID en el frontend."
          />
        ) : (
          <div className="login-boton-google" ref={contenedorBotonRef} />
        )}

        {validando && <p className="login-subtitulo">Verificando…</p>}
      </div>
    </div>
  );
}
