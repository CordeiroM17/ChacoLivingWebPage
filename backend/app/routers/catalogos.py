import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_token
from ..catalogos_render import borrar_paginas, pagina_url, renderizar_catalogo
from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/catalogos", tags=["catalogos"], dependencies=[Depends(require_token)]
)

MAX_NOMBRE = 200
TAMANO_MAXIMO = 60 * 1024 * 1024  # 60MB: de sobra para un catálogo con fotos


@router.get("", response_model=list[schemas.CatalogoOut])
def listar_catalogos(db: Session = Depends(get_db)):
    query = select(models.Catalogo).order_by(models.Catalogo.creado_en.desc())
    return db.scalars(query).all()


@router.get("/{catalogo_id}", response_model=schemas.CatalogoOut)
def obtener_catalogo(catalogo_id: int, db: Session = Depends(get_db)):
    catalogo = db.get(models.Catalogo, catalogo_id)
    if catalogo is None:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado")
    return catalogo


@router.post("", response_model=schemas.CatalogoOut, status_code=201)
async def subir_catalogo(
    nombre: str = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    nombre = nombre.strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre no puede quedar sin completar")
    if len(nombre) > MAX_NOMBRE:
        raise HTTPException(
            status_code=422, detail=f"El nombre supera el máximo de {MAX_NOMBRE} caracteres"
        )

    if (archivo.content_type or "").lower() != "application/pdf":
        raise HTTPException(status_code=422, detail="El catálogo debe ser un archivo PDF")

    contenido = await archivo.read()
    if not contenido:
        raise HTTPException(status_code=422, detail="El archivo está vacío")
    if len(contenido) > TAMANO_MAXIMO:
        raise HTTPException(status_code=422, detail="El PDF no puede superar 60MB")

    # Se crea la fila primero (sin id no hay carpeta donde guardar las páginas),
    # y recién después de renderizar se completan portada_url y total_paginas.
    catalogo = models.Catalogo(nombre=nombre, portada_url="", total_paginas=0)
    db.add(catalogo)
    db.flush()

    catalogo_id = catalogo.id
    try:
        total_paginas = renderizar_catalogo(catalogo_id, contenido)
    except Exception:
        # El motivo real (PDF cifrado, corrupto, sin memoria) solo se ve acá:
        # al cliente se le devuelve un mensaje genérico a propósito.
        logger.exception("No se pudo procesar el PDF del catálogo %s", nombre)
        db.rollback()
        borrar_paginas(catalogo_id)
        raise HTTPException(status_code=422, detail="No se pudo procesar el PDF")

    if total_paginas == 0:
        db.rollback()
        borrar_paginas(catalogo_id)
        raise HTTPException(status_code=422, detail="El PDF no tiene páginas")

    catalogo.total_paginas = total_paginas
    catalogo.portada_url = pagina_url(catalogo.id, 1)
    db.commit()
    db.refresh(catalogo)
    return catalogo
