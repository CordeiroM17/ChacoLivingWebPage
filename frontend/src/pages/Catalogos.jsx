import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { catalogosApi, catalogosCacheados } from "../api/catalogos";
import { fotoUrl } from "../api/fotos";
import { primerMensaje } from "../schemas/comunes.js";
import { construirCatalogoDto } from "../schemas/catalogo.js";
import Aviso from "../components/Aviso";

export default function Catalogos() {
  // Si ya se visitó la sección en esta sesión, la grilla aparece llena de
  // entrada y la revalidación pasa desapercibida; solo se muestra "Cargando"
  // la primera vez, cuando no hay nada que mostrar mientras tanto.
  const [cacheInicial] = useState(catalogosCacheados);
  const [catalogos, setCatalogos] = useState(cacheInicial ?? []);
  const [cargando, setCargando] = useState(!cacheInicial);
  const [aviso, setAviso] = useState(null);
  const [mostrandoNuevo, setMostrandoNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    catalogosApi
      .listar()
      .then(setCatalogos)
      .catch((err) =>
        setAviso({ tipo: "error", mensaje: err.message || "No se pudieron cargar los catálogos." })
      )
      .finally(() => setCargando(false));
  }, []);

  function cancelar() {
    setMostrandoNuevo(false);
    setNombre("");
    setArchivo(null);
  }

  async function subir(e) {
    e.preventDefault();

    const dto = construirCatalogoDto({ nombre, archivo });
    if (!dto.success) {
      setAviso({ tipo: "error", mensaje: primerMensaje(dto.error) });
      return;
    }

    setSubiendo(true);
    setAviso(null);
    try {
      const nuevo = await catalogosApi.subir(dto.data);
      setCatalogos((prev) => [nuevo, ...prev]);
      setAviso({ tipo: "exito", mensaje: "Catálogo subido." });
      cancelar();
    } catch (err) {
      setAviso({ tipo: "error", mensaje: err.message || "No se pudo subir el catálogo." });
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="pagina vista-entra">
      <h1>Catálogos</h1>
      <Aviso tipo={aviso?.tipo} mensaje={aviso?.mensaje} />

      {mostrandoNuevo ? (
        <form onSubmit={subir} className="tarjeta">
          <h2>Nuevo catálogo</h2>
          <label className="campo">
            Nombre *
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </label>
          <label className="campo">
            Archivo PDF *
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setArchivo(e.target.files[0] || null)}
              required
            />
          </label>
          <div className="fila-2">
            <button type="submit" className="boton-primario" disabled={subiendo}>
              {subiendo ? "Subiendo…" : "Guardar"}
            </button>
            <button type="button" className="boton-texto" onClick={cancelar} disabled={subiendo}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button className="boton-primario" onClick={() => setMostrandoNuevo(true)}>
          + Subir catálogo
        </button>
      )}

      {cargando ? (
        <p>Cargando...</p>
      ) : catalogos.length === 0 ? (
        !mostrandoNuevo && <p className="catalogos-vacio">Todavía no subiste ningún catálogo.</p>
      ) : (
        <div className="catalogos-grilla">
          {catalogos.map((c) => (
            <Link
              key={c.id}
              to={`/catalogos/${c.id}`}
              state={{ catalogo: c }}
              className="catalogo-tarjeta"
            >
              <div className="catalogo-portada">
                <img src={fotoUrl(c.portada_url)} alt="" loading="lazy" />
              </div>
              <div className="catalogo-info">
                <strong>{c.nombre}</strong>
                <span>{c.total_paginas} página{c.total_paginas === 1 ? "" : "s"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
