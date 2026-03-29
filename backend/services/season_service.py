from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.sql.expression import func

import models
from user_service import get_user_state, sync_full_energy_timestamp


def get_active_season(db: Session, with_tasks: bool = False) -> Optional[models.Season]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    query = db.query(models.Season).filter(
        models.Season.is_active == True,
        models.Season.start_date <= now,
        models.Season.end_date >= now,
    ).order_by(models.Season.start_date.desc())
    if with_tasks:
        query = query.options(selectinload(models.Season.tasks))
    return query.first()


def ensure_season_exists(db: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    expired_seasons = db.query(models.Season).filter(
        models.Season.is_active == True,
        models.Season.end_date < now,
    ).all()
    for expired_season in expired_seasons:
        expired_season.is_active = False
    if expired_seasons:
        db.flush()

    season = db.query(models.Season).filter(models.Season.is_active == True).order_by(
        models.Season.start_date.desc()
    ).first()
    if season:
        if expired_seasons:
            db.commit()
        return season

    season = models.Season(
        name="Сезон 1: Весна Вайфу 🌸",
        start_date=now,
        end_date=now + timedelta(days=30),
        is_active=True,
    )
    db.add(season)
    db.flush()

    db.add_all([
        models.SeasonTask(season_id=season.id, title="Перший спін", task_type="spins", target=1, reward_coins=100, reward_energy=0),
        models.SeasonTask(season_id=season.id, title="Зроби 10 спінів", task_type="spins", target=10, reward_coins=500, reward_energy=2),
        models.SeasonTask(season_id=season.id, title="Зроби 50 спінів", task_type="spins", target=50, reward_coins=2000, reward_energy=5),
        models.SeasonTask(season_id=season.id, title="Зроби 100 спінів", task_type="spins", target=100, reward_coins=5000, reward_energy=10),
        models.SeasonTask(season_id=season.id, title="Зберіть 5 унікальних карток", task_type="unique_cards", target=5, reward_coins=300, reward_energy=1),
        models.SeasonTask(season_id=season.id, title="Зберіть 25 унікальних карток", task_type="unique_cards", target=25, reward_coins=1500, reward_energy=3),
        models.SeasonTask(season_id=season.id, title="Зберіть 50 унікальних карток", task_type="unique_cards", target=50, reward_coins=3000, reward_energy=5),
        models.SeasonTask(season_id=season.id, title="Зробіть 1 преміум спін", task_type="premium_spins", target=1, reward_coins=1000, reward_energy=2),
    ])
    db.commit()
    db.refresh(season)
    return season


def get_user_season_metrics(db: Session, user: models.User):
    return {
        "spins": user.total_spins or 0,
        "unique_cards": db.query(func.count(models.UserCard.id)).filter(models.UserCard.user_id == user.id).scalar() or 0,
        "premium_spins": db.query(func.count(models.PurchaseLog.id)).filter(
            models.PurchaseLog.user_id == user.id,
            models.PurchaseLog.item == "premium_spin",
        ).scalar() or 0,
    }


def resolve_task_progress(task: models.SeasonTask, metrics: dict[str, int]) -> int:
    return metrics.get(task.task_type, 0)


def get_season_payload(db: Session, user: models.User):
    ensure_season_exists(db)
    season = get_active_season(db, with_tasks=True)
    if not season:
        return {"active": False, "message": "Зараз немає активного сезону"}

    metrics = get_user_season_metrics(db, user)
    progress_rows = {}
    task_ids = [task.id for task in season.tasks]
    if task_ids:
        progress_rows = {
            progress.task_id: progress
            for progress in db.query(models.UserSeasonProgress).filter(
                models.UserSeasonProgress.user_id == user.id,
                models.UserSeasonProgress.task_id.in_(task_ids),
            ).all()
        }
    tasks_out = []
    for task in season.tasks:
        progress_row = progress_rows.get(task.id)
        current = resolve_task_progress(task, metrics)
        tasks_out.append({
            "id": task.id,
            "title": task.title,
            "task_type": task.task_type,
            "target": task.target,
            "progress": min(current, task.target),
            "completed": current >= task.target,
            "claimed": progress_row.claimed if progress_row else False,
            "reward_coins": task.reward_coins,
            "reward_energy": task.reward_energy,
        })

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return {
        "active": True,
        "season_name": season.name,
        "days_left": max(0, (season.end_date - now).days),
        "tasks": tasks_out,
    }


def claim_season_reward_for_user(db: Session, user: models.User, task_id: int):
    task = (
        db.query(models.SeasonTask)
        .options(joinedload(models.SeasonTask.season))
        .filter(models.SeasonTask.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Задача не знайдена")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    season = task.season
    if not season or not season.is_active or season.start_date > now or season.end_date < now:
        raise HTTPException(status_code=400, detail="Нагорода цього сезону недоступна")

    metrics = get_user_season_metrics(db, user)
    current = resolve_task_progress(task, metrics)
    if current < task.target:
        raise HTTPException(status_code=400, detail=f"Задача ще не виконана ({current}/{task.target})")

    progress_row = db.query(models.UserSeasonProgress).filter(
        models.UserSeasonProgress.user_id == user.id,
        models.UserSeasonProgress.task_id == task_id,
    ).first()
    if progress_row and progress_row.claimed:
        raise HTTPException(status_code=400, detail="Нагорода вже отримана!")

    claimed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    if not progress_row:
        db.add(models.UserSeasonProgress(
            user_id=user.id,
            task_id=task_id,
            progress=current,
            claimed=True,
            claimed_at=claimed_at,
        ))
    else:
        progress_row.claimed = True
        progress_row.claimed_at = claimed_at

    user.coins += task.reward_coins
    if task.reward_energy > 0:
        user.energy = min(user.max_energy, user.energy + task.reward_energy)
    sync_full_energy_timestamp(user)

    db.commit()
    return {
        "success": True,
        "message": f"Нагорода отримана! +{task.reward_coins} 🪙 +{task.reward_energy} ⚡",
        "user_stats": get_user_state(db, user),
    }
