import asyncio
import os
import sys
import tempfile
import unittest
from datetime import datetime
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
    REFERRAL_NEW_USER_COINS,
    REFERRAL_NEW_USER_ENERGY,
    REFERRAL_REFERRER_COINS,
    REFERRAL_REFERRER_ENERGY,
    get_referral_reward_description,
)
from season_catalog import DEFAULT_SEASON_NAME, DEFAULT_SEASON_TASKS


def utcnow_naive():
    return datetime.now()


class ReferralSeasonFlowTests(unittest.TestCase):
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

    def run_async(self, coroutine):
        return asyncio.run(coroutine)

    def create_user(self, user_id: int, **overrides):
        with SessionLocal() as db:
            user = main.get_or_create_user(db, user_id, first_name=overrides.pop("first_name", "Tester"))
            for field, value in overrides.items():
                setattr(user, field, value)
            db.commit()

    def test_referral_link_uses_bot_name_and_counts_referrals(self):
        with SessionLocal() as db, patch.dict(os.environ, {"BOT_NAME": "uaifu_test_bot"}, clear=False):
            referrer = main.get_or_create_user(db, 80001, first_name="Referrer")
            db.add(models.Referral(referrer_id=referrer.id, invited_id=80002, rewarded=True))
            db.add(models.Referral(referrer_id=referrer.id, invited_id=80003, rewarded=True))
            db.commit()

            payload = self.run_async(main.get_referral_link(current_user=referrer, db=db))

        self.assertEqual(payload["link"], "https://t.me/uaifu_test_bot?start=ref_80001")
        self.assertEqual(payload["ref_count"], 2)
        self.assertEqual(payload["reward_per_ref"], get_referral_reward_description())

    def test_referral_self_invite_is_rejected(self):
        with SessionLocal() as db:
            user = main.get_or_create_user(db, 80011, first_name="Solo")

            with self.assertRaises(HTTPException) as claim_error:
                self.run_async(
                    main.claim_referral(
                        ref_id=user.id,
                        current_user=user,
                        db=db,
                    )
                )

        self.assertEqual(claim_error.exception.status_code, 400)
        self.assertEqual(claim_error.exception.detail, "Не можна запросити самого себе 🙃")

    def test_successful_referral_updates_both_users_and_blocks_second_claim(self):
        with SessionLocal() as db:
            referrer = main.get_or_create_user(db, 80021, first_name="Referrer")
            invited = main.get_or_create_user(db, 80022, first_name="Newbie")
            referrer.energy = 20 - REFERRAL_REFERRER_ENERGY + 3
            referrer.coins = 100
            invited.energy = 20 - REFERRAL_NEW_USER_ENERGY + 2
            invited.coins = 25
            db.commit()

            response = self.run_async(
                main.claim_referral(
                    ref_id=referrer.id,
                    current_user=invited,
                    db=db,
                )
            )
            referral = db.query(models.Referral).filter(models.Referral.invited_id == invited.id).first()
            referrer_energy = referrer.energy
            referrer_coins = referrer.coins
            invited_energy = invited.energy
            invited_coins = invited.coins
            invited_referred_by = invited.referred_by

            with self.assertRaises(HTTPException) as second_claim:
                self.run_async(
                    main.claim_referral(
                        ref_id=referrer.id,
                        current_user=invited,
                        db=db,
                    )
                )

        self.assertTrue(response["success"])
        self.assertEqual(response["user_stats"]["coins"], 25 + REFERRAL_NEW_USER_COINS)
        self.assertEqual(response["user_stats"]["energy"], 20)
        self.assertIsNotNone(referral)
        self.assertEqual(referrer_energy, 20)
        self.assertEqual(referrer_coins, 100 + REFERRAL_REFERRER_COINS)
        self.assertEqual(invited_energy, 20)
        self.assertEqual(invited_coins, 25 + REFERRAL_NEW_USER_COINS)
        self.assertEqual(invited_referred_by, 80021)
        self.assertEqual(second_claim.exception.status_code, 400)
        self.assertEqual(second_claim.exception.detail, "Реферал вже зареєстровано")

    def test_season_payload_reports_progress_and_claimed_tasks(self):
        with SessionLocal() as db:
            user = main.get_or_create_user(db, 80031, first_name="Seasoner")
            user.total_spins = 12
            db.commit()

            season = main.ensure_season_exists(db)
            self.assertEqual(season.name, DEFAULT_SEASON_NAME)
            self.assertEqual(len(season.tasks), len(DEFAULT_SEASON_TASKS))
            first_spin_task = next(task for task in season.tasks if task.target == 1 and task.task_type == "spins")
            premium_task = next(task for task in season.tasks if task.task_type == "premium_spins")
            db.add(
                models.UserSeasonProgress(
                    user_id=user.id,
                    task_id=first_spin_task.id,
                    progress=1,
                    claimed=True,
                    claimed_at=utcnow_naive(),
                )
            )
            db.commit()

            payload = self.run_async(main.get_season(current_user=user, db=db))

        self.assertTrue(payload["active"])
        self.assertGreater(len(payload["tasks"]), 0)

        first_spin_payload = next(task for task in payload["tasks"] if task["id"] == first_spin_task.id)
        ten_spin_payload = next(task for task in payload["tasks"] if task["task_type"] == "spins" and task["target"] == 10)
        premium_payload = next(task for task in payload["tasks"] if task["id"] == premium_task.id)

        self.assertTrue(first_spin_payload["claimed"])
        self.assertTrue(first_spin_payload["completed"])
        self.assertEqual(first_spin_payload["progress"], 1)
        self.assertTrue(ten_spin_payload["completed"])
        self.assertEqual(ten_spin_payload["progress"], 10)
        self.assertFalse(premium_payload["completed"])
        self.assertEqual(premium_payload["progress"], 0)

    def test_successful_season_claim_grants_rewards_and_blocks_reclaim(self):
        with SessionLocal() as db:
            user = main.get_or_create_user(db, 80041, first_name="Claimer")
            user.total_spins = 12
            user.coins = 100
            user.energy = 18
            db.commit()

            season = main.ensure_season_exists(db)
            task = next(task for task in season.tasks if task.task_type == "spins" and task.target == 10)

            response = self.run_async(
                main.claim_season_reward(
                    task_id=task.id,
                    current_user=user,
                    db=db,
                )
            )
            progress_row = (
                db.query(models.UserSeasonProgress)
                .filter(models.UserSeasonProgress.user_id == user.id, models.UserSeasonProgress.task_id == task.id)
                .first()
            )
            user_coins = user.coins
            user_energy = user.energy

            with self.assertRaises(HTTPException) as second_claim:
                self.run_async(
                    main.claim_season_reward(
                        task_id=task.id,
                        current_user=user,
                        db=db,
                    )
                )

        self.assertTrue(response["success"])
        self.assertEqual(response["user_stats"]["coins"], 100 + task.reward_coins)
        self.assertEqual(response["user_stats"]["energy"], 20)
        self.assertIsNotNone(progress_row)
        self.assertTrue(progress_row.claimed)
        self.assertEqual(user_coins, 100 + task.reward_coins)
        self.assertEqual(user_energy, 20)
        self.assertEqual(second_claim.exception.status_code, 400)
        self.assertEqual(second_claim.exception.detail, "Нагорода вже отримана!")

    def test_incomplete_season_task_cannot_be_claimed(self):
        with SessionLocal() as db:
            user = main.get_or_create_user(db, 80051, first_name="Incomplete")
            user.total_spins = 3
            db.commit()

            season = main.ensure_season_exists(db)
            task = next(task for task in season.tasks if task.task_type == "spins" and task.target == 10)

            with self.assertRaises(HTTPException) as claim_error:
                self.run_async(
                    main.claim_season_reward(
                        task_id=task.id,
                        current_user=user,
                        db=db,
                    )
                )

        self.assertEqual(claim_error.exception.status_code, 400)
        self.assertEqual(claim_error.exception.detail, "Задача ще не виконана (3/10)")


if __name__ == "__main__":
    unittest.main()
