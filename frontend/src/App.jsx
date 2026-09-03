import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { CatalogoProvider } from "./context/CatalogoContext";
import RutaProtegida from "./components/RutaProtegida";
import Nav from "./components/Nav";
import InstalarApp from "./components/InstalarApp";
import ActualizarApp from "./components/ActualizarApp";
import Login from "./pages/Login";
import TomarPedido from "./pages/TomarPedido";
import VerPedidos from "./pages/VerPedidos";
import DetallePedido from "./pages/DetallePedido";
import Modelos from "./pages/Modelos";
import Catalogos from "./pages/Catalogos";
import VisorCatalogo from "./pages/VisorCatalogo";
import { borrarToken, haySesion } from "./utils/sesion";
import "./App.css";

function Marca() {
  return (
    <div className="marca">
      <svg className="marca-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8.3" fill="var(--accent-500)" />
        <rect x="8" y="7.5" width="16" height="10" rx="3" fill="white" />
        <rect x="4" y="12" width="5.5" height="11" rx="2.5" fill="white" />
        <rect x="22.5" y="12" width="5.5" height="11" rx="2.5" fill="white" />
        <rect x="6" y="16" width="20" height="7.5" rx="3" fill="white" />
        <rect x="8" y="23.5" width="2.4" height="3.2" rx="1" fill="white" />
        <rect x="21.6" y="23.5" width="2.4" height="3.2" rx="1" fill="white" />
      </svg>
      <span className="marca-texto">Chaco Living</span>
    </div>
  );
}

function BotonSalir() {
  const navigate = useNavigate();
  if (!haySesion()) return null;

  function salir() {
    borrarToken();
    navigate("/login", { replace: true });
  }

  return (
    <button type="button" className="boton-salir" onClick={salir} aria-label="Cerrar sesión">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9" />
        <path d="M10 12h11M17.5 8.5 21 12l-3.5 3.5" />
      </svg>
      <span>Salir</span>
    </button>
  );
}

function Cuerpo() {
  // El Nav (Tomar pedido / Ver pedidos / Modelos) no tiene sentido en la
  // pantalla de login: todas sus rutas están protegidas y solo rebotarían de
  // vuelta acá.
  const enLogin = useLocation().pathname === "/login";
  return (
    <div className="cuerpo">
      {!enLogin && <Nav />}
      <main className="contenido">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RutaProtegida>
                <TomarPedido />
              </RutaProtegida>
            }
          />
          <Route
            path="/pedidos"
            element={
              <RutaProtegida>
                <VerPedidos />
              </RutaProtegida>
            }
          />
          <Route
            path="/pedidos/:id"
            element={
              <RutaProtegida>
                <DetallePedido />
              </RutaProtegida>
            }
          />
          <Route
            path="/modelos"
            element={
              <RutaProtegida>
                <Modelos />
              </RutaProtegida>
            }
          />
          <Route
            path="/catalogos"
            element={
              <RutaProtegida>
                <Catalogos />
              </RutaProtegida>
            }
          />
          <Route
            path="/catalogos/:id"
            element={
              <RutaProtegida>
                <VisorCatalogo />
              </RutaProtegida>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CatalogoProvider>
        <div className="app">
          <header className="encabezado">
            <Marca />
            <BotonSalir />
          </header>
          <InstalarApp />
          <Cuerpo />
          <ActualizarApp />
        </div>
        <Analytics />
      </CatalogoProvider>
    </BrowserRouter>
  );
}
