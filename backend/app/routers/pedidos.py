import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..auth import require_token
from ..comprobantes import generar_comprobante
from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pedidos", tags=["pedidos"], dependencies=[Depends(require_token)]
)

# Margen para la fecha del pedido. El borrador vive en localStorage y puede
# quedar días abierto (o ser editado a mano), así que se acota a una ventana
# razonable en vez de aceptar cualquier fecha: el año de esta fecha es el que
# arma el código correlativo (P-{año}-{secuencia}).
DIAS_ATRAS_MAXIMO = 365
DIAS_ADELANTE_MAXIMO = 1  # margen por diferencia de huso entre tablet y servidor

LIMITE_DEFECTO = 50
LIMITE_MAXIMO = 200


def _generar_codigo(db: Session, anio: int) -> str:
    """Siguiente código correlativo del año: P-{año}-{secuencia con padding 4}.

    Se calcula desde el código más alto del año, no contando pedidos: contar
    reusa números si alguna vez se borra una fila (dos pedidos terminarían con
    el mismo `codigo`, que es UNIQUE, y el segundo alta fallaría).

    El filtro va por rango de fechas en vez de `extract('year', ...)`: una
    función sobre la columna impide usar `idx_pedidos_fecha` y obliga a leer la
    tabla entera en cada alta.
    """
    ultimo = db.scalar(
        select(func.max(models.Pedido.codigo)).where(
            models.Pedido.fecha_pedido >= date(anio, 1, 1),
            models.Pedido.fecha_pedido < date(anio + 1, 1, 1),
        )
    )
    # El padding a 4 dígitos hace que el orden alfabético coincida con el
    # numérico hasta 9999 pedidos por año, de sobra para la fábrica.
    secuencia = int(ultimo.rsplit("-", 1)[1]) + 1 if ultimo else 1
    return f"P-{anio}-{secuencia:04d}"


def _cargar_pedido_completo(db: Session, pedido_id: int) -> models.Pedido | None:
    """Trae un pedido con sus ítems y el modelo de cada ítem en consultas acotadas.

    `selectinload` hace una consulta para los ítems y otra para los modelos
    distintos que aparecen entre ellos (con `IN`), sin importar cuántos ítems
    tenga el pedido — a diferencia del acceso perezoso normal, que dispara una
    consulta por ítem la primera vez que se lee `item.modelo`.
    """
    return db.scalar(
        select(models.Pedido)
        .options(selectinload(models.Pedido.items).selectinload(models.PedidoItem.modelo))
        .where(models.Pedido.id == pedido_id)
    )


