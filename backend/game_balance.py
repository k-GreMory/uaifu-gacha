import copy
import json
import os
from pathlib import Path

from sqlalchemy.orm import Session

import models

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_BALANCE_FILE = BASE_DIR / "content" / "game_balance.json"
RARITY_FIELD_SUFFIX = {
    "Common": "common",
    "UnCommon": "uncommon",
    "Rare": "rare",
    "Epic": "epic",
    "Legendary": "legendary",
    "Mythic": "mythic",
}

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


def get_balance_record_kwargs(config: dict | None = None, name: str = "Default Balance") -> dict:
    source = copy.deepcopy(config or DEFAULT_BALANCE_CONFIG)
    return {
        "name": name,
        "is_active": True,
        "daily_reward_base_coins": int(source["daily_rewards"]["base_coins"]),
        "daily_reward_energy_bonus": int(source["daily_rewards"]["energy_bonus"]),
        "daily_reward_max_coins": int(source["daily_rewards"]["max_coins"]),
        "daily_reward_streak_step_coins": int(source["daily_rewards"]["streak_step_coins"]),
        "drone_score_per_coin": int(source["drone"]["score_per_coin"]),
        "energy_purchase_amount": int(source["pricing"]["energy_purchase_amount"]),
        "energy_purchase_cost": int(source["pricing"]["energy_purchase_cost"]),
        "premium_spin_cost": int(source["pricing"]["premium_spin_cost"]),
        "pity_threshold": int(source["rarity_chances"]["pity_threshold"]),
        "premium_rare_chance": int(source["rarity_chances"]["premium"]["Rare"]),
        "premium_epic_chance": int(source["rarity_chances"]["premium"]["Epic"]),
        "premium_legendary_chance": int(source["rarity_chances"]["premium"]["Legendary"]),
        "premium_mythic_chance": int(source["rarity_chances"]["premium"]["Mythic"]),
        "pity_legendary_chance": int(source["rarity_chances"]["pity"]["Legendary"]),
        "pity_mythic_chance": int(source["rarity_chances"]["pity"]["Mythic"]),
        "referrer_reward_coins": int(source["referral_rewards"]["referrer"]["coins"]),
        "referrer_reward_energy": int(source["referral_rewards"]["referrer"]["energy"]),
        "new_user_reward_coins": int(source["referral_rewards"]["new_user"]["coins"]),
        "new_user_reward_energy": int(source["referral_rewards"]["new_user"]["energy"]),
        "standard_duplicate_common": int(source["duplicate_rewards"]["standard"]["Common"]),
        "standard_duplicate_uncommon": int(source["duplicate_rewards"]["standard"]["UnCommon"]),
        "standard_duplicate_rare": int(source["duplicate_rewards"]["standard"]["Rare"]),
        "standard_duplicate_epic": int(source["duplicate_rewards"]["standard"]["Epic"]),
        "standard_duplicate_legendary": int(source["duplicate_rewards"]["standard"]["Legendary"]),
        "standard_duplicate_mythic": int(source["duplicate_rewards"]["standard"]["Mythic"]),
        "sell_duplicate_common": int(source["duplicate_rewards"]["sell"]["Common"]),
        "sell_duplicate_uncommon": int(source["duplicate_rewards"]["sell"]["UnCommon"]),
        "sell_duplicate_rare": int(source["duplicate_rewards"]["sell"]["Rare"]),
        "sell_duplicate_epic": int(source["duplicate_rewards"]["sell"]["Epic"]),
        "sell_duplicate_legendary": int(source["duplicate_rewards"]["sell"]["Legendary"]),
        "sell_duplicate_mythic": int(source["duplicate_rewards"]["sell"]["Mythic"]),
    }


