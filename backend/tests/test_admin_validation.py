import asyncio
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DB_PATH = Path(tempfile.gettempdir()) / "uaifu_admin_validation_test.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["BOT_TOKEN"] = "123456:TEST_BOT_TOKEN"
os.environ["ALLOW_DEV_AUTH"] = "true"
os.environ["TELEGRAM_AUTH_MAX_AGE_SECONDS"] = "86400"

sys.path.insert(0, str(BACKEND_DIR))

import datetime

from wtforms import Form, IntegerField, StringField, DateTimeField

import admin_panel
import bootstrap
import models
from database import SessionLocal, engine


def _build_form(form_args: dict, field_specs: dict, data: dict) -> Form:
    """Build a WTForm at runtime so we can exercise validators in isolation."""

    class _DynamicForm(Form):
        pass

    for name, field_factory in field_specs.items():
        args = dict(form_args.get(name, {}))
        validators = args.pop("validators", None)
        setattr(
            _DynamicForm,
            name,
            field_factory(validators=validators) if validators else field_factory(),
        )

    return _DynamicForm(data=data)


class GameBalanceConfigAdminValidationTests(unittest.TestCase):
    FIELD_SPECS = {
        "name": StringField,
        "daily_reward_base_coins": IntegerField,
        "daily_reward_energy_bonus": IntegerField,
        "daily_reward_max_coins": IntegerField,
        "daily_reward_streak_step_coins": IntegerField,
        "drone_score_per_coin": IntegerField,
        "energy_purchase_amount": IntegerField,
        "energy_purchase_cost": IntegerField,
        "premium_spin_cost": IntegerField,
        "pity_threshold": IntegerField,
        "premium_rare_chance": IntegerField,
        "premium_epic_chance": IntegerField,
        "premium_legendary_chance": IntegerField,
        "premium_mythic_chance": IntegerField,
        "pity_legendary_chance": IntegerField,
        "pity_mythic_chance": IntegerField,
        "referrer_reward_coins": IntegerField,
        "referrer_reward_energy": IntegerField,
        "new_user_reward_coins": IntegerField,
        "new_user_reward_energy": IntegerField,
        "standard_duplicate_common": IntegerField,
        "standard_duplicate_uncommon": IntegerField,
        "standard_duplicate_rare": IntegerField,
        "standard_duplicate_epic": IntegerField,
        "standard_duplicate_legendary": IntegerField,
        "standard_duplicate_mythic": IntegerField,
        "sell_duplicate_common": IntegerField,
        "sell_duplicate_uncommon": IntegerField,
        "sell_duplicate_rare": IntegerField,
        "sell_duplicate_epic": IntegerField,
        "sell_duplicate_legendary": IntegerField,
        "sell_duplicate_mythic": IntegerField,
    }

    def _valid_data(self) -> dict:
        return {
            "name": "Balance",
            "daily_reward_base_coins": 100,
            "daily_reward_energy_bonus": 5,
            "daily_reward_max_coins": 1000,
            "daily_reward_streak_step_coins": 50,
            "drone_score_per_coin": 5,
            "energy_purchase_amount": 1,
            "energy_purchase_cost": 1000,
            "premium_spin_cost": 10000,
            "pity_threshold": 50,
            "premium_rare_chance": 600,
            "premium_epic_chance": 300,
            "premium_legendary_chance": 90,
            "premium_mythic_chance": 10,
            "pity_legendary_chance": 90,
            "pity_mythic_chance": 10,
            "referrer_reward_coins": 500,
            "referrer_reward_energy": 5,
            "new_user_reward_coins": 200,
            "new_user_reward_energy": 3,
            "standard_duplicate_common": 10,
            "standard_duplicate_uncommon": 20,
            "standard_duplicate_rare": 50,
            "standard_duplicate_epic": 150,
            "standard_duplicate_legendary": 500,
            "standard_duplicate_mythic": 2000,
            "sell_duplicate_common": 20,
            "sell_duplicate_uncommon": 40,
            "sell_duplicate_rare": 100,
            "sell_duplicate_epic": 300,
            "sell_duplicate_legendary": 1000,
            "sell_duplicate_mythic": 4000,
        }

    def _form(self, data: dict) -> Form:
        return _build_form(
            admin_panel.GameBalanceConfigAdmin.form_args,
            self.FIELD_SPECS,
            data,
        )

    def test_valid_payload_passes_field_validation(self):
        form = self._form(self._valid_data())
        self.assertTrue(form.validate(), msg=f"unexpected errors: {form.errors}")

    def test_blank_name_is_rejected(self):
        data = self._valid_data()
        data["name"] = ""
        form = self._form(data)
        self.assertFalse(form.validate())
        self.assertIn("name", form.errors)

    def test_negative_rewards_are_rejected(self):
        data = self._valid_data()
        data["referrer_reward_coins"] = -1
        form = self._form(data)
        self.assertFalse(form.validate())
        self.assertIn("referrer_reward_coins", form.errors)

    def test_pity_threshold_must_be_positive(self):
        data = self._valid_data()
        data["pity_threshold"] = 0
        form = self._form(data)
        self.assertFalse(form.validate())
        self.assertIn("pity_threshold", form.errors)

    def test_energy_purchase_amount_must_be_positive(self):
        data = self._valid_data()
        data["energy_purchase_amount"] = 0
        form = self._form(data)
        self.assertFalse(form.validate())
        self.assertIn("energy_purchase_amount", form.errors)

    def test_on_model_change_rejects_zero_premium_chance_total(self):
        admin = admin_panel.GameBalanceConfigAdmin()
        data = {
            "premium_rare_chance": 0,
            "premium_epic_chance": 0,
            "premium_legendary_chance": 0,
            "premium_mythic_chance": 0,
            "pity_legendary_chance": 90,
            "pity_mythic_chance": 10,
        }
        with self.assertRaises(ValueError):
            asyncio.run(
                admin.on_model_change(
                    data, MagicMock(), is_created=True, request=MagicMock()
                )
            )

    def test_on_model_change_rejects_zero_pity_chance_total(self):
        admin = admin_panel.GameBalanceConfigAdmin()
        data = {
            "premium_rare_chance": 600,
            "premium_epic_chance": 300,
            "premium_legendary_chance": 90,
            "premium_mythic_chance": 10,
            "pity_legendary_chance": 0,
            "pity_mythic_chance": 0,
        }
        with self.assertRaises(ValueError):
            asyncio.run(
                admin.on_model_change(
                    data, MagicMock(), is_created=True, request=MagicMock()
                )
            )

    def test_on_model_change_accepts_valid_totals(self):
        admin = admin_panel.GameBalanceConfigAdmin()
        data = {
            "premium_rare_chance": 600,
            "premium_epic_chance": 300,
            "premium_legendary_chance": 90,
            "premium_mythic_chance": 10,
            "pity_legendary_chance": 90,
            "pity_mythic_chance": 10,
        }
        asyncio.run(
            admin.on_model_change(
                data, MagicMock(), is_created=True, request=MagicMock()
            )
        )


