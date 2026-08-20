from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Modelo(Base):
    __tablename__ = "modelos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    precio_base: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    foto_url: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(default=True, nullable=False)
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
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    cliente_nombre: Mapped[str] = mapped_column(Text, nullable=False)
    cliente_contacto: Mapped[str | None] = mapped_column(Text)
    fecha_pedido: Mapped[date] = mapped_column(
        Date, server_default=func.current_date(), nullable=False
    )
    fecha_prometida: Mapped[date | None] = mapped_column(Date)
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
    medidas: Mapped[str | None] = mapped_column(Text)
    precio_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    pedido: Mapped["Pedido"] = relationship(back_populates="items")
    modelo: Mapped["Modelo"] = relationship()
