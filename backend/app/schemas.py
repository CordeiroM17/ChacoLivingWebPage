import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

ESTADOS = ("pendiente", "en_proceso", "listo", "entregado", "cancelado")
TIPOS_FACTURA = ("A", "B", "C")

# Topes de validación. El backend nunca confía en lo que manda el cliente: el
# frontend guarda el borrador en localStorage, que es editable a mano desde la
# consola del navegador, así que todo lo que llega se vuelve a validar acá.
MAX_MONTO = 9_999_999_999.99  # tope real de NUMERIC(12,2) en la base
MAX_CANTIDAD = 1000  # un pedido de fábrica no llega ni cerca
MAX_ITEMS = 50  # ítems distintos por pedido
MAX_DIRECCION = 300
MAX_EMAIL = 200
MAX_MEDIDA_CM = 500  # ningún sillón de fábrica llega a 5 metros de lado
MAX_MEDIDA_M = 5  # mismo tope que MAX_MEDIDA_CM: la medida del ítem del pedido va en metros

# Los uploads siempre devuelven /uploads/{uuid}.{ext}. Aceptar cualquier string
# permitiría apuntar la foto de un modelo a un dominio externo.
PATRON_FOTO = re.compile(r"^/uploads/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$", re.IGNORECASE)

# Chequeo de forma nomás (no DNS ni MX): alcanza para atajar errores de tipeo
# sin rechazar direcciones válidas pero poco comunes.
PATRON_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# Los esquemas de entrada rechazan campos no declarados: si llega algo de más
# es un bug del cliente (o un intento de mandar datos que no corresponden), y
# conviene verlo explícito antes que ignorarlo en silencio.
SOLO_LO_DECLARADO = ConfigDict(extra="forbid")


def _validar_foto_url(valor: str | None) -> str | None:
    if valor is None or valor == "":
        return None
    if not PATRON_FOTO.match(valor):
        raise ValueError("debe ser una imagen subida a este servidor")
    return valor


def _texto_obligatorio(valor: str) -> str:
    limpio = valor.strip()
    if not limpio:
        raise ValueError("no puede quedar sin completar")
    return limpio


