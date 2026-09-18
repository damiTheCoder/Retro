import httpx
from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any, Optional
from app.services.market_data import fetch_historical_candles
from app.services.lse_client import LseClient
from lse import LSEError

router = APIRouter(tags=["Market Data"])

def fetch_binance_candles(symbol: str, timeframe: str = "1d", limit: int = 1000) -> List[Dict[str, Any]]:
    tf = timeframe.lower()
    if tf == "1mo":
        tf = "1M"
    capped_limit = min(max(int(limit), 1), 1000)
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={tf}&limit={capped_limit}"
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(url)
        resp.raise_for_status()
        data = resp.json()
        candles = []
        for item in data:
            candles.append({
                "timestamp": int(item[0]),
                "open": float(item[1]),
                "high": float(item[2]),
                "low": float(item[3]),
                "close": float(item[4]),
                "volume": float(item[5]),
            })
        return candles

@router.get("/api/candles")
def get_candles(
    symbol: str = Query(..., description="Ticker symbol e.g. BTC/USD, AAPL"),
    timeframe: str = Query("1d", description="Timeframe e.g. 1m, 5m, 1h, 1d"),
    start: Optional[str] = Query(None, description="Start date/time in ISO format"),
    end: Optional[str] = Query(None, description="End date/time in ISO format"),
    limit: int = Query(2000, ge=1, le=5000, description="Number of candles (max 5000)"),
    order: str = Query("desc", description="Sort order: asc or desc"),
):
    client = LseClient()
    try:
        data = client.get_candles(
            symbol=symbol,
            timeframe=timeframe,
            start=start,
            end=end,
            limit=limit,
            order=order,
        )
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "count": len(data),
            "candles": data,
            "source": "lse",
        }
    except Exception as e:
        # Fallback to Binance for crypto symbols
        if "/" in symbol and symbol.split("/")[1].upper() in ["USD", "USDT"]:
            try:
                # Map BTC/USD -> BTCUSDT for Binance
                binance_symbol = symbol.upper().replace("/", "").replace("USD", "USDT")
                binance_candles = fetch_binance_candles(binance_symbol, timeframe, limit)
                if binance_candles:
                    return {
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "count": len(binance_candles),
                        "candles": binance_candles,
                        "source": "binance-fallback",
                    }
            except Exception:
                pass
        raise HTTPException(
            status_code=502,
            detail=f"LSE error: {e}"
        )

@router.get("/api/v1/market/symbols")
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

@router.get("/api/v1/market/history", response_model=List[Dict[str, Any]])
async def get_market_history(
    symbol: str = Query("BTCUSDT", description="Ticker symbol"),
    timeframe: str = Query("1d", description="Bar timeframe: 1m, 5m, 1h, 1d"),
    limit: int = Query(100, ge=1, le=1000, description="Number of candles")
):
    candles = await fetch_historical_candles(symbol, timeframe, limit)
    return candles

@router.get("/api/v1/market/history/{symbol}", response_model=List[Dict[str, Any]])
async def get_market_history_path(
    symbol: str,
    timeframe: str = Query("1d", description="Bar timeframe: 1m, 5m, 1h, 1d"),
    limit: int = Query(100, ge=1, le=1000, description="Number of candles")
):
    candles = await fetch_historical_candles(symbol, timeframe, limit)
    return candles
