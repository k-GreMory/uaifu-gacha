import json
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import game_balance
import season_catalog


class ContentCatalogTests(unittest.TestCase):
    def test_balance_loader_uses_json_override_values(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "balance.json"
            path.write_text(json.dumps({
                "pricing": {"premium_spin_cost": 7777},
                "referral_rewards": {"referrer": {"coins": 999}},
            }), encoding="utf-8")

            payload = game_balance.load_balance_config(path)

        self.assertEqual(payload["pricing"]["premium_spin_cost"], 7777)
        self.assertEqual(payload["referral_rewards"]["referrer"]["coins"], 999)
        self.assertEqual(payload["pricing"]["energy_purchase_cost"], game_balance.DEFAULT_BALANCE_CONFIG["pricing"]["energy_purchase_cost"])

    def test_balance_loader_falls_back_on_invalid_json(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "broken_balance.json"
            path.write_text("{broken", encoding="utf-8")

            payload = game_balance.load_balance_config(path)

        self.assertEqual(payload, game_balance.DEFAULT_BALANCE_CONFIG)

    def test_default_season_loader_uses_json_override_values(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "season.json"
            path.write_text(json.dumps({
                "name": "Сезон 99: Тест",
                "duration_days": 14,
                "tasks": [
                    {
                        "title": "Test task",
                        "task_type": "spins",
                        "target": 3,
                        "reward_coins": 123,
                        "reward_energy": 4,
                    }
                ],
            }, ensure_ascii=False), encoding="utf-8")

            payload = season_catalog.load_default_season_template(path)
            seed = season_catalog.get_default_season_seed(datetime(2026, 3, 29), template=payload)

        self.assertEqual(payload["name"], "Сезон 99: Тест")
        self.assertEqual(payload["duration_days"], 14)
        self.assertEqual(len(payload["tasks"]), 1)
        self.assertEqual(seed["tasks"][0]["reward_coins"], 123)
        self.assertEqual((seed["end_date"] - seed["start_date"]).days, 14)

    def test_default_season_loader_falls_back_on_invalid_tasks(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "broken_season.json"
            path.write_text(json.dumps({"tasks": {"bad": True}}), encoding="utf-8")

            payload = season_catalog.load_default_season_template(path)

        self.assertEqual(payload, season_catalog.DEFAULT_SEASON_TEMPLATE)


if __name__ == "__main__":
    unittest.main()
