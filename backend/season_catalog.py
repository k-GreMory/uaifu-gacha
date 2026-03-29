from datetime import timedelta

DEFAULT_SEASON_NAME = "Сезон 1: Весна Вайфу 🌸"
DEFAULT_SEASON_DURATION_DAYS = 30

DEFAULT_SEASON_TASKS = [
    {
        "title": "Перший спін",
        "task_type": "spins",
        "target": 1,
        "reward_coins": 100,
        "reward_energy": 0,
    },
    {
        "title": "Зроби 10 спінів",
        "task_type": "spins",
        "target": 10,
        "reward_coins": 500,
        "reward_energy": 2,
    },
    {
        "title": "Зроби 50 спінів",
        "task_type": "spins",
        "target": 50,
        "reward_coins": 2000,
        "reward_energy": 5,
    },
    {
        "title": "Зроби 100 спінів",
        "task_type": "spins",
        "target": 100,
        "reward_coins": 5000,
        "reward_energy": 10,
    },
    {
        "title": "Зберіть 5 унікальних карток",
        "task_type": "unique_cards",
        "target": 5,
        "reward_coins": 300,
        "reward_energy": 1,
    },
    {
        "title": "Зберіть 25 унікальних карток",
        "task_type": "unique_cards",
        "target": 25,
        "reward_coins": 1500,
        "reward_energy": 3,
    },
    {
        "title": "Зберіть 50 унікальних карток",
        "task_type": "unique_cards",
        "target": 50,
        "reward_coins": 3000,
        "reward_energy": 5,
    },
    {
        "title": "Зробіть 1 преміум спін",
        "task_type": "premium_spins",
        "target": 1,
        "reward_coins": 1000,
        "reward_energy": 2,
    },
]


def get_default_season_seed(now):
    return {
        "name": DEFAULT_SEASON_NAME,
        "start_date": now,
        "end_date": now + timedelta(days=DEFAULT_SEASON_DURATION_DAYS),
        "is_active": True,
        "tasks": [dict(task) for task in DEFAULT_SEASON_TASKS],
    }