class SeasonTemplateAdminValidationTests(unittest.TestCase):
    FIELD_SPECS = {
        "code": StringField,
        "name": StringField,
        "duration_days": IntegerField,
    }

    @classmethod
    def setUpClass(cls):
        import main

        main.ensure_bootstrap()

    def setUp(self):
        with SessionLocal() as db:
            db.query(models.SeasonTemplateTask).delete()
            db.query(models.SeasonTemplate).delete()
            db.commit()
        bootstrap.seed_managed_content()

    def tearDown(self):
        self.setUp()

    def _form(self, data: dict) -> Form:
        return _build_form(
            admin_panel.SeasonTemplateAdmin.form_args,
            self.FIELD_SPECS,
            data,
        )

    def test_blank_code_is_rejected(self):
        form = self._form({"code": "", "name": "Season", "duration_days": 30})
        self.assertFalse(form.validate())
        self.assertIn("code", form.errors)

    def test_duration_days_must_be_positive(self):
        form = self._form({"code": "s1", "name": "Season", "duration_days": 0})
        self.assertFalse(form.validate())
        self.assertIn("duration_days", form.errors)

    def test_duplicate_code_rejected_on_create(self):
        admin = admin_panel.SeasonTemplateAdmin()
        admin.session_maker = SessionLocal

        with SessionLocal() as db:
            existing = db.query(models.SeasonTemplate).first()
            self.assertIsNotNone(existing)
            taken_code = existing.code

        with self.assertRaises(ValueError):
            asyncio.run(
                admin.on_model_change(
                    {"code": taken_code, "name": "Dup", "duration_days": 10},
                    MagicMock(id=None),
                    is_created=True,
                    request=MagicMock(),
                )
            )

    def test_same_record_can_keep_its_code_on_update(self):
        admin = admin_panel.SeasonTemplateAdmin()
        admin.session_maker = SessionLocal

        with SessionLocal() as db:
            existing = db.query(models.SeasonTemplate).first()
            pk = existing.id
            code = existing.code

        asyncio.run(
            admin.on_model_change(
                {"code": code, "name": "Updated", "duration_days": 14},
                MagicMock(id=pk),
                is_created=False,
                request=MagicMock(),
            )
        )


