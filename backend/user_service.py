from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends
from sqlalchemy.orm import Session

import models
from auth import TelegramAuthUser, get_authenticated_telegram_user
from database import get_db


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

    total_cards = db.query(models.Card).count()
    return {
        "energy": user.energy,
        "max_energy": user.max_energy,
        "coins": user.coins,
        "next_energy_in_seconds": next_energy,
        "total_cards": total_cards,
    }


def get_or_create_user(db: Session, user_id: int, username: Optional[str] = None, first_name: Optional[str] = None):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        user = models.User(
            id=user_id,
            username=username,
            first_name=first_name,
            energy=20,
            max_energy=20,
            coins=0,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        needs_update = False
        if username and user.username != username:
            user.username = username
            needs_update = True
        if first_name and user.first_name != first_name:
            user.first_name = first_name
            needs_update = True

        user = update_energy(db, user)
        if needs_update:
            db.commit()
            db.refresh(user)
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
