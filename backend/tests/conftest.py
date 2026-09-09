"""Infra de tests: una base Postgres de prueba reconstruida desde sql/schema.sql.

Requiere un Postgres accesible. Por defecto usa
`postgresql://sillones:sillones@localhost:5432/sillones_test` (la base la crea
este mismo archivo si no existe) — se puede cambiar con `TEST_DATABASE_URL`.

    cd backend && pytest
"""

import os
import pathlib

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SQL_DIR = RAIZ / "sql"

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://sillones:sillones@localhost:5432/sillones_test",
)

# El backend lee estas variables al importar `app.*`. Se setean acá, a nivel de
# módulo, que corre antes de cualquier `import app`.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET_KEY", "test-no-secreto-" + "0" * 32)
os.environ.setdefault("GOOGLE_CLIENT_ID", "test.apps.googleusercontent.com")
os.environ.setdefault("ADMIN_EMAILS", "test@example.com")
os.environ.setdefault(
    "UPLOADS_DIR",
    str(pathlib.Path(os.getenv("TEMP") or "/tmp") / "chaco-test-uploads"),
)

USUARIO_TEST = "test@example.com"


def _leer(archivo: str) -> str:
    return (SQL_DIR / archivo).read_text(encoding="utf-8")


def ejecutar_script(engine, sql: str) -> None:
    """Corre un script SQL multi-sentencia por el driver crudo (psycopg2)."""
    raw = engine.raw_connection()
    try:
        cur = raw.cursor()
        cur.execute(sql)
        raw.commit()
    finally:
        raw.close()


def _asegurar_base_existe(url: str) -> None:
    u = make_url(url)
    admin = create_engine(u.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            existe = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": u.database}
            ).scalar()
            if not existe:
                conn.exec_driver_sql(f'CREATE DATABASE "{u.database}"')
    finally:
        admin.dispose()


@pytest.fixture(scope="session")
def engine():
    _asegurar_base_existe(TEST_DATABASE_URL)
    eng = create_engine(TEST_DATABASE_URL)
    ejecutar_script(eng, "DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    ejecutar_script(eng, _leer("schema.sql"))
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    """Base limpia + seed para cada test; devuelve una sesión para setup/asserts."""
    ejecutar_script(
        engine,
        "TRUNCATE modelos, catalogos, clientes, pedidos, pedido_items "
        "RESTART IDENTITY CASCADE;",
    )
    ejecutar_script(engine, _leer("seed.sql"))
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    sesion = Session()
    try:
        yield sesion
    finally:
        sesion.close()


@pytest.fixture
def client(db):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth():
    from app.auth import crear_token

    return {"Authorization": f"Bearer {crear_token(USUARIO_TEST)}"}


@pytest.fixture
def correr_sql(engine):
    """Corre un script SQL de `sql/` contra la base de test (para probar migraciones)."""

    def _correr(archivo: str) -> None:
        ejecutar_script(engine, _leer(archivo))

    return _correr
