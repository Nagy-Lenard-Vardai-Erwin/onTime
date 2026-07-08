from typing import Optional, List
from pydantic import BaseModel
from models.UserModel import UserResponse

class StationData(BaseModel):
    id: int
    station_id: Optional[int] = None
    name: str
    line_id: int
    lat: float
    long: float
    order_index: int

    class Config:
        from_attributes = True

class Station(BaseModel):
    stations: List[StationData]
    created_at: Optional[str] = None
    created_by: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class StationCreate(BaseModel):
    name: str
    line_id: int
    lat: float
    long: float
    station_id: Optional[int] = None
    order_index: Optional[int] = None

class StationUpdate(BaseModel):
    name: Optional[str] = None
    line_id: Optional[int] = None
    lat: Optional[float] = None
    long: Optional[float] = None
    order_index: Optional[int] = None
    station_id: Optional[int] = None