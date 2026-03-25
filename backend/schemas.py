from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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


class CollectionRestoreCard(BaseModel):
    card_id: str
    duplicates: int = 0
    acquired_at: Optional[datetime] = None


class CollectionRestoreRequest(BaseModel):
    cards: list[CollectionRestoreCard]
