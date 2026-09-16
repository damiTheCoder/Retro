from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import time

from app.database import get_db
from app.models.journal import JournalEntryModel
from app.schemas.journal import JournalEntryCreate, JournalEntryResponse

router = APIRouter(prefix="/api/v1/journal", tags=["Trade Journal"])

@router.get("/entries", response_model=List[JournalEntryResponse])
def get_journal_entries(
    symbol: Optional[str] = None,
    asset_class: Optional[str] = None,
    outcome: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(JournalEntryModel)
    if symbol:
        query = query.filter(JournalEntryModel.symbol.ilike(f"%{symbol}%"))
    if asset_class and asset_class.lower() != "all":
        query = query.filter(JournalEntryModel.asset_class.ilike(asset_class))
    if outcome and outcome.lower() != "all":
        if outcome.lower() == "wins":
            query = query.filter(JournalEntryModel.outcome == "WIN")
        elif outcome.lower() == "losses":
            query = query.filter(JournalEntryModel.outcome == "LOSS")

    entries = query.order_by(JournalEntryModel.created_at.desc()).all()
    
    # Map snake_case model to camelCase schema
    res = []
    for e in entries:
        res.append(JournalEntryResponse(
            id=e.id,
            tradeId=e.trade_id,
            title=e.title,
            assetClass=e.asset_class,
            symbol=e.symbol,
            direction=e.direction,
            entryPrice=e.entry_price,
            exitPrice=e.exit_price,
            targetPrice=e.target_price,
            stopPrice=e.stop_price,
            outcome=e.outcome,
            pnlAmount=e.pnl_amount,
            pnlPercentage=e.pnl_percentage,
            winRate=e.win_rate,
            riskReward=e.risk_reward,
            totalReplays=e.total_replays,
            rules=e.rules or [],
            notes=e.notes or "",
            createdAt=e.created_at,
            tags=e.tags or [],
        ))
    return res

@router.post("/entries", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
def create_journal_entry(
    entry: JournalEntryCreate,
    db: Session = Depends(get_db)
):
    total_count = db.query(JournalEntryModel).count()
    next_num = 101 + total_count
    
    # Calculate PnL & Return % automatically if not supplied
    ep = entry.entryPrice
    xp = entry.exitPrice
    is_long = entry.direction.upper() == "LONG"
    
    if entry.pnlAmount is None:
        pnl = (xp - ep) * 10.0 if is_long else (ep - xp) * 10.0
    else:
        pnl = entry.pnlAmount
        
    if entry.pnlPercentage is None:
        pct = round(((xp - ep) / ep * 100.0) if is_long else ((ep - xp) / ep * 100.0), 2)
    else:
        pct = entry.pnlPercentage
        
    outcome = entry.outcome or ("WIN" if pnl >= 0 else "LOSS")
    
    entry_id = f"entry-{int(time.time() * 1000)}"
    trade_id = f"T-{next_num}"
    created_at = time.strftime("%Y-%m-%d")

    db_entry = JournalEntryModel(
        id=entry_id,
        trade_id=trade_id,
        title=entry.title,
        asset_class=entry.assetClass,
        symbol=entry.symbol.upper(),
        direction=entry.direction.upper(),
        entry_price=ep,
        exit_price=xp,
        target_price=entry.targetPrice or xp,
        stop_price=entry.stopPrice or (ep * 0.98 if is_long else ep * 1.02),
        outcome=outcome,
        pnl_amount=round(pnl, 2),
        pnl_percentage=pct,
        win_rate=entry.winRate or 68.5,
        risk_reward=entry.riskReward or "1 : 2.5",
        total_replays=entry.totalReplays or 1,
        rules=entry.rules or [],
        notes=entry.notes or "",
        created_at=created_at,
        tags=entry.tags or [entry.assetClass, "Simulated Trade"],
    )
    
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)

    return JournalEntryResponse(
        id=db_entry.id,
        tradeId=db_entry.trade_id,
        title=db_entry.title,
        assetClass=db_entry.asset_class,
        symbol=db_entry.symbol,
        direction=db_entry.direction,
        entryPrice=db_entry.entry_price,
        exitPrice=db_entry.exit_price,
        targetPrice=db_entry.target_price,
        stopPrice=db_entry.stop_price,
        outcome=db_entry.outcome,
        pnlAmount=db_entry.pnl_amount,
        pnlPercentage=db_entry.pnl_percentage,
        winRate=db_entry.win_rate,
        riskReward=db_entry.risk_reward,
        totalReplays=db_entry.total_replays,
        rules=db_entry.rules or [],
        notes=db_entry.notes or "",
        createdAt=db_entry.created_at,
        tags=db_entry.tags or [],
    )

@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal_entry(entry_id: str, db: Session = Depends(get_db)):
    db_entry = db.query(JournalEntryModel).filter(JournalEntryModel.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    db.delete(db_entry)
    db.commit()
    return None
