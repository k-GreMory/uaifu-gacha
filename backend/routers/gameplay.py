import random
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import distinct
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import func

import models
from cards_data import RARITY_CHANCES
from database import get_db
from schemas import SpinResult, UserCardInfo
from user_service import get_current_user, get_user_state

router = APIRouter()


class SellDuplicateRequest(BaseModel):
    card_id: str


def draw_card_for_rarity(db: Session, rarity: str):
    card = db.query(models.Card).filter(models.Card.rarity == rarity).order_by(func.random()).first()
    if card:
        return card

    fallback = db.query(models.Card).filter(models.Card.rarity == "UnCommon").order_by(func.random()).first()
    if fallback:
        return fallback

    return db.query(models.Card).order_by(func.random()).first()


def resolve_standard_rarity(pity_counter: int) -> str:
    if pity_counter >= 50:
        pity_chances = {"Legendary": 90, "Mythic": 10}
        total_chance = sum(pity_chances.values())
        rand = random.randint(1, total_chance)
        current_sum = 0
        rarity = "Legendary"
        for rarity_name, rarity_chance in pity_chances.items():
            current_sum += rarity_chance
            if rand <= current_sum:
                rarity = rarity_name
                break
        return rarity

    total_chance = sum(RARITY_CHANCES.values())
    rand = random.randint(1, total_chance)
    current_sum = 0
    rarity = "Common"
    for rarity_name, rarity_chance in RARITY_CHANCES.items():
        current_sum += rarity_chance
        if rand <= current_sum:
            rarity = rarity_name
            break
    return rarity


def resolve_premium_rarity() -> str:
    premium_chances = {"Rare": 600, "Epic": 300, "Legendary": 90, "Mythic": 10}
    total_chance = sum(premium_chances.values())
    rand = random.randint(1, total_chance)

    current_sum = 0
    rarity = "Rare"
    for rarity_name, rarity_chance in premium_chances.items():
        current_sum += rarity_chance
        if rand <= current_sum:
            rarity = rarity_name
            break
    return rarity


def apply_card_result(db: Session, user: models.User, card: models.Card, rarity: str):
    existing = db.query(models.UserCard).filter(
        models.UserCard.user_id == user.id,
        models.UserCard.card_id == card.id,
    ).first()
    is_duplicate = False
    new_level = 0

    spin_log = models.SpinLog(user_id=user.id, card_id=card.id)
    coin_rewards = {"Common": 10, "UnCommon": 20, "Rare": 50, "Epic": 150, "Legendary": 500, "Mythic": 2000}
    gained_coins = coin_rewards.get(rarity, 10)

    if existing:
        is_duplicate = True
        spin_log.is_duplicate = True
        user.coins += gained_coins
        existing.duplicates += 1
        new_level = existing.duplicates + 1
    else:
        db.add(models.UserCard(user_id=user.id, card_id=card.id))

    db.add(spin_log)
    return is_duplicate, gained_coins, new_level


def build_spin_payload(user: models.User, card: models.Card, rarity: str, is_duplicate: bool, gained_coins: int, new_level: int, db: Session):
    is_gold = rarity in ["Legendary", "Mythic", "Epic"]
    if is_duplicate:
        message = f"Прокачка до Lvl.{new_level}! +{gained_coins} монет 🪙"
    elif rarity == "Mythic":
        message = "ШОК! МІФІЧНА КАРТКА! 🔥"
    elif rarity == "Legendary":
        message = "ВАУ! ЛЕГЕНДАРКА! 🌟"
    elif rarity == "Epic":
        message = "Епік! Гідний улов 👾"
    else:
        message = f"Нова картка: {card.name}"

    return {
        "card_id": card.id,
        "name": card.name,
        "rarity": card.rarity,
        "image": card.image,
        "message": message,
        "is_gold": is_gold,
        "is_new": not is_duplicate,
        "new_level": new_level,
        "user_stats": get_user_state(db, user),
    }


def build_premium_spin_payload(user: models.User, card: models.Card, rarity: str, is_duplicate: bool, gained_coins: int, new_level: int, db: Session):
    is_gold = rarity in ["Legendary", "Mythic", "Epic"]
    if is_duplicate:
        message = f"Прокачка до Lvl.{new_level}! Скомпенсовано +{gained_coins} монет 🪙"
    elif rarity == "Mythic":
        message = "ПРЕМІУМ ДЖЕКПОТ! МІФІЧНА КАРТКА! 🔥"
    elif rarity == "Legendary":
        message = "УСПІХ! ЛЕГЕНДАРНА КАРТКА! 🌟"
    elif rarity == "Epic":
        message = "Гарантований Епік! 👾"
    else:
        message = f"Нова картка: {card.name}"

    return {
        "card_id": card.id,
        "name": card.name,
        "rarity": card.rarity,
        "image": card.image,
        "message": message,
        "is_gold": is_gold,
        "is_new": not is_duplicate,
        "new_level": new_level,
        "user_stats": get_user_state(db, user),
    }


