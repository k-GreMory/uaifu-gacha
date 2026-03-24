import os
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from sqlalchemy import func

def merge_users(source_id: int, target_id: int):
    db = SessionLocal()
    try:
        source_user = db.query(models.User).filter(models.User.id == source_id).first()
        target_user = db.query(models.User).filter(models.User.id == target_id).first()

        if not source_user:
            print(f"ERROR: Source user {source_id} not found.")
            return
        if not target_user:
            print(f"ERROR: Target user {target_id} not found.")
            return

        print(f"MERGING: {source_id} ({source_user.username}) -> {target_id} ({target_user.username})")

        # 1. Merge UserCards
        source_cards = db.query(models.UserCard).filter(models.UserCard.user_id == source_id).all()
        for sc in source_cards:
            target_card = db.query(models.UserCard).filter(
                models.UserCard.user_id == target_id,
                models.UserCard.card_id == sc.card_id
            ).first()

            if target_card:
                # Add duplicates: (source_dupes + 1) because the card itself counts as 1
                # Actually, if they both have the card, total = sc.dupes + tc.dupes + 1
                target_card.duplicates += (sc.duplicates + 1)
                db.delete(sc)
            else:
                sc.user_id = target_id
        
        # 2. Merge Coins and Spins
        target_user.coins += source_user.coins
        target_user.total_spins += source_user.total_spins
        
        # 3. Handle Referrals
        db.query(models.Referral).filter(models.Referral.referrer_id == source_id).update({models.Referral.referrer_id: target_id})
        db.query(models.Referral).filter(models.Referral.invited_id == source_id).update({models.Referral.invited_id: target_id})
        
        # 4. Handle Purchase Logs
        db.query(models.PurchaseLog).filter(models.PurchaseLog.user_id == source_id).update({models.PurchaseLog.user_id: target_id})
        
        # 5. Handle Spin Logs
        db.query(models.SpinLog).filter(models.SpinLog.user_id == source_id).update({models.SpinLog.user_id: target_id})

        # 6. Delete source user
        db.delete(source_user)

        db.commit()
        print("SUCCESS: Users merged successfully.")
    except Exception as e:
        db.rollback()
        print(f"CRITICAL ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # Source: 959711352 (The 277 cards profile)
    # Target: 908721870 (The active user in screenshot)
    merge_users(source_id=959711352, target_id=908721870)
