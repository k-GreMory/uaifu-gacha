from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from database import get_db
from services.referral_service import (
    claim_referral_reward,
    get_referral_link_payload,
    is_referral_eligible_user,
)
from user_service import get_current_user

router = APIRouter()


@router.get("/referral/link")
async def get_referral_link(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_referral_link_payload(db, current_user)


@router.post("/referral/claim")
async def claim_referral(ref_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return claim_referral_reward(db, current_user, ref_id)
