from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from database import get_db
from drone_service import (
    claim_drone_reward,
    create_drone_game_session as create_drone_game_session_impl,
    get_max_allowed_drone_score as get_max_allowed_drone_score_impl,
    start_drone_game_for_user,
)
from schemas import DroneRewardRequest, DroneRewardResponse, DroneSessionResponse
from user_service import get_current_user

router = APIRouter()


def create_drone_game_session(db: Session, user_id: int):
    return create_drone_game_session_impl(db, user_id)


def get_max_allowed_drone_score(session: models.DroneGameSession):
    return get_max_allowed_drone_score_impl(session)


@router.post("/games/drone/start", response_model=DroneSessionResponse)
async def start_drone_game(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return start_drone_game_for_user(db, current_user)


@router.post("/games/drone/reward", response_model=DroneRewardResponse)
async def drone_reward(
    data: DroneRewardRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return claim_drone_reward(db, current_user, data.session_token, data.score)
