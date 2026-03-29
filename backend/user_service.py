from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends
from sqlalchemy.orm import Session

import models
from auth import TelegramAuthUser, get_authenticated_telegram_user
from cards_data import CARDS
from database import get_db

TOTAL_CARD_COUNT = len(CARDS)


def normalize_profile_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def update_energy(db: Session, user: models.User):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if user.energy < user.max_energy:
        diff_minutes = (now - user.last_energy_update).total_seconds() / 60.0
        gained = int(diff_minutes // 10)

        if gained > 0:
            user.energy = min(user.max_energy, user.energy + gained)
            user.last_energy_update = user.last_energy_update + timedelta(minutes=gained * 10)
            db.commit()
    else:
        user.last_energy_update = now
        db.commit()
    return user


def get_user_state(db: Session, user: models.User):
    next_energy = 0
    if user.energy < user.max_energy:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        elapsed = (now - user.last_energy_update).total_seconds()
        next_energy = max(0, int((10 * 60) - elapsed))

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    can_claim = False
    if not user.last_login_date or user.last_login_date.date() < now_naive.date():
        can_claim = True

    return {
        "energy": user.energy,
        "max_energy": user.max_energy,
        "coins": user.coins,
        "next_energy_in_seconds": next_energy,
        "total_cards": TOTAL_CARD_COUNT,
        "pity_counter": user.pity_counter or 0,
        "login_streak": user.login_streak or 0,
        "can_claim_daily": can_claim,
    }


def create_user(
    db: Session,
    user_id: int,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
):
    user = models.User(
        id=user_id,
        username=normalize_profile_value(username),
        first_name=normalize_profile_value(first_name),
        energy=20,
        max_energy=20,
        coins=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def fill_missing_user_profile(
    db: Session,
    user: models.User,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
):
    needs_update = False
    username = normalize_profile_value(username)
    first_name = normalize_profile_value(first_name)

    if username and not normalize_profile_value(user.username):
        user.username = username
        needs_update = True
    if first_name and not normalize_profile_value(user.first_name):
        user.first_name = first_name
        needs_update = True

    if needs_update:
        db.commit()
        db.refresh(user)

    return user


def get_or_create_user(db: Session, user_id: int, username: Optional[str] = None, first_name: Optional[str] = None):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        user = create_user(db, user_id, username=username, first_name=first_name)
    else:
        user = update_energy(db, user)
        user = fill_missing_user_profile(db, user, username=username, first_name=first_name)
    return user


def get_current_user(
    auth_user: TelegramAuthUser = Depends(get_authenticated_telegram_user),
    db: Session = Depends(get_db),
):
    return get_or_create_user(
        db,
        auth_user.id,
        username=auth_user.username,
        first_name=auth_user.first_name,
    )
