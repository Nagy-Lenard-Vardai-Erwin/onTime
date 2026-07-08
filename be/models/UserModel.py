from typing import Literal, Optional
from pydantic import BaseModel, EmailStr

class UserResponse(BaseModel):
    id: int
    email: str

class AdminUserResponse(BaseModel):
    id: int
    email: str
    roles: str
    created_at: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[Literal["Driver", "Admin"]] = None
    password: Optional[str] = None
