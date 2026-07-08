from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from helpers.auth import hash_password
from helpers.get_current_user import get_current_user
from models.db_schemas.User import User as UserDB
from models.UserModel import AdminUserResponse, UserUpdate
from models.errors.Errors import (
    AdminRequiredError,
    CannotDeleteSelfError,
    EmailExistsError,
    InvalidUserError,
)

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

def _require_admin(user: dict):
    if user.get("roles") != "Admin":
        raise AdminRequiredError()

def _serialize(user: UserDB) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "roles": user.roles,
        "created_at": str(user.created_at) if user.created_at else None,
    }

@router.get("", response_model=List[AdminUserResponse])
async def get_users(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)

    users = db.query(UserDB).order_by(UserDB.id).all()
    return [_serialize(user) for user in users]

@router.put("/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)

    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise InvalidUserError()

    if data.email is not None and data.email != user.email:
        existing = db.query(UserDB).filter(
            UserDB.email == data.email, UserDB.id != user_id
        ).first()
        if existing:
            raise EmailExistsError()
        user.email = data.email

    if data.role is not None:
        user.roles = data.role

    if data.password:
        user.password = hash_password(data.password)
        user.token_version = (user.token_version or 0) + 1

    db.commit()
    db.refresh(user)

    return _serialize(user)

@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)

    if current_user["id"] == user_id:
        raise CannotDeleteSelfError()

    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise InvalidUserError()

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully",
        "deleted_id": user_id,
    }
