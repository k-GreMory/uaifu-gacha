import argparse
import json
from datetime import datetime, UTC
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import Session, sessionmaker

import models


SNAPSHOT_VERSION = 1
REQUIRED_TABLES = ("users", "cards", "user_cards")


def normalize_profile_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def utcnow_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def json_dump(data: dict[str, Any], output_path: Optional[Path] = None):
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    if output_path is None:
        print(payload)
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(payload + "\n", encoding="utf-8")


def create_engine_for_db_url(db_url: str):
    is_sqlite = db_url.startswith("sqlite")
    engine_kwargs = {"connect_args": {"check_same_thread": False}} if is_sqlite else {}
    engine = create_engine(db_url, **engine_kwargs)

    if is_sqlite:
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

    return engine


def create_session_factory(db_url: str):
    engine = create_engine_for_db_url(db_url)
    validate_database_schema(engine)
    return engine, sessionmaker(autocommit=False, autoflush=False, bind=engine)


def validate_database_schema(engine):
    table_names = set(inspect(engine).get_table_names())
    missing_tables = [table for table in REQUIRED_TABLES if table not in table_names]
    if missing_tables:
        raise ValueError(
            "Database is missing required tables: "
            + ", ".join(missing_tables)
            + ". Run the app/bootstrap first so cards and schema exist."
        )


def snapshot_collection_map(snapshot: Optional[dict[str, Any]]) -> dict[str, int]:
    if not snapshot:
        return {}
    return {entry["card_id"]: entry["duplicates"] for entry in snapshot["collection"]}


def load_user_snapshot_from_session(
    db: Session,
    user_id: int,
    require_exists: bool = True,
) -> Optional[dict[str, Any]]:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        if require_exists:
            raise ValueError(f"User {user_id} was not found.")
        return None

    collection = db.query(models.UserCard).filter(models.UserCard.user_id == user_id).order_by(models.UserCard.card_id).all()

    return {
        "version": SNAPSHOT_VERSION,
        "exported_at": utcnow_iso(),
        "user_id": user.id,
        "user": {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "coins": user.coins,
            "energy": user.energy,
            "max_energy": user.max_energy,
            "total_spins": user.total_spins,
            "referred_by": user.referred_by,
        },
        "collection": [
            {
                "card_id": entry.card_id,
                "duplicates": entry.duplicates,
            }
            for entry in collection
        ],
    }


def load_user_snapshot_from_db(db_url: str, user_id: int, require_exists: bool = True):
    engine, session_factory = create_session_factory(db_url)
    try:
        with session_factory() as db:
            return load_user_snapshot_from_session(db, user_id, require_exists=require_exists)
    finally:
        engine.dispose()


def load_snapshot_file(snapshot_path: str | Path) -> dict[str, Any]:
    path = Path(snapshot_path)
    snapshot = json.loads(path.read_text(encoding="utf-8"))
    if "user" not in snapshot or "collection" not in snapshot:
        raise ValueError("Snapshot is missing required keys: user and collection.")
    return snapshot


