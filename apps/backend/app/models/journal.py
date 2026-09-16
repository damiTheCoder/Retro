from sqlalchemy import Column, String, Float, Integer, JSON, DateTime, Text
from datetime import datetime
from app.database import Base

class JournalEntryModel(Base):
    __tablename__ = "journal_entries"

    id = Column(String, primary_key=True, index=True)
    trade_id = Column(String, index=True)
    title = Column(String, nullable=False)
    asset_class = Column(String, nullable=False)
    symbol = Column(String, nullable=False, index=True)
    direction = Column(String, nullable=False)  # 'LONG' or 'SHORT'
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=False)
    target_price = Column(Float, nullable=True)
    stop_price = Column(Float, nullable=True)
    outcome = Column(String, nullable=False)  # 'WIN' or 'LOSS'
    pnl_amount = Column(Float, nullable=False)
    pnl_percentage = Column(Float, nullable=False)
    win_rate = Column(Float, default=68.5)
    risk_reward = Column(String, default="1 : 2.5")
    total_replays = Column(Integer, default=1)
    rules = Column(JSON, default=list)
    notes = Column(Text, nullable=True)
    created_at = Column(String, nullable=False) # 'YYYY-MM-DD' format
    tags = Column(JSON, default=list)
