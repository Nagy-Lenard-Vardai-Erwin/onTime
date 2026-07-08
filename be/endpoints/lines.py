from typing import List

from fastapi import APIRouter, Depends, HTTPException
from models.LineModel import LineCreate, LineModel
from sqlalchemy.orm import Session
from helpers import logger
from db import get_db
from sqlalchemy import text
from sqlalchemy.orm import Session
from models.db_schemas.Line import Line
from models.errors.Errors import LineAlreadyExistsError, LineNotFoundError

router = APIRouter()

router = APIRouter(
    prefix="/line",
    tags=["line"],
)

@router.post("", response_model=LineModel)
async def create_line(data: LineCreate, db: Session = Depends(get_db)):

    existingLine = db.query(Line).filter(Line.name == data.name).first()

    if existingLine:
        raise LineAlreadyExistsError()

    new_line = Line(
        name=data.name,
    )

    db.add(new_line)
    db.commit()
    db.refresh(new_line)

    return new_line

@router.get("", response_model=List[LineModel])
async def get_all_lines(db: Session = Depends(get_db)):
    try:
        lines = db.query(Line).all()
        return lines
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{line_id}")
async def delete_line(
    line_id: int,
    db: Session = Depends(get_db),
):
    line = db.query(Line).filter(Line.id == line_id).first()

    if not line:
        raise LineNotFoundError()

    db.execute(
        text(
            "DELETE FROM line_stations "
            "WHERE line_id = :line_id "
            "OR station_id IN (SELECT id FROM stations WHERE line_id = :line_id)"
        ),
        {"line_id": line_id}
    )

    db.execute(
        text("DELETE FROM routes WHERE line_id = :line_id"),
        {"line_id": line_id}
    )

    db.execute(
        text("DELETE FROM stations WHERE line_id = :line_id"),
        {"line_id": line_id}
    )

    db.execute(
        text("DELETE FROM bus_locations WHERE line_id = :line_id"),
        {"line_id": line_id}
    )
    db.execute(
        text("DELETE FROM buses WHERE line_id = :line_id"),
        {"line_id": line_id}
    )

    db.delete(line)

    db.commit()

    return {
        "message": "Line and all related data deleted",
        "line_id": line_id
    }