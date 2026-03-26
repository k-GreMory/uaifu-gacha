import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import models
import user_data_tools as tools


def make_db_url(path: Path) -> str:
    return f"sqlite:///{path.resolve().as_posix()}"


class UserDataToolsTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        temp_root = Path(self.temp_dir.name)
        self.source_db_path = temp_root / "source.db"
        self.target_db_path = temp_root / "target.db"
        self.snapshot_path = temp_root / "snapshot.json"
        self.source_db_url = make_db_url(self.source_db_path)
        self.target_db_url = make_db_url(self.target_db_path)
        self.bootstrap_db(self.source_db_url)
        self.bootstrap_db(self.target_db_url)

    def tearDown(self):
        self.temp_dir.cleanup()

    def bootstrap_db(self, db_url: str):
        engine = tools.create_engine_for_db_url(db_url)
        try:
            models.Base.metadata.create_all(bind=engine)
            session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            with session_factory() as db:
                db.add_all([
                    models.Card(id="c1", name="Card 1", rarity="Common", image="/c1.jpg", description=""),
                    models.Card(id="c2", name="Card 2", rarity="Rare", image="/c2.jpg", description=""),
                    models.Card(id="c3", name="Card 3", rarity="Epic", image="/c3.jpg", description=""),
                ])
                db.commit()
        finally:
            engine.dispose()

    def session_scope(self, db_url: str):
        engine = tools.create_engine_for_db_url(db_url)
        session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        return engine, session_factory

    def seed_user(self, db_url: str, user_id: int, username=None, first_name=None, coins=0, energy=20, max_energy=20, total_spins=0, referred_by=None, cards=None):
        engine, session_factory = self.session_scope(db_url)
        try:
            with session_factory() as db:
                user = models.User(
                    id=user_id,
                    username=username,
                    first_name=first_name,
                    coins=coins,
                    energy=energy,
                    max_energy=max_energy,
                    total_spins=total_spins,
                    referred_by=referred_by,
                )
                db.add(user)
                for card_id, duplicates in cards or []:
                    db.add(models.UserCard(user_id=user_id, card_id=card_id, duplicates=duplicates))
                db.commit()
        finally:
            engine.dispose()

    def get_user_and_cards(self, db_url: str, user_id: int):
        engine, session_factory = self.session_scope(db_url)
        try:
            with session_factory() as db:
                user = db.query(models.User).filter(models.User.id == user_id).first()
                cards = {
                    entry.card_id: entry.duplicates
                    for entry in db.query(models.UserCard).filter(models.UserCard.user_id == user_id).all()
                }
                if user is None:
                    return None, cards
                return {
                    "username": user.username,
                    "first_name": user.first_name,
                    "coins": user.coins,
                    "energy": user.energy,
                    "max_energy": user.max_energy,
                    "total_spins": user.total_spins,
                    "referred_by": user.referred_by,
                }, cards
        finally:
            engine.dispose()

    def test_export_writes_expected_snapshot_shape(self):
        self.seed_user(
            self.source_db_url,
            user_id=70001,
            username="export-user",
            first_name="Export",
            coins=123,
            energy=9,
            max_energy=25,
            total_spins=77,
            referred_by=42,
            cards=[("c1", 2), ("c2", 0)],
        )

        stdout = io.StringIO()
        with redirect_stdout(stdout):
            exit_code = tools.main([
                "export",
                "--db-url", self.source_db_url,
                "--user-id", "70001",
                "--output", str(self.snapshot_path),
            ])

        self.assertEqual(exit_code, 0)
        status_line = json.loads(stdout.getvalue().strip().splitlines()[-1])
        snapshot = json.loads(self.snapshot_path.read_text(encoding="utf-8"))

        self.assertEqual(status_line["command"], "export")
        self.assertEqual(snapshot["user"]["id"], 70001)
        self.assertEqual(snapshot["user"]["coins"], 123)
        self.assertEqual(snapshot["user"]["max_energy"], 25)
        self.assertEqual(snapshot["user"]["referred_by"], 42)
        self.assertEqual(snapshot["collection"], [
            {"card_id": "c1", "duplicates": 2},
            {"card_id": "c2", "duplicates": 0},
        ])

    def test_diff_reports_changes_without_mutating_target(self):
        self.seed_user(
            self.source_db_url,
            user_id=70002,
            username="source",
            first_name="Source",
            coins=50,
            cards=[("c1", 3), ("c2", 0)],
        )
        self.seed_user(
            self.target_db_url,
            user_id=70002,
            username="target",
            first_name="Target",
            coins=10,
            cards=[("c1", 1), ("c3", 4)],
        )

        stdout = io.StringIO()
        with redirect_stdout(stdout):
            exit_code = tools.main([
                "diff",
                "--source-db-url", self.source_db_url,
                "--target-db-url", self.target_db_url,
                "--user-id", "70002",
            ])

        self.assertEqual(exit_code, 0)
        diff = json.loads(stdout.getvalue())
        _, cards_after = self.get_user_and_cards(self.target_db_url, 70002)

        self.assertEqual(diff["cards_missing_in_target"], ["c2"])
        self.assertEqual(diff["cards_only_in_target"], ["c3"])
        self.assertEqual(diff["cards_with_duplicate_mismatch"], [
            {
                "card_id": "c1",
                "source_duplicates": 3,
                "target_duplicates": 1,
                "resolved_duplicates": 3,
            }
        ])
        self.assertEqual(cards_after, {"c1": 1, "c3": 4})

    def test_merge_creates_missing_target_user_from_snapshot(self):
        self.seed_user(
            self.source_db_url,
            user_id=70003,
            username="missing-target",
            first_name="Merge",
            coins=99,
            energy=7,
            max_energy=30,
            total_spins=12,
            referred_by=555,
            cards=[("c1", 1), ("c2", 4)],
        )
        snapshot = tools.load_user_snapshot_from_db(self.source_db_url, 70003)

        report = tools.merge_snapshot_into_db(snapshot, self.target_db_url, 70003)
        user, cards = self.get_user_and_cards(self.target_db_url, 70003)

        self.assertTrue(report["created_user"])
        self.assertEqual(user, {
            "username": "missing-target",
            "first_name": "Merge",
            "coins": 99,
            "energy": 7,
            "max_energy": 30,
            "total_spins": 12,
            "referred_by": 555,
        })
        self.assertEqual(cards, {"c1": 1, "c2": 4})

    def test_merge_preserves_target_cards_fills_blank_profile_and_is_idempotent(self):
        self.seed_user(
            self.source_db_url,
            user_id=70004,
            username="source-name",
            first_name="Source",
            referred_by=333,
            cards=[("c1", 5), ("c2", 0)],
        )
        self.seed_user(
            self.target_db_url,
            user_id=70004,
            username=None,
            first_name="Target",
            referred_by=None,
            cards=[("c1", 1), ("c3", 2)],
        )
        snapshot = tools.load_user_snapshot_from_db(self.source_db_url, 70004)

        first_report = tools.merge_snapshot_into_db(snapshot, self.target_db_url, 70004)
        user_after_first_merge, cards_after_first_merge = self.get_user_and_cards(self.target_db_url, 70004)
        second_report = tools.merge_snapshot_into_db(snapshot, self.target_db_url, 70004)
        user_after_second_merge, cards_after_second_merge = self.get_user_and_cards(self.target_db_url, 70004)

        self.assertEqual(first_report["profile_fields_filled"], ["username"])
        self.assertTrue(first_report["referred_by_filled"])
        self.assertEqual(cards_after_first_merge, {"c1": 5, "c2": 0, "c3": 2})
        self.assertEqual(user_after_first_merge["username"], "source-name")
        self.assertEqual(user_after_first_merge["first_name"], "Target")
        self.assertEqual(user_after_first_merge["referred_by"], 333)

        self.assertEqual(second_report["cards_added"], 0)
        self.assertEqual(second_report["cards_updated"], 0)
        self.assertEqual(cards_after_second_merge, {"c1": 5, "c2": 0, "c3": 2})
        self.assertEqual(user_after_second_merge["username"], "source-name")
        self.assertEqual(user_after_second_merge["first_name"], "Target")

    def test_merge_dry_run_reports_without_mutating_target(self):
        self.seed_user(
            self.source_db_url,
            user_id=70005,
            username="dry-run",
            first_name="Source",
            cards=[("c1", 4), ("c2", 1)],
        )
        self.seed_user(
            self.target_db_url,
            user_id=70005,
            username=None,
            first_name="Target",
            cards=[("c1", 0)],
        )
        snapshot = tools.load_user_snapshot_from_db(self.source_db_url, 70005)

        report = tools.merge_snapshot_into_db(snapshot, self.target_db_url, 70005, dry_run=True)
        user_after, cards_after = self.get_user_and_cards(self.target_db_url, 70005)

        self.assertTrue(report["dry_run"])
        self.assertEqual(report["cards_added"], 1)
        self.assertEqual(report["cards_updated"], 1)
        self.assertEqual(user_after["username"], None)
        self.assertEqual(user_after["first_name"], "Target")
        self.assertEqual(cards_after, {"c1": 0})


if __name__ == "__main__":
    unittest.main()
