import sys
import os
from sqlalchemy.orm import Session
from database import SessionLocal
import models

def diagnose():
    db = SessionLocal()
    try:
        # 1. Total counts
        user_count = db.query(models.User).count()
        card_count = db.query(models.Card).count()
        user_card_count = db.query(models.UserCard).count()
        print(f"DIAGNOSTIC: Users={user_count}, Cards={card_count}, UserCards={user_card_count}")

        # 2. Check for orphaned UserCards (no matching Card)
        orphans = db.query(models.UserCard).filter(~models.UserCard.card_id.in_(db.query(models.Card.id))).all()
        if orphans:
            print(f"DIAGNOSTIC: Found {len(orphans)} orphaned UserCard entries!")
            distinct_orphans = set(o.card_id for o in orphans)
            print(f"DIAGNOSTIC: Orphaned IDs: {distinct_orphans}")
        else:
            print("DIAGNOSTIC: No orphaned UserCard entries found.")

        # 3. Check for users with cards
        users_with_cards = db.query(models.UserCard.user_id).distinct().count()
        print(f"DIAGNOSTIC: Users with cards: {users_with_cards}")

    except Exception as e:
        print(f"DIAGNOSTIC ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    diagnose()
