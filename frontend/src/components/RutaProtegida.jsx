import { Navigate, useLocation } from "react-router-dom";
import { haySesion } from "../utils/sesion";

// Bloquea el acceso sincrónicamente si no hay token guardado. El caso "hay
// token pero el backend lo rechaza" (vencido, inválido) lo resuelve
// client.js al primer 401, redirigiendo igual — esto solo cubre el caso
// obvio de entrar sin haber iniciado sesión nunca.
export default function RutaProtegida({ children }) {
  const location = useLocation();
  if (!haySesion()) {
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  }
  return children;
}
