import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db
from drone_service import create_drone_game_session as create_drone_game_session_impl
from drone_service import get_max_allowed_drone_score as get_max_allowed_drone_score_impl
from schemas import DroneRewardRequest, DroneRewardResponse, DroneSessionResponse
from user_service import get_current_user, get_user_state

router = APIRouter()

DRONE_SESSION_TTL_MINUTES = int(os.getenv("DRONE_SESSION_TTL_MINUTES", "15"))
MAX_DRONE_COINS_PER_RUN = int(os.getenv("MAX_DRONE_COINS_PER_RUN", "50"))
MAX_DRONE_SCORE_PER_SECOND = float(os.getenv("MAX_DRONE_SCORE_PER_SECOND", "0.75"))
DRONE_SCORE_GRACE = int(os.getenv("DRONE_SCORE_GRACE", "10"))


def create_drone_game_session(db: Session, user_id: int):
    return create_drone_game_session_impl(db, user_id, DRONE_SESSION_TTL_MINUTES)


def get_max_allowed_drone_score(session: models.DroneGameSession):
    return get_max_allowed_drone_score_impl(
        session,
        MAX_DRONE_SCORE_PER_SECOND,
        DRONE_SCORE_GRACE,
    )


@router.post("/games/drone/start", response_model=DroneSessionResponse)
async def start_drone_game(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = create_drone_game_session(db, current_user.id)
    return {
        "session_token": session.session_token,
        "expires_in_seconds": DRONE_SESSION_TTL_MINUTES * 60,
    }


@router.post("/games/drone/reward", response_model=DroneRewardResponse)
async def drone_reward(
    data: DroneRewardRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    score = max(0, int(data.score))
    session = db.query(models.DroneGameSession).filter(
        models.DroneGameSession.session_token == data.session_token,
        models.DroneGameSession.user_id == current_user.id,
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
    if score > max_allowed_score:
        raise HTTPException(status_code=400, detail="Suspicious score rejected")

    coins_to_add = min(score // 5, MAX_DRONE_COINS_PER_RUN)
    session.best_score = score
    session.reward_coins = coins_to_add
    session.status = "claimed"
    session.claimed_at = now

    if coins_to_add > 0:
        current_user.coins += coins_to_add

    db.add(current_user)
    db.add(session)
    db.commit()
    db.refresh(current_user)

    return {
        "status": "success",
        "coins_added": coins_to_add,
        "new_balance": current_user.coins,
        "user_stats": get_user_state(db, current_user),
    }
