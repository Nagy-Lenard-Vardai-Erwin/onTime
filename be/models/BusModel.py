from typing import Optional
from pydantic import BaseModel

class BusCreate(BaseModel):
    name: str
    line_id: int

class BusUpdate(BaseModel):
    name: Optional[str] = None
    line_id: Optional[int] = None

class BusResponse(BaseModel):
    id: int
    name: str
    line_id: int
    line_name: Optional[str] = None

    class Config:
        from_attributes = True
