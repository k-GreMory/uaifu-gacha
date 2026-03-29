from cards_data import CARDS
import models
from database import SessionLocal, engine


def migrate_database():
    if engine.dialect.name != "sqlite":
        return

    db = SessionLocal()
    try:
        from sqlalchemy import text

        result = db.execute(text("PRAGMA table_info(users)")).fetchall()
        columns = [row[1] for row in result]

        new_cols = [
            ("total_spins", "INTEGER DEFAULT 0"),
            ("referred_by", "INTEGER"),
            ("pity_counter", "INTEGER DEFAULT 0"),
            ("last_login_date", "DATETIME"),
            ("login_streak", "INTEGER DEFAULT 0"),
        ]

        for col_name, col_type in new_cols:
            if col_name not in columns:
                print(f"Migrating: Adding column '{col_name}' to 'users' table...")
                db.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                db.commit()
    except Exception as exc:
        print(f"Migration error during column update: {exc}")
    finally:
        db.close()


def reconcile_card_duplicates():
    mapping = {
        "c184": "c201", "c185": "c202", "c186": "c203", "c187": "c205",
        "c204": "c188", "c206": "c189", "c190": "c207", "c208": "c191",
        "c192": "c209", "c193": "c210", "c211": "c194", "c212": "c195",
        "c213": "c196", "c214": "c197", "c215": "c198", "c199": "c216",
    }

    db = SessionLocal()
    try:
        for old_id, new_id in mapping.items():
            old_entries = db.query(models.UserCard).filter(models.UserCard.card_id == old_id).all()
            for old_entry in old_entries:
                primary_entry = db.query(models.UserCard).filter(
                    models.UserCard.user_id == old_entry.user_id,
                    models.UserCard.card_id == new_id,
                ).first()

                if primary_entry:
                    primary_entry.duplicates += (old_entry.duplicates + 1)
                    db.delete(old_entry)
                else:
                    old_entry.card_id = new_id

            db.query(models.SpinLog).filter(models.SpinLog.card_id == old_id).update({
                models.SpinLog.card_id: new_id
            })
            db.query(models.Card).filter(models.Card.id == old_id).delete()

        db.commit()
        print("Character card consolidation completed successfully.")
    except Exception as exc:
        print(f"Error during consolidation: {exc}")
        db.rollback()
    finally:
        db.close()


def sync_database():
    db = SessionLocal()
    try:
        existing_cards = {card.id: card for card in db.query(models.Card).all()}
        new_count = 0
        updated_count = 0

        for card_data in CARDS:
            existing_card = existing_cards.get(card_data["id"])
            description = card_data.get("description", "")

            if existing_card is None:
                db.add(models.Card(
                    id=card_data["id"],
                    name=card_data["name"],
                    rarity=card_data["rarity"],
                    image=card_data["image"],
                    description=description,
                ))
                new_count += 1
            else:
                changed = False
                if existing_card.name != card_data["name"]:
                    existing_card.name = card_data["name"]
                    changed = True
                if existing_card.rarity != card_data["rarity"]:
                    existing_card.rarity = card_data["rarity"]
                    changed = True
                if existing_card.image != card_data["image"]:
                    existing_card.image = card_data["image"]
                    changed = True
                if (existing_card.description or "") != description:
                    existing_card.description = description
                    changed = True

                if changed:
                    updated_count += 1

        db.commit()
        if new_count > 0 or updated_count > 0:
            print(f"Database Sync: {new_count} new cards added, {updated_count} cards updated.")
    finally:
        db.close()


def cleanup_orphan_user_cards():
    db = SessionLocal()
    try:
        card_ids = [card.id for card in db.query(models.Card.id).all()]
        orphans = db.query(models.UserCard).filter(~models.UserCard.card_id.in_(card_ids)).all()
        if orphans:
            print(f"Cleaning up {len(orphans)} orphaned cards...")
            for orphan in orphans:
                db.delete(orphan)
            db.commit()
    except Exception as exc:
        print(f"Orphan Cleanup Error: {exc}")
    finally:
        db.close()


def bootstrap_system():
    models.Base.metadata.create_all(bind=engine)
    migrate_database()
    sync_database()
    reconcile_card_duplicates()
    cleanup_orphan_user_cards()
