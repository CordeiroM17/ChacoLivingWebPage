import os
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from . import models
from .config import UPLOADS_DIR

COMPROBANTES_DIR = os.path.join(UPLOADS_DIR, "comprobantes")
os.makedirs(COMPROBANTES_DIR, exist_ok=True)


def _moneda(valor) -> str:
    formateado = f"{float(valor):,.2f}"
    formateado = formateado.replace(",", "_").replace(".", ",").replace("_", ".")
    return f"$ {formateado}"


def _fecha(valor) -> str:
    return valor.strftime("%d/%m/%Y") if valor else ""


def _texto(valor) -> str:
    """Escapa texto del cliente para meterlo en un Paragraph.

    Paragraph de reportlab interpreta un subconjunto de HTML, así que un nombre
    con '<' o '&' rompe la generación del PDF. Solo se usa en Paragraph: las
    celdas sueltas de la Table no se parsean y ahí el texto va tal cual.
    """
    return escape(str(valor)) if valor else ""


def generar_comprobante(
    pedido: models.Pedido, modelos_por_id: dict[int, models.Modelo]
) -> str:
    nombre_archivo = f"{pedido.codigo}.pdf"
    ruta = os.path.join(COMPROBANTES_DIR, nombre_archivo)

    estilos = getSampleStyleSheet()
    titulo = ParagraphStyle("titulo", parent=estilos["Heading1"], fontSize=18, spaceAfter=2)
    subtitulo = ParagraphStyle(
        "subtitulo", parent=estilos["Normal"], fontSize=10, textColor=colors.grey
    )
    etiqueta = ParagraphStyle("etiqueta", parent=estilos["Normal"], fontSize=10, spaceAfter=3)
    total_style = ParagraphStyle(
        "total", parent=estilos["Heading2"], alignment=TA_RIGHT, spaceBefore=4
    )

    doc = SimpleDocTemplate(
        ruta,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title=f"Comprobante {pedido.codigo}",
    )

    elementos = [
        Paragraph("Chaco Living", titulo),
        Paragraph("Fábrica de sillones · Comprobante de pedido", subtitulo),
        Spacer(1, 10 * mm),
        Paragraph(f"<b>Pedido:</b> {_texto(pedido.codigo)}", etiqueta),
        Paragraph(f"<b>Cliente:</b> {_texto(pedido.cliente_nombre)}", etiqueta),
    ]
    if pedido.cliente_contacto:
        elementos.append(
            Paragraph(f"<b>Contacto:</b> {_texto(pedido.cliente_contacto)}", etiqueta)
        )
    elementos.append(Paragraph(f"<b>Fecha del pedido:</b> {_fecha(pedido.fecha_pedido)}", etiqueta))
    if pedido.fecha_prometida:
        elementos.append(
            Paragraph(f"<b>Entrega prometida:</b> {_fecha(pedido.fecha_prometida)}", etiqueta)
        )
    elementos.append(Spacer(1, 8 * mm))

    filas = [["Modelo", "Detalle", "Cant.", "Precio unit.", "Subtotal"]]
    for item in pedido.items:
        modelo = modelos_por_id.get(item.modelo_id)
        detalle = " · ".join(filter(None, [item.tela, item.color, item.medidas]))
        filas.append(
            [
                modelo.nombre if modelo else f"Modelo #{item.modelo_id}",
                detalle,
                str(item.cantidad),
                _moneda(item.precio_unitario),
                _moneda(item.subtotal),
            ]
        )

    tabla = Table(filas, colWidths=[45 * mm, 52 * mm, 15 * mm, 30 * mm, 30 * mm])
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f1f1f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elementos.append(tabla)
    elementos.append(Spacer(1, 6 * mm))
    elementos.append(Paragraph(f"Total: {_moneda(pedido.total)}", total_style))

    if pedido.notas:
        elementos.append(Spacer(1, 8 * mm))
        elementos.append(Paragraph(f"<b>Notas:</b> {_texto(pedido.notas)}", etiqueta))

    doc.build(elementos)
    return f"/uploads/comprobantes/{nombre_archivo}"
