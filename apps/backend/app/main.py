from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api.journal import router as journal_router
from app.api.analytics import router as analytics_router
from app.api.replay import router as replay_router
from app.api.chat import router as chat_router
from app.api.market import router as market_router

# Auto-create SQLite database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Chart Rabbit Trading Platform API",
    description="Python FastAPI backend for Replay Session Persistence, Trade Simulation Logging, Performance Analytics, and OpenRouter AI Assistant.",
    version="1.0.0"
)

# Enable CORS for local frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(journal_router)
app.include_router(analytics_router)
app.include_router(replay_router)
app.include_router(chat_router)
app.include_router(market_router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Chart Rabbit Trading Platform API",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}
