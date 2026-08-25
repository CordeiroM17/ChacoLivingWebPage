import io
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from PIL import Image, ImageOps

from ..auth import require_token
from ..config import UPLOADS_DIR

router = APIRouter(prefix="/fotos", tags=["fotos"], dependencies=[Depends(require_token)])

EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAXIMO = 8 * 1024 * 1024  # 8MB: tope de la subida original, antes de recomprimir

# Toda foto de acá se ve como miniatura (40-72px) o como mucho a 52px en el
# comprobante: una foto de celular de varios MB a resolución completa no suma
# nada ahí. Se recomprime siempre a WEBP, una sola vez al subir.
LADO_MAXIMO = 1600
CALIDAD_WEBP = 82


def _procesar_imagen(contenido: bytes) -> Image.Image:
    try:
        imagen = Image.open(io.BytesIO(contenido))
        imagen.load()
    except Exception:
        raise HTTPException(status_code=422, detail="No se pudo procesar la imagen")

    # Corrige la rotación que algunas cámaras guardan solo como metadato EXIF,
    # en vez de rotar los píxeles: si no se aplica acá, se pierde al recomprimir.
    imagen = ImageOps.exif_transpose(imagen)

    if imagen.mode in ("RGBA", "LA") or (imagen.mode == "P" and "transparency" in imagen.info):
        imagen = imagen.convert("RGBA")
        fondo = Image.new("RGB", imagen.size, (255, 255, 255))
        fondo.paste(imagen, mask=imagen.split()[-1])
        imagen = fondo
    else:
        imagen = imagen.convert("RGB")

    imagen.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.LANCZOS)
    return imagen


@router.post("", status_code=201)
async def subir_foto(archivo: UploadFile = File(...)):
    extension = os.path.splitext(archivo.filename or "")[1].lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(status_code=422, detail="Formato de imagen no permitido")

    contenido = await archivo.read()
    if len(contenido) > TAMANO_MAXIMO:
        raise HTTPException(status_code=422, detail="La imagen no puede superar 8MB")

    imagen = _procesar_imagen(contenido)

    nombre = f"{uuid.uuid4().hex}.webp"
    ruta = os.path.join(UPLOADS_DIR, nombre)
    imagen.save(ruta, "WEBP", quality=CALIDAD_WEBP)

    return {"url": f"/uploads/{nombre}"}
