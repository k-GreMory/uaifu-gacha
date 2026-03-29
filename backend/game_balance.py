import copy
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_BALANCE_FILE = BASE_DIR / "content" / "game_balance.json"

DEFAULT_BALANCE_CONFIG = {
    "daily_rewards": {
        "base_coins": 200,
        "energy_bonus": 5,
        "max_coins": 1000,
        "streak_step_coins": 50,
    },
    "drone": {
        "score_per_coin": 5,
    },
    "duplicate_rewards": {
        "sell": {
            "Common": 20,
            "UnCommon": 40,
            "Rare": 100,
            "Epic": 300,
            "Legendary": 1000,
            "Mythic": 4000,
        },
        "standard": {
            "Common": 10,
            "UnCommon": 20,
            "Rare": 50,
            "Epic": 150,
            "Legendary": 500,
            "Mythic": 2000,
        },
    },
    "pricing": {
        "energy_purchase_amount": 1,
        "energy_purchase_cost": 1000,
        "premium_spin_cost": 10000,
    },
    "rarity_chances": {
        "pity": {
            "Legendary": 90,
            "Mythic": 10,
        },
        "pity_threshold": 50,
        "premium": {
            "Rare": 600,
            "Epic": 300,
            "Legendary": 90,
            "Mythic": 10,
        },
    },
    "referral_rewards": {
        "new_user": {
            "coins": 200,
            "energy": 3,
        },
        "referrer": {
            "coins": 500,
            "energy": 5,
        },
    },
}


def _deep_merge(base: dict, override: dict) -> dict:
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Balance config at {path} must be a JSON object")
    return payload


def load_balance_config(path: str | Path | None = None) -> dict:
    source = Path(path or os.getenv("GAME_BALANCE_FILE") or DEFAULT_BALANCE_FILE)
    if not source.exists():
        return copy.deepcopy(DEFAULT_BALANCE_CONFIG)
    try:
        return _deep_merge(DEFAULT_BALANCE_CONFIG, _read_json(source))
    except Exception as exc:
        print(f"[game_balance] WARNING: failed to load {source}: {exc}")
        return copy.deepcopy(DEFAULT_BALANCE_CONFIG)


def get_balance_config() -> dict:
    return copy.deepcopy(BALANCE_CONFIG)


BALANCE_CONFIG = load_balance_config()

STANDARD_DUPLICATE_REWARDS = BALANCE_CONFIG["duplicate_rewards"]["standard"]
SELL_DUPLICATE_REWARDS = BALANCE_CONFIG["duplicate_rewards"]["sell"]
PREMIUM_RARITY_CHANCES = BALANCE_CONFIG["rarity_chances"]["premium"]
PITY_RARITY_CHANCES = BALANCE_CONFIG["rarity_chances"]["pity"]

PITY_THRESHOLD = int(BALANCE_CONFIG["rarity_chances"]["pity_threshold"])
PREMIUM_SPIN_COST = int(BALANCE_CONFIG["pricing"]["premium_spin_cost"])
ENERGY_PURCHASE_COST = int(BALANCE_CONFIG["pricing"]["energy_purchase_cost"])
ENERGY_PURCHASE_AMOUNT = int(BALANCE_CONFIG["pricing"]["energy_purchase_amount"])

DAILY_REWARD_BASE_COINS = int(BALANCE_CONFIG["daily_rewards"]["base_coins"])
DAILY_REWARD_STREAK_STEP_COINS = int(BALANCE_CONFIG["daily_rewards"]["streak_step_coins"])
DAILY_REWARD_MAX_COINS = int(BALANCE_CONFIG["daily_rewards"]["max_coins"])
DAILY_REWARD_ENERGY_BONUS = int(BALANCE_CONFIG["daily_rewards"]["energy_bonus"])

REFERRAL_REFERRER_ENERGY = int(BALANCE_CONFIG["referral_rewards"]["referrer"]["energy"])
REFERRAL_REFERRER_COINS = int(BALANCE_CONFIG["referral_rewards"]["referrer"]["coins"])
REFERRAL_NEW_USER_ENERGY = int(BALANCE_CONFIG["referral_rewards"]["new_user"]["energy"])
REFERRAL_NEW_USER_COINS = int(BALANCE_CONFIG["referral_rewards"]["new_user"]["coins"])

DRONE_SCORE_PER_COIN = int(BALANCE_CONFIG["drone"]["score_per_coin"])


def get_standard_duplicate_reward(rarity: str) -> int:
    return STANDARD_DUPLICATE_REWARDS.get(rarity, 10)


def get_sell_duplicate_reward(rarity: str) -> int:
    return SELL_DUPLICATE_REWARDS.get(rarity, 20)


def calculate_daily_reward_coins(login_streak: int) -> int:
    return min(
        DAILY_REWARD_BASE_COINS + (login_streak * DAILY_REWARD_STREAK_STEP_COINS),
        DAILY_REWARD_MAX_COINS,
    )


def get_referral_reward_description() -> str:
    return f"{REFERRAL_REFERRER_ENERGY} енергії + {REFERRAL_REFERRER_COINS} монет"