def diff_user_snapshots(source_snapshot: dict[str, Any], target_snapshot: Optional[dict[str, Any]]) -> dict[str, Any]:
    source_user = source_snapshot["user"]
    target_user = target_snapshot["user"] if target_snapshot else None
    source_collection = snapshot_collection_map(source_snapshot)
    target_collection = snapshot_collection_map(target_snapshot)

    profile_fields = ("username", "first_name")
    stat_fields = ("coins", "energy", "max_energy", "total_spins", "referred_by")

    profile_differences = {
        field: {
            "source": source_user.get(field),
            "target": target_user.get(field) if target_user else None,
        }
        for field in profile_fields
        if not target_user or source_user.get(field) != target_user.get(field)
    }
    stat_differences = {
        field: {
            "source": source_user.get(field),
            "target": target_user.get(field) if target_user else None,
        }
        for field in stat_fields
        if not target_user or source_user.get(field) != target_user.get(field)
    }

    missing_in_target = sorted(set(source_collection) - set(target_collection))
    only_in_target = sorted(set(target_collection) - set(source_collection))
    duplicate_mismatches = [
        {
            "card_id": card_id,
            "source_duplicates": source_collection[card_id],
            "target_duplicates": target_collection[card_id],
            "resolved_duplicates": max(source_collection[card_id], target_collection[card_id]),
        }
        for card_id in sorted(set(source_collection) & set(target_collection))
        if source_collection[card_id] != target_collection[card_id]
    ]

    return {
        "user_id": source_snapshot["user_id"],
        "source_exists": True,
        "target_exists": target_snapshot is not None,
        "source_card_count": len(source_collection),
        "target_card_count": len(target_collection),
        "profile_differences": profile_differences,
        "stat_differences": stat_differences,
        "cards_missing_in_target": missing_in_target,
        "cards_only_in_target": only_in_target,
        "cards_with_duplicate_mismatch": duplicate_mismatches,
    }


def ensure_snapshot_user_matches(snapshot: dict[str, Any], user_id: int):
    snapshot_user_id = snapshot.get("user_id")
    nested_user_id = snapshot.get("user", {}).get("id")
    if snapshot_user_id != user_id or nested_user_id != user_id:
        raise ValueError(
            f"Snapshot user mismatch: expected user_id={user_id}, got user_id={snapshot_user_id}, user.id={nested_user_id}."
        )


def validate_snapshot_cards_exist(db: Session, snapshot: dict[str, Any]):
    source_card_ids = {entry["card_id"] for entry in snapshot["collection"]}
    if not source_card_ids:
        return

    existing_card_ids = {
        row[0]
        for row in db.query(models.Card.id).filter(models.Card.id.in_(source_card_ids)).all()
    }
    missing_cards = sorted(source_card_ids - existing_card_ids)
    if missing_cards:
        raise ValueError(
            "Target DB is missing card definitions for: " + ", ".join(missing_cards)
        )


def merge_snapshot_into_session(
    db: Session,
    snapshot: dict[str, Any],
    user_id: int,
    dry_run: bool = False,
) -> dict[str, Any]:
    ensure_snapshot_user_matches(snapshot, user_id)
    validate_snapshot_cards_exist(db, snapshot)

    snapshot_user = snapshot["user"]
    target_user = db.query(models.User).filter(models.User.id == user_id).first()

    created_user = False
    profile_fields_filled = []
    referred_by_filled = False

    if not target_user:
        target_user = models.User(
            id=user_id,
            username=normalize_profile_value(snapshot_user.get("username")),
            first_name=normalize_profile_value(snapshot_user.get("first_name")),
            coins=snapshot_user.get("coins", 0) or 0,
            energy=snapshot_user.get("energy", 20) or 20,
            max_energy=snapshot_user.get("max_energy", 20) or 20,
            total_spins=snapshot_user.get("total_spins", 0) or 0,
            referred_by=snapshot_user.get("referred_by"),
        )
        db.add(target_user)
        db.flush()
        created_user = True
    else:
        snapshot_username = normalize_profile_value(snapshot_user.get("username"))
        snapshot_first_name = normalize_profile_value(snapshot_user.get("first_name"))

        if snapshot_username and not normalize_profile_value(target_user.username):
            target_user.username = snapshot_username
            profile_fields_filled.append("username")
        if snapshot_first_name and not normalize_profile_value(target_user.first_name):
            target_user.first_name = snapshot_first_name
            profile_fields_filled.append("first_name")
        if target_user.referred_by is None and snapshot_user.get("referred_by") is not None:
            target_user.referred_by = snapshot_user["referred_by"]
            referred_by_filled = True

    existing_cards = {
        entry.card_id: entry
        for entry in db.query(models.UserCard).filter(models.UserCard.user_id == user_id).all()
    }
    target_only_cards_preserved = len(set(existing_cards) - {entry["card_id"] for entry in snapshot["collection"]})
    cards_added = 0
    cards_updated = 0
    cards_unchanged = 0

    for entry in snapshot["collection"]:
        card_id = entry["card_id"]
        source_duplicates = entry["duplicates"]
        target_entry = existing_cards.get(card_id)

        if not target_entry:
            db.add(models.UserCard(
                user_id=user_id,
                card_id=card_id,
                duplicates=source_duplicates,
            ))
            cards_added += 1
            continue

        resolved_duplicates = max(source_duplicates, target_entry.duplicates)
        if resolved_duplicates != target_entry.duplicates:
            target_entry.duplicates = resolved_duplicates
            cards_updated += 1
        else:
            cards_unchanged += 1

    final_target_card_count = len(set(existing_cards) | {entry["card_id"] for entry in snapshot["collection"]})
    report = {
        "user_id": user_id,
        "dry_run": dry_run,
        "created_user": created_user,
        "profile_fields_filled": profile_fields_filled,
        "referred_by_filled": referred_by_filled,
        "cards_added": cards_added,
        "cards_updated": cards_updated,
        "cards_unchanged": cards_unchanged,
        "target_only_cards_preserved": target_only_cards_preserved,
        "final_target_card_count": final_target_card_count,
    }

    if dry_run:
        db.rollback()
        return report

    db.commit()
    return report


