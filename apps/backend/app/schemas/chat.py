from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ChatMessageCreate(BaseModel):
    thread_id: Optional[str] = "thread-default"
    text: Optional[str] = None
    message: Optional[str] = None
    active_page: Optional[str] = "aichat"

class ChatMessageResponse(BaseModel):
    id: str
    thread_id: str
    sender: str
    text: str
    timestamp: str

    class Config:
        from_attributes = True

class ChatThreadResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    messages: List[ChatMessageResponse] = []

    class Config:
        from_attributes = True
