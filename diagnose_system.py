import sys
import os
from sqlalchemy import text
from sqlalchemy.orm import Session

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

import models
from database import SessionLocal, engine

def diagnose():
    db = SessionLocal()
    print("--- Database Diagnostic Start ---")
    
    try:
        # 1. Check for orphaned UserCards (no User)
        orphaned_uc_user = db.query(models.UserCard).filter(
            ~models.UserCard.user_id.in_(db.query(models.User.id))
        ).count()
        print(f"Orphaned UserCards (User missing): {orphaned_uc_user}")
        
        # 2. Check for orphaned UserCards (no Card definition)
        orphaned_uc_card = db.query(models.UserCard).filter(
            ~models.UserCard.card_id.in_(db.query(models.Card.id))
        ).count()
        print(f"Orphaned UserCards (Card ID missing): {orphaned_uc_card}")
        
        # 3. Check for NULL user_id
        null_user_uc = db.query(models.UserCard).filter(models.UserCard.user_id.is_(None)).count()
        print(f"UserCards with NULL user_id: {null_user_uc}")
        
        # 4. Check SpinLogs
        orphaned_logs = db.query(models.SpinLog).filter(
            ~models.SpinLog.user_id.in_(db.query(models.User.id))
        ).count()
        print(f"SpinLogs for non-existent users: {orphaned_logs}")
        
        # 5. Check duplicate UserCards (Unique Constraint violations if any)
        # (Though SQLite should have blocked these, it's good to check)
        from sqlalchemy import func
        dupe_check = db.query(models.UserCard.user_id, models.UserCard.card_id, func.count('*')) \
            .group_by(models.UserCard.user_id, models.UserCard.card_id) \
            .having(func.count('*') > 1).all()
        print(f"Duplicate UserCard constraints violated: {len(dupe_check)}")
        
        # 6. Global Stats
        print(f"Total Users: {db.query(models.User).count()}")
        print(f"Total Cards: {db.query(models.Card).count()}")
        print(f"Total UserCards: {db.query(models.UserCard).count()}")
        
    except Exception as e:
        print(f"Diagnostic failed: {e}")
    finally:
        db.close()
    print("--- Diagnostic Complete ---")

if __name__ == "__main__":
    diagnose()
