import os

from fastapi import HTTPException
from sqlalchemy.orm import Session

import models
from game_balance import (
    get_referral_reward_description,
    get_balance_config,
)
from user_service import get_user_state, sync_full_energy_timestamp


def is_referral_eligible_user(db: Session, user: models.User) -> bool:
    if (user.total_spins or 0) > 0:
        return False

    has_cards = db.query(models.UserCard.id).filter(models.UserCard.user_id == user.id).first() is not None
    has_spin_logs = db.query(models.SpinLog.id).filter(models.SpinLog.user_id == user.id).first() is not None
    has_purchases = db.query(models.PurchaseLog.id).filter(models.PurchaseLog.user_id == user.id).first() is not None
    has_drone_sessions = db.query(models.DroneGameSession.id).filter(models.DroneGameSession.user_id == user.id).first() is not None
    return not any((has_cards, has_spin_logs, has_purchases, has_drone_sessions))


def get_referral_link_payload(db: Session, user: models.User):
    bot_name = os.getenv("BOT_NAME", "uaifu_bot")
    link = f"https://t.me/{bot_name}?start=ref_{user.id}"
    ref_count = db.query(models.Referral).filter(models.Referral.referrer_id == user.id).count()
    return {
        "link": link,
        "ref_count": ref_count,
        "reward_per_ref": get_referral_reward_description(db),
    }


def claim_referral_reward(db: Session, current_user: models.User, ref_id: int):
    if current_user.id == ref_id:
        raise HTTPException(status_code=400, detail="Не можна запросити самого себе 🙃")

    existing = db.query(models.Referral).filter(models.Referral.invited_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Реферал вже зареєстровано")

    if not is_referral_eligible_user(db, current_user):
        raise HTTPException(status_code=400, detail="Реферальний бонус доступний лише новим гравцям")

    referrer = db.query(models.User).filter(models.User.id == ref_id).first()
    if not referrer:
        raise HTTPException(status_code=404, detail="Запрошувач не знайдений")

    balance = get_balance_config(db)
    referrer_reward = balance["referral_rewards"]["referrer"]
    new_user_reward = balance["referral_rewards"]["new_user"]

    db.add(models.Referral(referrer_id=ref_id, invited_id=current_user.id, rewarded=True))
    referrer.energy = min(referrer.max_energy, referrer.energy + int(referrer_reward["energy"]))
    referrer.coins += int(referrer_reward["coins"])
    current_user.energy = min(current_user.max_energy, current_user.energy + int(new_user_reward["energy"]))
    current_user.coins += int(new_user_reward["coins"])
    current_user.referred_by = ref_id
    sync_full_energy_timestamp(referrer)
    sync_full_energy_timestamp(current_user)
    db.commit()

    return {
        "success": True,
        "message": "Реферал зараховано! Обом нараховано бонуси 🎉",
        "referrer_bonus": f"+{int(referrer_reward['energy'])} енергії, +{int(referrer_reward['coins'])} монет",
        "new_user_bonus": f"+{int(new_user_reward['energy'])} енергії, +{int(new_user_reward['coins'])} монет",
        "user_stats": get_user_state(db, current_user),
    }
