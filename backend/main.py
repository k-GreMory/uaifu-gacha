import random
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import func

import models
from auth import TelegramAuthUser, get_authenticated_telegram_user
from config import validate_runtime_configuration
from database import engine, SessionLocal, get_db
from cards_data import CARDS, RARITY_CHANCES

from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

load_dotenv()
RUNTIME_CONFIG = validate_runtime_configuration()
ADMIN_SECRET = RUNTIME_CONFIG["admin_secret"]
ADMIN_ENABLED = RUNTIME_CONFIG["admin_enabled"]
CORS_ALLOW_ORIGINS = RUNTIME_CONFIG["cors_origins"]
CORS_ALLOW_ORIGIN_REGEX = RUNTIME_CONFIG["cors_origin_regex"]
if not CORS_ALLOW_ORIGINS and not CORS_ALLOW_ORIGIN_REGEX:
    CORS_ALLOW_ORIGINS = ["*"]

# Create tables (creates new ones, doesn't migrate existing ones)
models.Base.metadata.create_all(bind=engine)

# Manual migration for SQLite since metadata.create_all doesn't add columns
def migrate_database():
    if engine.dialect.name != "sqlite":
        return

    db = SessionLocal()
    try:
        # Check User table columns
        from sqlalchemy import text
        result = db.execute(text("PRAGMA table_info(users)")).fetchall()
        columns = [row[1] for row in result]
        
        # New columns for User model in Phase 2
        new_cols = [
            ("total_spins", "INTEGER DEFAULT 0"),
            ("referred_by", "INTEGER")
        ]
        
        for col_name, col_type in new_cols:
            if col_name not in columns:
                print(f"Migrating: Adding column '{col_name}' to 'users' table...")
                db.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                db.commit()
    except Exception as e:
        print(f"Migration error during column update: {e}")
    finally:
        db.close()

# Merging character versions that have multiple IDs
def reconcile_card_duplicates():
    MAPPING = {
        "c184": "c201", "c185": "c202", "c186": "c203", "c187": "c205",
        "c204": "c188", "c206": "c189", "c190": "c207", "c208": "c191",
        "c192": "c209", "c193": "c210", "c211": "c194", "c212": "c195",
        "c213": "c196", "c214": "c197", "c215": "c198", "c199": "c216"
    }
    
    db = SessionLocal()
    try:
        for old_id, new_id in MAPPING.items():
            # 1. Update UserCard entries
            old_entries = db.query(models.UserCard).filter(models.UserCard.card_id == old_id).all()
            for old_entry in old_entries:
                primary_entry = db.query(models.UserCard).filter(
                    models.UserCard.user_id == old_entry.user_id,
                    models.UserCard.card_id == new_id
                ).first()
                
                if primary_entry:
                    # Merge: +1 for the card itself, plus its duplicates
                    primary_entry.duplicates += (old_entry.duplicates + 1)
                    db.delete(old_entry)
                else:
                    # Move: Change ID
                    old_entry.card_id = new_id
            
            # 2. Update SpinLog entries
            db.query(models.SpinLog).filter(models.SpinLog.card_id == old_id).update({models.SpinLog.card_id: new_id})
            
            # 3. Clean up the cards table if the old ID exists
            db.query(models.Card).filter(models.Card.id == old_id).delete()
            
        db.commit()
        print("Character card consolidation completed successfully.")
    except Exception as e:
        print(f"Error during consolidation: {e}")
        db.rollback()
    finally:
        db.close()

