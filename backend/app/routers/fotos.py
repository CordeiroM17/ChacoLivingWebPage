import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from ..auth import require_token
from ..config import UPLOADS_DIR

router = APIRouter(prefix="/fotos", tags=["fotos"], dependencies=[Depends(require_token)])

EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAXIMO = 8 * 1024 * 1024  # 8MB


@router.post("", status_code=201)
async def subir_foto(archivo: UploadFile = File(...)):
    extension = os.path.splitext(archivo.filename or "")[1].lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(status_code=422, detail="Formato de imagen no permitido")

    contenido = await archivo.read()
    if len(contenido) > TAMANO_MAXIMO:
        raise HTTPException(status_code=422, detail="La imagen no puede superar 8MB")

    nombre = f"{uuid.uuid4().hex}{extension}"
    ruta = os.path.join(UPLOADS_DIR, nombre)
    with open(ruta, "wb") as destino:
        destino.write(contenido)

    return {"url": f"/uploads/{nombre}"}