def merge_snapshot_into_db(snapshot: dict[str, Any], target_db_url: str, user_id: int, dry_run: bool = False):
    engine, session_factory = create_session_factory(target_db_url)
    try:
        with session_factory() as db:
            return merge_snapshot_into_session(db, snapshot, user_id, dry_run=dry_run)
    finally:
        engine.dispose()


def handle_export(args):
    snapshot = load_user_snapshot_from_db(args.db_url, args.user_id, require_exists=True)
    output_path = Path(args.output)
    json_dump(snapshot, output_path=output_path)
    print(
        json.dumps(
            {
                "status": "ok",
                "command": "export",
                "user_id": args.user_id,
                "output": str(output_path),
                "card_count": len(snapshot["collection"]),
            },
            ensure_ascii=False,
        )
    )
    return 0


def handle_diff(args):
    source_snapshot = load_user_snapshot_from_db(args.source_db_url, args.user_id, require_exists=True)
    target_snapshot = load_user_snapshot_from_db(args.target_db_url, args.user_id, require_exists=False)
    json_dump(diff_user_snapshots(source_snapshot, target_snapshot))
    return 0


def handle_merge(args):
    snapshot = load_snapshot_file(args.snapshot)
    report = merge_snapshot_into_db(snapshot, args.target_db_url, args.user_id, dry_run=args.dry_run)
    report["command"] = "merge"
    report["snapshot"] = str(Path(args.snapshot))
    json_dump(report)
    return 0


def build_parser():
    parser = argparse.ArgumentParser(description="Offline user data export/diff/merge utilities.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser("export", help="Export a user snapshot to JSON.")
    export_parser.add_argument("--db-url", required=True)
    export_parser.add_argument("--user-id", required=True, type=int)
    export_parser.add_argument("--output", required=True)
    export_parser.set_defaults(handler=handle_export)

    diff_parser = subparsers.add_parser("diff", help="Compare one user across two databases.")
    diff_parser.add_argument("--source-db-url", required=True)
    diff_parser.add_argument("--target-db-url", required=True)
    diff_parser.add_argument("--user-id", required=True, type=int)
    diff_parser.set_defaults(handler=handle_diff)

    merge_parser = subparsers.add_parser("merge", help="Merge a user snapshot into a target database.")
    merge_parser.add_argument("--snapshot", required=True)
    merge_parser.add_argument("--target-db-url", required=True)
    merge_parser.add_argument("--user-id", required=True, type=int)
    merge_parser.add_argument("--dry-run", action="store_true")
    merge_parser.set_defaults(handler=handle_merge)

    return parser


def main(argv: Optional[list[str]] = None):
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
