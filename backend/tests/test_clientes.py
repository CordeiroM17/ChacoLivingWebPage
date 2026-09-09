import datetime as dt

from sqlalchemy import text


def _pedido_body(**over):
    hoy = dt.date.today()
    body = {
        "cliente_nombre": "Juan Pérez",
        "cliente_contacto": "11-5555",
        "cliente_direccion": "Calle Falsa 123",
        "cliente_tipo_factura": "B",
        "cliente_email": None,
        "fecha_pedido": hoy.isoformat(),
        "fecha_prometida": (hoy + dt.timedelta(days=10)).isoformat(),
        "notas": None,
        "items": [
            {
                "modelo_id": 1,
                "cantidad": 1,
                "tela": "pana",
                "color": "gris",
                "ancho_m": 0.8,
                "altura_m": 0.9,
                "profundidad_m": 0.85,
                "precio_unitario": 100000,
            }
        ],
    }
    body.update(over)
    return body


# ---------- CRUD de clientes ----------


def test_crear_y_listar_cliente(client, auth):
    r = client.post(
        "/api/clientes",
        json={"nombre": "  Ferretería Norte  ", "contacto": "3794-1", "email": ""},
        headers=auth,
    )
    assert r.status_code == 201
    creado = r.json()
    assert creado["nombre"] == "Ferretería Norte"  # trim
    assert creado["email"] is None  # "" -> None
    assert creado["activo"] is True

    r = client.get("/api/clientes", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["items"][0]["nombre"] == "Ferretería Norte"


def test_buscar_cliente_por_nombre_contacto_localidad(client, auth):
    client.post("/api/clientes", json={"nombre": "Mueblería Sur", "localidad": "Corrientes"}, headers=auth)
    client.post("/api/clientes", json={"nombre": "Otro", "contacto": "sur-99"}, headers=auth)
    client.post("/api/clientes", json={"nombre": "Nada que ver"}, headers=auth)

    r = client.get("/api/clientes", params={"buscar": "sur"}, headers=auth)
    nombres = {c["nombre"] for c in r.json()["items"]}
    assert nombres == {"Mueblería Sur", "Otro"}


def test_patch_vaciar_campos_y_desactivar(client, auth):
    cid = client.post(
        "/api/clientes", json={"nombre": "Con datos", "contacto": "111", "cuit": "20-1-2"}, headers=auth
    ).json()["id"]

    r = client.patch(
        f"/api/clientes/{cid}", json={"contacto": None, "activo": False}, headers=auth
    )
    assert r.status_code == 200
    assert r.json()["contacto"] is None
    assert r.json()["cuit"] == "20-1-2"  # no se tocó
    assert r.json()["activo"] is False

    # ?activos=true lo excluye
    r = client.get("/api/clientes", params={"activos": "true"}, headers=auth)
    assert r.json()["total"] == 0


def test_patch_nombre_null_se_ignora(client, auth):
    cid = client.post("/api/clientes", json={"nombre": "Original"}, headers=auth).json()["id"]
    r = client.patch(f"/api/clientes/{cid}", json={"nombre": None}, headers=auth)
    assert r.status_code == 200
    assert r.json()["nombre"] == "Original"


def test_cliente_tipo_factura_invalido(client, auth):
    r = client.post("/api/clientes", json={"nombre": "X", "tipo_factura": "Z"}, headers=auth)
    assert r.status_code == 422


def test_clientes_requiere_token(client):
    assert client.get("/api/clientes").status_code == 403


# ---------- Integración con pedidos ----------


def test_pedido_con_cliente_id_inexistente(client, auth):
    r = client.post("/api/pedidos", json=_pedido_body(cliente_id=999), headers=auth)
    assert r.status_code == 422


def test_pedido_con_cliente_desactivado(client, auth):
    cid = client.post("/api/clientes", json={"nombre": "Baja"}, headers=auth).json()["id"]
    client.patch(f"/api/clientes/{cid}", json={"activo": False}, headers=auth)
    r = client.post("/api/pedidos", json=_pedido_body(cliente_id=cid), headers=auth)
    assert r.status_code == 422


def test_pedido_con_cliente_id_guarda_link_y_snapshot(client, auth, db):
    cid = client.post(
        "/api/clientes", json={"nombre": "Juan Pérez", "contacto": "vieja"}, headers=auth
    ).json()["id"]

    # El snapshot del pedido puede diferir del cliente (se editó al tomar el pedido).
    r = client.post(
        "/api/pedidos",
        json=_pedido_body(cliente_id=cid, cliente_contacto="nueva-en-el-pedido"),
        headers=auth,
    )
    assert r.status_code == 201
    assert r.json()["cliente_id"] == cid

    row = db.execute(
        text("SELECT cliente_id, cliente_contacto, creado_por FROM pedidos")
    ).one()
    assert row.cliente_id == cid
    assert row.cliente_contacto == "nueva-en-el-pedido"  # snapshot, no el del cliente
    assert row.creado_por == "test@example.com"


def test_pedido_sin_cliente_id_autocrea_cliente(client, auth, db):
    r = client.post("/api/pedidos", json=_pedido_body(cliente_nombre="Nuevo Cliente"), headers=auth)
    assert r.status_code == 201
    nuevo_id = r.json()["cliente_id"]
    assert nuevo_id is not None

    fila = db.execute(
        text("SELECT nombre, contacto FROM clientes WHERE id = :i"), {"i": nuevo_id}
    ).one()
    assert fila.nombre == "Nuevo Cliente"
    assert fila.contacto == "11-5555"  # se copió del snapshot del pedido


def test_pedido_sin_cliente_id_linkea_al_existente(client, auth, db):
    cid = client.post("/api/clientes", json={"nombre": "Juan Pérez"}, headers=auth).json()["id"]
    # mismo nombre escrito distinto → linkea, no duplica
    r = client.post("/api/pedidos", json=_pedido_body(cliente_nombre="  juan pérez "), headers=auth)
    assert r.status_code == 201
    assert r.json()["cliente_id"] == cid
    total = db.execute(text("SELECT count(*) FROM clientes")).scalar()
    assert total == 1


# ---------- Migración ----------


def test_migracion_clientes_idempotente(db, correr_sql):
    """La migración corre 2x sobre una base que ya tiene el esquema nuevo, sin error.

    `db` deja la base limpia (esquema presente, `clientes` y `pedidos` vacíos) antes.
    """
    for _ in range(2):
        correr_sql("migracion_clientes.sql")
