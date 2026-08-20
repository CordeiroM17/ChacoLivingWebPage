// Límites de validación, espejados de `backend/app/schemas.py`.
//
// El backend es la autoridad: es el único que no se puede saltear. Estas
// constantes existen para que el usuario vea el error mientras carga el pedido,
// en vez de recién al confirmar. Si cambia un límite allá, hay que cambiarlo acá
// (y al revés) — están duplicados a propósito porque no compartimos runtime
// entre Python y JavaScript.

export const MAX_MONTO = 9_999_999_999.99; // tope de NUMERIC(12,2) en la base
export const MAX_CANTIDAD = 1000;
export const MAX_ITEMS = 50;

export const MAX_NOMBRE = 200;
export const MAX_CONTACTO = 100;
export const MAX_NOTAS = 2000;
export const MAX_DESCRIPCION = 1000;
export const MAX_TEXTO_ITEM = 100; // tela, color, medidas
export const MAX_FOTO_URL = 300;

// Misma forma que devuelve POST /api/fotos.
export const PATRON_FOTO = /^\/uploads\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/i;

export const ESTADOS_VALIDOS = [
  "pendiente",
  "en_proceso",
  "listo",
  "entregado",
  "cancelado",
];
