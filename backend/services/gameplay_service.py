import random
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import distinct
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import func

import models
from cards_data import RARITY_CHANCES
from user_service import get_user_state

STANDARD_DUPLICATE_REWARDS = {"Common": 10, "UnCommon": 20, "Rare": 50, "Epic": 150, "Legendary": 500, "Mythic": 2000}
SELL_DUPLICATE_REWARDS = {"Common": 20, "UnCommon": 40, "Rare": 100, "Epic": 300, "Legendary": 1000, "Mythic": 4000}
PREMIUM_RARITY_CHANCES = {"Rare": 600, "Epic": 300, "Legendary": 90, "Mythic": 10}
PITY_RARITY_CHANCES = {"Legendary": 90, "Mythic": 10}


def draw_card_for_rarity(db: Session, rarity: str):
    card = db.query(models.Card).filter(models.Card.rarity == rarity).order_by(func.random()).first()
    if card:
        return card

    fallback = db.query(models.Card).filter(models.Card.rarity == "UnCommon").order_by(func.random()).first()
    if fallback:
        return fallback

    return db.query(models.Card).order_by(func.random()).first()


def resolve_rarity(chances: dict[str, int], default_rarity: str) -> str:
    total_chance = sum(chances.values())
    rand = random.randint(1, total_chance)
    current_sum = 0
    rarity = default_rarity
    for rarity_name, rarity_chance in chances.items():
        current_sum += rarity_chance
        if rand <= current_sum:
            rarity = rarity_name
            break
    return rarity


def resolve_standard_rarity(pity_counter: int) -> str:
    if pity_counter >= 50:
        return resolve_rarity(PITY_RARITY_CHANCES, "Legendary")
    return resolve_rarity(RARITY_CHANCES, "Common")


def resolve_premium_rarity() -> str:
    return resolve_rarity(PREMIUM_RARITY_CHANCES, "Rare")


def apply_card_result(db: Session, user: models.User, card: models.Card, rarity: str):
    existing = db.query(models.UserCard).filter(
        models.UserCard.user_id == user.id,
        models.UserCard.card_id == card.id,
    ).first()
    is_duplicate = False
    new_level = 0
    gained_coins = STANDARD_DUPLICATE_REWARDS.get(rarity, 10)

    spin_log = models.SpinLog(user_id=user.id, card_id=card.id)
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


def build_spin_message(card_name: str, rarity: str, is_duplicate: bool, gained_coins: int, new_level: int, premium: bool) -> str:
    if is_duplicate:
        if premium:
            return f"Прокачка до Lvl.{new_level}! Скомпенсовано +{gained_coins} монет 🪙"
        return f"Прокачка до Lvl.{new_level}! +{gained_coins} монет 🪙"
    if rarity == "Mythic":
        return "ПРЕМІУМ ДЖЕКПОТ! МІФІЧНА КАРТКА! 🔥" if premium else "ШОК! МІФІЧНА КАРТКА! 🔥"
    if rarity == "Legendary":
        return "УСПІХ! ЛЕГЕНДАРНА КАРТКА! 🌟" if premium else "ВАУ! ЛЕГЕНДАРКА! 🌟"
    if rarity == "Epic":
        return "Гарантований Епік! 👾" if premium else "Епік! Гідний улов 👾"
    return f"Нова картка: {card_name}"


def build_spin_payload(db: Session, user: models.User, card: models.Card, rarity: str, is_duplicate: bool, gained_coins: int, new_level: int, premium: bool = False):
    return {
        "card_id": card.id,
        "name": card.name,
        "rarity": card.rarity,
        "image": card.image,
        "message": build_spin_message(card.name, rarity, is_duplicate, gained_coins, new_level, premium),
        "is_gold": rarity in ["Legendary", "Mythic", "Epic"],
        "is_new": not is_duplicate,
        "new_level": new_level,
        "user_stats": get_user_state(db, user),
    }


def perform_spin(db: Session, user: models.User):
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
    return build_spin_payload(db, user, card, rarity, is_duplicate, gained_coins, new_level, premium=False)


def perform_premium_spin(db: Session, user: models.User):
    if user.coins < 10000:
        raise HTTPException(status_code=400, detail="Недостатньо монет! Потрібно 10,000 🪙")

    user.coins -= 10000
    user.total_spins = (user.total_spins or 0) + 1

    rarity = resolve_premium_rarity()
    card = draw_card_for_rarity(db, rarity)
    is_duplicate, gained_coins, new_level = apply_card_result(db, user, card, rarity)
    db.add(models.PurchaseLog(user_id=user.id, item="premium_spin", cost=10000))
    db.commit()
    return build_spin_payload(db, user, card, rarity, is_duplicate, gained_coins, new_level, premium=True)


def buy_energy_for_user(db: Session, user: models.User):
    if user.energy >= user.max_energy:
        raise HTTPException(status_code=400, detail="Енергія вже повна! Спочатку витрать хоча б 1 ⚡")
    if user.coins < 1000:
        raise HTTPException(status_code=400, detail="Недостатньо монет! Потрібно 1,000 🪙")

    user.coins -= 1000
    user.energy = min(user.max_energy, user.energy + 1)
    db.add(models.PurchaseLog(user_id=user.id, item="energy", cost=1000))
    db.commit()
    return {
        "success": True,
        "message": "Придбано 1 Енергію ⚡",
        "user_stats": get_user_state(db, user),
    }


def get_collection_payload(db: Session, user: models.User):
    user_cards = db.query(models.UserCard).filter(models.UserCard.user_id == user.id).all()
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


def get_leaderboard_payload(db: Session, mode: str = "spins"):
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


def claim_daily_reward_for_user(db: Session, user: models.User):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if user.last_login_date and user.last_login_date.date() >= now.date():
        raise HTTPException(status_code=400, detail="Бонус вже отримано сьогодні!")

    if user.last_login_date and user.last_login_date.date() == now.date() - timedelta(days=1):
        user.login_streak = (user.login_streak or 0) + 1
    else:
        user.login_streak = 1

    reward_coins = min(200 + (user.login_streak * 50), 1000)
    if user.energy < user.max_energy:
        user.energy = min(user.max_energy, user.energy + 5)

    user.coins += reward_coins
    user.last_login_date = now
    db.commit()
    return {
        "success": True,
        "message": f"Щоденний бонус (День {user.login_streak})! +{reward_coins} 🪙",
        "user_stats": get_user_state(db, user),
    }


def sell_duplicate_for_user(db: Session, user: models.User, card_id: str):
    user_card = db.query(models.UserCard).filter(
        models.UserCard.user_id == user.id,
        models.UserCard.card_id == card_id,
    ).first()
    if not user_card or user_card.duplicates < 1:
        raise HTTPException(status_code=400, detail="Немає дублікатів для продажу!")

    sell_price = SELL_DUPLICATE_REWARDS.get(user_card.card.rarity, 20)
    user_card.duplicates -= 1
    user.coins += sell_price
    db.commit()
    return {
        "success": True,
        "message": f"Дублікат продано за +{sell_price} 🪙!",
        "user_stats": get_user_state(db, user),
    }