def _config_from_record(record: models.GameBalanceConfig) -> dict:
    standard = {}
    sell = {}
    for rarity, suffix in RARITY_FIELD_SUFFIX.items():
        standard[rarity] = int(getattr(record, f"standard_duplicate_{suffix}"))
        sell[rarity] = int(getattr(record, f"sell_duplicate_{suffix}"))

    return {
        "daily_rewards": {
            "base_coins": int(record.daily_reward_base_coins),
            "energy_bonus": int(record.daily_reward_energy_bonus),
            "max_coins": int(record.daily_reward_max_coins),
            "streak_step_coins": int(record.daily_reward_streak_step_coins),
        },
        "drone": {
            "score_per_coin": int(record.drone_score_per_coin),
        },
        "duplicate_rewards": {
            "sell": sell,
            "standard": standard,
        },
        "pricing": {
            "energy_purchase_amount": int(record.energy_purchase_amount),
            "energy_purchase_cost": int(record.energy_purchase_cost),
            "premium_spin_cost": int(record.premium_spin_cost),
        },
        "rarity_chances": {
            "pity": {
                "Legendary": int(record.pity_legendary_chance),
                "Mythic": int(record.pity_mythic_chance),
            },
            "pity_threshold": int(record.pity_threshold),
            "premium": {
                "Rare": int(record.premium_rare_chance),
                "Epic": int(record.premium_epic_chance),
                "Legendary": int(record.premium_legendary_chance),
                "Mythic": int(record.premium_mythic_chance),
            },
        },
        "referral_rewards": {
            "new_user": {
                "coins": int(record.new_user_reward_coins),
                "energy": int(record.new_user_reward_energy),
            },
            "referrer": {
                "coins": int(record.referrer_reward_coins),
                "energy": int(record.referrer_reward_energy),
            },
        },
    }


def get_active_balance_record(db: Session | None):
    if db is None:
        return None
    return (
        db.query(models.GameBalanceConfig)
        .filter(models.GameBalanceConfig.is_active == True)
        .order_by(models.GameBalanceConfig.updated_at.desc(), models.GameBalanceConfig.id.desc())
        .first()
    )


def get_balance_config(db: Session | None = None) -> dict:
    record = get_active_balance_record(db)
    if record is not None:
        return _config_from_record(record)
    return copy.deepcopy(BALANCE_CONFIG)


def get_pity_threshold(db: Session | None = None) -> int:
    return int(get_balance_config(db)["rarity_chances"]["pity_threshold"])


def get_pity_rarity_chances(db: Session | None = None) -> dict[str, int]:
    return dict(get_balance_config(db)["rarity_chances"]["pity"])


def get_premium_rarity_chances(db: Session | None = None) -> dict[str, int]:
    return dict(get_balance_config(db)["rarity_chances"]["premium"])


def get_premium_spin_cost(db: Session | None = None) -> int:
    return int(get_balance_config(db)["pricing"]["premium_spin_cost"])


def get_energy_purchase_cost(db: Session | None = None) -> int:
    return int(get_balance_config(db)["pricing"]["energy_purchase_cost"])


def get_energy_purchase_amount(db: Session | None = None) -> int:
    return int(get_balance_config(db)["pricing"]["energy_purchase_amount"])


def get_daily_reward_energy_bonus(db: Session | None = None) -> int:
    return int(get_balance_config(db)["daily_rewards"]["energy_bonus"])


def get_drone_score_per_coin(db: Session | None = None) -> int:
    return int(get_balance_config(db)["drone"]["score_per_coin"])


def get_standard_duplicate_reward(rarity: str, db: Session | None = None) -> int:
    return int(get_balance_config(db)["duplicate_rewards"]["standard"].get(rarity, 10))


def get_sell_duplicate_reward(rarity: str, db: Session | None = None) -> int:
    return int(get_balance_config(db)["duplicate_rewards"]["sell"].get(rarity, 20))


def calculate_daily_reward_coins(login_streak: int, db: Session | None = None) -> int:
    config = get_balance_config(db)
    return min(
        int(config["daily_rewards"]["base_coins"]) + (login_streak * int(config["daily_rewards"]["streak_step_coins"])),
        int(config["daily_rewards"]["max_coins"]),
    )


def get_referral_reward_description(db: Session | None = None) -> str:
    config = get_balance_config(db)
    reward = config["referral_rewards"]["referrer"]
    return f"{int(reward['energy'])} енергії + {int(reward['coins'])} монет"


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