# Auto-sync the database cards table on startup
def sync_database():
    db = SessionLocal()
    try:
        existing_ids = {c.id for c in db.query(models.Card).all()}
        new_count = 0
        updated_count = 0
        
        for card_data in CARDS:
            if card_data["id"] not in existing_ids:
                card = models.Card(
                    id=card_data["id"],
                    name=card_data["name"],
                    rarity=card_data["rarity"],
                    image=card_data["image"],
                    description=card_data.get("description", "")
                )
                db.add(card)
                new_count += 1
            else:
                # Update existing card to ensure name/rarity/image stay in sync with CARDS
                db.query(models.Card).filter(models.Card.id == card_data["id"]).update({
                    "name": card_data["name"],
                    "rarity": card_data["rarity"],
                    "image": card_data["image"],
                    "description": card_data.get("description", "")
                })
                updated_count += 1
        
        db.commit()
        if new_count > 0 or updated_count > 0:
            print(f"Database Sync: {new_count} new cards added, {updated_count} cards updated.")
    finally:
        db.close()

# Initialize database on startup
def bootstrap_system():
    # Run only core metadata first
    models.Base.metadata.create_all(bind=engine)
    
    migrate_database()
    sync_database()
    reconcile_card_duplicates()
    
    # NEW: Cleanup Orphans (UserCard -> Missing Card)
    db = SessionLocal()
    try:
        # Avoid subquery incompatibility in some SQLite versions by fetching manually
        card_ids = [c.id for c in db.query(models.Card.id).all()]
        orphans = db.query(models.UserCard).filter(~models.UserCard.card_id.in_(card_ids)).all()
        if orphans:
            print(f"Cleaning up {len(orphans)} orphaned cards...")
            for o in orphans:
                db.delete(o)
            db.commit()
    except Exception as e:
        print(f"Orphan Cleanup Error: {e}")
    finally:
        db.close()

bootstrap_system()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
DRONE_SESSION_TTL_MINUTES = int(os.getenv("DRONE_SESSION_TTL_MINUTES", "15"))
MAX_DRONE_COINS_PER_RUN = int(os.getenv("MAX_DRONE_COINS_PER_RUN", "50"))
MAX_DRONE_SCORE_PER_SECOND = float(os.getenv("MAX_DRONE_SCORE_PER_SECOND", "0.75"))
DRONE_SCORE_GRACE = int(os.getenv("DRONE_SCORE_GRACE", "10"))

app = FastAPI(title="UAIFU Admin API", version="1.0.0")

# Removed debug endpoints for production security

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_origin_regex=CORS_ALLOW_ORIGIN_REGEX,
    allow_credentials=False, # Set to False to allow "*" origin if headers/query params are used instead of cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# Force HTTPS for sqladmin on Railway
@app.middleware("http")
async def https_middleware(request: Request, call_next):
    # Check for X-Forwarded-Proto or if we are already on https
    if request.headers.get("x-forwarded-proto") == "https" or request.url.scheme == "https":
        request.scope["scheme"] = "https"
    
    # Also fix the URL for redirect responses if needed
    response = await call_next(request)
    return response

class UserState(BaseModel):
    energy: int
    max_energy: int
    coins: int
    next_energy_in_seconds: int
    total_cards: int = 200

class SpinResult(BaseModel):
    card_id: str
    name: str
    rarity: str
    image: str
    message: str
    is_gold: bool
    is_new: bool = False
    new_level: int = 0
    
    # Full UI state for perfect sync
    user_stats: UserState

class UserCardInfo(BaseModel):
    card_id: str
    name: str
    rarity: str
    image: str
    duplicates: int
    acquired_at: Optional[datetime] = None

class DroneSessionResponse(BaseModel):
    session_token: str
    expires_in_seconds: int

class DroneRewardRequest(BaseModel):
    session_token: str
    score: int

class DroneRewardResponse(BaseModel):
    status: str
    coins_added: int
    new_balance: int
    user_stats: UserState

def update_energy(db: Session, user: models.User):
    now = datetime.now(timezone.utc).replace(tzinfo=None) # Keep tz naive for sqlite
    # Calculate difference
    if user.energy < user.max_energy:
        diff_minutes = (now - user.last_energy_update).total_seconds() / 60.0
        gained = int(diff_minutes // 10)
        
        if gained > 0:
            user.energy = min(user.max_energy, user.energy + gained)
            # Advance last_update by gained * 10 minutes so partial progress isn't lost
            user.last_energy_update = user.last_energy_update + timedelta(minutes=gained * 10)
            db.commit()
    else:
        # If at max energy, keep update time at now
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
        "total_cards": total_cards
    }

