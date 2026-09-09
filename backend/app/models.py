from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Modelo(Base):
    __tablename__ = "modelos"
    __table_args__ = (
        CheckConstraint("profundidad_m > 0", name="modelos_profundidad_check"),
        CheckConstraint("altura_m > 0", name="modelos_altura_check"),
        CheckConstraint("ancho_m > 0", name="modelos_ancho_check"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    precio_base: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # En metros, la misma unidad que usan los ítems del pedido: las medidas del
    # modelo se copian tal cual al ítem al elegirlo, sin conversión en el medio.
    profundidad_m: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    altura_m: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    ancho_m: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    # Varias fotos por modelo, en orden: la primera es la portada (la que se ve
    # como miniatura en la lista, en los ítems del pedido y en el comprobante).
    # Guardadas como array de rutas `/uploads/...`; reordenar o quitar una es
    # reasignar la lista entera, no hay tabla aparte.
    fotos: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'")
    )
    activo: Mapped[bool] = mapped_column(default=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    @property
    def foto_url(self) -> str | None:
        """La portada: primera foto, o None si el modelo no tiene ninguna.

        Se expone así para que todo lo que ya mostraba una sola foto del modelo
        (miniatura en la lista, ítems del pedido, comprobante en PDF) siga
        funcionando sin cambios.
        """
        return self.fotos[0] if self.fotos else None


class Cliente(Base):
    __tablename__ = "clientes"
    __table_args__ = (
        CheckConstraint(
            "tipo_factura IS NULL OR tipo_factura IN ('A','B','C')",
            name="clientes_tipo_factura_check",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    contacto: Mapped[str | None] = mapped_column(Text)
    direccion: Mapped[str | None] = mapped_column(Text)
    # Preferencia por defecto del cliente; el pedido guarda su propio snapshot
    # y puede diferir (se edita por pedido).
    tipo_factura: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    localidad: Mapped[str | None] = mapped_column(Text)
    cuit: Mapped[str | None] = mapped_column(Text)
    notas: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(default=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class Catalogo(Base):
    __tablename__ = "catalogos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    portada_url: Mapped[str] = mapped_column(Text, nullable=False)
    total_paginas: Mapped[int] = mapped_column(nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class Pedido(Base):
    __tablename__ = "pedidos"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('pendiente','en_proceso','listo','entregado','cancelado')",
            name="pedidos_estado_check",
        ),
        CheckConstraint(
            "cliente_tipo_factura IN ('A','B','C')",
            name="pedidos_tipo_factura_check",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    # Link opcional al cliente de la lista global. Los `cliente_*` de abajo son
    # el snapshot congelado al momento del pedido (pueden diferir del cliente si
    # se editaron acá); el link sirve para agrupar y para autocompletar el
    # próximo pedido de la misma persona.
    cliente_id: Mapped[int | None] = mapped_column(
        ForeignKey("clientes.id", ondelete="SET NULL")
    )
    cliente_nombre: Mapped[str] = mapped_column(Text, nullable=False)
    cliente_contacto: Mapped[str] = mapped_column(Text, nullable=False)
    cliente_direccion: Mapped[str] = mapped_column(Text, nullable=False)
    cliente_tipo_factura: Mapped[str] = mapped_column(Text, nullable=False)
    cliente_email: Mapped[str | None] = mapped_column(Text)
    # Mail del JWT de quien cargó el pedido. Hoy no se usa para permisos (un
    # solo dueño), pero se guarda desde ahora para no tener que backfillearlo
    # cuando haya varios usuarios.
    creado_por: Mapped[str | None] = mapped_column(Text)
    fecha_pedido: Mapped[date] = mapped_column(
        Date, server_default=func.current_date(), nullable=False
    )
    fecha_prometida: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[str] = mapped_column(Text, default="pendiente", nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    notas: Mapped[str | None] = mapped_column(Text)
    comprobante_url: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    items: Mapped[list["PedidoItem"]] = relationship(
        back_populates="pedido", cascade="all, delete-orphan"
    )
    cliente: Mapped["Cliente | None"] = relationship()


class PedidoItem(Base):
    __tablename__ = "pedido_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    pedido_id: Mapped[int] = mapped_column(
        ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False
    )
    modelo_id: Mapped[int] = mapped_column(ForeignKey("modelos.id"), nullable=False)
    cantidad: Mapped[int] = mapped_column(default=1, nullable=False)
    tela: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(Text)
    # En metros (a diferencia de las medidas del modelo, que son en cm): se
    # precargan desde el modelo pero quedan editables por ítem, el cliente
    # puede pedir otra medida. Nullable como tela/color: lo exige
    # PedidoItemCreate, no la base, así que un ítem viejo sin estos datos se
    # sigue pudiendo leer.
    ancho_m: Mapped[float | None] = mapped_column(Numeric(4, 2))
    altura_m: Mapped[float | None] = mapped_column(Numeric(4, 2))
    profundidad_m: Mapped[float | None] = mapped_column(Numeric(4, 2))
    precio_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    pedido: Mapped["Pedido"] = relationship(back_populates="items")
    modelo: Mapped["Modelo"] = relationship()
