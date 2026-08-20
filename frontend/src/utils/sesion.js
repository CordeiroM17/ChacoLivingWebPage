const CLAVE = "chaco_sesion_token";

export function obtenerToken() {
  return localStorage.getItem(CLAVE);
}

export function guardarToken(token) {
  localStorage.setItem(CLAVE, token);
}

export function borrarToken() {
  localStorage.removeItem(CLAVE);
}

export function haySesion() {
  return Boolean(obtenerToken());
}
