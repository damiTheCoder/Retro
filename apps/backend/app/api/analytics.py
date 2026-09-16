from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.journal import JournalEntryModel
from app.schemas.analytics import AnalyticsSummary, MonthlyPnLItem, AssetBreakdownItem
from app.services.analytics_engine import (
    calculate_analytics_summary,
    calculate_monthly_performance,
    calculate_asset_breakdown,
)

router = APIRouter(prefix="/api/v1/analytics", tags=["Performance Analytics"])

@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db)):
    entries = db.query(JournalEntryModel).all()
    stats = calculate_analytics_summary(entries)
    return AnalyticsSummary(**stats)

@router.get("/monthly", response_model=List[MonthlyPnLItem])
def get_monthly_analytics(db: Session = Depends(get_db)):
    entries = db.query(JournalEntryModel).all()
    items = calculate_monthly_performance(entries)
    return [MonthlyPnLItem(**item) for item in items]

@router.get("/asset-breakdown", response_model=List[AssetBreakdownItem])
def get_asset_breakdown(db: Session = Depends(get_db)):
    entries = db.query(JournalEntryModel).all()
    items = calculate_asset_breakdown(entries)
    return [AssetBreakdownItem(**item) for item in items]