@router.get("", response_model=schemas.PedidosPaginadosOut)
def listar_pedidos(
    buscar: str | None = None,
    estado: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    limit: int = Query(default=LIMITE_DEFECTO, ge=1, le=LIMITE_MAXIMO),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = select(models.Pedido)

    if buscar:
        patron = f"%{buscar}%"
        query = query.where(
            or_(
                models.Pedido.cliente_nombre.ilike(patron),
                models.Pedido.codigo.ilike(patron),
            )
        )
    if estado:
        query = query.where(models.Pedido.estado == estado)
    if desde:
        query = query.where(models.Pedido.fecha_pedido >= desde)
    if hasta:
        query = query.where(models.Pedido.fecha_pedido <= hasta)

    # El total se cuenta con los mismos filtros pero sin paginar, para que el
    # frontend pueda mostrar "50 de 1240" sin traer los 1240 pedidos.
    total = db.scalar(select(func.count()).select_from(query.subquery()))

    items = db.scalars(
        query.order_by(models.Pedido.fecha_pedido.desc(), models.Pedido.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return {"items": items, "total": total or 0}


@router.post("", response_model=schemas.PedidoDetalleOut, status_code=201)
def crear_pedido(
    datos: schemas.PedidoCreate,
    db: Session = Depends(get_db),
    usuario: str = Depends(require_token),
):
    # Los formatos y rangos ya los validó Pydantic (schemas.py). Acá va lo que
    # solo se puede verificar contra la base: que los modelos existan, que estén
    # activos y que el total entre en la columna.
    hoy = date.today()
    fecha_pedido = datos.fecha_pedido
    if fecha_pedido < hoy - timedelta(days=DIAS_ATRAS_MAXIMO):
        raise HTTPException(
            status_code=422, detail="La fecha del pedido es demasiado antigua"
        )
    if fecha_pedido > hoy + timedelta(days=DIAS_ADELANTE_MAXIMO):
        raise HTTPException(status_code=422, detail="La fecha del pedido no puede ser futura")
    if datos.fecha_prometida < fecha_pedido:
        raise HTTPException(
            status_code=422,
            detail="La entrega prometida no puede ser anterior a la fecha del pedido",
        )

    # Cliente de la lista global:
    #  - si el frontend mandó `cliente_id`, tiene que existir y estar activo;
    #  - si no, se busca por nombre (case-insensitive) y se linkea al que haya,
    #    o se crea uno nuevo — así la lista se va poblando sola al tomar pedidos.
    # Los `cliente_*` del pedido siguen siendo el snapshot que manda el frontend
    # (prellenado desde ese cliente pero editable en el formulario).
    if datos.cliente_id is not None:
        cliente = db.get(models.Cliente, datos.cliente_id)
        if cliente is None:
            raise HTTPException(status_code=422, detail="El cliente elegido no existe")
        if not cliente.activo:
            raise HTTPException(
                status_code=422, detail="El cliente elegido está desactivado"
            )
        cliente_id = cliente.id
    else:
        cliente = db.scalar(
            select(models.Cliente).where(
                func.lower(func.btrim(models.Cliente.nombre))
                == datos.cliente_nombre.lower()
            )
        )
        if cliente is None:
            cliente = models.Cliente(
                nombre=datos.cliente_nombre,
                contacto=datos.cliente_contacto,
                direccion=datos.cliente_direccion,
                tipo_factura=datos.cliente_tipo_factura,
                email=datos.cliente_email,
            )
            db.add(cliente)
            db.flush()
        cliente_id = cliente.id

    modelo_ids = {item.modelo_id for item in datos.items}
    modelos_db = db.scalars(
        select(models.Modelo).where(models.Modelo.id.in_(modelo_ids))
    ).all()
    modelos_por_id = {m.id: m for m in modelos_db}

    faltantes = modelo_ids - modelos_por_id.keys()
    if faltantes:
        raise HTTPException(status_code=422, detail="Hay un modelo inexistente en los ítems")

    # Un borrador guardado en el navegador puede referirse a un modelo que se
    # dio de baja mientras el pedido estaba a medio cargar.
    inactivos = [m.nombre for m in modelos_db if not m.activo]
    if inactivos:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Estos modelos ya no están disponibles: {', '.join(sorted(inactivos))}. "
                "Actualizá el pedido antes de confirmarlo."
            ),
        )

    total = 0.0
    items_calculados = []
    for item in datos.items:
        subtotal = round(item.cantidad * item.precio_unitario, 2)
        total = round(total + subtotal, 2)
        items_calculados.append((item, subtotal))

    if total > schemas.MAX_MONTO:
        raise HTTPException(status_code=422, detail="El total del pedido excede el máximo permitido")

    codigo = _generar_codigo(db, fecha_pedido.year)

    pedido = models.Pedido(
        codigo=codigo,
        cliente_id=cliente_id,
        cliente_nombre=datos.cliente_nombre,
        cliente_contacto=datos.cliente_contacto,
        cliente_direccion=datos.cliente_direccion,
        cliente_tipo_factura=datos.cliente_tipo_factura,
        cliente_email=datos.cliente_email,
        creado_por=usuario,
        fecha_pedido=fecha_pedido,
        fecha_prometida=datos.fecha_prometida,
        notas=datos.notas,
        total=total,
    )
    for item, subtotal in items_calculados:
        pedido.items.append(
            models.PedidoItem(
                modelo_id=item.modelo_id,
                cantidad=item.cantidad,
                tela=item.tela,
                color=item.color,
                ancho_m=item.ancho_m,
                altura_m=item.altura_m,
                profundidad_m=item.profundidad_m,
                precio_unitario=item.precio_unitario,
                subtotal=subtotal,
            )
        )

    db.add(pedido)
    db.flush()  # asigna pedido.id (vía el INSERT) mientras el objeto sigue fresco
    pedido_id = pedido.id
    db.commit()

    # El pedido recién queda guardado acá. El comprobante se genera después, no
    # antes: si el commit fallara (una restricción violada, por ejemplo), nunca
    # se llegaría a este punto y no se generaría un PDF para un pedido que no
    # existe. Usa los mismos datos que ya se armaron arriba — no hace falta
    # volver a pedirlos a la base.
    try:
        pedido.comprobante_url = generar_comprobante(pedido, modelos_por_id)
        db.commit()
    except Exception:
        logger.exception("No se pudo generar el comprobante del pedido %s", pedido.codigo)
        # El pedido ya quedó guardado sin comprobante; se puede regenerar más
        # adelante. No se pierde la venta por esto.

    # Una consulta acotada (pedido + ítems + modelos, sin importar cuántos
    # ítems tenga) para traer la respuesta completa, en vez de dejar que la
    # serialización dispare una consulta por ítem.
    return _cargar_pedido_completo(db, pedido_id)


@router.get("/{pedido_id}", response_model=schemas.PedidoDetalleOut)
def obtener_pedido(pedido_id: int, db: Session = Depends(get_db)):
    pedido = _cargar_pedido_completo(db, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return pedido


@router.post("/{pedido_id}/comprobante", response_model=schemas.PedidoDetalleOut)
def regenerar_comprobante(pedido_id: int, db: Session = Depends(get_db)):
    """Vuelve a generar el PDF de un pedido ya guardado.

    El comprobante es dato derivado: todo lo que necesita (código, cliente,
    ítems, precios, total, notas) vive en la base, así que se reconstruye
    idéntico en cualquier momento. Sirve para dos casos reales:

    - Un pedido que quedó sin comprobante porque la generación falló en el alta
      (ver el `try/except` de `crear_pedido`).
    - Un archivo perdido: si el disco donde viven los uploads se borra —lo que
      pasa en cada redeploy si no hay un volumen persistente— la fila del pedido
      sigue apuntando a un archivo que ya no existe.
    """
    pedido = _cargar_pedido_completo(db, pedido_id)
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if pedido.estado == "cancelado":
        raise HTTPException(
            status_code=409,
            detail="No se puede generar un comprobante para un pedido cancelado",
        )

    modelos_por_id = {item.modelo.id: item.modelo for item in pedido.items}
    try:
        pedido.comprobante_url = generar_comprobante(pedido, modelos_por_id)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("No se pudo regenerar el comprobante del pedido %s", pedido.codigo)
        raise HTTPException(
            status_code=500,
            detail="No se pudo generar el comprobante. Probá de nuevo en un momento.",
        )

    return _cargar_pedido_completo(db, pedido_id)


@router.patch("/{pedido_id}", response_model=schemas.PedidoDetalleOut)
def editar_pedido(
    pedido_id: int, datos: schemas.PedidoUpdate, db: Session = Depends(get_db)
):
    pedido = db.scalar(select(models.Pedido).where(models.Pedido.id == pedido_id))
    if pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # El estado y los largos de texto ya los valida schemas.PedidoUpdate.
    cambios = datos.model_dump(exclude_unset=True)
    nueva_prometida = cambios.get("fecha_prometida", pedido.fecha_prometida)
    if nueva_prometida and nueva_prometida < pedido.fecha_pedido:
        raise HTTPException(
            status_code=422,
            detail="La entrega prometida no puede ser anterior a la fecha del pedido",
        )

    for campo, valor in cambios.items():
        # notas se puede vaciar; el resto de lo que PedidoUpdate acepta es
        # NOT NULL en la base, así que un null explícito se ignora en vez de
        # reventar con un 500 al hacer commit.
        if valor is None and campo != "notas":
            continue
        setattr(pedido, campo, valor)

    db.commit()
    # `pedido_id` (el parámetro de ruta) en vez de `pedido.id`: leer el atributo
    # del objeto ya expirado por el commit dispararía un SELECT de más.
    return _cargar_pedido_completo(db, pedido_id)
