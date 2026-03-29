from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db
from schemas import SpinResult, UserCardInfo
from services.gameplay_service import (
    buy_energy_for_user,
    claim_daily_reward_for_user,
    get_collection_payload,
    get_leaderboard_payload,
    perform_premium_spin,
    perform_spin,
    sell_duplicate_for_user,
)
from user_service import get_current_user

router = APIRouter()


class SellDuplicateRequest(BaseModel):
    card_id: str


@router.get("/spin", response_model=SpinResult)
@router.post("/spin", response_model=SpinResult)
async def spin(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return perform_spin(db, current_user)


@router.post("/buy_energy")
async def buy_energy(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return buy_energy_for_user(db, current_user)


@router.get("/premium_spin", response_model=SpinResult)
@router.post("/premium_spin", response_model=SpinResult)
async def premium_spin(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return perform_premium_spin(db, current_user)


@router.get("/collection", response_model=List[UserCardInfo])
async def get_collection(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_collection_payload(db, current_user)


@router.get("/leaderboard")
async def get_leaderboard(mode: str = "spins", db: Session = Depends(get_db)):
    return get_leaderboard_payload(db, mode)


@router.post("/claim_daily")
async def claim_daily(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return claim_daily_reward_for_user(db, current_user)


@router.post("/sell_duplicate")
async def sell_duplicate(data: SellDuplicateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return sell_duplicate_for_user(db, current_user, data.card_id)
