"""Traducción de los errores de validación de Pydantic a español.

FastAPI responde a un payload inválido con `detail` como lista de objetos
técnicos en inglés (`[{"type": "greater_than_equal", "msg": "Input should be
greater than or equal to 0", ...}]`). El frontend muestra `detail` tal cual, así
que sin esto el usuario vería "[object Object]".
"""

# campo -> (etiqueta, es_plural). El plural define la conjugación del verbo; las
# frases están redactadas para no depender del género.
CAMPOS = {
    "cliente_id": ("El cliente", False),
    "cliente_nombre": ("El nombre del cliente", False),
    "cliente_contacto": ("El contacto", False),
    "cliente_direccion": ("La dirección de envío", False),
    "cliente_tipo_factura": ("El tipo de factura", False),
    "cliente_email": ("El correo electrónico", False),
    # Campos de la lista de clientes (nombres sin prefijo `cliente_`).
    "contacto": ("El contacto", False),
    "direccion": ("La dirección", False),
    "tipo_factura": ("El tipo de factura", False),
    "email": ("El correo electrónico", False),
    "localidad": ("La localidad", False),
    "cuit": ("El CUIT", False),
    "fecha_pedido": ("La fecha del pedido", False),
    "fecha_prometida": ("La entrega prometida", False),
    "notas": ("Las notas", True),
    "items": ("El pedido", False),
    "modelo_id": ("El modelo", False),
    "cantidad": ("La cantidad", False),
    "precio_unitario": ("El precio unitario", False),
    "tela": ("La tela", False),
    "color": ("El color", False),
    "nombre": ("El nombre", False),
    "descripcion": ("La descripción", False),
    "precio_base": ("El precio", False),
    "profundidad_m": ("La profundidad", False),
    "altura_m": ("La altura", False),
    "ancho_m": ("El ancho", False),
    "foto_url": ("La foto", False),
    "fotos": ("Las fotos", True),
    "activo": ("El estado activo", False),
    "estado": ("El estado", False),
}


def _etiqueta(loc: tuple) -> tuple[str, bool]:
    """Arma ('Ítem 2 · El precio unitario', False) desde ('body','items',1,'precio_unitario')."""
    partes = [p for p in loc if p != "body"]
    campo, plural, prefijo = "", False, ""
    for i, parte in enumerate(partes):
        if parte == "items" and i + 1 < len(partes) and isinstance(partes[i + 1], int):
            prefijo = f"Ítem {partes[i + 1] + 1} · "
        elif isinstance(parte, str):
            campo, plural = CAMPOS.get(parte, (parte.replace("_", " "), False))
    return f"{prefijo}{campo}".strip(), plural


def _motivo(error: dict, plural: bool) -> str:
    tipo = error.get("type", "")
    ctx = error.get("ctx") or {}
    es = "son" if plural else "es"
    puede = "pueden" if plural else "puede"
    debe = "deben" if plural else "debe"
    tiene = "tienen" if plural else "tiene"
    supera = "superan" if plural else "supera"

    if tipo == "missing":
        return f"{es} un dato obligatorio"
    if tipo == "extra_forbidden":
        return f"no {es} un campo que este pedido acepte"
    if tipo == "greater_than_equal":
        limite = ctx.get("ge")
        return (
            f"no {puede} ser menor que cero"
            if limite in (0, 0.0)
            else f"no {puede} ser menor que {limite}"
        )
    if tipo == "greater_than":
        limite = ctx.get("gt")
        return (
            f"{debe} ser mayor que cero"
            if limite in (0, 0.0)
            else f"{debe} ser mayor que {limite}"
        )
    if tipo == "less_than_equal":
        return f"no {puede} superar {ctx.get('le')}"
    if tipo == "string_too_long":
        return f"{supera} el máximo de {ctx.get('max_length')} caracteres"
    if tipo == "string_too_short":
        return f"no {puede} quedar sin completar"
    if tipo == "too_short":
        minimo = ctx.get("min_length", 1)
        return "debe tener al menos un ítem" if minimo == 1 else f"debe tener al menos {minimo} ítems"
    if tipo == "too_long":
        return f"no puede tener más de {ctx.get('max_length')} ítems"
    if tipo == "finite_number":
        return f"{debe} ser un número válido"
    if tipo == "value_error":
        # Los validadores propios de schemas.py ya escriben el motivo en español,
        # sin repetir el sujeto (ej: "no puede quedar sin completar").
        propio = str(ctx.get("error", "")).strip()
        return propio or f"no {es} válido"
    if tipo.endswith("_parsing") or tipo.endswith("_type"):
        return f"{tiene} un formato inválido"
    return f"no {es} un valor válido"


def traducir(errores: list[dict], maximo: int = 3) -> str:
    """Convierte la lista de errores de Pydantic en una sola frase legible."""
    frases = []
    for error in errores[:maximo]:
        etiqueta, plural = _etiqueta(error.get("loc", ()))
        motivo = _motivo(error, plural)
        frases.append(f"{etiqueta} {motivo}" if etiqueta else motivo)

    mensaje = ". ".join(frases)
    if len(errores) > maximo:
        mensaje += f" (y {len(errores) - maximo} error/es más)"
    return mensaje + "."
