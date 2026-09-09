import { useEffect, useMemo, useState } from "react";
import { clientesApi } from "../api/clientes";
import { useClientes } from "../context/clientes.js";
import { primerMensaje } from "../schemas/comunes.js";
import { construirClienteDto, clienteActivoDtoSchema } from "../schemas/cliente.js";
import { TIPOS_FACTURA_VALIDOS } from "../schemas/limites.js";
import Aviso from "../components/Aviso";

function formularioVacio() {
  return {
    nombre: "",
    contacto: "",
    direccion: "",
    tipo_factura: "",
    email: "",
    localidad: "",
    cuit: "",
    notas: "",
  };
}

function desdeCliente(c) {
  return {
    nombre: c.nombre,
    contacto: c.contacto || "",
    direccion: c.direccion || "",
    tipo_factura: c.tipo_factura || "",
    email: c.email || "",
    localidad: c.localidad || "",
    cuit: c.cuit || "",
    notas: c.notas || "",
  };
}

function irArriba() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export default function Clientes() {
  const { clientes, cargando, error, aplicarCliente } = useClientes();
  const [aviso, setAviso] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrandoNuevo, setMostrandoNuevo] = useState(false);
  const [form, setForm] = useState(formularioVacio());
  const [buscar, setBuscar] = useState("");

  useEffect(() => {
    if (error) setAviso({ tipo: "error", mensaje: error });
  }, [error]);

  const editando = mostrandoNuevo || editandoId;
  const clienteEditando = editandoId ? clientes.find((c) => c.id === editandoId) : null;

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      [c.nombre, c.contacto, c.localidad, c.cuit]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [clientes, buscar]);

  function empezarNuevo() {
    setEditandoId(null);
    setMostrandoNuevo(true);
    setForm(formularioVacio());
    irArriba();
  }

  function empezarEdicion(cliente) {
    setMostrandoNuevo(false);
    setEditandoId(cliente.id);
    setForm(desdeCliente(cliente));
    irArriba();
  }

  function cancelar() {
    setEditandoId(null);
    setMostrandoNuevo(false);
    setForm(formularioVacio());
  }

  async function guardar(e) {
    e.preventDefault();
    const dto = construirClienteDto(form);
    if (!dto.success) {
      setAviso({ tipo: "error", mensaje: primerMensaje(dto.error) });
      return;
    }
    try {
      const actualizado = editandoId
        ? await clientesApi.editar(editandoId, dto.data)
        : await clientesApi.crear(dto.data);
      aplicarCliente(actualizado);
      setAviso({ tipo: "exito", mensaje: "Cliente guardado." });
      cancelar();
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo guardar el cliente." });
    }
  }

  async function alternarActivo() {
    if (!clienteEditando) return;
    const accion = clienteEditando.activo ? "desactivar" : "activar";
    if (!window.confirm(`¿Seguro que querés ${accion} a "${clienteEditando.nombre}"?`)) return;
    try {
      const actualizado = await clientesApi.editar(
        clienteEditando.id,
        clienteActivoDtoSchema.parse({ activo: !clienteEditando.activo })
      );
      aplicarCliente(actualizado);
      setAviso({
        tipo: "exito",
        mensaje: actualizado.activo ? "Cliente activado." : "Cliente desactivado.",
      });
      cancelar();
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo actualizar el cliente." });
    }
  }

  return (
    <div className="pagina vista-entra">
      <h1>Clientes</h1>
      <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />

      {editando && (
        <form onSubmit={guardar} className="tarjeta">
          <h2>{editandoId ? "Editar cliente" : "Nuevo cliente"}</h2>
          <label className="campo">
            Nombre *
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </label>
          <div className="fila-2">
            <label className="campo">
              Contacto / teléfono
              <input
                type="text"
                value={form.contacto}
                onChange={(e) => setForm({ ...form, contacto: e.target.value })}
              />
            </label>
            <label className="campo">
              Localidad
              <input
                type="text"
                value={form.localidad}
                onChange={(e) => setForm({ ...form, localidad: e.target.value })}
              />
            </label>
          </div>
          <label className="campo">
            Dirección
            <input
              type="text"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
          </label>
          <div className="fila-2">
            <label className="campo">
              Tipo de factura
              <select
                value={form.tipo_factura}
                onChange={(e) => setForm({ ...form, tipo_factura: e.target.value })}
              >
                <option value="">Sin definir</option>
                {TIPOS_FACTURA_VALIDOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              CUIT
              <input
                type="text"
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                placeholder="20-12345678-3"
              />
            </label>
          </div>
          <label className="campo">
            Correo electrónico
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="campo">
            Notas
            <textarea
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              rows={2}
            />
          </label>

          <div className="fila-2">
            <button type="submit" className="boton-primario">Guardar</button>
            <button type="button" className="boton-texto" onClick={cancelar}>Cancelar</button>
          </div>
          {clienteEditando && (
            <button type="button" className="boton-texto boton-peligro" onClick={alternarActivo}>
              {clienteEditando.activo ? "Desactivar cliente" : "Activar cliente"}
            </button>
          )}
        </form>
      )}

      {!editando && (
        <button className="boton-primario" onClick={empezarNuevo}>+ Nuevo cliente</button>
      )}

      <label className="campo" style={{ marginTop: "1rem" }}>
        Buscar por nombre, contacto, localidad o CUIT
        <input type="text" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </label>

      {cargando ? (
        <p>Cargando...</p>
      ) : filtrados.length === 0 ? (
        <p>
          {clientes.length === 0
            ? "Todavía no hay clientes. Cargá el primero o se van a ir creando al tomar pedidos."
            : "Ningún cliente coincide con la búsqueda."}
        </p>
      ) : (
        <div className="clientes-lista">
          <div className="lista-encabezado">
            <span>Cliente</span>
            <span>Localidad</span>
            <span>Estado</span>
          </div>
          <div className="lista-pedidos">
            {filtrados.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`tarjeta cliente-fila${c.activo ? "" : " cliente-inactivo"}`}
                onClick={() => empezarEdicion(c)}
              >
                <div className="cliente-fila-info">
                  <div className="cliente-nombre-celda">
                    <strong>{c.nombre}</strong>
                    {c.contacto && <span className="cliente-contacto">{c.contacto}</span>}
                  </div>
                  <div>{c.localidad || "—"}</div>
                  <span className={`estado ${c.activo ? "estado-entregado" : "estado-cancelado"}`}>
                    {c.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <span className="modelo-fila-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
