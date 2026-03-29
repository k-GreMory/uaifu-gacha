import asyncio
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DB_PATH = Path(tempfile.gettempdir()) / "uaifu_security_flow_test.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["BOT_TOKEN"] = "123456:TEST_BOT_TOKEN"
os.environ["ALLOW_DEV_AUTH"] = "true"
os.environ["TELEGRAM_AUTH_MAX_AGE_SECONDS"] = "86400"

sys.path.insert(0, str(BACKEND_DIR))

import main
import models
from database import SessionLocal
from game_balance import (
    DAILY_REWARD_BASE_COINS,
    DAILY_REWARD_ENERGY_BONUS,
    DAILY_REWARD_STREAK_STEP_COINS,
    ENERGY_PURCHASE_COST,
    PREMIUM_SPIN_COST,
    PITY_THRESHOLD,
)
from routers.gameplay import SellDuplicateRequest
from services.gameplay_service import SELL_DUPLICATE_REWARDS
from user_service import utcnow_naive


class GameplayFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        main.ensure_bootstrap()

    def setUp(self):
        with SessionLocal() as db:
            db.query(models.DroneGameSession).delete()
            db.query(models.UserSeasonProgress).delete()
            db.query(models.SeasonTask).delete()
            db.query(models.Season).delete()
            db.query(models.Referral).delete()
            db.query(models.PurchaseLog).delete()
            db.query(models.SpinLog).delete()
            db.query(models.UserCard).delete()
            db.query(models.User).delete()
            db.commit()

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

    def run_async(self, coroutine):
        return asyncio.run(coroutine)

    def get_route_endpoint(self, path: str):
        for route in main.app.routes:
            if getattr(route, "path", None) == path:
                return route.endpoint
        self.fail(f"Route not found: {path}")

    def test_health_endpoints_report_runtime_state(self):
        health = self.run_async(self.get_route_endpoint("/health")())
        version = self.run_async(self.get_route_endpoint("/health/version")())

        self.assertEqual(health["status"], "ok")
        self.assertTrue(health["bootstrapped"])
        self.assertEqual(version["status"], "ok")
        self.assertEqual(version["version"], main.app.state.app_version)
        self.assertEqual(version["version_short"], main.app.state.app_version_short)
        self.assertIn(version["environment"], {"local", "non_local"})

    def test_spin_consumes_energy_tracks_progress_and_resets_pity_for_legendary(self):
        user_id = 70001
        self.create_user(user_id, energy=3, coins=100, pity_counter=PITY_THRESHOLD - 1, total_spins=0)
        card = self.get_card("Legendary")

        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            with patch("services.gameplay_service.resolve_standard_rarity", return_value="Legendary"), patch(
                "services.gameplay_service.draw_card_for_rarity",
                return_value=card,
            ):
                payload = self.run_async(main.spin(current_user=user, db=db))
            owned_card = (
                db.query(models.UserCard)
                .filter(models.UserCard.user_id == user_id, models.UserCard.card_id == card.id)
                .first()
            )
            spin_log = db.query(models.SpinLog).filter(models.SpinLog.user_id == user_id).all()
            total_spins = user.total_spins
            energy = user.energy
            pity_counter = user.pity_counter
            has_owned_card = owned_card is not None
            spin_log_count = len(spin_log)

        self.assertEqual(payload["card_id"], card.id)
        self.assertTrue(payload["is_new"])
        self.assertEqual(payload["user_stats"]["energy"], 2)
        self.assertEqual(payload["user_stats"]["pity_counter"], 0)
        self.assertEqual(total_spins, 1)
        self.assertEqual(energy, 2)
        self.assertEqual(pity_counter, 0)
        self.assertTrue(has_owned_card)
        self.assertEqual(spin_log_count, 1)

    def test_spin_from_full_energy_restarts_regen_from_now(self):
        user_id = 70009
        old_timestamp = utcnow_naive() - timedelta(hours=2)
        self.create_user(user_id, energy=20, max_energy=20, last_energy_update=old_timestamp)
        card = self.get_card("Rare")

        before_spin = utcnow_naive() - timedelta(seconds=2)
        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            with patch("services.gameplay_service.resolve_standard_rarity", return_value="Rare"), patch(
                "services.gameplay_service.draw_card_for_rarity",
                return_value=card,
            ):
                payload = self.run_async(main.spin(current_user=user, db=db))
            last_energy_update = user.last_energy_update

        self.assertGreaterEqual(payload["user_stats"]["next_energy_in_seconds"], 590)
        self.assertLessEqual(payload["user_stats"]["next_energy_in_seconds"], 600)
        self.assertGreaterEqual(last_energy_update, before_spin)

    def test_premium_spin_spends_coins_and_creates_purchase_log(self):
        user_id = 70002
        self.create_user(user_id, energy=7, coins=PREMIUM_SPIN_COST + 2000, total_spins=4)
        card = self.get_card("Epic")

        with SessionLocal() as db:
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
            coins = user.coins
            total_spins = user.total_spins
            energy = user.energy
            purchase_cost = purchase_log.cost if purchase_log else None

        self.assertEqual(payload["card_id"], card.id)
        self.assertEqual(payload["user_stats"]["coins"], 2000)
        self.assertEqual(payload["user_stats"]["energy"], 7)
        self.assertEqual(coins, 2000)
        self.assertEqual(total_spins, 5)
        self.assertEqual(energy, 7)
        self.assertEqual(purchase_cost, PREMIUM_SPIN_COST)

    def test_buy_energy_spends_coins_and_caps_at_max(self):
        user_id = 70003
        self.create_user(user_id, energy=19, max_energy=20, coins=ENERGY_PURCHASE_COST + 500)

        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            payload = self.run_async(main.buy_energy(current_user=user, db=db))
            purchase_log = (
                db.query(models.PurchaseLog)
                .filter(models.PurchaseLog.user_id == user_id, models.PurchaseLog.item == "energy")
                .first()
            )
            energy = user.energy
            coins = user.coins
            purchase_cost = purchase_log.cost if purchase_log else None

        self.assertTrue(payload["success"])
        self.assertEqual(payload["user_stats"]["energy"], 20)
        self.assertEqual(payload["user_stats"]["coins"], 500)
        self.assertEqual(energy, 20)
        self.assertEqual(coins, 500)
        self.assertEqual(purchase_cost, ENERGY_PURCHASE_COST)

    def test_buy_energy_rejects_full_energy_without_spending(self):
        user_id = 70004
        self.create_user(user_id, energy=20, max_energy=20, coins=ENERGY_PURCHASE_COST + 500)

        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            with self.assertRaises(HTTPException) as error:
                self.run_async(main.buy_energy(current_user=user, db=db))
            purchase_count = db.query(models.PurchaseLog).filter(models.PurchaseLog.user_id == user_id).count()
            coins = user.coins

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "Енергія вже повна! Спочатку витрать хоча б 1 ⚡")
        self.assertEqual(coins, ENERGY_PURCHASE_COST + 500)
        self.assertEqual(purchase_count, 0)

    def test_claim_daily_awards_streak_bonus_once_per_day(self):
        user_id = 70005
        self.create_user(user_id, energy=17, max_energy=20, coins=100, last_login_date=None, login_streak=0)

        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            payload = self.run_async(main.claim_daily(current_user=user, db=db))
            with self.assertRaises(HTTPException) as second_claim:
                self.run_async(main.claim_daily(current_user=user, db=db))

        self.assertTrue(payload["success"])
        self.assertEqual(payload["user_stats"]["coins"], 100 + DAILY_REWARD_BASE_COINS + DAILY_REWARD_STREAK_STEP_COINS)
        self.assertEqual(payload["user_stats"]["energy"], 20)
        self.assertEqual(payload["user_stats"]["login_streak"], 1)
        self.assertFalse(payload["user_stats"]["can_claim_daily"])
        self.assertEqual(second_claim.exception.status_code, 400)
        self.assertEqual(second_claim.exception.detail, "Бонус вже отримано сьогодні!")

    def test_sell_duplicate_reduces_duplicate_count_and_adds_coins(self):
        user_id = 70006
        self.create_user(user_id, coins=300)
        card = self.get_card("Rare")
        sell_price = SELL_DUPLICATE_REWARDS[card.rarity]

        with SessionLocal() as db:
            db.add(models.UserCard(user_id=user_id, card_id=card.id, duplicates=2))
            db.commit()

        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            payload = self.run_async(
                main.sell_duplicate(
                    data=SellDuplicateRequest(card_id=card.id),
                    current_user=user,
                    db=db,
                )
            )
            user_card = (
                db.query(models.UserCard)
                .filter(models.UserCard.user_id == user_id, models.UserCard.card_id == card.id)
                .first()
            )
            coins = user.coins
            duplicates = user_card.duplicates if user_card else None

        self.assertTrue(payload["success"])
        self.assertEqual(payload["user_stats"]["coins"], 300 + sell_price)
        self.assertEqual(coins, 300 + sell_price)
        self.assertEqual(duplicates, 1)

    def test_sell_duplicate_rejects_when_user_has_no_extra_copy(self):
        user_id = 70007
        self.create_user(user_id, coins=300)
        card = self.get_card("Rare")

        with SessionLocal() as db:
            db.add(models.UserCard(user_id=user_id, card_id=card.id, duplicates=0))
            db.commit()

        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            with self.assertRaises(HTTPException) as error:
                self.run_async(
                    main.sell_duplicate(
                        data=SellDuplicateRequest(card_id=card.id),
                        current_user=user,
                        db=db,
                    )
                )

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "Немає дублікатів для продажу!")

    def test_daily_claim_preserves_consecutive_streak_from_yesterday(self):
        user_id = 70008
        yesterday = datetime.now() - timedelta(days=1)
        self.create_user(user_id, energy=10, max_energy=20, coins=0, last_login_date=yesterday, login_streak=3)

        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            payload = self.run_async(main.claim_daily(current_user=user, db=db))

        self.assertEqual(payload["user_stats"]["login_streak"], 4)
        self.assertEqual(payload["user_stats"]["coins"], DAILY_REWARD_BASE_COINS + (4 * DAILY_REWARD_STREAK_STEP_COINS))
        self.assertEqual(payload["user_stats"]["energy"], 10 + DAILY_REWARD_ENERGY_BONUS)


if __name__ == "__main__":
    unittest.main()
