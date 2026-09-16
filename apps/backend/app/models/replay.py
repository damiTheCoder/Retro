from sqlalchemy import Column, String, Integer, JSON, Boolean, DateTime
from datetime import datetime
from app.database import Base

class ReplaySessionModel(Base):
    __tablename__ = "replay_sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    symbol = Column(String, nullable=False, default="BTCUSDT")
    asset_class = Column(String, nullable=False, default="crypto")
    timeframe = Column(String, nullable=False, default="1d")
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    current_bar_index = Column(Integer, default=0)
    active_strategy = Column(JSON, default=dict)
    is_demo_data = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
