from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
import datetime
from database import Base


def utcnow_naive():
    return datetime.datetime.now(datetime.UTC).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True) # Telegram ID
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    energy = Column(Integer, default=20)
    max_energy = Column(Integer, default=20)
    coins = Column(Integer, default=0)
    last_energy_update = Column(DateTime, default=utcnow_naive)
    total_spins = Column(Integer, default=0)  # For leaderboard
    referred_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    pity_counter = Column(Integer, default=0)
    last_login_date = Column(DateTime, nullable=True)
    login_streak = Column(Integer, default=0)

    collection = relationship("UserCard", back_populates="owner")

    def __str__(self):
        return f"{self.username or self.first_name or self.id}"

class Card(Base):
    __tablename__ = "cards"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    rarity = Column(String, index=True)
    image = Column(String)
    description = Column(String)

    def __str__(self):
        return f"{self.name} ({self.id})"

class UserCard(Base):
    __tablename__ = "user_cards"
    __table_args__ = (UniqueConstraint('user_id', 'card_id', name='_user_card_uc'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    card_id = Column(String, ForeignKey("cards.id"), index=True)
    duplicates = Column(Integer, default=0)
    acquired_at = Column(DateTime, default=utcnow_naive)

    owner = relationship("User", back_populates="collection")
    card = relationship("Card")

    def __str__(self):
        return f"{self.card_id} (x{self.duplicates + 1})"

class SpinLog(Base):
    __tablename__ = "spin_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    card_id = Column(String, ForeignKey("cards.id"))
    is_duplicate = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=utcnow_naive)

    owner = relationship("User")
    card = relationship("Card")

    def __str__(self):
        return f"Spin {self.id}: {self.card_id} (User {self.user_id})"

class PurchaseLog(Base):
    __tablename__ = "purchase_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    item = Column(String)
    cost = Column(Integer)
    timestamp = Column(DateTime, default=utcnow_naive)

    def __str__(self):
        return f"Purchase {self.id}: {self.item} (Cost {self.cost})"

class DroneGameSession(Base):
    __tablename__ = "drone_game_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    session_token = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="active", nullable=False)
    best_score = Column(Integer, default=0)
    reward_coins = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    claimed_at = Column(DateTime, nullable=True)

    owner = relationship("User")

    def __str__(self):
        return f"DroneSession {self.id}: {self.user_id} ({self.status})"

# --- Referral System ---
class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    referrer_id = Column(Integer, ForeignKey("users.id"), index=True)  # who invited
    invited_id = Column(Integer, ForeignKey("users.id"), unique=True)  # who was invited
    rewarded = Column(Boolean, default=False)  # bonus given?
    created_at = Column(DateTime, default=utcnow_naive)

    def __str__(self):
        return f"Referral: {self.referrer_id} -> {self.invited_id}"

# --- Managed Content ---
class GameBalanceConfig(Base):
    __tablename__ = "game_balance_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, default="Default Balance")
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    daily_reward_base_coins = Column(Integer, default=200, nullable=False)
    daily_reward_energy_bonus = Column(Integer, default=5, nullable=False)
    daily_reward_max_coins = Column(Integer, default=1000, nullable=False)
    daily_reward_streak_step_coins = Column(Integer, default=50, nullable=False)

    drone_score_per_coin = Column(Integer, default=5, nullable=False)

    energy_purchase_amount = Column(Integer, default=1, nullable=False)
    energy_purchase_cost = Column(Integer, default=1000, nullable=False)
    premium_spin_cost = Column(Integer, default=10000, nullable=False)

    pity_threshold = Column(Integer, default=50, nullable=False)
    premium_rare_chance = Column(Integer, default=600, nullable=False)
    premium_epic_chance = Column(Integer, default=300, nullable=False)
    premium_legendary_chance = Column(Integer, default=90, nullable=False)
    premium_mythic_chance = Column(Integer, default=10, nullable=False)
    pity_legendary_chance = Column(Integer, default=90, nullable=False)
    pity_mythic_chance = Column(Integer, default=10, nullable=False)

    referrer_reward_coins = Column(Integer, default=500, nullable=False)
    referrer_reward_energy = Column(Integer, default=5, nullable=False)
    new_user_reward_coins = Column(Integer, default=200, nullable=False)
    new_user_reward_energy = Column(Integer, default=3, nullable=False)

    standard_duplicate_common = Column(Integer, default=10, nullable=False)
    standard_duplicate_uncommon = Column(Integer, default=20, nullable=False)
    standard_duplicate_rare = Column(Integer, default=50, nullable=False)
    standard_duplicate_epic = Column(Integer, default=150, nullable=False)
    standard_duplicate_legendary = Column(Integer, default=500, nullable=False)
    standard_duplicate_mythic = Column(Integer, default=2000, nullable=False)

    sell_duplicate_common = Column(Integer, default=20, nullable=False)
    sell_duplicate_uncommon = Column(Integer, default=40, nullable=False)
    sell_duplicate_rare = Column(Integer, default=100, nullable=False)
    sell_duplicate_epic = Column(Integer, default=300, nullable=False)
    sell_duplicate_legendary = Column(Integer, default=1000, nullable=False)
    sell_duplicate_mythic = Column(Integer, default=4000, nullable=False)

    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

    def __str__(self):
        suffix = " (active)" if self.is_active else ""
        return f"{self.name}{suffix}"


class SeasonTemplate(Base):
    __tablename__ = "season_templates"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    duration_days = Column(Integer, default=30, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

    tasks = relationship(
        "SeasonTemplateTask",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="SeasonTemplateTask.sort_order",
    )

    def __str__(self):
        suffix = " (active)" if self.is_active else ""
        return f"{self.name}{suffix}"


class SeasonTemplateTask(Base):
    __tablename__ = "season_template_tasks"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("season_templates.id"), index=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    title = Column(String, nullable=False)
    task_type = Column(String, nullable=False)
    target = Column(Integer, nullable=False)
    reward_coins = Column(Integer, default=0, nullable=False)
    reward_energy = Column(Integer, default=0, nullable=False)

    template = relationship("SeasonTemplate", back_populates="tasks")

    def __str__(self):
        return f"{self.sort_order}. {self.title}"


# --- Season Pass ---
class Season(Base):
    __tablename__ = "seasons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True)

    tasks = relationship("SeasonTask", back_populates="season")

    def __str__(self):
        return f"Season: {self.name}"

class SeasonTask(Base):
    __tablename__ = "season_tasks"

    id = Column(Integer, primary_key=True, index=True)
    season_id = Column(Integer, ForeignKey("seasons.id"), index=True)
    title = Column(String)         # e.g. "Зроби 10 спінів"
    task_type = Column(String)     # "spins", "unique_cards", "premium_spins"
    target = Column(Integer)       # e.g. 10
    reward_coins = Column(Integer, default=0)
    reward_energy = Column(Integer, default=0)

    season = relationship("Season", back_populates="tasks")

    def __str__(self):
        return f"Task: {self.title}"

class UserSeasonProgress(Base):
    __tablename__ = "user_season_progress"
    __table_args__ = (UniqueConstraint('user_id', 'task_id', name='_user_task_uc'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    task_id = Column(Integer, ForeignKey("season_tasks.id"), index=True)
    progress = Column(Integer, default=0)
    claimed = Column(Boolean, default=False)
    claimed_at = Column(DateTime, nullable=True)

    task = relationship("SeasonTask")
