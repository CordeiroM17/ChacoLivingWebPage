import { useEffect, useState } from "react";
import { pedidosApi } from "../api/pedidos";
import { fotoUrl, descargarArchivo } from "../api/fotos";
import { useCatalogo } from "../context/catalogo.js";
import { parsearBorrador } from "../schemas/borrador.js";
import { primerMensaje } from "../schemas/comunes.js";
import {
  construirPedidoDto,
  pasoDelError,
  validarPasoCliente,
  validarPasoItems,
} from "../schemas/pedido.js";
import { formatoMoneda, formatoFecha, formatoMedidasItem, TELAS } from "../utils/format";
import { TIPOS_FACTURA_VALIDOS } from "../schemas/limites.js";
import Aviso from "../components/Aviso";

const PASOS = ["Cliente", "Sillones", "Confirmar", "Factura"];
const BORRADOR_KEY = "chaco_pedido_borrador";

function nuevoItem() {
  return {
    key: crypto.randomUUID(),
    modelo_id: "",
    tela: "",
    telaOtra: "",
    color: "",
    anchoM: "",
    alturaM: "",
    profundidadM: "",
    cantidad: "1",
    precio_unitario: "",
  };
}

// El modelo guarda sus medidas de fábrica en cm; el ítem del pedido las
// trabaja en metros de punta a punta. Esta es la única cuenta que cruza esa
// frontera, y es solo para sugerir un valor inicial: el campo queda igual de
// editable que si se hubiera cargado a mano.
function valorInicialEnMetros(cm) {
  return String(Number(cm) / 100);
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Todo lo que no son ítems viaja junto en un solo objeto. Antes cada campo era
// un `useState` aparte, y sumar uno obligaba a acordarse de cinco lugares
// (estado, guardado del borrador, sus dependencias, limpiar el formulario y el
// DTO); olvidarse de uno hacía que el borrador perdiera ese dato en silencio.
// Con la cabecera junta, agregar un campo acá alcanza: el resto lo recorre por
// claves.
function cabeceraVacia() {
  return {
    clienteNombre: "",
    clienteContacto: "",
    clienteDireccion: "",
    clienteTipoFactura: "",
    clienteEmail: "",
    fechaPedido: hoyISO(),
    fechaPrometida: "",
    notas: "",
  };
}

function cabeceraDesdeBorrador(borrador) {
  const cabecera = cabeceraVacia();
  if (!borrador) return cabecera;
  // Solo las claves que la cabecera declara: si el borrador quedó de una
  // versión con otros campos, los de más se ignoran y los que falten se
  // quedan con su valor por defecto (la fecha, con la de hoy).
  for (const clave of Object.keys(cabecera)) {
    if (borrador[clave]) cabecera[clave] = borrador[clave];
  }
  return cabecera;
}

// El borrador de localStorage pasa por su esquema antes de entrar al estado:
// puede estar corrupto, editado a mano o venir de una versión vieja de la app.
function cargarBorrador() {
  try {
    return parsearBorrador(localStorage.getItem(BORRADOR_KEY));
  } catch {
    return null;
  }
}

export default function TomarPedido() {
  // El catálogo viene del contexto compartido: ya está en memoria desde que se
  // abrió la app, así que esta pantalla no dispara ninguna petición al entrar.
  const { modelos, modelosActivos, cargando: cargandoCatalogo, error: errorCatalogo } =
    useCatalogo();

  // Con inicializador perezoso: se relee de localStorage en cada montaje, no
  // una sola vez al cargar el módulo. Sin esto, ir a otra sección de la app
  // (por ejemplo Catálogos) y volver perdía lo que ya se había guardado del
  // borrador, porque el componente se remonta pero el módulo no se reevalúa.
  const [borradorInicial] = useState(cargarBorrador);
  const [paso, setPaso] = useState(borradorInicial?.paso ?? 0);
  const [cabecera, setCabecera] = useState(() => cabeceraDesdeBorrador(borradorInicial));
  const [items, setItems] = useState(
    borradorInicial?.items?.length ? borradorInicial.items : [nuevoItem()]
  );
  const [pedidoGuardado, setPedidoGuardado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (errorCatalogo) setAviso({ tipo: "error", mensaje: errorCatalogo });
  }, [errorCatalogo]);

  // Un borrador puede quedar días abierto en el navegador y apuntar a un modelo
  // que mientras tanto se dio de baja. Al llegar el catálogo se limpian esos
  // ítems acá, para que el usuario lo resuelva antes de confirmar en vez de
  // comerse el rechazo del backend (que valida lo mismo del lado del servidor).
  useEffect(() => {
    if (pedidoGuardado || cargandoCatalogo || modelosActivos.length === 0) return;
    const vigentes = new Set(modelosActivos.map((m) => String(m.id)));
    const caidos = items.filter((item) => item.modelo_id && !vigentes.has(String(item.modelo_id)));
    if (caidos.length === 0) return;

    setItems((prev) =>
      prev.map((item) =>
        item.modelo_id && !vigentes.has(String(item.modelo_id))
          ? { ...item, modelo_id: "", precio_unitario: "" }
          : item
      )
    );
    setAviso({
      tipo: "error",
      mensaje:
        caidos.length === 1
          ? "Un modelo del borrador ya no está disponible. Elegí otro para ese ítem."
          : `${caidos.length} modelos del borrador ya no están disponibles. Elegilos de nuevo.`,
    });
    setPaso((p) => Math.min(p, 1));
  }, [pedidoGuardado, cargandoCatalogo, modelosActivos, items]);

  // La cabecera se guarda desarmada (plana) para no cambiar el formato del
  // borrador que ya vive en los navegadores: lo que cambió es de dónde sale,
  // no cómo se guarda.
  useEffect(() => {
    if (pedidoGuardado) return;
    localStorage.setItem(BORRADOR_KEY, JSON.stringify({ paso, ...cabecera, items }));
  }, [paso, cabecera, items, pedidoGuardado]);

  function actualizarCabecera(cambios) {
    setCabecera((prev) => ({ ...prev, ...cambios }));
  }

  function actualizarItem(key, cambios) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...cambios } : item))
    );
  }

  function elegirModelo(key, modeloId) {
    const modelo = modelos.find((m) => String(m.id) === String(modeloId));
    actualizarItem(key, {
      modelo_id: modeloId,
      precio_unitario: modelo ? String(modelo.precio_base) : "",
      // Las medidas del modelo son el punto de partida; quedan editables por
      // si este pedido puntual necesita otra cosa.
      anchoM: modelo ? valorInicialEnMetros(modelo.ancho_cm) : "",
      alturaM: modelo ? valorInicialEnMetros(modelo.altura_cm) : "",
      profundidadM: modelo ? valorInicialEnMetros(modelo.profundidad_cm) : "",
    });
  }

  function agregarItem() {
    setItems((prev) => [...prev, nuevoItem()]);
  }

  function quitarItem(key) {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.key !== key) : prev));
  }

  function subtotal(item) {
    const cantidad = Number(item.cantidad) || 0;
    const precio = Number(item.precio_unitario) || 0;
    return cantidad * precio;
  }

  const total = items.reduce((acc, item) => acc + subtotal(item), 0);

  function limpiarFormulario() {
    localStorage.removeItem(BORRADOR_KEY);
    setPaso(0);
    setCabecera(cabeceraVacia());
    setItems([nuevoItem()]);
    setPedidoGuardado(null);
    setAviso(null);
  }

  function siguiente() {
    // Cada paso se valida con el mismo esquema que arma el DTO final, así el
    // error aparece donde se cargó el dato y no recién al confirmar.
    const revision =
      paso === 0
        ? validarPasoCliente(cabecera)
        : paso === 1
          ? validarPasoItems(items)
          : null;

    if (revision && !revision.success) {
      setAviso({ tipo: "error", mensaje: primerMensaje(revision.error) });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setAviso(null);
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function atras() {
    setAviso(null);
    setPaso((p) => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardarPedido(e) {
    e.preventDefault();
    if (paso !== PASOS.length - 1) return;
    setAviso(null);

    // Un solo lugar arma y valida el cuerpo de la petición: el DTO convierte los
    // strings del formulario, descarta lo que es solo de la UI (`key`, `telaOtra`)
    // y aplica los mismos límites que el backend.
    const dto = construirPedidoDto({ ...cabecera, items });

    if (!dto.success) {
      setAviso({ tipo: "error", mensaje: primerMensaje(dto.error) });
      setPaso(pasoDelError(dto.error));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setGuardando(true);
    try {
      const creado = await pedidosApi.crear(dto.data);
      localStorage.removeItem(BORRADOR_KEY);
      setPedidoGuardado(creado);
      setAviso({ tipo: "exito", mensaje: "Pedido guardado correctamente." });
      setPaso(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (creado.comprobante_url) {
        descargarArchivo(creado.comprobante_url, `${creado.codigo}.pdf`).catch(() => {
          setAviso({
            tipo: "error",
            mensaje: "El pedido se guardó, pero no se pudo descargar el comprobante automáticamente.",
          });
        });
      }
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo guardar el pedido." });
    } finally {
      setGuardando(false);
    }
  }

  function descargarComprobante() {
    if (!pedidoGuardado?.comprobante_url) return;
    descargarArchivo(pedidoGuardado.comprobante_url, `${pedidoGuardado.codigo}.pdf`).catch(() => {
      setAviso({ tipo: "error", mensaje: "No se pudo descargar el comprobante." });
    });
  }

  return (
    <div className="pagina">
      <h1>Tomar pedido</h1>
      <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />

      {!pedidoGuardado ? (
        <div className="pasos">
          {PASOS.map((label, idx) => (
            <div
              key={label}
              className={`paso-item${idx === paso ? " paso-actual" : ""}${
                idx < paso ? " paso-hecho" : ""
              }`}
            >
              <span className="paso-numero">{idx + 1}</span>
              <span className="paso-etiqueta">{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="pasos-hecho">✓ Pedido guardado</div>
      )}

      <form onSubmit={guardarPedido} className="formulario">
        {/* `key` distingue paso a paso, y además "confirmado" de "sin confirmar"
            dentro del mismo paso 3: React remonta este bloque en cada cambio,
            así que la entrada suave se repite exactamente donde importa —
            avanzar un paso, o el momento en que el pedido queda guardado. */}
        <div key={pedidoGuardado ? "guardado" : paso} className="vista-entra">
          {paso === 0 && (
            <section className="tarjeta">
              <h2>Cliente</h2>
              <label className="campo">
                Nombre *
                <input
                  type="text"
                  value={cabecera.clienteNombre}
                  onChange={(e) => actualizarCabecera({ clienteNombre: e.target.value })}
                  placeholder="Nombre del cliente"
                  required
                />
              </label>
              <label className="campo">
                Contacto / teléfono *
                <input
                  type="text"
                  value={cabecera.clienteContacto}
                  onChange={(e) => actualizarCabecera({ clienteContacto: e.target.value })}
                  required
                />
              </label>
              <label className="campo">
                Dirección de envío *
                <input
                  type="text"
                  value={cabecera.clienteDireccion}
                  onChange={(e) => actualizarCabecera({ clienteDireccion: e.target.value })}
                  required
                />
              </label>
              <div className="fila-2">
                <label className="campo">
                  Tipo de factura *
                  <select
                    value={cabecera.clienteTipoFactura}
                    onChange={(e) => actualizarCabecera({ clienteTipoFactura: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {TIPOS_FACTURA_VALIDOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  Correo electrónico
                  <input
                    type="email"
                    value={cabecera.clienteEmail}
                    onChange={(e) => actualizarCabecera({ clienteEmail: e.target.value })}
                    placeholder="Opcional"
                  />
                </label>
              </div>
              <div className="fila-2">
                <label className="campo">
                  Fecha del pedido *
                  <input
                    type="date"
                    value={cabecera.fechaPedido}
                    onChange={(e) => actualizarCabecera({ fechaPedido: e.target.value })}
                    required
                  />
                </label>
                <label className="campo">
                  Entrega prometida *
                  <input
                    type="date"
                    value={cabecera.fechaPrometida}
                    onChange={(e) => actualizarCabecera({ fechaPrometida: e.target.value })}
                    required
                  />
                </label>
              </div>
            </section>
          )}

          {paso === 1 && (
            <section className="tarjeta">
              <div className="item-pedido-header">
                <h2 style={{ margin: 0 }}>Sillones</h2>
                <span className="subtotal-parcial">{formatoMoneda(total)}</span>
              </div>
              {items.map((item, idx) => (
                <div key={item.key} className="item-pedido">
                  <div className="item-pedido-header">
                    <strong>Ítem {idx + 1}</strong>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="boton-texto"
                        onClick={() => quitarItem(item.key)}
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  <label className="campo">
                    Modelo *
                    <select
                      value={item.modelo_id}
                      onChange={(e) => elegirModelo(item.key, e.target.value)}
                      required
                    >
                      <option value="">Seleccionar modelo</option>
                      {modelosActivos.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="campo">
                    Tela *
                    <select
                      value={item.tela}
                      onChange={(e) => actualizarItem(item.key, { tela: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar tela</option>
                      {TELAS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      <option value="otra">Otra</option>
                    </select>
                  </label>
                  {item.tela === "otra" && (
                    <label className="campo">
                      Especificar tela *
                      <input
                        type="text"
                        value={item.telaOtra}
                        onChange={(e) => actualizarItem(item.key, { telaOtra: e.target.value })}
                        required
                      />
                    </label>
                  )}

                  <label className="campo">
                    Color *
                    <input
                      type="text"
                      value={item.color}
                      onChange={(e) => actualizarItem(item.key, { color: e.target.value })}
                      required
                    />
                  </label>

                  <div className="fila-3">
                    <label className="campo">
                      Ancho (m) *
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.anchoM}
                        onChange={(e) => actualizarItem(item.key, { anchoM: e.target.value })}
                        placeholder="0.80"
                        required
                      />
                    </label>
                    <label className="campo">
                      Alto (m) *
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.alturaM}
                        onChange={(e) => actualizarItem(item.key, { alturaM: e.target.value })}
                        placeholder="0.90"
                        required
                      />
                    </label>
                    <label className="campo">
                      Profundidad (m) *
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.profundidadM}
                        onChange={(e) =>
                          actualizarItem(item.key, { profundidadM: e.target.value })
                        }
                        placeholder="0.85"
                        required
                      />
                    </label>
                  </div>

                  <div className="fila-2">
                    <label className="campo">
                      Cantidad *
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => actualizarItem(item.key, { cantidad: e.target.value })}
                        required
                      />
                    </label>
                    <label className="campo">
                      Precio unitario *
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.precio_unitario}
                        onChange={(e) =>
                          actualizarItem(item.key, { precio_unitario: e.target.value })
                        }
                        required
                      />
                    </label>
                  </div>

                  <div className="subtotal">Subtotal: {formatoMoneda(subtotal(item))}</div>
                </div>
              ))}

              <button type="button" className="boton-secundario" onClick={agregarItem}>
                + Agregar sillón
              </button>
            </section>
          )}

          {paso === 2 && (
            <>
              <h2>Confirmar</h2>
              <section className="tarjeta factura">
                <div className="factura-encabezado">
                  <div className="factura-cliente">
                    <span className="factura-etiqueta">Cliente</span>
                    <strong>{cabecera.clienteNombre}</strong>
                    <span className="factura-contacto">{cabecera.clienteContacto}</span>
                    <span className="factura-contacto">{cabecera.clienteDireccion}</span>
                    {cabecera.clienteEmail && (
                      <span className="factura-contacto">{cabecera.clienteEmail}</span>
                    )}
                  </div>
                  <div className="factura-fechas">
                    <span>Factura {cabecera.clienteTipoFactura}</span>
                    <span>{formatoFecha(cabecera.fechaPedido)}</span>
                    <span>Entrega: {formatoFecha(cabecera.fechaPrometida)}</span>
                  </div>
                </div>

                <div className="factura-items">
                  {items.map((item, idx) => {
                    const modelo = modelos.find((m) => String(m.id) === String(item.modelo_id));
                    const tela = item.tela === "otra" ? item.telaOtra : item.tela;
                    const medidas = formatoMedidasItem({
                      ancho_m: item.anchoM,
                      altura_m: item.alturaM,
                      profundidad_m: item.profundidadM,
                    });
                    const detalle = [tela, item.color, medidas].filter(Boolean).join(" · ");
                    return (
                      <div key={item.key} className="factura-fila">
                        {modelo?.foto_url ? (
                          <img
                            className="factura-foto"
                            src={fotoUrl(modelo.foto_url)}
                            alt=""
                          />
                        ) : (
                          <div className="factura-foto factura-foto-vacia" aria-hidden="true" />
                        )}
                        <div className="factura-item-info">
                          <strong>{modelo?.nombre || `Ítem ${idx + 1}`}</strong>
                          {detalle && <span>{detalle}</span>}
                        </div>
                        <div className="factura-item-precio">
                          <span>
                            {item.cantidad} × {formatoMoneda(item.precio_unitario)}
                          </span>
                          <strong>{formatoMoneda(subtotal(item))}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="factura-total">
                  <span>Total</span>
                  <strong>{formatoMoneda(total)}</strong>
                </div>
              </section>

              <section className="tarjeta">
                <label className="campo">
                  Notas / observaciones
                  <textarea
                    value={cabecera.notas}
                    onChange={(e) => actualizarCabecera({ notas: e.target.value })}
                    rows={3}
                  />
                </label>
              </section>
            </>
          )}

          {paso === 3 && !pedidoGuardado && (
            <section className="tarjeta confirmacion-final">
              <h2>Confirmar pedido</h2>
              <p>
                Vas a guardar el pedido de <strong>{cabecera.clienteNombre}</strong> con{" "}
                <strong>
                  {items.length} {items.length === 1 ? "ítem" : "ítems"}
                </strong>{" "}
                por un total de <strong>{formatoMoneda(total)}</strong>.
              </p>
              <p>Se va a generar el comprobante en PDF automáticamente al confirmar.</p>
            </section>
          )}

          {paso === 3 && pedidoGuardado && (
            <>
              <h2>Factura</h2>
              <section className="tarjeta factura">
                <div className="factura-encabezado">
                  <div className="factura-cliente">
                    <span className="factura-etiqueta">Comprobante</span>
                    <strong>{pedidoGuardado.codigo}</strong>
                    <span className="factura-contacto">{pedidoGuardado.cliente_nombre}</span>
                    <span className="factura-contacto">{pedidoGuardado.cliente_contacto}</span>
                    <span className="factura-contacto">{pedidoGuardado.cliente_direccion}</span>
                    {pedidoGuardado.cliente_email && (
                      <span className="factura-contacto">{pedidoGuardado.cliente_email}</span>
                    )}
                  </div>
                  <div className="factura-fechas">
                    <span>Factura {pedidoGuardado.cliente_tipo_factura}</span>
                    <span>{formatoFecha(pedidoGuardado.fecha_pedido)}</span>
                    <span>Entrega: {formatoFecha(pedidoGuardado.fecha_prometida)}</span>
                  </div>
                </div>

                <div className="factura-items">
                  {pedidoGuardado.items.map((item) => {
                    const detalle = [item.tela, item.color, formatoMedidasItem(item)]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <div key={item.id} className="factura-fila">
                        {item.modelo.foto_url ? (
                          <img className="factura-foto" src={fotoUrl(item.modelo.foto_url)} alt="" />
                        ) : (
                          <div className="factura-foto factura-foto-vacia" aria-hidden="true" />
                        )}
                        <div className="factura-item-info">
                          <strong>{item.modelo.nombre}</strong>
                          {detalle && <span>{detalle}</span>}
                        </div>
                        <div className="factura-item-precio">
                          <span>
                            {item.cantidad} × {formatoMoneda(item.precio_unitario)}
                          </span>
                          <strong>{formatoMoneda(item.subtotal)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="factura-total">
                  <span>Total</span>
                  <strong>{formatoMoneda(pedidoGuardado.total)}</strong>
                </div>
              </section>
            </>
          )}

          {paso === 3 && pedidoGuardado && !pedidoGuardado.comprobante_url && (
            <Aviso
              tipo="warn"
              mensaje='El pedido se guardó, pero el comprobante no se pudo generar. Podés consultarlo más tarde desde "Ver pedidos".'
            />
          )}
        </div>

        {/* Los botones de navegación quedan fuera de la vista animada: son
            chrome fijo, no contenido del paso — que no se muevan bajo el
            dedo justo cuando se los va a tocar. */}
        <div className="fila-2">
          {paso === 3 && pedidoGuardado ? (
            <>
              {pedidoGuardado.comprobante_url ? (
                <button type="button" className="boton-secundario" onClick={descargarComprobante}>
                  Descargar comprobante
                </button>
              ) : null}
              <button
                type="button"
                className="boton-primario"
                onClick={limpiarFormulario}
                style={pedidoGuardado.comprobante_url ? undefined : { gridColumn: "1 / -1" }}
              >
                Nuevo pedido →
              </button>
            </>
          ) : paso === 3 ? (
            <>
              <button type="button" className="boton-secundario" onClick={atras}>
                ← Atrás
              </button>
              <button type="submit" className="boton-primario" disabled={guardando}>
                {guardando ? "Guardando..." : "Confirmar pedido"}
              </button>
            </>
          ) : (
            <>
              {paso > 0 && (
                <button type="button" className="boton-secundario" onClick={atras}>
                  ← Atrás
                </button>
              )}
              <button
                type="button"
                className="boton-primario"
                onClick={siguiente}
                style={paso === 0 ? { gridColumn: "1 / -1" } : undefined}
              >
                {paso === 2 ? "Confirmar →" : "Siguiente →"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
