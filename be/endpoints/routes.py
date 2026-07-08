from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from db import get_db
from sqlalchemy.orm import Session, joinedload, selectinload
from models.RouteModel import CreateRouteResponse, Route, RouteCreate, RouteUpdate, RouteCreatePayload
from helpers.get_current_user import get_current_user
from models.db_schemas.Route import Route as RouteDB
from models.db_schemas.RouteWaypoints import Route_Waypoints as RouteWaypointDB
from models.db_schemas.Station import Station as StationDB
from datetime import datetime, timezone
from models.db_schemas.User import User as UserDB
from models.db_schemas.LineStation import LineStation as LineStationDB
from models.db_schemas.Station import Station as StationDB
from models.db_schemas.Line import Line as LineDB
from models.errors.Errors import NoLineIdsProvided, RouteNotFoundError, StationNotFoundError, LineNotFoundError

router = APIRouter()

router = APIRouter(
    prefix="/route",
    tags=["route"],
)

@router.get("")
async def get_routes(
    line_ids: Optional[List[int]] = Query(default=None),
    db: Session = Depends(get_db)
):
    if not line_ids:
        raise NoLineIdsProvided()

    lines = (
        db.query(LineDB)
        .options(
            selectinload(LineDB.routes),
            selectinload(LineDB.waypoints),
            selectinload(LineDB.line_stations)
            .selectinload(LineStationDB.station)
        )
        .filter(LineDB.id.in_(line_ids))
        .all()
    )

    result = [
        {
            "id": line.id,
            "name": line.name,

            "routes": [
                {
                    "id": r.id,
                    "lat": r.lat,
                    "long": r.long,
                    "order_index": r.order_index
                }
                for r in sorted(line.routes, key=lambda x: x.order_index)
            ],
            "waypoints": [
                {
                    "id": r.id,
                    "lat": r.lat,
                    "long": r.long,
                    "order_index": r.order_index
                }
                for r in sorted(line.waypoints, key=lambda x: x.order_index)
            ],

            "stations": [
                {
                    "id": ls.station.id,
                    "name": ls.station.name,
                    "lat": ls.station.lat,
                    "long": ls.station.long,
                    "order_index": ls.order_index
                }
                for ls in sorted(line.line_stations, key=lambda x: x.order_index)
            ]
        }
        for line in lines
    ]

    return {
        "line_ids": line_ids,
        "response": result
    }

@router.post("/{line_id}", response_model=CreateRouteResponse)
async def create_route(line_id: int, data: RouteCreatePayload, db: Session = Depends(get_db), user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)

    route_rows = [
        RouteDB(
            lat=r.lat,
            long=r.long,
            line_id=r.line_id,
            order_index=r.order_index,
            created_by=user["id"],
            created_at=now
        )
        for r in data.routes
    ]

    waypoint_rows = [
        RouteWaypointDB(
            lat=w.lat,
            long=w.long,
            line_id=w.line_id,
            order_index=w.order_index,
            created_by=user["id"],
            created_at=now
        )
        for w in data.waypoints
    ]

    try:
        db.query(RouteDB).filter(RouteDB.line_id == line_id).delete()
        db.query(RouteWaypointDB).filter(
            RouteWaypointDB.line_id == line_id).delete()
        db.query(LineDB).filter(
            LineDB.id == line_id).update({"has_route": True})
        db.add_all(route_rows)
        db.add_all(waypoint_rows)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Routes and waypoints created successfully", "line_id": line_id}

@router.put("/{id}", response_model=Route)
async def update_route(
    id: int,
    data: RouteUpdate,
    db: Session = Depends(get_db),
):
    route = db.query(RouteDB).filter(RouteDB.id == id).first()

    if not route:
        raise RouteNotFoundError()

    if data.lat is not None:
        route.lat = data.lat
    if data.long is not None:
        route.long = data.long
    if data.line_id is not None:
        route.line_id = data.line_id
    if data.order_index is not None:
        route.order_index = data.order_index

    db.commit()
    db.refresh(route)

    user = db.query(UserDB).filter(UserDB.id == route.created_by).first()

    return {
        "routes": [{
            "id": route.id,
            "lat": route.lat,
            "long": route.long,
            "line_id": route.line_id,
            "order_index": route.order_index,
        }],
        "created_at": str(route.created_at),
        "created_by": {
            "id": user.id,
            "email": user.email,
        } if user else None,
    }

@router.delete("/{line_id}")
async def delete_route_by_line(
    line_id: int,
    db: Session = Depends(get_db),
):

    deleted_count = db.query(RouteDB).filter(
        RouteDB.line_id == line_id).delete(synchronize_session=False)

    if deleted_count == 0:
        raise RouteNotFoundError()

    db.query(LineDB).filter(
            LineDB.id == line_id).update({"has_route": False})

    db.commit()

    return {
        "message": "All routes deleted for line_id",
        "line_id": line_id,
        "deleted_count": deleted_count
    }
