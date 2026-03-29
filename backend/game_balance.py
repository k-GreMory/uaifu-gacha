STANDARD_DUPLICATE_REWARDS = {
    "Common": 10,
    "UnCommon": 20,
    "Rare": 50,
    "Epic": 150,
    "Legendary": 500,
    "Mythic": 2000,
}

SELL_DUPLICATE_REWARDS = {
    "Common": 20,
    "UnCommon": 40,
    "Rare": 100,
    "Epic": 300,
    "Legendary": 1000,
    "Mythic": 4000,
}

PREMIUM_RARITY_CHANCES = {
    "Rare": 600,
    "Epic": 300,
    "Legendary": 90,
    "Mythic": 10,
}

PITY_RARITY_CHANCES = {
    "Legendary": 90,
    "Mythic": 10,
}

PITY_THRESHOLD = 50
PREMIUM_SPIN_COST = 10000
ENERGY_PURCHASE_COST = 1000
ENERGY_PURCHASE_AMOUNT = 1

DAILY_REWARD_BASE_COINS = 200
DAILY_REWARD_STREAK_STEP_COINS = 50
DAILY_REWARD_MAX_COINS = 1000
DAILY_REWARD_ENERGY_BONUS = 5

REFERRAL_REFERRER_ENERGY = 5
REFERRAL_REFERRER_COINS = 500
REFERRAL_NEW_USER_ENERGY = 3
REFERRAL_NEW_USER_COINS = 200
DRONE_SCORE_PER_COIN = 5


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
