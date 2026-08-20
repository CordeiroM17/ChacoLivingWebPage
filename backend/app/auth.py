import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Se llama acá también (no solo en database.py) para que este módulo no dependa
# de que otro se haya importado primero.
load_dotenv()

JWT_ALGORITMO = "HS256"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
# 30 días por defecto: es una tablet compartida en el galpón, no una app con
# datos sensibles por persona — pedir contraseña cada rato solo molesta.
JWT_EXPIRA_MINUTOS = int(os.getenv("JWT_EXPIRA_MINUTOS", 60 * 24 * 30))

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "Falta la variable de entorno JWT_SECRET_KEY. Generá una con:\n"
        "  python -c \"import secrets; print(secrets.token_hex(32))\"\n"
        "y agregala al .env (ver .env.example)."
    )

bearer_scheme = HTTPBearer()


def crear_token(usuario: str) -> str:
    ahora = datetime.now(timezone.utc)
    payload = {
        "sub": usuario,
        "iat": ahora,
        "exp": ahora + timedelta(minutes=JWT_EXPIRA_MINUTOS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITMO)


def require_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    """Valida la sesión y devuelve el usuario. Reemplaza al token fijo anterior.

    El token ya no es un secreto fijo compilado dentro del bundle del frontend:
    se obtiene recién al iniciar sesión (POST /auth/login) y expira solo.
    """
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITMO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión expiró. Iniciá sesión de nuevo.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida. Iniciá sesión de nuevo.",
        )
    return payload["sub"]
