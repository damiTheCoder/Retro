from pydantic import BaseModel, Field
from typing import List, Optional

class JournalEntryBase(BaseModel):
    title: str
    assetClass: str
    symbol: str
    direction: str  # 'LONG' or 'SHORT'
    entryPrice: float
    exitPrice: float
    targetPrice: Optional[float] = None
    stopPrice: Optional[float] = None
    outcome: Optional[str] = None
    pnlAmount: Optional[float] = None
    pnlPercentage: Optional[float] = None
    winRate: Optional[float] = 68.5
    riskReward: Optional[str] = "1 : 2.5"
    totalReplays: Optional[int] = 1
    rules: Optional[List[str]] = Field(default_factory=list)
    notes: Optional[str] = ""
    tags: Optional[List[str]] = Field(default_factory=list)

class JournalEntryCreate(JournalEntryBase):
    pass

class JournalEntryResponse(JournalEntryBase):
    id: str
    tradeId: str
    createdAt: str

    class Config:
        from_attributes = True
