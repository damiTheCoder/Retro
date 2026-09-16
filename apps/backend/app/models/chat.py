from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class ChatThreadModel(Base):
    __tablename__ = "chat_threads"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False, default="New Strategy Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    messages = relationship("ChatMessageModel", back_populates="thread", cascade="all, delete-orphan")

class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True)
    thread_id = Column(String, ForeignKey("chat_threads.id"), nullable=False, index=True)
    sender = Column(String, nullable=False) # 'user' or 'ai'
    text = Column(Text, nullable=False)
    timestamp = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    thread = relationship("ChatThreadModel", back_populates="messages")
