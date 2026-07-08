from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from db import get_db
from models.db_schemas.Station import Station as StationDB
from models.db_schemas.LineStation import LineStation as LineStationDB
from models.StationModel import StationCreate, Station, StationUpdate
from models.db_schemas.User import User as UserDB
from helpers.get_current_user import get_current_user
from datetime import datetime, timezone
from models.errors.Errors import StationNotFoundError, LineNotFoundError

router = APIRouter(
    prefix="/stations",
    tags=["stations"],
)

@router.post("", response_model=Station)
async def create_station(
    data: StationCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    station_id = data.station_id
    if station_id is None:
        max_station_id = db.query(func.max(StationDB.station_id)).scalar()
        station_id = (max_station_id or 0) + 1

    order_index = data.order_index
    if order_index is None:
        max_order = (
            db.query(func.max(StationDB.order_index))
            .filter(StationDB.line_id == data.line_id)
            .scalar()
        )
        order_index = (max_order + 1) if max_order is not None else 0

    new_station = StationDB(
        name=data.name,
        station_id=station_id,
        line_id=data.line_id,
        lat=data.lat,
        long=data.long,
        order_index=order_index,
        created_by=user["id"],
        created_at=datetime.now(timezone.utc)

    )

    db.add(new_station)
    db.commit()
    db.refresh(new_station)

    max_ls_order = (
        db.query(func.max(LineStationDB.order_index))
        .filter(LineStationDB.line_id == data.line_id)
        .scalar()
    )
    db.add(
        LineStationDB(
            line_id=data.line_id,
            station_id=new_station.id,
            order_index=(max_ls_order + 1) if max_ls_order is not None else 0,
            created_by=user["id"],
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    return {
        "stations": [{
            "id": new_station.id,
            "station_id": new_station.station_id,
            "name": new_station.name,
            "line_id": new_station.line_id,
            "lat": new_station.lat,
            "long": new_station.long,
            "order_index": new_station.order_index,
        }],
        "created_at": str(new_station.created_at),
        "created_by": {
            "id": user["id"],
            "email": user["email"],
        }
    }

@router.get("", response_model=Station)
async def get_stations(
    line_ids: Optional[List[int]] = Query(default=None),
    station_ids: Optional[List[int]] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(StationDB, UserDB).join(
        UserDB,
        StationDB.created_by == UserDB.id
    )

    if station_ids:
        query = query.filter(StationDB.station_id.in_(station_ids))

    if line_ids:
        query = query.filter(StationDB.line_id.in_(line_ids))

    rows = query.order_by(
        StationDB.line_id,
        StationDB.order_index
    ).all()

    if not rows:
        if station_ids:
            raise StationNotFoundError()
        elif line_ids:
            raise LineNotFoundError()
        return {"stations": [], "created_at": None, "created_by": None}

    latest_station, latest_user =  max(
            rows,
            key=lambda row: row[0].created_at
    )
    
    return {
        "stations": [
            {
                "id": station.id,
                "station_id": station.station_id,
                "name": station.name,
                "line_id": station.line_id,
                "lat": station.lat,
                "long": station.long,
                "order_index": station.order_index,
            }
            for station, _ in rows
        ],
        "created_at": str(latest_station.created_at),
        "created_by": {
            "id": latest_user.id,
            "email": latest_user.email,
        } if latest_user else None,
    }

@router.put("/{id}", response_model=Station)
async def update_station(
    id: int,
    data: StationUpdate,
    db: Session = Depends(get_db)
):
    station = db.query(StationDB).filter(StationDB.id == id).first()

    if not station:
        raise StationNotFoundError()

    if data.name is not None:
        station.name = data.name
    if data.line_id is not None:
        station.line_id = data.line_id
    if data.lat is not None:
        station.lat = data.lat
    if data.long is not None:
        station.long = data.long
    if data.order_index is not None:
        station.order_index = data.order_index
    if data.station_id is not None:
        station.station_id = data.station_id
    
    db.commit()
    db.refresh(station)

    user = db.query(UserDB).filter(UserDB.id == station.created_by).first()

    return {
        "stations": [{
            "id": station.id,
            "station_id": station.station_id,
            "name": station.name,
            "line_id": station.line_id,
            "lat": station.lat,
            "long": station.long,
            "order_index": station.order_index,
        }],
        "created_at": str(station.created_at),
        "created_by": {
            "id": user.id,
            "email": user.email,
        } if user else None,
    }

@router.delete("/{id}")
async def delete_station(
    id: int,
    db: Session = Depends(get_db)
):
    station = db.query(StationDB).filter(StationDB.id == id).first()

    if not station:
        raise StationNotFoundError()

    db.delete(station)
    db.commit()

    return {
        "message": "Station deleted successfully",
        "deleted_id": id
    }