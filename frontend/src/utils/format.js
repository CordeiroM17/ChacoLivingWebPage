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

/**
 * Medidas en metros: ancho×alto×profundidad. Sirve igual para un modelo del
 * catálogo y para un ítem del pedido — los dos usan la misma unidad y los
 * mismos nombres de campo.
 */
export function formatoMedidas({ ancho_m, altura_m, profundidad_m }) {
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
