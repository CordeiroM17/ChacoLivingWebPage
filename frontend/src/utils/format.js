export function formatoMoneda(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function formatoFecha(fechaISO) {
  if (!fechaISO) return "";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Medidas de un modelo del catálogo: ancho×alto×profundidad en cm. */
export function formatoMedidas({ ancho_cm, altura_cm, profundidad_cm }) {
  if (ancho_cm == null || altura_cm == null || profundidad_cm == null) return "";
  return `${ancho_cm}×${altura_cm}×${profundidad_cm} cm`;
}

/** Medidas de un ítem del pedido: ancho×alto×profundidad en metros. */
export function formatoMedidasItem({ ancho_m, altura_m, profundidad_m }) {
  if (ancho_m == null || altura_m == null || profundidad_m == null) return "";
  return `${ancho_m}×${altura_m}×${profundidad_m} m`;
}

export const ESTADOS = [
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "en_proceso", etiqueta: "En proceso" },
  { valor: "listo", etiqueta: "Listo" },
  { valor: "entregado", etiqueta: "Entregado" },
  { valor: "cancelado", etiqueta: "Cancelado" },
];

export const TELAS = ["Chenille", "Pana", "Lino", "Ecocuero"];
