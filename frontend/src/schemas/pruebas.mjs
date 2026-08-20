// Pruebas de la capa de esquemas. Se corren con:
//   node src/schemas/pruebas.mjs
//
// No necesitan navegador ni backend: validan que el DTO arme el cuerpo correcto,
// que el borrador de localStorage se sanee, y que las respuestas de la API se
// verifiquen antes de entrar a la app.

import { parsearBorrador } from "./borrador.js";
import { primerMensaje, validarRespuesta } from "./comunes.js";
import { construirModeloDto } from "./modelo.js";
import {
  construirPedidoDto,
  pedidoDetalleSchema,
  pedidosPaginadosSchema,
  validarPasoCliente,
} from "./pedido.js";

let ok = 0;
let fallos = 0;

function caso(nombre, fn) {
  try {
    fn();
    ok += 1;
    console.log(`  PASA   ${nombre}`);
  } catch (e) {
    fallos += 1;
    console.log(`  FALLA  ${nombre}\n         ${e.message}`);
  }
}

function igual(a, b, que) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${que}\n         esperado: ${jb}\n         obtenido: ${ja}`);
}

function rechaza(resultado, fragmentoEsperado) {
  if (resultado.success) throw new Error("se esperaba un rechazo, pero pasó");
  const msg = primerMensaje(resultado.error);
  if (fragmentoEsperado && !msg.includes(fragmentoEsperado)) {
    throw new Error(`mensaje inesperado: "${msg}"`);
  }
}

// Un borrador tal como lo deja la pantalla: todo string, con campos de UI.
const borradorTipico = {
  clienteNombre: "  Juan Pérez  ",
  clienteContacto: "",
  fechaPedido: "2026-08-19",
  fechaPrometida: "",
  notas: "  ",
  items: [
    {
      key: "abc-123",
      modelo_id: "2",
      tela: "chenille",
      telaOtra: "",
      color: " gris ",
      medidas: "",
      cantidad: "2",
      precio_unitario: "290000",
    },
  ],
};

const conItem = (cambios) => ({
  ...borradorTipico,
  items: [{ ...borradorTipico.items[0], ...cambios }],
});

console.log("\n=== A. DTO del pedido: arma el cuerpo correcto ===");

caso("convierte strings a números y limpia espacios", () => {
  const r = construirPedidoDto(borradorTipico);
  if (!r.success) throw new Error(primerMensaje(r.error));
  igual(r.data, {
    cliente_nombre: "Juan Pérez",
    cliente_contacto: null,
    fecha_pedido: "2026-08-19",
    fecha_prometida: null,
    notas: null,
    items: [
      {
        modelo_id: 2,
        cantidad: 2,
        tela: "chenille",
        color: "gris",
        medidas: null,
        precio_unitario: 290000,
      },
    ],
  }, "el cuerpo no es el esperado");
});

caso("descarta los campos que son solo de la UI (key, telaOtra)", () => {
  const r = construirPedidoDto(borradorTipico);
  const claves = Object.keys(r.data.items[0]).sort();
  igual(claves, ["cantidad", "color", "medidas", "modelo_id", "precio_unitario", "tela"], "sobran o faltan claves");
});

caso('resuelve tela "otra" con el texto libre', () => {
  const r = construirPedidoDto(conItem({ tela: "otra", telaOtra: "  gamuza  " }));
  igual(r.data.items[0].tela, "gamuza", "no resolvió la tela");
});

caso("descarta un campo inyectado en el ítem", () => {
  const r = construirPedidoDto(conItem({ subtotal: 999999, id: 7 }));
  if ("subtotal" in r.data.items[0] || "id" in r.data.items[0]) {
    throw new Error("se filtró un campo inyectado");
  }
});

caso("descarta un total inyectado en la cabecera", () => {
  const r = construirPedidoDto({ ...borradorTipico, total: 1, estado: "entregado" });
  if ("total" in r.data || "estado" in r.data) throw new Error("se filtró un campo inyectado");
});

console.log("\n=== B. DTO del pedido: rechaza lo inválido ===");

caso("precio vacío NO se convierte en 0", () =>
  rechaza(construirPedidoDto(conItem({ precio_unitario: "" })), "El precio unitario"));

caso("precio no numérico", () =>
  rechaza(construirPedidoDto(conItem({ precio_unitario: "carísimo" })), "El precio unitario"));

caso("precio negativo", () =>
  rechaza(construirPedidoDto(conItem({ precio_unitario: "-5000" })), "no puede ser menor"));

caso("precio sobre el tope de la columna", () =>
  rechaza(construirPedidoDto(conItem({ precio_unitario: "99999999999999" })), "no puede superar"));

caso("cantidad 0", () =>
  rechaza(construirPedidoDto(conItem({ cantidad: "0" })), "La cantidad"));

caso("cantidad con decimales", () =>
  rechaza(construirPedidoDto(conItem({ cantidad: "2.5" })), "entero"));

caso("cantidad absurda", () =>
  rechaza(construirPedidoDto(conItem({ cantidad: "999999" })), "no puede superar"));

caso("sin modelo elegido", () =>
  rechaza(construirPedidoDto(conItem({ modelo_id: "" })), "El modelo"));

caso("nombre de cliente vacío", () =>
  rechaza(construirPedidoDto({ ...borradorTipico, clienteNombre: "   " }), "El nombre del cliente"));

caso("pedido sin ítems", () =>
  rechaza(construirPedidoDto({ ...borradorTipico, items: [] }), "al menos un ítem"));

caso("más de 50 ítems", () =>
  rechaza(
    construirPedidoDto({ ...borradorTipico, items: Array(60).fill(borradorTipico.items[0]) }),
    "no puede tener más de 50"
  ));

caso("notas demasiado largas", () =>
  rechaza(construirPedidoDto({ ...borradorTipico, notas: "x".repeat(3000) }), "supera el máximo"));

caso("fecha de pedido mal formada", () =>
  rechaza(construirPedidoDto({ ...borradorTipico, fechaPedido: "ayer" }), "formato inválido"));

caso("entrega prometida anterior al pedido", () =>
  rechaza(
    validarPasoCliente({
      clienteNombre: "Juan",
      clienteContacto: "",
      fechaPedido: "2026-08-19",
      fechaPrometida: "2026-08-01",
    }),
    "anterior a la fecha del pedido"
  ));

console.log("\n=== C. DTO de modelo ===");

caso("arma el cuerpo del modelo", () => {
  const r = construirModeloDto({
    nombre: "  Sillón Milán  ",
    descripcion: "",
    precio_base: "180000.50",
    foto_url: "",
  });
  igual(r.data, { nombre: "Sillón Milán", descripcion: null, precio_base: 180000.5, foto_url: null },
    "cuerpo inesperado");
});

caso("rechaza precio vacío", () =>
  rechaza(construirModeloDto({ nombre: "X", descripcion: "", precio_base: "", foto_url: "" }), "El precio"));

caso("rechaza foto de un dominio externo", () =>
  rechaza(
    construirModeloDto({ nombre: "X", descripcion: "", precio_base: "1", foto_url: "https://rastreador.example/p.png" }),
    "subida a este servidor"
  ));

caso("acepta una foto legítima", () => {
  const r = construirModeloDto({ nombre: "X", descripcion: "", precio_base: "1", foto_url: "/uploads/a3f9c2.png" });
  if (!r.success) throw new Error(primerMensaje(r.error));
});

console.log("\n=== D. Borrador de localStorage ===");

caso("JSON roto devuelve null", () => {
  if (parsearBorrador("{esto no es json") !== null) throw new Error("debería descartarse");
});

caso("valor que no es objeto devuelve null", () => {
  if (parsearBorrador('"hola"') !== null) throw new Error("debería descartarse");
});

caso("recupera un borrador válido", () => {
  const b = parsearBorrador(JSON.stringify(borradorTipico));
  igual(b.clienteNombre, "  Juan Pérez  ", "no conservó el nombre");
  igual(b.items.length, 1, "no conservó los ítems");
});

caso("repone los campos rotos en vez de perder el pedido", () => {
  const b = parsearBorrador(
    JSON.stringify({ ...borradorTipico, paso: "tres", clienteNombre: { hack: 1 } })
  );
  igual(b.paso, 0, "no repuso el paso");
  igual(b.clienteNombre, "", "no repuso el nombre");
  igual(b.items[0].modelo_id, "2", "perdió los ítems que sí servían");
});

caso("acota un borrador manipulado con 5000 ítems", () => {
  const b = parsearBorrador(
    JSON.stringify({ ...borradorTipico, items: Array(5000).fill(borradorTipico.items[0]) })
  );
  igual(b.items.length, 50, "no acotó la cantidad de ítems");
});

caso("acota un texto gigante", () => {
  const b = parsearBorrador(JSON.stringify({ ...borradorTipico, notas: "x".repeat(999999) }));
  igual(b.notas.length, 2000, "no acotó las notas");
});

caso("le pone key a un ítem que no la tiene", () => {
  const b = parsearBorrador(
    JSON.stringify({ ...borradorTipico, items: [{ ...borradorTipico.items[0], key: undefined }] })
  );
  if (!b.items[0].key || b.items[0].key.length < 10) throw new Error("no generó la key");
});

console.log("\n=== E. Validación de respuestas de la API ===");

const pedidoValido = {
  id: 1, codigo: "P-2026-0001", cliente_nombre: "Juan", cliente_contacto: null,
  fecha_pedido: "2026-08-19", fecha_prometida: null, estado: "pendiente",
  total: 580000, notas: null, comprobante_url: "/uploads/comprobantes/P-2026-0001.pdf",
  creado_en: "2026-08-19T00:00:00",
};

caso("acepta una página válida", () => {
  const r = validarRespuesta(
    pedidosPaginadosSchema,
    { items: [pedidoValido], total: 1 },
    "la lista de pedidos"
  );
  igual(r.items.length, 1, "no devolvió el pedido");
  igual(r.total, 1, "no devolvió el total");
});

caso("descarta campos que la app no usa", () => {
  const r = validarRespuesta(
    pedidosPaginadosSchema,
    { items: [{ ...pedidoValido, campo_nuevo: "x" }], total: 1 },
    "la lista"
  );
  if ("campo_nuevo" in r.items[0]) throw new Error("no descartó el campo extra");
});

caso("rechaza un estado que no existe", () => {
  try {
    validarRespuesta(
      pedidosPaginadosSchema,
      { items: [{ ...pedidoValido, estado: "facturado" }], total: 1 },
      "la lista de pedidos"
    );
    throw new Error("debería haber fallado");
  } catch (e) {
    if (!e.message.includes("formato inesperado")) throw e;
  }
});

caso("rechaza un total que viene como texto", () => {
  try {
    validarRespuesta(
      pedidosPaginadosSchema,
      { items: [{ ...pedidoValido, total: "580000" }], total: 1 },
      "la lista de pedidos"
    );
    throw new Error("debería haber fallado");
  } catch (e) {
    if (!e.message.includes("formato inesperado")) throw e;
  }
});

caso("rechaza el total de la página cuando viene como texto", () => {
  try {
    validarRespuesta(
      pedidosPaginadosSchema,
      { items: [pedidoValido], total: "1" },
      "la lista de pedidos"
    );
    throw new Error("debería haber fallado");
  } catch (e) {
    if (!e.message.includes("formato inesperado")) throw e;
  }
});

caso("el detalle exige los ítems", () => {
  try {
    validarRespuesta(pedidoDetalleSchema, pedidoValido, "el pedido");
    throw new Error("debería haber fallado");
  } catch (e) {
    if (!e.message.includes("formato inesperado")) throw e;
  }
});

console.log(`\n${"=".repeat(60)}\nRESULTADO: ${ok} pasan, ${fallos} fallan\n${"=".repeat(60)}`);
process.exit(fallos ? 1 : 0);
