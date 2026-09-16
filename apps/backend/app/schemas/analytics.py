from pydantic import BaseModel
from typing import List

class AnalyticsSummary(BaseModel):
    net_pnl: float
    total_return_pct: float
    win_count: int
    loss_count: int
    win_rate_pct: float
    profit_factor: float
    avg_win: float
    avg_loss: float
    rr_ratio: str
    total_trades: int

class MonthlyPnLItem(BaseModel):
    month: str
    year_month_key: str
    pnl: float
    trades: int
    win_rate: float

class AssetBreakdownItem(BaseModel):
    asset: str
    pnl: float
    win_rate: float
    count: int
    is_white_bar: bool