def get_or_create_user(db: Session, user_id: int, username: Optional[str] = None, first_name: Optional[str] = None):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        user = models.User(id=user_id, username=username, first_name=first_name, energy=20, max_energy=20, coins=0)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Always update name/username from TG if available (Phase 36: Sync Nicknames)
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

def create_drone_game_session(db: Session, user_id: int):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db.query(models.DroneGameSession).filter(
        models.DroneGameSession.user_id == user_id,
        models.DroneGameSession.status == "active"
    ).update({models.DroneGameSession.status: "replaced"})

    session = models.DroneGameSession(
        user_id=user_id,
        session_token=secrets.token_urlsafe(24),
        status="active",
        created_at=now,
        expires_at=now + timedelta(minutes=DRONE_SESSION_TTL_MINUTES),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def get_max_allowed_drone_score(session: models.DroneGameSession):
    elapsed_seconds = max(
        1,
        int((datetime.now(timezone.utc).replace(tzinfo=None) - session.created_at).total_seconds()),
    )
    return int(elapsed_seconds * MAX_DRONE_SCORE_PER_SECOND) + DRONE_SCORE_GRACE

@app.get("/user", response_model=UserState)
async def get_user(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_user_state(db, current_user)

@app.get("/spin", response_model=SpinResult)
async def spin(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Get/Create user and update energy
    user = current_user
    
    if user.energy < 1:
        raise HTTPException(status_code=400, detail="Недостатньо енергії! Зачекай або купи за монети.")
        
    # Deduct energy
    user.energy -= 1
    user.total_spins = (user.total_spins or 0) + 1
    
    # 2. Logic for rarity
    total_chance = sum(RARITY_CHANCES.values())
    rand = random.randint(1, total_chance)
    current_sum = 0
    rarity = "Common"
    # To handle dictionaries unordered properly, better to predefine order or just test sequentially
    for r_name, r_chance in RARITY_CHANCES.items():
        current_sum += r_chance
        if rand <= current_sum:
            rarity = r_name
            break
    
    # 3. Pick random card of that rarity
    possible_card = db.query(models.Card).filter(models.Card.rarity == rarity).order_by(func.random()).first()
    # Fallback if a rarity has no cards assigned
    if not possible_card:
        possible_card = db.query(models.Card).filter(models.Card.rarity == "UnCommon").order_by(func.random()).first()
        if not possible_card:
            possible_card = db.query(models.Card).order_by(func.random()).first()

    card = possible_card
    
    # 4. Save to collection and check duplicates
    existing = db.query(models.UserCard).filter(models.UserCard.user_id == user.id, models.UserCard.card_id == card.id).first()
    is_duplicate = False
    
    spin_log = models.SpinLog(user_id=user.id, card_id=card.id)
    coin_rewards = {"Common": 10, "UnCommon": 20, "Rare": 50, "Epic": 150, "Legendary": 500, "Mythic": 2000}
    gained_coins = coin_rewards.get(rarity, 10)
    new_lvl = 0

    if existing:
        is_duplicate = True
        spin_log.is_duplicate = True
        user.coins += gained_coins
        existing.duplicates += 1
        new_lvl = existing.duplicates + 1
    else:
        user_card = models.UserCard(user_id=user.id, card_id=card.id)
        db.add(user_card)
        
    db.add(spin_log)
    db.commit()
    
    is_gold = rarity in ["Legendary", "Mythic", "Epic"]
    
    if is_duplicate:
        message = f"Прокачка до Lvl.{new_lvl}! +{gained_coins} монет 🪙"
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
        "new_level": new_lvl,
        "user_stats": get_user_state(db, user)
    }

@app.post("/buy_energy")
async def buy_energy(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = current_user
    if user.energy >= user.max_energy:
        raise HTTPException(status_code=400, detail="Енергія вже повна! Спочатку витрать хоча б 1 ⚡")
    if user.coins < 1000:
        raise HTTPException(status_code=400, detail="Недостатньо монет! Потрібно 1,000 🪙")
    
    user.coins -= 1000
    user.energy = min(user.max_energy, user.energy + 1)
    
    purchase_log = models.PurchaseLog(user_id=user.id, item="energy", cost=1000)
    db.add(purchase_log)
    
    db.commit()
    
    return {
        "success": True,
        "message": "Придбано 1 Енергію ⚡",
        "user_stats": get_user_state(db, user)
    }

@app.get("/premium_spin", response_model=SpinResult)
async def premium_spin(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = current_user
    
    if user.coins < 10000:
        raise HTTPException(status_code=400, detail="Недостатньо монет! Потрібно 10,000 🪙")
        
    user.coins -= 10000
    user.total_spins = (user.total_spins or 0) + 1
    
    # Premium Logic: Cut out Common and UnCommon entirely
    premium_chances = {"Rare": 600, "Epic": 300, "Legendary": 90, "Mythic": 10}
    total_chance = sum(premium_chances.values())
    rand = random.randint(1, total_chance)
    
    current_sum = 0
    rarity = "Rare"
    for r_name, r_chance in premium_chances.items():
        current_sum += r_chance
        if rand <= current_sum:
            rarity = r_name
            break
            
    possible_card = db.query(models.Card).filter(models.Card.rarity == rarity).order_by(func.random()).first()
    if not possible_card:
        possible_card = db.query(models.Card).order_by(func.random()).first()
        
    card = possible_card
    
    existing = db.query(models.UserCard).filter(models.UserCard.user_id == user.id, models.UserCard.card_id == card.id).first()
    is_duplicate = False
    
    spin_log = models.SpinLog(user_id=user.id, card_id=card.id)
    coin_rewards = {"Common": 10, "UnCommon": 20, "Rare": 50, "Epic": 150, "Legendary": 500, "Mythic": 2000}
    gained_coins = coin_rewards.get(rarity, 10)
    new_lvl = 0

    if existing:
        is_duplicate = True
        spin_log.is_duplicate = True
        user.coins += gained_coins
        existing.duplicates += 1
        new_lvl = existing.duplicates + 1
    else:
        user_card = models.UserCard(user_id=user.id, card_id=card.id)
        db.add(user_card)
        
    db.add(spin_log)

    purchase_log = models.PurchaseLog(user_id=user.id, item="premium_spin", cost=10000)
    db.add(purchase_log)

    db.commit()
    
    is_gold = rarity in ["Legendary", "Mythic", "Epic"]
    
    if is_duplicate:
        message = f"Прокачка до Lvl.{new_lvl}! Скомпенсовано +{gained_coins} монет 🪙"
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
        "new_level": new_lvl,
        "user_stats": get_user_state(db, user)
    }

@app.get("/collection", response_model=List[UserCardInfo])
async def get_collection(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_cards = db.query(models.UserCard).filter(models.UserCard.user_id == current_user.id).all()
    
    result = []
    for uc in user_cards:
        c = uc.card
        if c:
            result.append({
                "card_id": c.id,
                "name": c.name,
                "rarity": c.rarity,
                "image": c.image,
                "duplicates": uc.duplicates,
                "acquired_at": uc.acquired_at
            })
    return result

# --- Leaderboard ---

@app.get("/leaderboard")
async def get_leaderboard(mode: str = "spins", db: Session = Depends(get_db)):
    """Returns top-15 players. mode=spins or mode=cards"""
    if mode == "cards":
        from sqlalchemy import distinct
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
                "rank": i + 1,
                "user_id": u.id,
                "name": u.first_name or u.username or "Гравець",
                "score": score,
                "label": "карток"
            }
            for i, (u, score) in enumerate(rows)
        ]
    else:  # spins
        rows = (
            db.query(models.User)
            .order_by(models.User.total_spins.desc())
            .limit(15)
            .all()
        )
        return [
            {
                "rank": i + 1,
                "user_id": u.id,
                "name": u.first_name or u.username or "Гравець",
                "score": u.total_spins,
                "label": "спінів"
            }
            for i, u in enumerate(rows)
        ]

# --- Referral System ---

@app.get("/referral/link")
async def get_referral_link(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = current_user
    bot_name = os.getenv("BOT_NAME", "uaifu_bot")
    link = f"https://t.me/{bot_name}?start=ref_{user.id}"
    
    # Count how many people this user has referred
    ref_count = db.query(models.Referral).filter(models.Referral.referrer_id == user.id).count()
    
    return {
        "link": link,
        "ref_count": ref_count,
        "reward_per_ref": "5 енергії + 500 монет"
    }

@app.post("/referral/claim")
async def claim_referral(ref_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Called when a new user joins via referral link (ref_id = who invited them)"""
    user_id = current_user.id
    if user_id == ref_id:
        raise HTTPException(status_code=400, detail="Не можна запросити самого себе 🙃")
    
    # Check if already referred
    existing = db.query(models.Referral).filter(models.Referral.invited_id == user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Реферал вже зареєстровано")
    
    # Make sure both users exist
    new_user = current_user
    referrer = db.query(models.User).filter(models.User.id == ref_id).first()
    if not referrer:
        raise HTTPException(status_code=404, detail="Запрошувач не знайдений")
    
    # Record referral
    referral = models.Referral(referrer_id=ref_id, invited_id=user_id, rewarded=True)
    db.add(referral)
    
    # Reward both parties
    referrer.energy = min(referrer.max_energy, referrer.energy + 5)
    referrer.coins += 500
    new_user.energy = min(new_user.max_energy, new_user.energy + 3)
    new_user.coins += 200
    new_user.referred_by = ref_id
    
    db.commit()
    
    return {
        "success": True,
        "message": "Реферал зараховано! Обом нараховано бонуси 🎉",
        "referrer_bonus": "+5 енергії, +500 монет",
        "new_user_bonus": "+3 енергії, +200 монет"
    }

# --- Season Pass ---

def get_active_season(db: Session) -> Optional[models.Season]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return db.query(models.Season).filter(
        models.Season.is_active == True,
        models.Season.start_date <= now,
        models.Season.end_date >= now
    ).first()

def ensure_season_exists(db: Session):
    """Auto-create a season if none exists"""
    season = db.query(models.Season).filter(models.Season.is_active == True).first()
    if not season:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        season = models.Season(
            name="Сезон 1: Весна Вайфу 🌸",
            start_date=now,
            end_date=now + timedelta(days=30),
            is_active=True
        )
        db.add(season)
        db.flush()
        
        # Default tasks
        tasks = [
            models.SeasonTask(season_id=season.id, title="Перший спін", task_type="spins", target=1, reward_coins=100, reward_energy=0),
            models.SeasonTask(season_id=season.id, title="Зроби 10 спінів", task_type="spins", target=10, reward_coins=500, reward_energy=2),
            models.SeasonTask(season_id=season.id, title="Зроби 50 спінів", task_type="spins", target=50, reward_coins=2000, reward_energy=5),
            models.SeasonTask(season_id=season.id, title="Зроби 100 спінів", task_type="spins", target=100, reward_coins=5000, reward_energy=10),
            models.SeasonTask(season_id=season.id, title="Зберіть 5 унікальних карток", task_type="unique_cards", target=5, reward_coins=300, reward_energy=1),
            models.SeasonTask(season_id=season.id, title="Зберіть 25 унікальних карток", task_type="unique_cards", target=25, reward_coins=1500, reward_energy=3),
            models.SeasonTask(season_id=season.id, title="Зберіть 50 унікальних карток", task_type="unique_cards", target=50, reward_coins=3000, reward_energy=5),
            models.SeasonTask(season_id=season.id, title="Зробіть 1 преміум спін", task_type="premium_spins", target=1, reward_coins=1000, reward_energy=2),
        ]
        db.add_all(tasks)
        db.commit()
        db.refresh(season)
    return season

@app.get("/season")
async def get_season(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_season_exists(db)
    season = get_active_season(db)
    if not season:
        return {"active": False, "message": "Зараз немає активного сезону"}
    
    user = current_user
    user_id = current_user.id
    unique_cards = db.query(func.count(models.UserCard.id)).filter(models.UserCard.user_id == user_id).scalar() or 0
    premium_spins = db.query(func.count(models.PurchaseLog.id)).filter(
        models.PurchaseLog.user_id == user_id,
        models.PurchaseLog.item == "premium_spin"
    ).scalar() or 0

    tasks_out = []
    for task in season.tasks:
        # Get or calculate progress
        progress_row = db.query(models.UserSeasonProgress).filter(
            models.UserSeasonProgress.user_id == user_id,
            models.UserSeasonProgress.task_id == task.id
        ).first()
        
        # Calculate current progress from live data
        if task.task_type == "spins":
            current = user.total_spins
        elif task.task_type == "unique_cards":
            current = unique_cards
        elif task.task_type == "premium_spins":
            current = premium_spins
        else:
            current = 0
        
        claimed = progress_row.claimed if progress_row else False
        
        tasks_out.append({
            "id": task.id,
            "title": task.title,
            "task_type": task.task_type,
            "target": task.target,
            "progress": min(current, task.target),
            "completed": current >= task.target,
            "claimed": claimed,
            "reward_coins": task.reward_coins,
            "reward_energy": task.reward_energy,
        })
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    days_left = max(0, (season.end_date - now).days)
    
    return {
        "active": True,
        "season_name": season.name,
        "days_left": days_left,
        "tasks": tasks_out
    }

@app.post("/season/claim")
async def claim_season_reward(task_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.SeasonTask).filter(models.SeasonTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не знайдена")
    
    user = current_user
    user_id = current_user.id
    unique_cards = db.query(func.count(models.UserCard.id)).filter(models.UserCard.user_id == user_id).scalar() or 0
    premium_spins = db.query(func.count(models.PurchaseLog.id)).filter(
        models.PurchaseLog.user_id == user_id,
        models.PurchaseLog.item == "premium_spin"
    ).scalar() or 0
    
    if task.task_type == "spins":
        current = user.total_spins
    elif task.task_type == "unique_cards":
        current = unique_cards
    elif task.task_type == "premium_spins":
        current = premium_spins
    else:
        current = 0
    
    if current < task.target:
        raise HTTPException(status_code=400, detail=f"Задача ще не виконана ({current}/{task.target})")
    
    # Check if already claimed
    progress_row = db.query(models.UserSeasonProgress).filter(
        models.UserSeasonProgress.user_id == user_id,
        models.UserSeasonProgress.task_id == task_id
    ).first()
    
    if progress_row and progress_row.claimed:
        raise HTTPException(status_code=400, detail="Нагорода вже отримана!")
    
    # Mark claimed and give reward
    if not progress_row:
        progress_row = models.UserSeasonProgress(
            user_id=user_id, task_id=task_id, progress=current, claimed=True,
            claimed_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(progress_row)
    else:
        progress_row.claimed = True
        progress_row.claimed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    
    user.coins += task.reward_coins
    if task.reward_energy > 0:
        user.energy = min(user.max_energy, user.energy + task.reward_energy)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Нагорода отримана! +{task.reward_coins} 🪙 +{task.reward_energy} ⚡",
        "user_stats": get_user_state(db, user)
    }

# --- Admin Section ---


class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        secret = form.get("username") # Using username field for the secret key
        if ADMIN_SECRET and secret == ADMIN_SECRET:
            request.session.update({"token": secret})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        if not ADMIN_SECRET or not token or token != ADMIN_SECRET:
            return False
        return True

class UserAdmin(ModelView, model=models.User):
    name = "Користувач"
    name_plural = "Користувачі"
    icon = "fa-solid fa-user"
    column_list = [models.User.id, models.User.username, models.User.first_name, models.User.coins, models.User.energy, models.User.total_spins, models.User.referred_by]
    search_fields = ["username", "first_name", "id"]
    inline_models = [models.UserCard]

class CardAdmin(ModelView, model=models.Card):
    name = "Персонаж"
    name_plural = "Персонажі"
    icon = "fa-solid fa-image"
    column_list = [models.Card.id, models.Card.name, models.Card.rarity, models.Card.image]
    search_fields = ["name", "id"]

class UserCardAdmin(ModelView, model=models.UserCard):
    name = "Колекція"
    name_plural = "Колекції"
    icon = "fa-solid fa-box"
    column_list = [models.UserCard.id, models.UserCard.user_id, models.UserCard.card_id, models.UserCard.duplicates, models.UserCard.acquired_at]
    search_fields = ["user_id", "card_id"]

class SpinLogAdmin(ModelView, model=models.SpinLog):
    name = "Лог Спінів"
    name_plural = "Логи Спінів"
    icon = "fa-solid fa-list"
    column_list = [models.SpinLog.id, models.SpinLog.user_id, models.SpinLog.card_id, models.SpinLog.is_duplicate, models.SpinLog.timestamp]
    search_fields = ["user_id", "card_id"]

class PurchaseLogAdmin(ModelView, model=models.PurchaseLog):
    name = "Лог Покупок"
    name_plural = "Логи Покупок"
    icon = "fa-solid fa-cart-shopping"
    column_list = [models.PurchaseLog.id, models.PurchaseLog.user_id, models.PurchaseLog.item, models.PurchaseLog.cost, models.PurchaseLog.timestamp]
    search_fields = ["user_id", "item"]

class ReferralAdmin(ModelView, model=models.Referral):
    name = "Реферал"
    name_plural = "Реферали"
    icon = "fa-solid fa-link"
    column_list = ["id", "referrer_id", "invited_id", "rewarded", "created_at"]

class SeasonAdmin(ModelView, model=models.Season):
    name = "Сезон"
    name_plural = "Сезони"
    icon = "fa-solid fa-calendar"
    column_list = ["id", "name", "start_date", "end_date", "is_active"]

class SeasonTaskAdmin(ModelView, model=models.SeasonTask):
    name = "Завдання Сезону"
    name_plural = "Завдання Сезону"
    icon = "fa-solid fa-check-double"
    column_list = ["id", "season_id", "title", "reward_coins", "reward_energy"]

if ADMIN_ENABLED:
    authentication_backend = AdminAuth(secret_key=ADMIN_SECRET)
    admin = Admin(
        app,
        engine,
        authentication_backend=authentication_backend,
        templates_dir=TEMPLATES_DIR,
        title="UAIFU Admin"
    )

    admin.add_view(UserAdmin)
    admin.add_view(CardAdmin)
    admin.add_view(UserCardAdmin)
    admin.add_view(SpinLogAdmin)
    admin.add_view(PurchaseLogAdmin)
    admin.add_view(ReferralAdmin)
    admin.add_view(SeasonAdmin)
    admin.add_view(SeasonTaskAdmin)
else:
    print("[config] Admin UI disabled because ADMIN_SECRET is not configured or admin was disabled explicitly.")

@app.post("/games/drone/start", response_model=DroneSessionResponse)
async def start_drone_game(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = create_drone_game_session(db, current_user.id)
    return {
        "session_token": session.session_token,
        "expires_in_seconds": DRONE_SESSION_TTL_MINUTES * 60,
    }

@app.post("/games/drone/reward", response_model=DroneRewardResponse)
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
        "user_stats": get_user_state(db, current_user)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
