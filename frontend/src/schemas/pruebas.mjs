// Pruebas de la capa de esquemas. Se corren con:
//   node src/schemas/pruebas.mjs
//
// No necesitan navegador ni backend: validan que el DTO arme el cuerpo correcto,
// que el borrador de localStorage se sanee, y que las respuestas de la API se
// verifiquen antes de entrar a la app.

import { parsearBorrador } from "./borrador.js";
import { construirCatalogoDto, listaCatalogosSchema, paginaUrl } from "./catalogo.js";
import { primerMensaje, validarRespuesta } from "./comunes.js";
import { construirClienteDto } from "./cliente.js";
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
  clienteId: "",
  clienteNombre: "  Juan Pérez  ",
  clienteContacto: "  11-5555-4444  ",
  clienteDireccion: "  Av. Siempre Viva 742  ",
  clienteTipoFactura: "B",
  clienteEmail: "",
  fechaPedido: "2026-08-19",
  fechaPrometida: "2026-08-25",
  notas: "  ",
  items: [
    {
      key: "abc-123",
      modelo_id: "2",
      tela: "chenille",
      telaOtra: "",
      color: " gris ",
      anchoM: " 1.5 ",
      alturaM: "0.95",
      profundidadM: "0.9",
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
    cliente_id: null,
    cliente_nombre: "Juan Pérez",
    cliente_contacto: "11-5555-4444",
    cliente_direccion: "Av. Siempre Viva 742",
    cliente_tipo_factura: "B",
    cliente_email: null,
    fecha_pedido: "2026-08-19",
    fecha_prometida: "2026-08-25",
    notas: null,
    items: [
      {
        modelo_id: 2,
        cantidad: 2,
        tela: "chenille",
        color: "gris",
        ancho_m: 1.5,
        altura_m: 0.95,
        profundidad_m: 0.9,
        precio_unitario: 290000,
      },
    ],
  }, "el cuerpo no es el esperado");
});

caso("descarta los campos que son solo de la UI (key, telaOtra)", () => {
  const r = construirPedidoDto(borradorTipico);
  const claves = Object.keys(r.data.items[0]).sort();
  igual(
    claves,
    ["altura_m", "ancho_m", "cantidad", "color", "modelo_id", "precio_unitario", "profundidad_m", "tela"],
    "sobran o faltan claves"
  );
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

caso("clienteId vacío → cliente_id null", () => {
  const r = construirPedidoDto({ ...borradorTipico, clienteId: "" });
  igual(r.data.cliente_id, null, "no convirtió a null");
});

caso("clienteId '5' → cliente_id 5 (número)", () => {
  const r = construirPedidoDto({ ...borradorTipico, clienteId: "5" });
  igual(r.data.cliente_id, 5, "no convirtió a número");
});

caso("clienteId inválido se rechaza", () =>
  rechaza(construirPedidoDto({ ...borradorTipico, clienteId: "-3" }), "cliente"));

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

caso("sin tela elegida", () =>
  rechaza(construirPedidoDto(conItem({ tela: "" })), "La tela"));

caso('tela "otra" sin especificar', () =>
  rechaza(construirPedidoDto(conItem({ tela: "otra", telaOtra: "" })), "La tela"));

caso("color vacío", () =>
  rechaza(construirPedidoDto(conItem({ color: "" })), "El color"));

caso("ancho vacío", () =>
  rechaza(construirPedidoDto(conItem({ anchoM: "" })), "El ancho"));

caso("alto en 0", () =>
  rechaza(construirPedidoDto(conItem({ alturaM: "0" })), "La altura"));

caso("profundidad no numérica", () =>
  rechaza(construirPedidoDto(conItem({ profundidadM: "grande" })), "La profundidad"));

caso("ancho sobre el tope de 5 metros", () =>
  rechaza(construirPedidoDto(conItem({ anchoM: "6" })), "no puede superar"));

caso("el ancho queda en metros, sin convertir", () => {
  const r = construirPedidoDto(conItem({ anchoM: "1.25" }));
  if (!r.success) throw new Error(primerMensaje(r.error));
  igual(r.data.items[0].ancho_m, 1.25, "no debería convertir metros a otra unidad");
});

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
      clienteContacto: "11-5555-4444",
      clienteDireccion: "Calle Falsa 123",
      clienteTipoFactura: "A",
      clienteEmail: "",
      fechaPedido: "2026-08-19",
      fechaPrometida: "2026-08-01",
    }),
    "anterior a la fecha del pedido"
  ));

caso("contacto vacío", () =>
  rechaza(construirPedidoDto({ ...borradorTipico, clienteContacto: "" }), "El contacto"));