class SeasonTemplateTaskAdminValidationTests(unittest.TestCase):
    FIELD_SPECS = {
        "title": StringField,
        "task_type": StringField,
        "target": IntegerField,
        "reward_coins": IntegerField,
        "reward_energy": IntegerField,
        "sort_order": IntegerField,
    }

    def _valid_data(self) -> dict:
        return {
            "title": "Do 10 spins",
            "task_type": "spins",
            "target": 10,
            "reward_coins": 100,
            "reward_energy": 1,
            "sort_order": 1,
        }

    def _form(self, data: dict) -> Form:
        return _build_form(
            admin_panel.SeasonTemplateTaskAdmin.form_args,
            self.FIELD_SPECS,
            data,
        )

    def test_valid_payload_passes(self):
        form = self._form(self._valid_data())
        self.assertTrue(form.validate(), msg=f"unexpected errors: {form.errors}")

    def test_unknown_task_type_rejected(self):
        data = self._valid_data()
        data["task_type"] = "totally_fake"
        form = self._form(data)
        self.assertFalse(form.validate())
        self.assertIn("task_type", form.errors)

    def test_empty_title_rejected(self):
        data = self._valid_data()
        data["title"] = ""
        form = self._form(data)
        self.assertFalse(form.validate())
        self.assertIn("title", form.errors)

    def test_zero_target_rejected(self):
        data = self._valid_data()
        data["target"] = 0
        form = self._form(data)
        self.assertFalse(form.validate())
        self.assertIn("target", form.errors)

    def test_negative_rewards_rejected(self):
        data = self._valid_data()
        data["reward_coins"] = -5
        form = self._form(data)
        self.assertFalse(form.validate())
        self.assertIn("reward_coins", form.errors)


class SeasonAdminValidationTests(unittest.TestCase):
    FIELD_SPECS = {
        "name": StringField,
        "start_date": DateTimeField,
        "end_date": DateTimeField,
    }

    def _form(self, data: dict) -> Form:
        return _build_form(
            admin_panel.SeasonAdmin.form_args,
            self.FIELD_SPECS,
            data,
        )

    def test_empty_name_rejected(self):
        now = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        form = self._form({"name": "", "start_date": now, "end_date": now + datetime.timedelta(days=30)})
        self.assertFalse(form.validate())
        self.assertIn("name", form.errors)

    def test_on_model_change_rejects_end_before_start(self):
        admin = admin_panel.SeasonAdmin()
        start = datetime.datetime(2026, 1, 10)
        end = datetime.datetime(2026, 1, 1)
        with self.assertRaises(ValueError):
            asyncio.run(
                admin.on_model_change(
                    {"name": "Bad", "start_date": start, "end_date": end},
                    MagicMock(),
                    is_created=True,
                    request=MagicMock(),
                )
            )

    def test_on_model_change_rejects_end_equal_to_start(self):
        admin = admin_panel.SeasonAdmin()
        moment = datetime.datetime(2026, 1, 1)
        with self.assertRaises(ValueError):
            asyncio.run(
                admin.on_model_change(
                    {"name": "Edge", "start_date": moment, "end_date": moment},
                    MagicMock(),
                    is_created=True,
                    request=MagicMock(),
                )
            )

    def test_on_model_change_accepts_end_after_start(self):
        admin = admin_panel.SeasonAdmin()
        start = datetime.datetime(2026, 1, 1)
        end = datetime.datetime(2026, 1, 31)
        asyncio.run(
            admin.on_model_change(
                {"name": "Good", "start_date": start, "end_date": end},
                MagicMock(),
                is_created=True,
                request=MagicMock(),
            )
        )


class SeasonTaskAdminValidationTests(unittest.TestCase):
    FIELD_SPECS = {
        "title": StringField,
        "task_type": StringField,
        "target": IntegerField,
        "reward_coins": IntegerField,
        "reward_energy": IntegerField,
    }

    def _form(self, data: dict) -> Form:
        return _build_form(
            admin_panel.SeasonTaskAdmin.form_args,
            self.FIELD_SPECS,
            data,
        )

    def test_valid_payload_passes(self):
        form = self._form(
            {
                "title": "Win 3 matches",
                "task_type": "unique_cards",
                "target": 3,
                "reward_coins": 100,
                "reward_energy": 1,
            }
        )
        self.assertTrue(form.validate(), msg=f"unexpected errors: {form.errors}")

    def test_unknown_task_type_rejected(self):
        form = self._form(
            {
                "title": "Win 3 matches",
                "task_type": "collect_stars",
                "target": 3,
                "reward_coins": 100,
                "reward_energy": 1,
            }
        )
        self.assertFalse(form.validate())
        self.assertIn("task_type", form.errors)

    def test_target_must_be_positive(self):
        form = self._form(
            {
                "title": "Win matches",
                "task_type": "spins",
                "target": 0,
                "reward_coins": 100,
                "reward_energy": 1,
            }
        )
        self.assertFalse(form.validate())
        self.assertIn("target", form.errors)


if __name__ == "__main__":
    unittest.main()
