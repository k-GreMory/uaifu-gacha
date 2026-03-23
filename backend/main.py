from fastapi import FastAPI
import random
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import func

import models
from database import engine, SessionLocal, get_db
from cards_data import CARDS, RARITY_CHANCES

from sqladmin import Admin, ModelView, BaseView, expose
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

# Create tables
models.Base.metadata.create_all(bind=engine)

# Auto-seed the database cards table on startup if it is empty
def seed_database():
    db = SessionLocal()
    if db.query(models.Card).count() == 0:
        print("Seeding database with initial cards...")
        for card_data in CARDS:
            card = models.Card(
                id=card_data["id"],
                name=card_data["name"],
                rarity=card_data["rarity"],
                image=card_data["image"],
                description=card_data.get("description", "")
            )
            db.add(card)
        db.commit()
    db.close()

seed_database()

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

app = FastAPI(title="UAIFU Admin API", version="1.0.0")

# Add session middleware for sqladmin
app.add_middleware(SessionMiddleware, secret_key=os.getenv("ADMIN_SECRET", "fallback-secret-key-123"))

@app.get("/")
async def root():
    return {"message": "Animemes Collector API (Phase 2) is running!", "status": "ok"}

# Enable CORS for frontend
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
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

class SpinResult(BaseModel):
    card_id: str
    name: str
    rarity: str
    image: str
    message: str
    is_gold: bool
    is_new: bool = False
    new_level: int = 0
    
    # Fast UI updates without needing a separate /user fetch
    user_energy: int
    user_coins: int

class UserCardInfo(BaseModel):
    card_id: str
    name: str
    rarity: str
    image: str
    duplicates: int
    acquired_at: Optional[datetime] = None

class UserState(BaseModel):
    energy: int
    max_energy: int
    coins: int
    next_energy_in_seconds: int
    total_cards: int = 200

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

def get_or_create_user(db: Session, user_id: int, username: Optional[str] = None, first_name: Optional[str] = None):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        user = models.User(id=user_id, username=username, first_name=first_name, energy=20, max_energy=20, coins=0)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user = update_energy(db, user)
    return user

@app.get("/user", response_model=UserState)
async def get_user(user_id: int, db: Session = Depends(get_db)):
    user = get_or_create_user(db, user_id)
    
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

@app.get("/spin", response_model=SpinResult)
async def spin(user_id: int, db: Session = Depends(get_db)):
    # 1. Get/Create user and update energy
    user = get_or_create_user(db, user_id)
    
    if user.energy < 1:
        raise HTTPException(status_code=400, detail="Недостатньо енергії! Зачекай або купи за монети.")
        
    # Deduct energy
    user.energy -= 1
    
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
        "user_energy": user.energy,
        "user_coins": user.coins
    }

@app.post("/buy_energy")
async def buy_energy(user_id: int, db: Session = Depends(get_db)):
    user = get_or_create_user(db, user_id)
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
        "energy": user.energy,
        "coins": user.coins
    }

@app.get("/premium_spin", response_model=SpinResult)
async def premium_spin(user_id: int, db: Session = Depends(get_db)):
    user = get_or_create_user(db, user_id)
    
    if user.coins < 10000:
        raise HTTPException(status_code=400, detail="Недостатньо монет! Потрібно 10,000 🪙")
        
    user.coins -= 10000
    
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
        "user_energy": user.energy,
        "user_coins": user.coins
    }

@app.get("/collection", response_model=List[UserCardInfo])
async def get_collection(user_id: int, db: Session = Depends(get_db)):
    user_cards = db.query(models.UserCard).filter(models.UserCard.user_id == user_id).all()
    
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

# --- Admin Section ---

class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        secret = form.get("username") # Using username field for the secret key
        if secret == os.getenv("ADMIN_SECRET"):
            request.session.update({"token": secret})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("token")
        if not token or token != os.getenv("ADMIN_SECRET"):
            return False
        return True

authentication_backend = AdminAuth(secret_key=os.getenv("ADMIN_SECRET", "fallback-secret-key-123"))
admin = Admin(
    app, 
    engine, 
    authentication_backend=authentication_backend,
    templates_dir=TEMPLATES_DIR,
    title="UAIFU Admin"
)

class DashboardView(BaseView):
    name = "Панель керування"
    icon = "fa-solid fa-chart-line"

    @expose("/", methods=["GET"])
    async def index(self, request: Request):
        db = SessionLocal()
        stats = {
            "total_users": db.query(models.User).count(),
            "total_cards": db.query(models.Card).count(),
            "total_spins": db.query(models.SpinLog).count(),
            "total_coins": db.query(func.sum(models.User.coins)).scalar() or 0
        }
        db.close()
        return await self.templates.TemplateResponse(
            request, "admin_dashboard.html", {"stats": stats}
        )

admin.add_view(DashboardView)

class UserAdmin(ModelView, model=models.User):
    column_list = [models.User.id, models.User.username, models.User.coins, models.User.energy]
    column_searchable_list = [models.User.username, models.User.id]
    name = "Користувач"
    name_plural = "Користувачі"
    icon = "fa-solid fa-user"

class CardAdmin(ModelView, model=models.Card):
    column_list = ["id", "name", "rarity"]
    column_searchable_list = ["name", "id"]
    # Temporarily remove filters to avoid AttributeError: 'str' object has no attribute 'parameter_name'
    # column_filters = ["rarity"]
    name = "Персонаж"
    name_plural = "Персонажі"
    icon = "fa-solid fa-image"

class UserCardAdmin(ModelView, model=models.UserCard):
    column_list = [models.UserCard.user_id, models.UserCard.card_id, models.UserCard.duplicates]
    column_searchable_list = [models.UserCard.user_id, models.UserCard.card_id]
    name = "Колекція"
    name_plural = "Колекції"
    icon = "fa-solid fa-box"

class SpinLogAdmin(ModelView, model=models.SpinLog):
    column_list = [models.SpinLog.id, models.SpinLog.user_id, models.SpinLog.card_id, models.SpinLog.timestamp]
    name = "Лог Спінів"
    name_plural = "Логи Спінів"
    icon = "fa-solid fa-list"

class PurchaseLogAdmin(ModelView, model=models.PurchaseLog):
    column_list = [models.PurchaseLog.id, models.PurchaseLog.user_id, models.PurchaseLog.item, models.PurchaseLog.cost]
    name = "Лог Покупок"
    name_plural = "Логи Покупок"
    icon = "fa-solid fa-cart-shopping"

admin.add_view(UserAdmin)
admin.add_view(CardAdmin)
admin.add_view(UserCardAdmin)
admin.add_view(SpinLogAdmin)
admin.add_view(PurchaseLogAdmin)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
