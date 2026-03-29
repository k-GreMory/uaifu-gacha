import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

import models
from game_balance import get_drone_score_per_coin
from user_service import get_user_state

DRONE_SESSION_TTL_MINUTES = int(os.getenv("DRONE_SESSION_TTL_MINUTES", "15"))
MAX_DRONE_COINS_PER_RUN = int(os.getenv("MAX_DRONE_COINS_PER_RUN", "50"))
MAX_DRONE_SCORE_PER_SECOND = float(os.getenv("MAX_DRONE_SCORE_PER_SECOND", "0.75"))
DRONE_SCORE_GRACE = int(os.getenv("DRONE_SCORE_GRACE", "10"))


def create_drone_game_session(db, user_id: int, ttl_minutes: int = DRONE_SESSION_TTL_MINUTES):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db.query(models.DroneGameSession).filter(
        models.DroneGameSession.user_id == user_id,
        models.DroneGameSession.status == "active",
    ).update({models.DroneGameSession.status: "replaced"})

    session = models.DroneGameSession(
        user_id=user_id,
        session_token=secrets.token_urlsafe(24),
        status="active",
        created_at=now,
        expires_at=now + timedelta(minutes=ttl_minutes),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_max_allowed_drone_score(
    session: models.DroneGameSession,
    max_score_per_second: float = MAX_DRONE_SCORE_PER_SECOND,
    score_grace: int = DRONE_SCORE_GRACE,
):
    elapsed_seconds = max(
        1,
        int((datetime.now(timezone.utc).replace(tzinfo=None) - session.created_at).total_seconds()),
    )
    return int(elapsed_seconds * max_score_per_second) + score_grace


def start_drone_game_for_user(db, user: models.User):
    session = create_drone_game_session(db, user.id)
    return {
        "session_token": session.session_token,
        "expires_in_seconds": DRONE_SESSION_TTL_MINUTES * 60,
    }


def claim_drone_reward(db, user: models.User, session_token: str, score: int):
    normalized_score = max(0, int(score))
    session = db.query(models.DroneGameSession).filter(
        models.DroneGameSession.session_token == session_token,
        models.DroneGameSession.user_id == user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Game session already used")
    if session.expires_at <= now:
        session.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Game session expired")

    max_allowed_score = get_max_allowed_drone_score(session)
    if normalized_score > max_allowed_score:
        raise HTTPException(status_code=400, detail="Suspicious score rejected")

    coins_to_add = min(normalized_score // get_drone_score_per_coin(db), MAX_DRONE_COINS_PER_RUN)
    session.best_score = normalized_score
    session.reward_coins = coins_to_add
    session.status = "claimed"
    session.claimed_at = now

    if coins_to_add > 0:
        user.coins += coins_to_add

    db.add(user)
    db.add(session)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "coins_added": coins_to_add,
        "new_balance": user.coins,
        "user_stats": get_user_state(db, user),
    }
