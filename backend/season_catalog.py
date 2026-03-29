import copy
import json
import os
from datetime import timedelta
from pathlib import Path

from sqlalchemy.orm import Session, selectinload

import models

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SEASON_FILE = BASE_DIR / "content" / "default_season.json"
DEFAULT_SEASON_CODE = "default-season"

DEFAULT_SEASON_TEMPLATE = {
    "code": DEFAULT_SEASON_CODE,
    "duration_days": 30,
    "is_active": True,
    "name": "Сезон 1: Весна Вайфу 🌸",
    "tasks": [
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
    ],
}


def _read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Season template at {path} must be a JSON object")
    return payload


def load_default_season_template(path: str | Path | None = None) -> dict:
    source = Path(path or os.getenv("DEFAULT_SEASON_FILE") or DEFAULT_SEASON_FILE)
    if not source.exists():
        return copy.deepcopy(DEFAULT_SEASON_TEMPLATE)

    try:
        payload = _read_json(source)
        template = copy.deepcopy(DEFAULT_SEASON_TEMPLATE)
        template.update({key: value for key, value in payload.items() if key != "tasks"})
        if "tasks" in payload:
            if not isinstance(payload["tasks"], list):
                raise ValueError("'tasks' must be a JSON array")
            template["tasks"] = payload["tasks"]
        return template
    except Exception as exc:
        print(f"[season_catalog] WARNING: failed to load {source}: {exc}")
        return copy.deepcopy(DEFAULT_SEASON_TEMPLATE)


def get_season_template_seed(template: dict | None = None) -> dict:
    source = copy.deepcopy(template or DEFAULT_SEASON_TEMPLATE_LOADED)
    tasks = []
    for index, task in enumerate(source["tasks"], start=1):
        tasks.append({
            "sort_order": int(task.get("sort_order") or index),
            "title": task["title"],
            "task_type": task["task_type"],
            "target": int(task["target"]),
            "reward_coins": int(task.get("reward_coins", 0)),
            "reward_energy": int(task.get("reward_energy", 0)),
        })
    return {
        "code": source.get("code") or DEFAULT_SEASON_CODE,
        "name": source["name"],
        "duration_days": int(source["duration_days"]),
        "is_active": bool(source.get("is_active", True)),
        "tasks": tasks,
    }


def _template_from_record(record: models.SeasonTemplate) -> dict:
    tasks = [
        {
            "sort_order": int(task.sort_order),
            "title": task.title,
            "task_type": task.task_type,
            "target": int(task.target),
            "reward_coins": int(task.reward_coins),
            "reward_energy": int(task.reward_energy),
        }
        for task in record.tasks
    ]
    return {
        "code": record.code,
        "name": record.name,
        "duration_days": int(record.duration_days),
        "is_active": bool(record.is_active),
        "tasks": tasks,
    }


def get_active_season_template_record(db: Session | None):
    if db is None:
        return None
    return (
        db.query(models.SeasonTemplate)
        .options(selectinload(models.SeasonTemplate.tasks))
        .filter(models.SeasonTemplate.is_active == True)
        .order_by(models.SeasonTemplate.updated_at.desc(), models.SeasonTemplate.id.desc())
        .first()
    )


def get_default_season_template(db: Session | None = None) -> dict:
    record = get_active_season_template_record(db)
    if record is not None:
        return _template_from_record(record)
    return copy.deepcopy(DEFAULT_SEASON_TEMPLATE_LOADED)


def get_default_season_seed(now, template: dict | None = None, db: Session | None = None):
    source = get_season_template_seed(template or get_default_season_template(db))
    return {
        "name": source["name"],
        "start_date": now,
        "end_date": now + timedelta(days=int(source["duration_days"])),
        "is_active": bool(source.get("is_active", True)),
        "tasks": [
            {
                "title": task["title"],
                "task_type": task["task_type"],
                "target": int(task["target"]),
                "reward_coins": int(task["reward_coins"]),
                "reward_energy": int(task["reward_energy"]),
            }
            for task in source["tasks"]
        ],
    }


DEFAULT_SEASON_TEMPLATE_LOADED = load_default_season_template()
DEFAULT_SEASON_NAME = DEFAULT_SEASON_TEMPLATE_LOADED["name"]
DEFAULT_SEASON_DURATION_DAYS = int(DEFAULT_SEASON_TEMPLATE_LOADED["duration_days"])
DEFAULT_SEASON_TASKS = DEFAULT_SEASON_TEMPLATE_LOADED["tasks"]
