from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True) # Telegram ID
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    energy = Column(Integer, default=20)
    max_energy = Column(Integer, default=20)
    coins = Column(Integer, default=0)
    last_energy_update = Column(DateTime, default=datetime.datetime.utcnow)

    collection = relationship("UserCard", back_populates="owner")

class Card(Base):
    __tablename__ = "cards"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    rarity = Column(String, index=True)
    image = Column(String)
    description = Column(String)

class UserCard(Base):
    __tablename__ = "user_cards"
    __table_args__ = (UniqueConstraint('user_id', 'card_id', name='_user_card_uc'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    card_id = Column(String, ForeignKey("cards.id"), index=True)
    duplicates = Column(Integer, default=0)
    acquired_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="collection")
    card = relationship("Card")

class SpinLog(Base):
    __tablename__ = "spin_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    card_id = Column(String, ForeignKey("cards.id"))
    is_duplicate = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User")
    card = relationship("Card")

class PurchaseLog(Base):
    __tablename__ = "purchase_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    item = Column(String)
    cost = Column(Integer)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User")
