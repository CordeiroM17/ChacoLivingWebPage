import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { pedidosApi } from "../api/pedidos";
import { fotoUrl, descargarArchivo } from "../api/fotos";
import { primerMensaje } from "../schemas/comunes.js";
import { estadoDtoSchema } from "../schemas/pedido.js";
import { formatoMoneda, formatoFecha, formatoMedidasItem, ESTADOS } from "../utils/format";
import Aviso from "../components/Aviso";

export default function DetallePedido() {
  const { id } = useParams();
  const [pedido, setPedido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [regenerando, setRegenerando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    setCargando(true);
    setAviso(null);
    pedidosApi
      .obtener(id)
      .then(setPedido)
      .catch((err) => setAviso({ tipo: "error", mensaje: err.message || "No se pudo abrir el pedido." }))
      .finally(() => setCargando(false));
  }, [id]);

  function descargarComprobante() {
    if (!pedido?.comprobante_url) return;
    descargarArchivo(pedido.comprobante_url, `${pedido.codigo}.pdf`).catch(() =>
      setAviso({ tipo: "error", mensaje: "No se pudo descargar el comprobante." })
    );
  }

  // El comprobante es dato derivado: se reconstruye entero desde el pedido
  // guardado. Sirve si la generación falló al crear el pedido, o si el archivo
  // se perdió (un redeploy sin volumen persistente borra los uploads).
  async function regenerarComprobante() {
    setRegenerando(true);
    setAviso(null);
    try {
      const actualizado = await pedidosApi.regenerarComprobante(pedido.id);
      setPedido(actualizado);
      setAviso({ tipo: "exito", mensaje: "Comprobante generado de nuevo." });
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo generar el comprobante." });
    } finally {
      setRegenerando(false);
    }
  }

  async function cambiarEstado(nuevoEstado) {
    const dto = estadoDtoSchema.safeParse({ estado: nuevoEstado });
    if (!dto.success) {
      setAviso({ tipo: "error", mensaje: primerMensaje(dto.error) });
      return;
    }
    try {
      const actualizado = await pedidosApi.editar(pedido.id, dto.data);
      setPedido(actualizado);
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo cambiar el estado." });
    }
  }

  if (cargando) {
    return (
      <div className="pagina">
        <Link className="boton-texto" to="/pedidos">
          ← Volver a la lista
        </Link>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="pagina">
        <Link className="boton-texto" to="/pedidos">
          ← Volver a la lista
        </Link>
        <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />
      </div>
    );
  }

  return (
    <div className="pagina vista-entra">
      <Link className="boton-texto" to="/pedidos">
        ← Volver a la lista
      </Link>
      <h1>{pedido.codigo}</h1>
      <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />

      <section className="tarjeta tarjeta-con-accion">
        {/* Arriba a la derecha y discreto: con el comprobante ya disponible
            esto es la salida de emergencia (el archivo se perdió del disco),
            no una acción que se busque a diario. Un pedido cancelado no la
            ofrece: no tiene sentido regenerar un comprobante formal de algo
            que no se concretó, aunque haya quedado uno de antes de cancelarlo. */}
        {pedido.comprobante_url && pedido.estado !== "cancelado" && (
          <button
            type="button"
            className="boton-esquina"
            onClick={regenerarComprobante}
            disabled={regenerando}
          >
            {regenerando ? "Generando…" : "Generar de nuevo"}
          </button>
        )}

        <p><strong>Cliente:</strong> {pedido.cliente_nombre}</p>
        <p><strong>Contacto:</strong> {pedido.cliente_contacto}</p>
        <p><strong>Dirección de envío:</strong> {pedido.cliente_direccion}</p>
        <p><strong>Tipo de factura:</strong> {pedido.cliente_tipo_factura}</p>
        {pedido.cliente_email && (
          <p><strong>Correo electrónico:</strong> {pedido.cliente_email}</p>
        )}
        <p><strong>Fecha del pedido:</strong> {formatoFecha(pedido.fecha_pedido)}</p>
        <p><strong>Entrega prometida:</strong> {formatoFecha(pedido.fecha_prometida)}</p>
        {pedido.notas && <p><strong>Notas:</strong> {pedido.notas}</p>}

        {pedido.comprobante_url ? (
          <div className="fila-2">
            <a
              className="boton-secundario"
              href={fotoUrl(pedido.comprobante_url)}
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
        ) : pedido.estado === "cancelado" ? (
          <p className="nota-sutil">Los pedidos cancelados no generan comprobante.</p>
        ) : (
          <>
            <p className="nota-sutil">Este pedido no tiene comprobante generado.</p>
            <button
              type="button"
              className="boton-secundario"
              onClick={regenerarComprobante}
              disabled={regenerando}
            >
              {regenerando ? "Generando..." : "Generar comprobante"}
            </button>
          </>
        )}

        <label className="campo">
          Estado
          <select value={pedido.estado} onChange={(e) => cambiarEstado(e.target.value)}>
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
        {pedido.items.map((item) => (
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
            {item.ancho_m != null && (
              <p><strong>Medidas:</strong> {formatoMedidasItem(item)}</p>
            )}
            <p><strong>Precio unitario:</strong> {formatoMoneda(item.precio_unitario)}</p>
            <div className="subtotal">Subtotal: {formatoMoneda(item.subtotal)}</div>
          </div>
        ))}
      </section>

      <div className="total-pedido">Total: {formatoMoneda(pedido.total)}</div>
    </div>
  );
}
