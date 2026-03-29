import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db
from user_service import get_current_user, get_user_state

router = APIRouter()


def is_referral_eligible_user(db: Session, user: models.User) -> bool:
    if (user.total_spins or 0) > 0:
        return False

    has_cards = db.query(models.UserCard.id).filter(models.UserCard.user_id == user.id).first() is not None
    has_spin_logs = db.query(models.SpinLog.id).filter(models.SpinLog.user_id == user.id).first() is not None
    has_purchases = db.query(models.PurchaseLog.id).filter(models.PurchaseLog.user_id == user.id).first() is not None
    has_drone_sessions = db.query(models.DroneGameSession.id).filter(models.DroneGameSession.user_id == user.id).first() is not None
    return not any((has_cards, has_spin_logs, has_purchases, has_drone_sessions))


@router.get("/referral/link")
async def get_referral_link(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    bot_name = os.getenv("BOT_NAME", "uaifu_bot")
    link = f"https://t.me/{bot_name}?start=ref_{current_user.id}"
    ref_count = db.query(models.Referral).filter(models.Referral.referrer_id == current_user.id).count()
    return {
        "link": link,
        "ref_count": ref_count,
        "reward_per_ref": "5 енергії + 500 монет",
    }


@router.post("/referral/claim")
async def claim_referral(ref_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    if user_id == ref_id:
        raise HTTPException(status_code=400, detail="Не можна запросити самого себе 🙃")

    existing = db.query(models.Referral).filter(models.Referral.invited_id == user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Реферал вже зареєстровано")

    if not is_referral_eligible_user(db, current_user):
        raise HTTPException(status_code=400, detail="Реферальний бонус доступний лише новим гравцям")

    referrer = db.query(models.User).filter(models.User.id == ref_id).first()
    if not referrer:
        raise HTTPException(status_code=404, detail="Запрошувач не знайдений")

    db.add(models.Referral(referrer_id=ref_id, invited_id=user_id, rewarded=True))

    referrer.energy = min(referrer.max_energy, referrer.energy + 5)
    referrer.coins += 500
    current_user.energy = min(current_user.max_energy, current_user.energy + 3)
    current_user.coins += 200
    current_user.referred_by = ref_id
    db.commit()

    return {
        "success": True,
        "message": "Реферал зараховано! Обом нараховано бонуси 🎉",
        "referrer_bonus": "+5 енергії, +500 монет",
        "new_user_bonus": "+3 енергії, +200 монет",
        "user_stats": get_user_state(db, current_user),
    }
