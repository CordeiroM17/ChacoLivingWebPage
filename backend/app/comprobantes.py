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

# Misma paleta que el resto de la app (frontend/src/index.css), para que el
# comprobante no se sienta como un documento genérico de otra herramienta.
_INK_900 = colors.HexColor("#14171a")
_INK_700 = colors.HexColor("#3a4046")
_INK_500 = colors.HexColor("#676f77")
_INK_200 = colors.HexColor("#dde1e3")
_ACCENT_700 = colors.HexColor("#253f34")
_ACCENT_600 = colors.HexColor("#37564a")
_ACCENT_100 = colors.HexColor("#e3ebe7")
_WHITE = colors.white

_ANCHO_UTIL = 210 * mm - 18 * mm - 18 * mm  # A4 menos los márgenes de SimpleDocTemplate


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
    marca = ParagraphStyle(
        "marca", parent=estilos["Normal"], fontName="Helvetica-Bold",
        fontSize=17, textColor=_WHITE, leading=20,
    )
    marca_subtitulo = ParagraphStyle(
        "marca_subtitulo", parent=estilos["Normal"], fontSize=9, textColor=_ACCENT_100,
    )
    codigo_pedido = ParagraphStyle(
        "codigo_pedido", parent=estilos["Normal"], fontName="Helvetica-Bold",
        fontSize=14, textColor=_WHITE, alignment=TA_RIGHT, leading=17,
    )
    tipo_factura_style = ParagraphStyle(
        "tipo_factura", parent=estilos["Normal"], fontSize=9, textColor=_ACCENT_100,
        alignment=TA_RIGHT,
    )
    etiqueta_campo = ParagraphStyle(
        "etiqueta_campo", parent=estilos["Normal"], fontName="Helvetica-Bold",
        fontSize=7.5, textColor=_INK_500, leading=11,
    )
    valor_campo = ParagraphStyle(
        "valor_campo", parent=estilos["Normal"], fontSize=10.5, textColor=_INK_900,
        leading=13, spaceAfter=6,
    )
    encabezado_seccion = ParagraphStyle(
        "encabezado_seccion", parent=estilos["Normal"], fontName="Helvetica-Bold",
        fontSize=9, textColor=_INK_500, spaceAfter=4,
    )
    total_etiqueta = ParagraphStyle(
        "total_etiqueta", parent=estilos["Normal"], fontName="Helvetica-Bold",
        fontSize=10, textColor=_ACCENT_700, alignment=TA_RIGHT,
    )
    total_valor = ParagraphStyle(
        "total_valor", parent=estilos["Normal"], fontName="Helvetica-Bold",
        fontSize=17, textColor=_ACCENT_700, alignment=TA_RIGHT, leading=20,
    )
    nota_estilo = ParagraphStyle(
        "nota", parent=estilos["Normal"], fontSize=9.5, textColor=_INK_700, leading=13,
    )
    pie_estilo = ParagraphStyle(
        "pie", parent=estilos["Normal"], fontSize=8, textColor=_INK_500,
    )

    doc = SimpleDocTemplate(
        ruta,
        pagesize=A4,
        topMargin=0,
        bottomMargin=16 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title=f"Comprobante {pedido.codigo}",
    )

    elementos = []

    # ---------- Encabezado: banda de marca a todo el ancho de la página ----------
    # topMargin=0 en el documento para que la banda llegue hasta el borde;
    # el resto del contenido respeta el margen normal desde acá.
    encabezado = Table(
        [
            [
                Paragraph("Chaco Living", marca),
                Paragraph(pedido.codigo, codigo_pedido),
            ],
            [
                Paragraph("Fábrica de sillones · Comprobante de pedido", marca_subtitulo),
                Paragraph(f"Factura {_texto(pedido.cliente_tipo_factura)}", tipo_factura_style),
            ],
        ],
        colWidths=[_ANCHO_UTIL / 2, _ANCHO_UTIL / 2],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), _ACCENT_600),
            ("LEFTPADDING", (0, 0), (0, -1), 18 * mm),
            ("RIGHTPADDING", (-1, 0), (-1, -1), 18 * mm),
            ("TOPPADDING", (0, 0), (-1, 0), 14 * mm),
            ("BOTTOMPADDING", (0, -1), (-1, -1), 12 * mm),
            ("TOPPADDING", (0, 1), (-1, 1), 1),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]),
    )
    elementos.append(encabezado)
    elementos.append(Spacer(1, 10 * mm))

    # ---------- Datos de cliente y pedido: dos columnas prolijas ----------
    def _campo(etiqueta, valor):
        return [Paragraph(etiqueta.upper(), etiqueta_campo), Paragraph(_texto(valor), valor_campo)]

    columna_cliente = [
        Paragraph("CLIENTE", encabezado_seccion),
        *_campo("Nombre", pedido.cliente_nombre),
        *_campo("Contacto", pedido.cliente_contacto),
        *_campo("Dirección de envío", pedido.cliente_direccion),
    ]
    if pedido.cliente_email:
        columna_cliente += _campo("Correo electrónico", pedido.cliente_email)

    columna_pedido = [
        Paragraph("FECHAS", encabezado_seccion),
        *_campo("Fecha del pedido", _fecha(pedido.fecha_pedido)),
        *_campo("Entrega prometida", _fecha(pedido.fecha_prometida)),
    ]

    datos = Table(
        [[columna_cliente, columna_pedido]],
        colWidths=[_ANCHO_UTIL * 0.6, _ANCHO_UTIL * 0.4],
        style=TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (0, -1), 0),
            ("LEFTPADDING", (1, 0), (1, -1), 6 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]),
    )
    elementos.append(datos)
    elementos.append(Spacer(1, 4 * mm))

    # ---------- Ítems: solo líneas horizontales, sin grilla completa ----------
    filas = [["MODELO", "DETALLE", "CANT.", "PRECIO UNIT.", "SUBTOTAL"]]
    for item in pedido.items:
        modelo = modelos_por_id.get(item.modelo_id)
        medidas = None
        if item.ancho_m and item.altura_m and item.profundidad_m:
            medidas = f"{item.ancho_m}×{item.altura_m}×{item.profundidad_m} m"
        detalle = " · ".join(filter(None, [item.tela, item.color, medidas]))
        filas.append(
            [
                modelo.nombre if modelo else f"Modelo #{item.modelo_id}",
                detalle,
                str(item.cantidad),
                _moneda(item.precio_unitario),
                _moneda(item.subtotal),
            ]
        )

    cantidad_filas = len(filas)
    tabla = Table(filas, colWidths=[45 * mm, 52 * mm, 15 * mm, 30 * mm, 30 * mm], repeatRows=1)
    estilo_tabla = [
        ("BACKGROUND", (0, 0), (-1, 0), _ACCENT_600),
        ("TEXTCOLOR", (0, 0), (-1, 0), _WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), _INK_900),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, 0), 0, _ACCENT_600),
        # Una línea fina bajo cada fila de datos en vez de una grilla completa:
        # más parecido a una factura impresa que a una hoja de cálculo.
        *[
            ("LINEBELOW", (0, i), (-1, i), 0.5, _INK_200)
            for i in range(1, cantidad_filas - 1)
        ],
    ]
    tabla.setStyle(TableStyle(estilo_tabla))
    elementos.append(tabla)

    # ---------- Total: barra destacada, igual de prominente que en la app ----------
    total = Table(
        [[Paragraph("TOTAL", total_etiqueta), Paragraph(_moneda(pedido.total), total_valor)]],
        colWidths=[_ANCHO_UTIL - 45 * mm, 45 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), _ACCENT_100),
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (-1, 0), (-1, -1), 4 * mm),
        ]),
    )
    elementos.append(total)

    if pedido.notas:
        elementos.append(Spacer(1, 8 * mm))
        elementos.append(Paragraph("NOTAS", encabezado_seccion))
        elementos.append(Paragraph(_texto(pedido.notas), nota_estilo))

    elementos.append(Spacer(1, 14 * mm))
    elementos.append(Table(
        [[""]], colWidths=[_ANCHO_UTIL],
        style=TableStyle([("LINEABOVE", (0, 0), (-1, 0), 0.5, _INK_200)]),
    ))
    elementos.append(Spacer(1, 3 * mm))
    elementos.append(Paragraph("Chaco Living · Fábrica de sillones", pie_estilo))

    doc.build(elementos)
    return f"/uploads/comprobantes/{nombre_archivo}"
