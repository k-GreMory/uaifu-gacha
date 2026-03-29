import asyncio
import hashlib
import hmac
import json
import os
import sys
import tempfile
import time
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode

from fastapi import HTTPException
from starlette.requests import Request

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DB_PATH = Path(tempfile.gettempdir()) / "uaifu_security_flow_test.db"

if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["BOT_TOKEN"] = "123456:TEST_BOT_TOKEN"
os.environ["ALLOW_DEV_AUTH"] = "true"
os.environ["TELEGRAM_AUTH_MAX_AGE_SECONDS"] = "86400"

sys.path.insert(0, str(BACKEND_DIR))

from auth import get_authenticated_telegram_user
from game_balance import REFERRAL_NEW_USER_COINS
import main
import models
from database import SessionLocal


def build_signed_init_data(user_id: int, username: str = "tester", first_name: str = "Tester", auth_date: int | None = None):
    payload = {
        "auth_date": str(auth_date or int(time.time())),
        "query_id": "AAEAAAE",
        "user": json.dumps(
            {
                "id": user_id,
                "username": username,
                "first_name": first_name,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
    }
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(payload.items()))
    secret_key = hmac.new(b"WebAppData", os.environ["BOT_TOKEN"].encode("utf-8"), hashlib.sha256).digest()
    payload["hash"] = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return urlencode(payload)


def make_request(path: str, headers: dict[str, str] | None = None, query_string: str = "", host: str = "localhost"):
    encoded_headers = [
        (key.lower().encode("utf-8"), value.encode("utf-8"))
        for key, value in (headers or {}).items()
    ]
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": query_string.encode("utf-8"),
        "headers": encoded_headers,
        "client": ("127.0.0.1", 12345),
        "server": (host, 80),
    }
    return Request(scope)


def utcnow_naive():
    return datetime.now()


