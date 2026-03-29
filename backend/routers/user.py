from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from database import get_db
from schemas import UserState
from user_service import get_current_user, get_user_state

router = APIRouter()


@router.get("/user", response_model=UserState)
async def get_user(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_user_state(db, current_user)
