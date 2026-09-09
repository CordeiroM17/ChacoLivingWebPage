from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_token
from ..database import get_db

router = APIRouter(
    prefix="/clientes", tags=["clientes"], dependencies=[Depends(require_token)]
)

LIMITE_DEFECTO = 50
LIMITE_MAXIMO = 500  # la lista de clientes se trae entera al frontend (typeahead)

# nombre / activo son NOT NULL en la base: un null explícito en el PATCH se
# ignora en vez de reventar con un 500. El resto de los campos sí se puede vaciar.
CAMPOS_NO_VACIABLES = {"nombre", "activo"}


@router.get("", response_model=schemas.ClientesPaginadosOut)
def listar_clientes(
    buscar: str | None = None,
    activos: bool | None = None,
    limit: int = Query(default=LIMITE_DEFECTO, ge=1, le=LIMITE_MAXIMO),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = select(models.Cliente)

    if buscar:
        patron = f"%{buscar}%"
        query = query.where(
            or_(
                models.Cliente.nombre.ilike(patron),
                models.Cliente.contacto.ilike(patron),
                models.Cliente.localidad.ilike(patron),
            )
        )
    if activos is True:
        query = query.where(models.Cliente.activo.is_(True))

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(models.Cliente.nombre).limit(limit).offset(offset)
    ).all()
    return {"items": items, "total": total or 0}


@router.get("/{cliente_id}", response_model=schemas.ClienteOut)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.get(models.Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.post("", response_model=schemas.ClienteOut, status_code=201)
def crear_cliente(datos: schemas.ClienteCreate, db: Session = Depends(get_db)):
    cliente = models.Cliente(**datos.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.patch("/{cliente_id}", response_model=schemas.ClienteOut)
def editar_cliente(
    cliente_id: int, datos: schemas.ClienteUpdate, db: Session = Depends(get_db)
):
    cliente = db.get(models.Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    for campo, valor in datos.model_dump(exclude_unset=True).items():
        if valor is None and campo in CAMPOS_NO_VACIABLES:
            continue
        setattr(cliente, campo, valor)

    db.commit()
    db.refresh(cliente)
    return cliente