class SecurityFlowTests(unittest.TestCase):
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

    def auth_headers(self, user_id: int):
        return {"X-Telegram-Init-Data": build_signed_init_data(user_id)}

    def test_spin_supports_post_requests(self):
        spin_methods = {
            method
            for route in main.app.routes
            if getattr(route, "path", None) == "/spin"
            for method in getattr(route, "methods", set())
        }
        self.assertIn("POST", spin_methods)
        self.assertIn("GET", spin_methods)

    def test_premium_spin_supports_post_requests(self):
        premium_methods = {
            method
            for route in main.app.routes
            if getattr(route, "path", None) == "/premium_spin"
            for method in getattr(route, "methods", set())
        }
        self.assertIn("POST", premium_methods)
        self.assertIn("GET", premium_methods)

    def test_verified_telegram_identity_wins_over_spoofed_query_user(self):
        request = make_request(
            "/user",
            headers=self.auth_headers(10101),
            query_string="user_id=999999&first_name=Spoofed",
        )
        auth_user = get_authenticated_telegram_user(request)

        with SessionLocal() as db:
            user = main.get_or_create_user(
                db,
                auth_user.id,
                username=auth_user.username,
                first_name=auth_user.first_name,
            )
            state = asyncio.run(main.get_user(current_user=user, db=db))
            spoofed_user = db.query(models.User).filter(models.User.id == 999999).first()

        self.assertEqual(state["coins"], 0)
        self.assertEqual(user.id, 10101)
        self.assertEqual(user.first_name, "Tester")
        self.assertIsNone(spoofed_user)

    def test_existing_user_profile_is_not_overwritten_by_later_telegram_data(self):
        with SessionLocal() as db:
            original_user = models.User(
                id=11111,
                username="liveua",
                first_name="Liveua",
            )
            db.add(original_user)
            db.commit()

            user = main.get_or_create_user(
                db,
                11111,
                username="debug-user",
                first_name="Debug",
            )

        self.assertEqual(user.username, "liveua")
        self.assertEqual(user.first_name, "Liveua")

    def test_blank_existing_profile_fields_are_filled_from_telegram_data(self):
        with SessionLocal() as db:
            original_user = models.User(
                id=12121,
                username=None,
                first_name=None,
            )
            db.add(original_user)
            db.commit()

            user = main.get_or_create_user(
                db,
                12121,
                username="filled-user",
                first_name="Filled",
            )

        self.assertEqual(user.username, "filled-user")
        self.assertEqual(user.first_name, "Filled")

    def test_new_user_creation_stores_telegram_profile_data(self):
        with SessionLocal() as db:
            user = main.get_or_create_user(
                db,
                13131,
                username="brand-new",
                first_name="Brand",
            )

        self.assertEqual(user.username, "brand-new")
        self.assertEqual(user.first_name, "Brand")

    def test_invalid_telegram_signature_is_rejected(self):
        request = make_request(
            "/user",
            headers={"X-Telegram-Init-Data": "user=%7B%22id%22%3A1%7D&auth_date=1&hash=bad"},
        )

        with self.assertRaises(HTTPException) as context:
            get_authenticated_telegram_user(request)

        self.assertEqual(context.exception.status_code, 401)

    def test_drone_reward_requires_single_use_session(self):
        with SessionLocal() as db:
            user = main.get_or_create_user(db, 20202, first_name="Pilot")
            session = main.create_drone_game_session(db, user.id)
            session.created_at = utcnow_naive() - timedelta(seconds=40)
            session.expires_at = utcnow_naive() + timedelta(minutes=5)
            db.commit()

            response = asyncio.run(
                main.drone_reward(
                    data=main.DroneRewardRequest(session_token=session.session_token, score=10),
                    current_user=user,
                    db=db,
                )
            )
            self.assertEqual(response["coins_added"], 2)

            with self.assertRaises(HTTPException) as second_claim:
                asyncio.run(
                    main.drone_reward(
                        data=main.DroneRewardRequest(session_token=session.session_token, score=10),
                        current_user=user,
                        db=db,
                    )
                )

        self.assertEqual(second_claim.exception.status_code, 400)

    def test_drone_reward_rejects_implausible_score(self):
        with SessionLocal() as db:
            user = main.get_or_create_user(db, 30303, first_name="Speedrunner")
            session = main.create_drone_game_session(db, user.id)
            session.created_at = utcnow_naive() - timedelta(seconds=5)
            session.expires_at = utcnow_naive() + timedelta(minutes=5)
            db.commit()

            with self.assertRaises(HTTPException) as suspicious_score:
                asyncio.run(
                    main.drone_reward(
                        data=main.DroneRewardRequest(session_token=session.session_token, score=100),
                        current_user=user,
                        db=db,
                    )
                )

        self.assertEqual(suspicious_score.exception.status_code, 400)
        self.assertEqual(suspicious_score.exception.detail, "Suspicious score rejected")

    def test_existing_player_cannot_claim_referral_late(self):
        with SessionLocal() as db:
            referrer = main.get_or_create_user(db, 40404, first_name="Referrer")
            invited = main.get_or_create_user(db, 40405, first_name="Existing")
            invited.total_spins = 3
            db.commit()

            with self.assertRaises(HTTPException) as late_claim:
                asyncio.run(
                    main.claim_referral(
                        ref_id=referrer.id,
                        current_user=invited,
                        db=db,
                    )
                )

        self.assertEqual(late_claim.exception.status_code, 400)
        self.assertEqual(late_claim.exception.detail, "Реферальний бонус доступний лише новим гравцям")

    def test_new_player_can_claim_referral_after_daily_bonus_state(self):
        with SessionLocal() as db:
            referrer = main.get_or_create_user(db, 50505, first_name="Referrer")
            invited = main.get_or_create_user(db, 50506, first_name="Fresh")
            invited.last_login_date = utcnow_naive()
            invited.login_streak = 1
            invited.coins = 250
            db.commit()

            response = asyncio.run(
                main.claim_referral(
                    ref_id=referrer.id,
                    current_user=invited,
                    db=db,
                )
            )
            referral = db.query(models.Referral).filter(models.Referral.invited_id == invited.id).first()

        self.assertTrue(response["success"])
        self.assertIsNotNone(referral)
        self.assertEqual(response["user_stats"]["coins"], 250 + REFERRAL_NEW_USER_COINS)
        self.assertEqual(response["user_stats"]["energy"], 20)

    def test_ensure_season_exists_replaces_expired_active_season(self):
        with SessionLocal() as db:
            expired = models.Season(
                name="Old season",
                start_date=utcnow_naive() - timedelta(days=40),
                end_date=utcnow_naive() - timedelta(days=10),
                is_active=True,
            )
            db.add(expired)
            db.commit()

            season = main.ensure_season_exists(db)
            db.refresh(expired)
            active = main.get_active_season(db)

        self.assertNotEqual(season.id, expired.id)
        self.assertFalse(expired.is_active)
        self.assertIsNotNone(active)
        self.assertEqual(active.id, season.id)

    def test_cannot_claim_reward_from_inactive_season_task(self):
        with SessionLocal() as db:
            user = main.get_or_create_user(db, 60606, first_name="SeasonTester")
            user.total_spins = 20

            expired = models.Season(
                name="Archived season",
                start_date=utcnow_naive() - timedelta(days=60),
                end_date=utcnow_naive() - timedelta(days=30),
                is_active=False,
            )
            db.add(expired)
            db.flush()

            task = models.SeasonTask(
                season_id=expired.id,
                title="Old spins",
                task_type="spins",
                target=1,
                reward_coins=100,
                reward_energy=0,
            )
            db.add(task)
            db.commit()

            with self.assertRaises(HTTPException) as claim_error:
                asyncio.run(
                    main.claim_season_reward(
                        task_id=task.id,
                        current_user=user,
                        db=db,
                    )
                )

        self.assertEqual(claim_error.exception.status_code, 400)
        self.assertEqual(claim_error.exception.detail, "Нагорода цього сезону недоступна")


if __name__ == "__main__":
    unittest.main()
