import { useEffect, useRef, useState } from "react";
import { LIMITE_PEDIDOS, pedidosApi } from "../api/pedidos";
import { fotoUrl, descargarArchivo } from "../api/fotos";
import { primerMensaje } from "../schemas/comunes.js";
import { estadoDtoSchema } from "../schemas/pedido.js";
import { formatoMoneda, formatoFecha, ESTADOS } from "../utils/format";
import Aviso from "../components/Aviso";

export default function VerPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [buscar, setBuscar] = useState("");
  const [buscarDebounced, setBuscarDebounced] = useState("");
  const [estado, setEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const controladorRef = useRef(null);

  // `reemplazar` distingue una búsqueda nueva (pisa la lista) de "Cargar más"
  // (agrega al final). Las dos pasan por acá para compartir el abort y el
  // manejo de errores.
  async function cargarPedidos(offsetPedido, reemplazar) {
    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;

    if (reemplazar) setCargando(true);
    else setCargandoMas(true);
    try {
      const datos = await pedidosApi.listar(
        { buscar: buscarDebounced, estado, desde, hasta, offset: offsetPedido },
        { signal: controlador.signal }
      );
      setPedidos((prev) => (reemplazar ? datos.items : [...prev, ...datos.items]));
      setTotal(datos.total);
    } catch (err) {
      if (err.name === "AbortError") return;
      setAviso({ tipo: "error", mensaje: err.message || "No se pudieron cargar los pedidos." });
    } finally {
      if (controladorRef.current === controlador) {
        setCargando(false);
        setCargandoMas(false);
      }
    }
  }

  // El texto se debounce (300ms sin tipear) para no disparar una petición por
  // letra; estado y fechas son selecciones discretas y disparan al instante.
  useEffect(() => {
    const timeoutId = setTimeout(() => setBuscarDebounced(buscar), 300);
    return () => clearTimeout(timeoutId);
  }, [buscar]);

  // Cualquier cambio de filtro es una búsqueda nueva: vuelve a la primera
  // página y reemplaza la lista, no la extiende.
  useEffect(() => {
    setOffset(0);
    cargarPedidos(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarDebounced, estado, desde, hasta]);

  function cargarMas() {
    const siguiente = offset + LIMITE_PEDIDOS;
    setOffset(siguiente);
    cargarPedidos(siguiente, false);
  }

  async function abrirDetalle(id) {
    setAviso(null);
    try {
      const detalle = await pedidosApi.obtener(id);
      setPedidoSeleccionado(detalle);
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo abrir el pedido." });
    }
  }

  function descargarComprobante() {
    if (!pedidoSeleccionado?.comprobante_url) return;
    descargarArchivo(
      pedidoSeleccionado.comprobante_url,
      `${pedidoSeleccionado.codigo}.pdf`
    ).catch(() => setAviso({ tipo: "error", mensaje: "No se pudo descargar el comprobante." }));
  }

  async function cambiarEstado(nuevoEstado) {
    const dto = estadoDtoSchema.safeParse({ estado: nuevoEstado });
    if (!dto.success) {
      setAviso({ tipo: "error", mensaje: primerMensaje(dto.error) });
      return;
    }
    try {
      const actualizado = await pedidosApi.editar(pedidoSeleccionado.id, dto.data);
      setPedidoSeleccionado(actualizado);
      setPedidos((prev) =>
        prev.map((p) => (p.id === actualizado.id ? { ...p, estado: actualizado.estado } : p))
      );
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo cambiar el estado." });
    }
  }

  if (pedidoSeleccionado) {
    return (
      <div className="pagina">
        <button className="boton-texto" onClick={() => setPedidoSeleccionado(null)}>
          ← Volver a la lista
        </button>
        <h1>{pedidoSeleccionado.codigo}</h1>
        <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />

        <section className="tarjeta">
          <p><strong>Cliente:</strong> {pedidoSeleccionado.cliente_nombre}</p>
          {pedidoSeleccionado.cliente_contacto && (
            <p><strong>Contacto:</strong> {pedidoSeleccionado.cliente_contacto}</p>
          )}
          <p><strong>Fecha del pedido:</strong> {formatoFecha(pedidoSeleccionado.fecha_pedido)}</p>
          {pedidoSeleccionado.fecha_prometida && (
            <p><strong>Entrega prometida:</strong> {formatoFecha(pedidoSeleccionado.fecha_prometida)}</p>
          )}
          {pedidoSeleccionado.notas && <p><strong>Notas:</strong> {pedidoSeleccionado.notas}</p>}

          {pedidoSeleccionado.comprobante_url ? (
            <div className="fila-2">
              <a
                className="boton-secundario"
                href={fotoUrl(pedidoSeleccionado.comprobante_url)}
                target="_blank"
                rel="noreferrer"
                style={{ textAlign: "center" }}
              >
                Ver comprobante
              </a>
              <button type="button" className="boton-secundario" onClick={descargarComprobante}>
                Descargar
              </button>
            </div>
          ) : (
            <p className="nota-sutil">Este pedido no tiene comprobante generado.</p>
          )}

          <label className="campo">
            Estado
            <select
              value={pedidoSeleccionado.estado}
              onChange={(e) => cambiarEstado(e.target.value)}
            >
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="tarjeta">
          <h2>Ítems</h2>
          {pedidoSeleccionado.items.map((item) => (
            <div key={item.id} className="item-pedido">
              <div className="modelo-nombre-celda" style={{ marginBottom: "0.5rem" }}>
                {item.modelo.foto_url ? (
                  <img className="modelo-foto-mini" src={fotoUrl(item.modelo.foto_url)} alt="" />
                ) : (
                  <div className="modelo-foto-mini modelo-foto-vacia" aria-hidden="true" />
                )}
                <strong>{item.modelo.nombre}</strong>
              </div>
              <p><strong>Cantidad:</strong> {item.cantidad}</p>
              {item.tela && <p><strong>Tela:</strong> {item.tela}</p>}
              {item.color && <p><strong>Color:</strong> {item.color}</p>}
              {item.medidas && <p><strong>Medidas:</strong> {item.medidas}</p>}
              <p><strong>Precio unitario:</strong> {formatoMoneda(item.precio_unitario)}</p>
              <div className="subtotal">Subtotal: {formatoMoneda(item.subtotal)}</div>
            </div>
          ))}
        </section>

        <div className="total-pedido">Total: {formatoMoneda(pedidoSeleccionado.total)}</div>
      </div>
    );
  }

  return (
    <div className="pagina">
      <h1>Ver pedidos</h1>
      <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />

      <div className="tarjeta">
        <label className="campo">
          Buscar por cliente o código
          <input type="text" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </label>
        <div className="fila-2">
          <label className="campo">
            Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
        </div>
        <label className="campo" style={{ marginBottom: 0 }}>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>

      {cargando ? (
        <p>Cargando...</p>
      ) : pedidos.length === 0 ? (
        <p>
          No hay pedidos que coincidan con la búsqueda. Probá ajustar los filtros o cargá el
          primero desde "Tomar pedido".
        </p>
      ) : (
        <div className="pedidos-lista">
          <div className="lista-encabezado">
            <span>Código</span>
            <span>Cliente</span>
            <span>Estado</span>
            <span>Fecha</span>
            <span>Total</span>
          </div>
          <div className="lista-pedidos">
            {pedidos.map((p) => (
              <button key={p.id} className="tarjeta pedido-fila" onClick={() => abrirDetalle(p.id)}>
                <div>
                  <strong>{p.codigo}</strong>
                  <div>{p.cliente_nombre}</div>
                </div>
                <div className="pedido-fila-derecha">
                  <span className={`estado estado-${p.estado}`}>
                    {ESTADOS.find((e) => e.valor === p.estado)?.etiqueta}
                  </span>
                  <span>{formatoFecha(p.fecha_pedido)}</span>
                  <strong>{formatoMoneda(p.total)}</strong>
                </div>
              </button>
            ))}
          </div>

          <div className="paginacion">
            <span className="paginacion-texto">
              Mostrando {pedidos.length} de {total}
            </span>
            {pedidos.length < total && (
              <button
                type="button"
                className="boton-secundario"
                onClick={cargarMas}
                disabled={cargandoMas}
              >
                {cargandoMas ? "Cargando..." : "Cargar más"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