def _texto_opcional(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpio = valor.strip()
    return limpio or None


def _validar_email(valor: str | None) -> str | None:
    if valor is None or valor == "":
        return None
    limpio = valor.strip()
    if not PATRON_EMAIL.match(limpio):
        raise ValueError("no tiene un formato válido")
    return limpio


# ---------- Modelos ----------


class ModeloBase(BaseModel):
    model_config = SOLO_LO_DECLARADO

    nombre: str = Field(min_length=1, max_length=200)
    descripcion: str | None = Field(default=None, max_length=1000)
    precio_base: float = Field(ge=0, le=MAX_MONTO, allow_inf_nan=False)
    profundidad_cm: float = Field(gt=0, le=MAX_MEDIDA_CM, allow_inf_nan=False)
    altura_cm: float = Field(gt=0, le=MAX_MEDIDA_CM, allow_inf_nan=False)
    ancho_cm: float = Field(gt=0, le=MAX_MEDIDA_CM, allow_inf_nan=False)
    foto_url: str | None = Field(default=None, max_length=300)

    _limpiar_nombre = field_validator("nombre")(_texto_obligatorio)
    _limpiar_descripcion = field_validator("descripcion")(_texto_opcional)
    _validar_foto = field_validator("foto_url")(_validar_foto_url)


class ModeloCreate(ModeloBase):
    pass


class ModeloUpdate(BaseModel):
    model_config = SOLO_LO_DECLARADO

    nombre: str | None = Field(default=None, min_length=1, max_length=200)
    descripcion: str | None = Field(default=None, max_length=1000)
    precio_base: float | None = Field(default=None, ge=0, le=MAX_MONTO, allow_inf_nan=False)
    profundidad_cm: float | None = Field(default=None, gt=0, le=MAX_MEDIDA_CM, allow_inf_nan=False)
    altura_cm: float | None = Field(default=None, gt=0, le=MAX_MEDIDA_CM, allow_inf_nan=False)
    ancho_cm: float | None = Field(default=None, gt=0, le=MAX_MEDIDA_CM, allow_inf_nan=False)
    foto_url: str | None = Field(default=None, max_length=300)
    activo: bool | None = None

    @field_validator("nombre")
    @classmethod
    def _limpiar_nombre(cls, valor: str | None) -> str | None:
        return _texto_obligatorio(valor) if valor is not None else None

    _limpiar_descripcion = field_validator("descripcion")(_texto_opcional)
    _validar_foto = field_validator("foto_url")(_validar_foto_url)


class ModeloOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    descripcion: str | None
    precio_base: float
    profundidad_cm: float
    altura_cm: float
    ancho_cm: float
    foto_url: str | None
    activo: bool
    creado_en: datetime


# ---------- Catálogos ----------


class CatalogoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    portada_url: str
    total_paginas: int
    creado_en: datetime


# ---------- Pedido items ----------


class ModeloResumenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    foto_url: str | None


class PedidoItemCreate(BaseModel):
    model_config = SOLO_LO_DECLARADO

    modelo_id: int = Field(gt=0)
    cantidad: int = Field(default=1, gt=0, le=MAX_CANTIDAD)
    tela: str = Field(min_length=1, max_length=100)
    color: str = Field(min_length=1, max_length=100)
    # En metros (el modelo del catálogo usa cm; el ítem del pedido, metros).
    # Se precargan desde el modelo en el frontend pero llegan editables: el
    # cliente puede pedir otra medida para ese sillón puntual.
    ancho_m: float = Field(gt=0, le=MAX_MEDIDA_M, allow_inf_nan=False)
    altura_m: float = Field(gt=0, le=MAX_MEDIDA_M, allow_inf_nan=False)
    profundidad_m: float = Field(gt=0, le=MAX_MEDIDA_M, allow_inf_nan=False)
    # El precio llega del cliente a propósito (la spec dice que es editable en el
    # formulario), pero acotado: nunca negativo ni fuera del rango de la columna.
    precio_unitario: float = Field(ge=0, le=MAX_MONTO, allow_inf_nan=False)

    _limpiar_tela = field_validator("tela")(_texto_obligatorio)
    _limpiar_color = field_validator("color")(_texto_obligatorio)


class PedidoItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    modelo_id: int
    modelo: ModeloResumenOut
    cantidad: int
    tela: str | None
    color: str | None
    ancho_m: float | None
    altura_m: float | None
    profundidad_m: float | None
    precio_unitario: float
    subtotal: float


# ---------- Pedidos ----------


class PedidoCreate(BaseModel):
    model_config = SOLO_LO_DECLARADO

    cliente_nombre: str = Field(min_length=1, max_length=200)
    cliente_contacto: str = Field(min_length=1, max_length=100)
    cliente_direccion: str = Field(min_length=1, max_length=MAX_DIRECCION)
    cliente_tipo_factura: str
    cliente_email: str | None = Field(default=None, max_length=MAX_EMAIL)
    fecha_pedido: date
    fecha_prometida: date
    notas: str | None = Field(default=None, max_length=2000)
    items: list[PedidoItemCreate] = Field(min_length=1, max_length=MAX_ITEMS)

    _limpiar_cliente = field_validator("cliente_nombre")(_texto_obligatorio)
    _limpiar_contacto = field_validator("cliente_contacto")(_texto_obligatorio)
    _limpiar_direccion = field_validator("cliente_direccion")(_texto_obligatorio)
    _limpiar_notas = field_validator("notas")(_texto_opcional)
    _validar_correo = field_validator("cliente_email")(_validar_email)

    @field_validator("cliente_tipo_factura")
    @classmethod
    def _validar_tipo_factura(cls, valor: str) -> str:
        if valor not in TIPOS_FACTURA:
            raise ValueError(f"debe ser uno de: {', '.join(TIPOS_FACTURA)}")
        return valor


class PedidoUpdate(BaseModel):
    model_config = SOLO_LO_DECLARADO

    estado: str | None = None
    cliente_nombre: str | None = Field(default=None, min_length=1, max_length=200)
    cliente_contacto: str | None = Field(default=None, max_length=100)
    fecha_prometida: date | None = None
    notas: str | None = Field(default=None, max_length=2000)

    @field_validator("estado")
    @classmethod
    def _validar_estado(cls, valor: str | None) -> str | None:
        if valor is not None and valor not in ESTADOS:
            raise ValueError(f"debe ser uno de: {', '.join(ESTADOS)}")
        return valor

    @field_validator("cliente_nombre")
    @classmethod
    def _limpiar_cliente(cls, valor: str | None) -> str | None:
        return _texto_obligatorio(valor) if valor is not None else None

    _limpiar_contacto = field_validator("cliente_contacto")(_texto_opcional)
    _limpiar_notas = field_validator("notas")(_texto_opcional)


class PedidoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    cliente_nombre: str
    cliente_contacto: str
    cliente_direccion: str
    cliente_tipo_factura: str
    cliente_email: str | None
    fecha_pedido: date
    fecha_prometida: date
    estado: str
    total: float
    notas: str | None
    comprobante_url: str | None
    creado_en: datetime


class PedidoDetalleOut(PedidoOut):
    items: list[PedidoItemOut]


class PedidosPaginadosOut(BaseModel):
    """Respuesta de GET /pedidos: la página pedida más el total real de la base.

    El total viaja aparte de `items` para que el frontend pueda mostrar
    "50 de 1240" sin tener que traer los 1240 para contarlos.
    """

    items: list[PedidoOut]
    total: int
