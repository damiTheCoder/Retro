from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class ReplaySessionCreate(BaseModel):
    user_id: Optional[str] = None
    symbol: str = "BTCUSDT"
    asset_class: str = "crypto"
    timeframe: str = "1d"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    current_bar_index: int = 0
    active_strategy: Dict[str, Any] = Field(default_factory=dict)
    is_demo_data: bool = False

class ReplaySessionUpdate(BaseModel):
    current_bar_index: Optional[int] = None
    active_strategy: Optional[Dict[str, Any]] = None
    symbol: Optional[str] = None
    timeframe: Optional[str] = None

class ReplaySessionResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    symbol: str
    asset_class: str
    timeframe: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    current_bar_index: int
    active_strategy: Dict[str, Any]
    is_demo_data: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
