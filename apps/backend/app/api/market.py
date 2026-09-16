from fastapi import APIRouter, Query
from typing import List, Dict, Any, Optional
from app.services.market_data import fetch_historical_candles

router = APIRouter(prefix="/api/v1/market", tags=["Market Data"])

@router.get("/symbols")
def get_supported_symbols():
    return [
        {"ticker": "BTCUSDT", "name": "Bitcoin / Tether", "shortName": "BTC", "assetClass": "crypto"},
        {"ticker": "ETHUSDT", "name": "Ethereum / Tether", "shortName": "ETH", "assetClass": "crypto"},
        {"ticker": "SOLUSDT", "name": "Solana / Tether", "shortName": "SOL", "assetClass": "crypto"},
        {"ticker": "EURUSD", "name": "Euro / US Dollar", "shortName": "EUR/USD", "assetClass": "forex"},
        {"ticker": "GBPUSD", "name": "British Pound / US Dollar", "shortName": "GBP/USD", "assetClass": "forex"},
        {"ticker": "XAUUSD", "name": "Gold / US Dollar", "shortName": "GOLD", "assetClass": "commodity"},
        {"ticker": "AAPL", "name": "Apple Inc.", "shortName": "AAPL", "assetClass": "stock"},
        {"ticker": "NVDA", "name": "NVIDIA Corporation", "shortName": "NVDA", "assetClass": "stock"},
        {"ticker": "TSLA", "name": "Tesla Inc.", "shortName": "TSLA", "assetClass": "stock"},
    ]

@router.get("/history", response_model=List[Dict[str, Any]])
async def get_market_history(
    symbol: str = Query("BTCUSDT", description="Ticker symbol"),
    timeframe: str = Query("1d", description="Bar timeframe: 1m, 5m, 1h, 1d"),
    limit: int = Query(100, ge=1, le=1000, description="Number of candles")
):
    candles = await fetch_historical_candles(symbol, timeframe, limit)
    return candles

@router.get("/history/{symbol}", response_model=List[Dict[str, Any]])
async def get_market_history_path(
    symbol: str,
    timeframe: str = Query("1d", description="Bar timeframe: 1m, 5m, 1h, 1d"),
    limit: int = Query(100, ge=1, le=1000, description="Number of candles")
):
    candles = await fetch_historical_candles(symbol, timeframe, limit)
    return candles
