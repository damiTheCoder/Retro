from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.database import get_db
from app.models.replay import ReplaySessionModel
from app.schemas.replay import ReplaySessionCreate, ReplaySessionUpdate, ReplaySessionResponse

router = APIRouter(prefix="/api/v1/replay", tags=["Replay Session"])

@router.post("/sessions", response_model=ReplaySessionResponse, status_code=status.HTTP_201_CREATED)
def create_replay_session(session_data: ReplaySessionCreate, db: Session = Depends(get_db)):
    session_id = f"replay-{uuid.uuid4().hex[:10]}"
    db_session = ReplaySessionModel(
        id=session_id,
        user_id=session_data.user_id,
        symbol=session_data.symbol.upper(),
        asset_class=session_data.asset_class,
        timeframe=session_data.timeframe,
        start_date=session_data.start_date,
        end_date=session_data.end_date,
        current_bar_index=session_data.current_bar_index,
        active_strategy=session_data.active_strategy,
        is_demo_data=session_data.is_demo_data,
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/sessions", response_model=List[ReplaySessionResponse])
def list_replay_sessions(db: Session = Depends(get_db)):
    return db.query(ReplaySessionModel).order_by(ReplaySessionModel.updated_at.desc()).all()

@router.get("/sessions/{session_id}", response_model=ReplaySessionResponse)
def get_replay_session(session_id: str, db: Session = Depends(get_db)):
    db_session = db.query(ReplaySessionModel).filter(ReplaySessionModel.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="ReplaySession not found")
    return db_session

@router.patch("/sessions/{session_id}", response_model=ReplaySessionResponse)
def update_replay_session(session_id: str, patch_data: ReplaySessionUpdate, db: Session = Depends(get_db)):
    db_session = db.query(ReplaySessionModel).filter(ReplaySessionModel.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="ReplaySession not found")

    if patch_data.current_bar_index is not None:
        db_session.current_bar_index = patch_data.current_bar_index
    if patch_data.active_strategy is not None:
        db_session.active_strategy = patch_data.active_strategy
    if patch_data.symbol is not None:
        db_session.symbol = patch_data.symbol.upper()
    if patch_data.timeframe is not None:
        db_session.timeframe = patch_data.timeframe

    db.commit()
    db.refresh(db_session)
    return db_session

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_replay_session(session_id: str, db: Session = Depends(get_db)):
    db_session = db.query(ReplaySessionModel).filter(ReplaySessionModel.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="ReplaySession not found")
    db.delete(db_session)
    db.commit()
    return None
