from typing import Optional, List

from pydantic import BaseModel

class LineStationCreate(BaseModel):
    station_id: int
    line_id: int
    order_index: Optional[int] = None

class LineStationData(BaseModel):
    id: int
    line_id: int
    station_id: int
    order_index: int
    line_name: Optional[str] = None
    station_name: Optional[str] = None

    class Config:
        from_attributes = True

class LineStationList(BaseModel):
    line_stations: List[LineStationData]
