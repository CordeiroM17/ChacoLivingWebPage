import { useEffect, useState } from "react";
import { modelosApi } from "../api/modelos";
import { fotosApi, fotoUrl } from "../api/fotos";
import { useCatalogo } from "../context/catalogo.js";
import { primerMensaje } from "../schemas/comunes.js";
import { construirModeloDto, modeloActivoDtoSchema } from "../schemas/modelo.js";
import { formatoMoneda, formatoMedidas } from "../utils/format";
import Aviso from "../components/Aviso";

function formularioVacio() {
  return {
    nombre: "",
    descripcion: "",
    precio_base: "",
    profundidad_m: "",
    altura_m: "",
    ancho_m: "",
    foto_url: "",
  };
}

export default function Modelos() {
  // El catálogo es compartido: se pidió una sola vez al abrir la app y quedó en
  // memoria (respaldado en localStorage). Acá solo se lo lee y se lo actualiza.
  const { modelos, cargando, error, aplicarModelo } = useCatalogo();
  const [aviso, setAviso] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formularioVacio());
  const [mostrandoNuevo, setMostrandoNuevo] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  useEffect(() => {
    if (error) setAviso({ tipo: "error", mensaje: error });
  }, [error]);

  function empezarEdicion(modelo) {
    setEditandoId(modelo.id);
    setMostrandoNuevo(false);
    setForm({
      nombre: modelo.nombre,
      descripcion: modelo.descripcion || "",
      precio_base: String(modelo.precio_base),
      profundidad_m: String(modelo.profundidad_m),
      altura_m: String(modelo.altura_m),
      ancho_m: String(modelo.ancho_m),
      foto_url: modelo.foto_url || "",
    });
  }

  function empezarNuevo() {
    setEditandoId(null);
    setMostrandoNuevo(true);
    setForm(formularioVacio());
  }

  function cancelar() {
    setEditandoId(null);
    setMostrandoNuevo(false);
    setForm(formularioVacio());
  }

  async function seleccionarFoto(archivo) {
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const { url } = await fotosApi.subir(archivo);
      setForm((f) => ({ ...f, foto_url: url }));
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo subir la foto." });
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();

    // El DTO valida y arma el cuerpo: recorta espacios, convierte el precio de
    // string a número y normaliza los vacíos a null.
    const dto = construirModeloDto(form);
    if (!dto.success) {
      setAviso({ tipo: "error", mensaje: primerMensaje(dto.error) });
      return;
    }

    try {
      let actualizado;
      if (editandoId) {
        actualizado = await modelosApi.editar(editandoId, dto.data);
      } else {
        actualizado = await modelosApi.crear(dto.data);
      }
      aplicarModelo(actualizado);
      setAviso({ tipo: "exito", mensaje: "Modelo guardado." });
      cancelar();
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo guardar el modelo." });
    }
  }

  async function alternarActivo(modelo) {
    const accion = modelo.activo ? "desactivar" : "activar";
    if (!window.confirm(`¿Seguro que querés ${accion} "${modelo.nombre}"?`)) return;
    try {
      const actualizado = await modelosApi.editar(
        modelo.id,
        modeloActivoDtoSchema.parse({ activo: !modelo.activo })
      );
      aplicarModelo(actualizado);
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo actualizar el modelo." });
    }
  }

  return (
    <div className="pagina vista-entra">
      <h1>Modelos</h1>
      <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />

      {(mostrandoNuevo || editandoId) && (
        <form onSubmit={guardar} className="tarjeta">
          <h2>{editandoId ? "Editar modelo" : "Nuevo modelo"}</h2>
          <label className="campo">
            Nombre *
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </label>
          <label className="campo">
            Descripción
            <input
              type="text"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </label>
          <label className="campo">
            Precio base *
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.precio_base}
              onChange={(e) => setForm({ ...form, precio_base: e.target.value })}
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
                value={form.ancho_m}
                onChange={(e) => setForm({ ...form, ancho_m: e.target.value })}
                required
              />
            </label>
            <label className="campo">
              Alto (m) *
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.altura_m}
                onChange={(e) => setForm({ ...form, altura_m: e.target.value })}
                required
              />
            </label>
            <label className="campo">
              Profundidad (m) *
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.profundidad_m}
                onChange={(e) => setForm({ ...form, profundidad_m: e.target.value })}
                required
              />
            </label>
          </div>

          <div className="campo campo-fotos">
            <div className="fotos-encabezado">
              <span>Foto (opcional)</span>
              <label className="boton-secundario boton-fotos">
                {form.foto_url ? "Cambiar foto" : "+ Agregar foto"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    seleccionarFoto(e.target.files[0]);
                    e.target.value = "";
                  }}
                  hidden
                />
              </label>
            </div>
            {(form.foto_url || subiendoFoto) && (
              <div className="fotos-grilla">
                <div className={`foto-miniatura${subiendoFoto ? " foto-subiendo" : ""}`}>
                  {form.foto_url && <img src={fotoUrl(form.foto_url)} alt="" />}
                  {form.foto_url && !subiendoFoto && (
                    <button
                      type="button"
                      className="foto-quitar"
                      onClick={() => setForm((f) => ({ ...f, foto_url: "" }))}
                      aria-label="Quitar foto"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="fila-2">
            <button type="submit" className="boton-primario">Guardar</button>
            <button type="button" className="boton-texto" onClick={cancelar}>Cancelar</button>
          </div>
        </form>
      )}

      {!mostrandoNuevo && !editandoId && (
        <button className="boton-primario" onClick={empezarNuevo}>+ Nuevo modelo</button>
      )}

      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <div className="modelos-lista">
          <div className="lista-encabezado">
            <span>Modelo</span>
            <span>Precio</span>
            <span>Medidas (A×Al×P)</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          <div className="lista-pedidos">
            {modelos.map((m) => (
              <div key={m.id} className={`tarjeta modelo-fila${m.activo ? "" : " modelo-inactivo"}`}>
                <div className="modelo-fila-info">
                  <div className="modelo-nombre-celda">
                    {m.foto_url ? (
                      <img className="modelo-foto-mini" src={fotoUrl(m.foto_url)} alt="" />
                    ) : (
                      <div className="modelo-foto-mini modelo-foto-vacia" aria-hidden="true" />
                    )}
                    <strong>{m.nombre}</strong>
                  </div>
                  <div>{formatoMoneda(m.precio_base)}</div>
                  <div>{formatoMedidas(m)}</div>
                  <span className={`estado ${m.activo ? "estado-entregado" : "estado-cancelado"}`}>
                    {m.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="modelo-fila-acciones">
                  <button className="boton-texto" onClick={() => empezarEdicion(m)}>Editar</button>
                  <button className="boton-texto" onClick={() => alternarActivo(m)}>
                    {m.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
