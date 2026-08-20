import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

ESTADOS = ("pendiente", "en_proceso", "listo", "entregado", "cancelado")

# Topes de validación. El backend nunca confía en lo que manda el cliente: el
# frontend guarda el borrador en localStorage, que es editable a mano desde la
# consola del navegador, así que todo lo que llega se vuelve a validar acá.
MAX_MONTO = 9_999_999_999.99  # tope real de NUMERIC(12,2) en la base
MAX_CANTIDAD = 1000  # un pedido de fábrica no llega ni cerca
MAX_ITEMS = 50  # ítems distintos por pedido

# Los uploads siempre devuelven /uploads/{uuid}.{ext}. Aceptar cualquier string
# permitiría apuntar la foto de un modelo a un dominio externo.
PATRON_FOTO = re.compile(r"^/uploads/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$", re.IGNORECASE)


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


# ---------- Modelos ----------


class ModeloBase(BaseModel):
    model_config = SOLO_LO_DECLARADO

    nombre: str = Field(min_length=1, max_length=200)
    descripcion: str | None = Field(default=None, max_length=1000)
    precio_base: float = Field(ge=0, le=MAX_MONTO, allow_inf_nan=False)
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
    foto_url: str | None
    activo: bool
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
    tela: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=100)
    medidas: str | None = Field(default=None, max_length=100)
    # El precio llega del cliente a propósito (la spec dice que es editable en el
    # formulario), pero acotado: nunca negativo ni fuera del rango de la columna.
    precio_unitario: float = Field(ge=0, le=MAX_MONTO, allow_inf_nan=False)

    _limpiar_tela = field_validator("tela")(_texto_opcional)
    _limpiar_color = field_validator("color")(_texto_opcional)
    _limpiar_medidas = field_validator("medidas")(_texto_opcional)


class PedidoItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    modelo_id: int
    modelo: ModeloResumenOut
    cantidad: int
    tela: str | None
    color: str | None
    medidas: str | None
    precio_unitario: float
    subtotal: float


# ---------- Pedidos ----------


class PedidoCreate(BaseModel):
    model_config = SOLO_LO_DECLARADO

    cliente_nombre: str = Field(min_length=1, max_length=200)
    cliente_contacto: str | None = Field(default=None, max_length=100)
    fecha_pedido: date | None = None
    fecha_prometida: date | None = None
    notas: str | None = Field(default=None, max_length=2000)
    items: list[PedidoItemCreate] = Field(min_length=1, max_length=MAX_ITEMS)

    _limpiar_cliente = field_validator("cliente_nombre")(_texto_obligatorio)
    _limpiar_contacto = field_validator("cliente_contacto")(_texto_opcional)
    _limpiar_notas = field_validator("notas")(_texto_opcional)


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
    cliente_contacto: str | None
    fecha_pedido: date
    fecha_prometida: date | None
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
