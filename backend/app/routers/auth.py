import os

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel, ConfigDict, Field

from ..auth import crear_token

load_dotenv()

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
# Emails autorizados a entrar, separados por coma. Cualquiera con una cuenta de
# Google puede *intentar* iniciar sesión (Google solo confirma que la cuenta es
# real); esta lista es la que de verdad decide quién entra a Chaco Living.
ADMIN_EMAILS = {
    correo.strip().lower() for correo in os.getenv("ADMIN_EMAILS", "").split(",") if correo.strip()
}

if not GOOGLE_CLIENT_ID:
    raise RuntimeError(
        "Falta la variable de entorno GOOGLE_CLIENT_ID. Se obtiene al crear las "
        "credenciales OAuth en Google Cloud Console (ver README)."
    )
if not ADMIN_EMAILS:
    raise RuntimeError(
        "Falta ADMIN_EMAILS: la lista de emails de Google autorizados a entrar "
        "(separados por coma si son varios). Ver README."
    )

# Reutilizable entre pedidos: cachea internamente las claves públicas de
# Google, no hace falta pedirlas de nuevo en cada login.
_verificador = google_requests.Request()


class GoogleLoginDto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # El "credential" que entrega el botón de Google Identity Services: un JWT
    # firmado por Google, no una contraseña ni nada que pase por nuestro backend.
    credential: str = Field(min_length=1)


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/google", response_model=LoginOut)
def login_google(datos: GoogleLoginDto):
    try:
        payload = id_token.verify_oauth2_token(datos.credential, _verificador, GOOGLE_CLIENT_ID)
    except ValueError:
        # Firma inválida, token vencido, o emitido para otra app (audience
        # distinto) — cualquiera de esos casos es indistinguible para el
        # usuario: simplemente no se pudo confirmar la sesión de Google.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo verificar la sesión de Google. Probá de nuevo.",
        )

    email = (payload.get("email") or "").lower()
    if not payload.get("email_verified") or email not in ADMIN_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta de Google no tiene acceso a Chaco Living.",
        )

    return LoginOut(access_token=crear_token(email))
