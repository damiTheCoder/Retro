from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import time
import uuid

from app.database import get_db
from app.models.chat import ChatThreadModel, ChatMessageModel
from app.models.journal import JournalEntryModel
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse, ChatThreadResponse
from app.services.analytics_engine import calculate_analytics_summary
from app.services.ai_assistant import generate_ai_response

router = APIRouter(prefix="/api/v1/chat", tags=["AI Assistant Chat"])

@router.get("/threads", response_model=List[ChatThreadResponse])
def list_chat_threads(db: Session = Depends(get_db)):
    return db.query(ChatThreadModel).order_by(ChatThreadModel.created_at.desc()).all()

@router.post("/threads", response_model=ChatThreadResponse, status_code=status.HTTP_201_CREATED)
def create_chat_thread(title: str = "New Strategy Chat", db: Session = Depends(get_db)):
    thread_id = f"thread-{uuid.uuid4().hex[:10]}"
    db_thread = ChatThreadModel(id=thread_id, title=title)
    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)
    return db_thread

@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_thread(thread_id: str, db: Session = Depends(get_db)):
    db_thread = db.query(ChatThreadModel).filter(ChatThreadModel.id == thread_id).first()
    if not db_thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")
    db.delete(db_thread)
    db.commit()
    return None

@router.post("/messages", response_model=ChatMessageResponse)
async def send_chat_message(req: ChatMessageCreate, db: Session = Depends(get_db)):
    thread = db.query(ChatThreadModel).filter(ChatThreadModel.id == req.thread_id).first()
    if not thread:
        # Create thread if it doesn't exist
        thread = ChatThreadModel(id=req.thread_id, title="New Strategy Chat")
        db.add(thread)
        db.commit()
        db.refresh(thread)

    # 1. Save user message to DB
    user_msg_id = f"msg-{uuid.uuid4().hex[:10]}"
    now_str = time.strftime("%I:%M %p")
    user_msg = ChatMessageModel(
        id=user_msg_id,
        thread_id=req.thread_id,
        sender="user",
        text=req.text,
        timestamp=now_str
    )
    db.add(user_msg)
    db.commit()

    # 2. Gather conversation history for context
    db_messages = db.query(ChatMessageModel).filter(ChatMessageModel.thread_id == req.thread_id).order_by(ChatMessageModel.created_at.asc()).all()
    history = []
    for m in db_messages:
        role = "user" if m.sender == "user" else "assistant"
        history.append({"role": role, "content": m.text})

    # 3. Gather real user journal stats as system context
    journal_entries = db.query(JournalEntryModel).all()
    journal_stats = calculate_analytics_summary(journal_entries)

    # 4. Generate AI response from OpenRouter API (page-aware agentic mode)
    try:
        assistant_reply_text = await generate_ai_response(history, journal_stats, req.active_page)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))

    # 5. Save assistant message to DB
    ai_msg_id = f"msg-{uuid.uuid4().hex[:10]}"
    ai_msg = ChatMessageModel(
        id=ai_msg_id,
        thread_id=req.thread_id,
        sender="ai",
        text=assistant_reply_text,
        timestamp=time.strftime("%I:%M %p")
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    return ai_msg
