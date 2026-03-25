import secrets
from datetime import datetime, timedelta, timezone

import models


def create_drone_game_session(db, user_id: int, ttl_minutes: int):
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


def get_max_allowed_drone_score(session: models.DroneGameSession, max_score_per_second: float, score_grace: int):
    elapsed_seconds = max(
        1,
        int((datetime.now(timezone.utc).replace(tzinfo=None) - session.created_at).total_seconds()),
    )
    return int(elapsed_seconds * max_score_per_second) + score_grace
