from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_token
from ..database import get_db

router = APIRouter(
    prefix="/modelos", tags=["modelos"], dependencies=[Depends(require_token)]
)


@router.get("", response_model=list[schemas.ModeloOut])
def listar_modelos(activos: bool | None = None, db: Session = Depends(get_db)):
    query = select(models.Modelo).order_by(models.Modelo.nombre)
    if activos is True:
        query = query.where(models.Modelo.activo.is_(True))
    return db.scalars(query).all()


@router.post("", response_model=schemas.ModeloOut, status_code=201)
def crear_modelo(datos: schemas.ModeloCreate, db: Session = Depends(get_db)):
    modelo = models.Modelo(**datos.model_dump())
    db.add(modelo)
    db.commit()
    db.refresh(modelo)
    return modelo


@router.patch("/{modelo_id}", response_model=schemas.ModeloOut)
def editar_modelo(
    modelo_id: int, datos: schemas.ModeloUpdate, db: Session = Depends(get_db)
):
    modelo = db.get(models.Modelo, modelo_id)
    if modelo is None:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    for campo, valor in datos.model_dump(exclude_unset=True).items():
        # descripcion y foto_url sí se pueden vaciar; el resto son NOT NULL en la
        # base, así que un null explícito se ignora en vez de reventar con un 500.
        if valor is None and campo not in ("descripcion", "foto_url"):
            continue
        setattr(modelo, campo, valor)

    db.commit()
    db.refresh(modelo)
    return modelo