@router.get("/spin", response_model=SpinResult)
@router.post("/spin", response_model=SpinResult)
async def spin(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = current_user
    if user.energy < 1:
        raise HTTPException(status_code=400, detail="Недостатньо енергії! Зачекай або купи за монети.")

    user.energy -= 1
    user.total_spins = (user.total_spins or 0) + 1
    user.pity_counter = (user.pity_counter or 0) + 1

    rarity = resolve_standard_rarity(user.pity_counter)
    if rarity in ["Legendary", "Mythic"]:
        user.pity_counter = 0

    card = draw_card_for_rarity(db, rarity)
    is_duplicate, gained_coins, new_level = apply_card_result(db, user, card, rarity)
    db.commit()
    return build_spin_payload(user, card, rarity, is_duplicate, gained_coins, new_level, db)


@router.post("/buy_energy")
async def buy_energy(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.energy >= current_user.max_energy:
        raise HTTPException(status_code=400, detail="Енергія вже повна! Спочатку витрать хоча б 1 ⚡")
    if current_user.coins < 1000:
        raise HTTPException(status_code=400, detail="Недостатньо монет! Потрібно 1,000 🪙")

    current_user.coins -= 1000
    current_user.energy = min(current_user.max_energy, current_user.energy + 1)
    db.add(models.PurchaseLog(user_id=current_user.id, item="energy", cost=1000))
    db.commit()
    return {
        "success": True,
        "message": "Придбано 1 Енергію ⚡",
        "user_stats": get_user_state(db, current_user),
    }


@router.get("/premium_spin", response_model=SpinResult)
@router.post("/premium_spin", response_model=SpinResult)
async def premium_spin(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = current_user
    if user.coins < 10000:
        raise HTTPException(status_code=400, detail="Недостатньо монет! Потрібно 10,000 🪙")

    user.coins -= 10000
    user.total_spins = (user.total_spins or 0) + 1

    rarity = resolve_premium_rarity()
    card = draw_card_for_rarity(db, rarity)
    is_duplicate, gained_coins, new_level = apply_card_result(db, user, card, rarity)
    db.add(models.PurchaseLog(user_id=user.id, item="premium_spin", cost=10000))
    db.commit()
    return build_premium_spin_payload(user, card, rarity, is_duplicate, gained_coins, new_level, db)


@router.get("/collection", response_model=List[UserCardInfo])
async def get_collection(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_cards = db.query(models.UserCard).filter(models.UserCard.user_id == current_user.id).all()
    result = []
    for user_card in user_cards:
        card = user_card.card
        if card:
            result.append({
                "card_id": card.id,
                "name": card.name,
                "rarity": card.rarity,
                "image": card.image,
                "duplicates": user_card.duplicates,
                "acquired_at": user_card.acquired_at,
            })
    return result


@router.get("/leaderboard")
async def get_leaderboard(mode: str = "spins", db: Session = Depends(get_db)):
    if mode == "cards":
        rows = (
            db.query(models.User, func.count(distinct(models.UserCard.card_id)).label("score"))
            .join(models.UserCard, models.UserCard.user_id == models.User.id, isouter=True)
            .group_by(models.User.id)
            .order_by(func.count(distinct(models.UserCard.card_id)).desc())
            .limit(15)
            .all()
        )
        return [
            {
                "rank": index + 1,
                "user_id": user.id,
                "name": user.first_name or user.username or "Гравець",
                "score": score,
                "label": "карток",
            }
            for index, (user, score) in enumerate(rows)
        ]

    rows = (
        db.query(models.User)
        .order_by(models.User.total_spins.desc())
        .limit(15)
        .all()
    )
    return [
        {
            "rank": index + 1,
            "user_id": user.id,
            "name": user.first_name or user.username or "Гравець",
            "score": user.total_spins,
            "label": "спінів",
        }
        for index, user in enumerate(rows)
    ]


@router.post("/claim_daily")
async def claim_daily(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if current_user.last_login_date and current_user.last_login_date.date() >= now.date():
        raise HTTPException(status_code=400, detail="Бонус вже отримано сьогодні!")

    if current_user.last_login_date and current_user.last_login_date.date() == now.date() - timedelta(days=1):
        current_user.login_streak = (current_user.login_streak or 0) + 1
    else:
        current_user.login_streak = 1

    reward_coins = min(200 + (current_user.login_streak * 50), 1000)
    if current_user.energy < current_user.max_energy:
        current_user.energy = min(current_user.max_energy, current_user.energy + 5)

    current_user.coins += reward_coins
    current_user.last_login_date = now
    db.commit()
    return {
        "success": True,
        "message": f"Щоденний бонус (День {current_user.login_streak})! +{reward_coins} 🪙",
        "user_stats": get_user_state(db, current_user),
    }


@router.post("/sell_duplicate")
async def sell_duplicate(data: SellDuplicateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_card = db.query(models.UserCard).filter(
        models.UserCard.user_id == current_user.id,
        models.UserCard.card_id == data.card_id,
    ).first()
    if not user_card or user_card.duplicates < 1:
        raise HTTPException(status_code=400, detail="Немає дублікатів для продажу!")

    card = user_card.card
    coin_rewards = {"Common": 20, "UnCommon": 40, "Rare": 100, "Epic": 300, "Legendary": 1000, "Mythic": 4000}
    sell_price = coin_rewards.get(card.rarity, 20)

    user_card.duplicates -= 1
    current_user.coins += sell_price
    db.commit()
    return {
        "success": True,
        "message": f"Дублікат продано за +{sell_price} 🪙!",
        "user_stats": get_user_state(db, current_user),
    }