caso("dirección de envío vacía", () =>
  rechaza(construirPedidoDto({ ...borradorTipico, clienteDireccion: "" }), "La dirección"));

caso("tipo de factura inválido", () =>
  rechaza(construirPedidoDto({ ...borradorTipico, clienteTipoFactura: "Z" }), "tipo de factura"));

caso("correo electrónico mal formado", () =>
  rechaza(construirPedidoDto({ ...borradorTipico, clienteEmail: "no-es-un-correo" }), "correo"));

caso("acepta un correo electrónico válido", () => {
  const r = construirPedidoDto({ ...borradorTipico, clienteEmail: "juan@ejemplo.com" });
  if (!r.success) throw new Error(primerMensaje(r.error));
  igual(r.data.cliente_email, "juan@ejemplo.com", "no conservó el correo");
});

console.log("\n=== C. DTO de modelo ===");

const modeloTipico = {
  nombre: "  Sillón Milán  ",
  descripcion: "",
  precio_base: "180000.50",
  ancho_m: "0.80",
  altura_m: "0.90",
  profundidad_m: "0.85",
  fotos: [],
};

caso("arma el cuerpo del modelo", () => {
  const r = construirModeloDto(modeloTipico);
  igual(
    r.data,
    {
      nombre: "Sillón Milán",
      descripcion: null,
      precio_base: 180000.5,
      profundidad_m: 0.85,
      altura_m: 0.9,
      ancho_m: 0.8,
      fotos: [],
    },
    "cuerpo inesperado"
  );
});

caso("rechaza precio vacío", () =>
  rechaza(construirModeloDto({ ...modeloTipico, precio_base: "" }), "El precio"));

caso("rechaza medida en 0", () =>
  rechaza(construirModeloDto({ ...modeloTipico, ancho_m: "0" }), "El ancho"));

caso("rechaza una foto de un dominio externo", () =>
  rechaza(
    construirModeloDto({ ...modeloTipico, fotos: ["https://rastreador.example/p.png"] }),
    "subida a este servidor"
  ));

caso("rechaza más fotos que el máximo", () =>
  rechaza(
    construirModeloDto({
      ...modeloTipico,
      fotos: Array.from({ length: 13 }, (_, i) => `/uploads/f${i}.webp`),
    }),
    "más de 12"
  ));

caso("acepta varias fotos legítimas y descarta las vacías", () => {
  const r = construirModeloDto({
    ...modeloTipico,
    fotos: ["/uploads/a3f9c2.png", "  ", "/uploads/b7d1e0.webp"],
  });
  if (!r.success) throw new Error(primerMensaje(r.error));
  igual(r.data.fotos, ["/uploads/a3f9c2.png", "/uploads/b7d1e0.webp"], "no limpió las fotos");
});

console.log("\n=== C2. DTO de cliente ===");

const clienteFormTipico = {
  nombre: "  Ferretería Norte  ",
  contacto: "  3794-111  ",
  direccion: "",
  tipo_factura: "",
  email: "",
  localidad: "  Resistencia  ",
  cuit: "",
  notas: "",
};

caso("arma el cuerpo del cliente y normaliza vacíos a null", () => {
  const r = construirClienteDto(clienteFormTipico);
  igual(
    r.data,
    {
      nombre: "Ferretería Norte",
      contacto: "3794-111",
      direccion: null,
      tipo_factura: null,
      email: null,
      localidad: "Resistencia",
      cuit: null,
      notas: null,
    },
    "cuerpo inesperado"
  );
});

caso("rechaza cliente sin nombre", () =>
  rechaza(construirClienteDto({ ...clienteFormTipico, nombre: "   " }), "El nombre"));

caso("acepta tipo de factura válido", () => {
  const r = construirClienteDto({ ...clienteFormTipico, tipo_factura: "A" });
  igual(r.data.tipo_factura, "A", "no conservó el tipo de factura");
});

caso("rechaza tipo de factura inválido", () =>
  rechaza(construirClienteDto({ ...clienteFormTipico, tipo_factura: "Z" }), "tipo de factura"));

caso("rechaza correo mal formado", () =>
  rechaza(construirClienteDto({ ...clienteFormTipico, email: "no-es-correo" }), "correo"));

