from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from database import get_db
from services.season_service import (
    claim_season_reward_for_user,
    ensure_season_exists,
    get_active_season,
    get_season_payload,
)
from user_service import get_current_user

router = APIRouter()


@router.get("/season")
async def get_season(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_season_payload(db, current_user)


@router.post("/season/claim")
async def claim_season_reward(task_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return claim_season_reward_for_user(db, current_user, task_id)
