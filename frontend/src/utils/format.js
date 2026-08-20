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

export const ESTADOS = [
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "en_proceso", etiqueta: "En proceso" },
  { valor: "listo", etiqueta: "Listo" },
  { valor: "entregado", etiqueta: "Entregado" },
  { valor: "cancelado", etiqueta: "Cancelado" },
];

export const TELAS = ["Chenille", "Pana", "Lino", "Ecocuero"];