caso("descarta un campo inyectado", () => {
  const r = construirClienteDto({ ...clienteFormTipico, activo: false, id: 9 });
  if ("activo" in r.data || "id" in r.data) throw new Error("se filtró un campo inyectado");
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

// Guardarraíl: si se agrega un campo al formulario y se olvida de declararlo en
// borradorSchema, el dato se pierde en silencio al volver a la pantalla — el
// usuario ve el pedido a medio cargar sin ese campo y no hay ningún error que
// lo delate. Este caso compara campo por campo en vez de mirar solo algunos.
caso("el borrador conserva TODOS los campos de la cabecera", () => {
  const b = parsearBorrador(JSON.stringify(borradorTipico));
  for (const clave of Object.keys(borradorTipico)) {
    if (clave === "items") continue;
    igual(b[clave], borradorTipico[clave], `se perdió "${clave}" al guardar el borrador`);
  }
});

caso("el borrador conserva TODOS los campos de cada ítem", () => {
  const b = parsearBorrador(JSON.stringify(borradorTipico));
  for (const clave of Object.keys(borradorTipico.items[0])) {
    igual(
      b.items[0][clave],
      borradorTipico.items[0][clave],
      `se perdió "${clave}" del ítem al guardar el borrador`
    );
  }
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

console.log("\n=== E. Catálogos ===");

// El navegador da un File real; en Node se arma uno equivalente para poder
// probar el DTO sin abrir una pantalla.
const pdfFalso = (nombre, tipo, bytes) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });

caso("arma el cuerpo del catálogo", () => {
  const r = construirCatalogoDto({
    nombre: "  Catálogo 2024  ",
    archivo: pdfFalso("c.pdf", "application/pdf", 10),
  });
  if (!r.success) throw new Error(primerMensaje(r.error));
  igual(r.data.nombre, "Catálogo 2024", "no recortó el nombre");
});

caso("rechaza catálogo sin nombre", () =>
  rechaza(
    construirCatalogoDto({ nombre: "   ", archivo: pdfFalso("c.pdf", "application/pdf", 10) }),
    "El nombre"
  ));

caso("rechaza un archivo que no es PDF", () =>
  rechaza(
    construirCatalogoDto({ nombre: "X", archivo: pdfFalso("c.png", "image/png", 10) }),
    "debe ser un PDF"
  ));

caso("rechaza un PDF de más de 60MB", () =>
  rechaza(
    construirCatalogoDto({
      nombre: "X",
      archivo: pdfFalso("c.pdf", "application/pdf", 61 * 1024 * 1024),
    }),
    "60MB"
  ));

caso("rechaza cuando no se eligió archivo", () =>
  rechaza(construirCatalogoDto({ nombre: "X", archivo: null }), "PDF"));

caso("arma la URL de una página con padding y la extensión de la portada", () => {
  const catalogo = { id: 3, portada_url: "/uploads/catalogos/3/pagina-0001.webp" };
  igual(paginaUrl(catalogo, 7), "/uploads/catalogos/3/pagina-0007.webp", "URL inesperada");
  igual(paginaUrl(catalogo, 128), "/uploads/catalogos/3/pagina-0128.webp", "no paginó bien");
});

caso("respeta la extensión vieja de un catálogo ya subido", () => {
  const catalogo = { id: 1, portada_url: "/uploads/catalogos/1/pagina-0001.jpg" };
  igual(paginaUrl(catalogo, 2), "/uploads/catalogos/1/pagina-0002.jpg", "no respetó .jpg");
});

caso("acepta una lista de catálogos de la API", () => {
  const r = validarRespuesta(
    listaCatalogosSchema,
    [
      {
        id: 1,
        nombre: "Catálogo 2024",
        portada_url: "/uploads/catalogos/1/pagina-0001.webp",
        total_paginas: 10,
        creado_en: "2026-08-24T17:00:00",
      },
    ],
    "los catálogos"
  );
  igual(r.length, 1, "no devolvió el catálogo");
});

caso("rechaza un catálogo con 0 páginas", () => {
  try {
    validarRespuesta(
      listaCatalogosSchema,
      [
        {
          id: 1,
          nombre: "X",
          portada_url: "/uploads/catalogos/1/pagina-0001.webp",
          total_paginas: 0,
          creado_en: "2026-08-24T17:00:00",
        },
      ],
      "los catálogos"
    );
    throw new Error("debería haber fallado");
  } catch (e) {
    if (!e.message.includes("formato inesperado")) throw e;
  }
});

console.log("\n=== F. Validación de respuestas de la API ===");

const pedidoValido = {
  id: 1, codigo: "P-2026-0001", cliente_id: 7, cliente_nombre: "Juan", cliente_contacto: "11-5555-4444",
  cliente_direccion: "Calle Falsa 123", cliente_tipo_factura: "B", cliente_email: null,
  fecha_pedido: "2026-08-19", fecha_prometida: "2026-08-25", estado: "pendiente",
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
