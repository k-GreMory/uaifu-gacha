import asyncio
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DB_PATH = Path(tempfile.gettempdir()) / "uaifu_security_flow_test.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["BOT_TOKEN"] = "123456:TEST_BOT_TOKEN"
os.environ["ALLOW_DEV_AUTH"] = "true"
os.environ["TELEGRAM_AUTH_MAX_AGE_SECONDS"] = "86400"

sys.path.insert(0, str(BACKEND_DIR))

import bootstrap
import game_balance
import main
import models
import season_catalog
from database import SessionLocal


class ManagedContentFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        main.ensure_bootstrap()

    def setUp(self):
        self.restore_default_managed_content()

    def tearDown(self):
        self.restore_default_managed_content()

    def restore_default_managed_content(self):
        with SessionLocal() as db:
            db.query(models.UserSeasonProgress).delete()
            db.query(models.SeasonTask).delete()
            db.query(models.Season).delete()
            db.query(models.SeasonTemplateTask).delete()
            db.query(models.SeasonTemplate).delete()
            db.query(models.GameBalanceConfig).delete()
            db.commit()

        bootstrap.seed_managed_content()

    def run_async(self, coroutine):
        return asyncio.run(coroutine)

    def create_user(self, user_id: int, **overrides):
        with SessionLocal() as db:
            user = main.get_or_create_user(db, user_id, first_name=overrides.pop("first_name", "Tester"))
            for field, value in overrides.items():
                setattr(user, field, value)
            db.commit()

    def get_card(self, rarity: str):
        with SessionLocal() as db:
            card = db.query(models.Card).filter(models.Card.rarity == rarity).first()
            self.assertIsNotNone(card)
            return card

    def test_seed_managed_content_populates_balance_and_template_tables(self):
        with SessionLocal() as db:
            balance_count = db.query(models.GameBalanceConfig).count()
            template_count = db.query(models.SeasonTemplate).count()
            task_count = db.query(models.SeasonTemplateTask).count()

        self.assertEqual(balance_count, 1)
        self.assertEqual(template_count, 1)
        self.assertGreater(task_count, 0)

    def test_active_balance_config_from_db_overrides_premium_spin_cost(self):
        user_id = 91001
        custom_cost = 7777
        self.create_user(user_id, coins=8000, total_spins=2)
        card = self.get_card("Epic")

        with SessionLocal() as db:
            base_config = game_balance.get_balance_config()
            db.query(models.GameBalanceConfig).update({models.GameBalanceConfig.is_active: False})
            db.add(models.GameBalanceConfig(
                **game_balance.get_balance_record_kwargs(
                    {
                        **base_config,
                        "pricing": {
                            **base_config["pricing"],
                            "premium_spin_cost": custom_cost,
                        },
                    },
                    name="Admin Override",
                )
            ))
            db.commit()

            user = db.query(models.User).filter(models.User.id == user_id).first()
            with patch("services.gameplay_service.resolve_premium_rarity", return_value="Epic"), patch(
                "services.gameplay_service.draw_card_for_rarity",
                return_value=card,
            ):
                payload = self.run_async(main.premium_spin(current_user=user, db=db))
            purchase_log = (
                db.query(models.PurchaseLog)
                .filter(models.PurchaseLog.user_id == user_id, models.PurchaseLog.item == "premium_spin")
                .first()
            )

        self.assertEqual(payload["user_stats"]["coins"], 8000 - custom_cost)
        self.assertIsNotNone(purchase_log)
        self.assertEqual(purchase_log.cost, custom_cost)

    def test_balance_config_falls_back_to_json_when_admin_table_is_empty(self):
        with SessionLocal() as db:
            db.query(models.GameBalanceConfig).delete()
            db.commit()

            config = game_balance.get_balance_config(db)

        self.assertEqual(
            config["pricing"]["premium_spin_cost"],
            game_balance.DEFAULT_BALANCE_CONFIG["pricing"]["premium_spin_cost"],
        )
        self.assertEqual(
            config["referral_rewards"]["referrer"]["coins"],
            game_balance.DEFAULT_BALANCE_CONFIG["referral_rewards"]["referrer"]["coins"],
        )

    def test_active_season_template_from_db_creates_runtime_season(self):
        with SessionLocal() as db:
            db.query(models.SeasonTemplateTask).delete()
            db.query(models.SeasonTemplate).delete()
            db.commit()

            template = models.SeasonTemplate(
                code="summer-admin",
                name="Сезон Admin Summer",
                duration_days=14,
                is_active=True,
            )
            db.add(template)
            db.flush()
            db.add_all([
                models.SeasonTemplateTask(
                    template_id=template.id,
                    sort_order=1,
                    title="Admin spins",
                    task_type="spins",
                    target=3,
                    reward_coins=333,
                    reward_energy=1,
                ),
                models.SeasonTemplateTask(
                    template_id=template.id,
                    sort_order=2,
                    title="Admin premium",
                    task_type="premium_spins",
                    target=1,
                    reward_coins=444,
                    reward_energy=2,
                ),
            ])
            db.commit()

            season = main.ensure_season_exists(db)
            season_name = season.name
            task_titles = {task.title for task in season.tasks}

        self.assertEqual(season_name, "Сезон Admin Summer")
        self.assertEqual(len(task_titles), 2)
        self.assertEqual(task_titles, {"Admin spins", "Admin premium"})

    def test_season_creation_falls_back_to_json_seed_when_no_admin_template_exists(self):
        with SessionLocal() as db:
            db.query(models.SeasonTemplateTask).delete()
            db.query(models.SeasonTemplate).delete()
            db.commit()

            season = main.ensure_season_exists(db)
            season_name = season.name
            task_count = len(season.tasks)

        self.assertEqual(season_name, season_catalog.DEFAULT_SEASON_NAME)
        self.assertEqual(task_count, len(season_catalog.DEFAULT_SEASON_TASKS))


if __name__ == "__main__":
    unittest.main()
