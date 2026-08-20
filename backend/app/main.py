import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import UPLOADS_DIR
from .errores import traducir
from .routers import auth, fotos, modelos, pedidos

app = FastAPI(title="Fábrica de sillones - API de pedidos")


@app.exception_handler(RequestValidationError)
async def validacion_invalida(request: Request, exc: RequestValidationError):
    """Devuelve `detail` como texto en español, no como la lista técnica de Pydantic."""
    return JSONResponse(status_code=422, content={"detail": traducir(exc.errors())})

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    # "*" por defecto para no romper el desarrollo local. En producción hay
    # que fijar CORS_ORIGINS a la URL real del frontend (sin auth por cookie
    # esto no es tan grave como suena, pero no hay motivo para dejarlo abierto).
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.middleware("http")
async def cache_uploads(request: Request, call_next):
    """Cachea /uploads para siempre: fotos y comprobantes nunca cambian de contenido.

    Las fotos se guardan con nombre `{uuid}.{ext}` (routers/fotos.py) y los
    comprobantes con `{codigo}.pdf` (comprobantes.py); ninguno de los dos se
    sobrescribe después de creado — "cambiar la foto" de un modelo sube un
    archivo nuevo con otra URL, no reescribe el viejo. Como la URL identifica un
    contenido inmutable, el navegador (y cualquier CDN delante) puede quedarse
    con la copia local para siempre y no volver a pedirla.
    """
    respuesta = await call_next(request)
    if request.url.path.startswith("/uploads/") and respuesta.status_code in (200, 304):
        respuesta.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return respuesta

app.include_router(auth.router, prefix="/api")
app.include_router(modelos.router, prefix="/api")
app.include_router(pedidos.router, prefix="/api")
app.include_router(fotos.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
