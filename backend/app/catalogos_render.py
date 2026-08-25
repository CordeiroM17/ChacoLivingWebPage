import os
import shutil

import pymupdf
from PIL import Image

from .config import UPLOADS_DIR

CATALOGOS_DIR = os.path.join(UPLOADS_DIR, "catalogos")
os.makedirs(CATALOGOS_DIR, exist_ok=True)

# Zoom 2x sobre el tamaño real de página (~144 DPI): nítido en una tablet, y
# necesario para que el pinch-to-zoom del visor tenga detalle real para
# ampliar. WEBP en vez de JPEG mantiene esa misma resolución pesando ~40%
# menos: medido con el catálogo de ejemplo, ~275KB/página en JPEG calidad 82
# bajan a ~160KB/página en WEBP calidad 80, sin pérdida visible.
_MATRIZ_RENDER = pymupdf.Matrix(2, 2)
_CALIDAD_WEBP = 80


def renderizar_catalogo(catalogo_id: int, contenido_pdf: bytes) -> int:
    """Convierte cada página del PDF en un WEBP y los deja en su propia carpeta.

    Se guardan solo las imágenes, no el PDF original: es lo único que el visor
    necesita, y evita duplicar espacio en disco (el PDF ya pesa varios MB).
    Devuelve la cantidad de páginas generadas.
    """
    carpeta = os.path.join(CATALOGOS_DIR, str(catalogo_id))
    os.makedirs(carpeta, exist_ok=True)

    documento = pymupdf.open(stream=contenido_pdf, filetype="pdf")
    try:
        for numero, pagina in enumerate(documento, start=1):
            pixmap = pagina.get_pixmap(matrix=_MATRIZ_RENDER)
            imagen = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            ruta = os.path.join(carpeta, f"pagina-{numero:04d}.webp")
            imagen.save(ruta, "WEBP", quality=_CALIDAD_WEBP)
        return documento.page_count
    finally:
        documento.close()


def borrar_paginas(catalogo_id: int) -> None:
    """Borra la carpeta de un catálogo, si quedó algo escrito.

    Se usa cuando el alta se revierte a mitad de camino: la fila vuelve atrás
    con el rollback, pero los archivos ya escritos no — sin esto quedarían
    ocupando el disco para siempre, sin ninguna fila que los referencie.
    """
    shutil.rmtree(os.path.join(CATALOGOS_DIR, str(catalogo_id)), ignore_errors=True)


def pagina_url(catalogo_id: int, numero: int) -> str:
    return f"/uploads/catalogos/{catalogo_id}/pagina-{numero:04d}.webp"
