import { useEffect, useState } from "react";
import { modelosApi } from "../api/modelos";
import { fotosApi, fotoUrl } from "../api/fotos";
import { useCatalogo } from "../context/catalogo.js";
import { primerMensaje } from "../schemas/comunes.js";
import { construirModeloDto, modeloActivoDtoSchema } from "../schemas/modelo.js";
import { MAX_FOTOS_MODELO } from "../schemas/limites.js";
import { formatoMoneda, formatoMedidas } from "../utils/format";
import Aviso from "../components/Aviso";
import ModeloDetalle from "../components/ModeloDetalle";

function formularioVacio() {
  return {
    nombre: "",
    descripcion: "",
    precio_base: "",
    profundidad_m: "",
    altura_m: "",
    ancho_m: "",
    fotos: [],
  };
}

function irArriba() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export default function Modelos() {
  // El catálogo es compartido: se pidió una sola vez al abrir la app y quedó en
  // memoria (respaldado en localStorage). Acá solo se lo lee y se lo actualiza.
  const { modelos, cargando, error, aplicarModelo } = useCatalogo();
  const [aviso, setAviso] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formularioVacio());
  const [mostrandoNuevo, setMostrandoNuevo] = useState(false);
  const [fotosPendientes, setFotosPendientes] = useState(0);
  const [detalleId, setDetalleId] = useState(null);

  // El modelo del popup se deriva de la lista viva: si se lo edita o se lo
  // activa/desactiva desde adentro, el popup refleja el cambio sin recargar.
  const modeloDetalle = detalleId ? modelos.find((m) => m.id === detalleId) : null;

  useEffect(() => {
    if (error) setAviso({ tipo: "error", mensaje: error });
  }, [error]);

  // Si el modelo abierto en el popup desaparece de la lista (caso raro), se
  // cierra en vez de quedar mostrando un fantasma.
  useEffect(() => {
    if (detalleId && !modelos.some((m) => m.id === detalleId)) setDetalleId(null);
  }, [detalleId, modelos]);

  function empezarEdicion(modelo) {
    setDetalleId(null);
    setEditandoId(modelo.id);
    setMostrandoNuevo(false);
    setForm({
      nombre: modelo.nombre,
      descripcion: modelo.descripcion || "",
      precio_base: String(modelo.precio_base),
      profundidad_m: String(modelo.profundidad_m),
      altura_m: String(modelo.altura_m),
      ancho_m: String(modelo.ancho_m),
      fotos: [...(modelo.fotos || [])],
    });
    // El formulario aparece arriba de todo: llevar la vista ahí, igual que
    // "Tomar pedido" al pasar de un paso al siguiente.
    irArriba();
  }

  function empezarNuevo() {
    setEditandoId(null);
    setMostrandoNuevo(true);
    setForm(formularioVacio());
    irArriba();
  }

  function cancelar() {
    setEditandoId(null);
    setMostrandoNuevo(false);
    setForm(formularioVacio());
  }

  async function seleccionarFotos(archivos) {
    const lista = Array.from(archivos || []);
    if (lista.length === 0) return;

    const lugar = MAX_FOTOS_MODELO - form.fotos.length;
    if (lugar <= 0) {
      setAviso({
        tipo: "error",
        mensaje: `Un modelo no puede tener más de ${MAX_FOTOS_MODELO} fotos.`,
      });
      return;
    }
    const aSubir = lista.slice(0, lugar);
    setFotosPendientes(aSubir.length);
    setAviso(null);

    for (const archivo of aSubir) {
      try {
        const { url } = await fotosApi.subir(archivo);
        setForm((f) => ({ ...f, fotos: [...f.fotos, url] }));
      } catch (err) {
        setAviso({ tipo: "error", mensaje: err.message || "No se pudo subir una foto." });
      } finally {
        setFotosPendientes((n) => n - 1);
      }
    }
    if (lista.length > aSubir.length) {
      setAviso({
        tipo: "error",
        mensaje: `Se agregaron ${aSubir.length}: un modelo no puede tener más de ${MAX_FOTOS_MODELO} fotos.`,
      });
    }
  }

  function quitarFoto(url) {
    setForm((f) => ({ ...f, fotos: f.fotos.filter((u) => u !== url) }));
  }

  function hacerPortada(url) {
    setForm((f) => ({ ...f, fotos: [url, ...f.fotos.filter((u) => u !== url)] }));
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

  const subiendoFotos = fotosPendientes > 0;
  const editando = mostrandoNuevo || editandoId;

  return (
    <div className="pagina vista-entra">
      <h1>Modelos</h1>
      <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />

      {editando && (
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
              <span>Fotos (opcional) · la primera es la portada</span>
              {form.fotos.length < MAX_FOTOS_MODELO && (
                <label className="boton-secundario boton-fotos">
                  + Agregar fotos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      seleccionarFotos(e.target.files);
                      e.target.value = "";
                    }}
                    hidden
                  />
                </label>
              )}
            </div>
            {(form.fotos.length > 0 || subiendoFotos) && (
              <div className="fotos-grilla">
                {form.fotos.map((url, idx) => (
                  <div className="foto-miniatura" key={url}>
                    <img src={fotoUrl(url)} alt="" />
                    {idx === 0 && <span className="foto-portada-badge">Portada</span>}
                    {idx !== 0 && (
                      <button
                        type="button"
                        className="foto-portada-set"
                        onClick={() => hacerPortada(url)}
                        aria-label="Hacer portada"
                        title="Hacer portada"
                      >
                        ★
                      </button>
                    )}
                    <button
                      type="button"
                      className="foto-quitar"
                      onClick={() => quitarFoto(url)}
                      aria-label="Quitar foto"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {Array.from({ length: fotosPendientes }).map((_, i) => (
                  <div key={`pendiente-${i}`} className="foto-miniatura foto-subiendo" />
                ))}
              </div>
            )}
          </div>

          <div className="fila-2">
            <button type="submit" className="boton-primario" disabled={subiendoFotos}>
              {subiendoFotos ? "Subiendo fotos…" : "Guardar"}
            </button>
            <button type="button" className="boton-texto" onClick={cancelar}>Cancelar</button>
          </div>
        </form>
      )}

      {!editando && (
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
          </div>
          <div className="lista-pedidos">
            {modelos.map((m) => (
              <button
                type="button"
                key={m.id}
                className={`tarjeta modelo-fila${m.activo ? "" : " modelo-inactivo"}`}
                onClick={() => setDetalleId(m.id)}
              >
                <div className="modelo-fila-info">
                  <div className="modelo-nombre-celda">
                    {m.foto_url ? (
                      <span className="modelo-foto-envoltura">
                        <img className="modelo-foto-mini" src={fotoUrl(m.foto_url)} alt="" />
                        {m.fotos.length > 1 && (
                          <span className="modelo-foto-contador">{m.fotos.length}</span>
                        )}
                      </span>
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
                <span className="modelo-fila-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {modeloDetalle && (
        <ModeloDetalle
          modelo={modeloDetalle}
          onCerrar={() => setDetalleId(null)}
          onEditar={empezarEdicion}
          onAlternarActivo={alternarActivo}
        />
      )}
    </div>
  );
}
