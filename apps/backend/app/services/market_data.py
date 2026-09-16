import httpx
import time
from typing import List, Dict, Any, Optional

# In-Memory Candle Cache keyed by symbol+timeframe
_CANDLE_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 86400  # 1 day TTL for cached candles

def get_cache_key(symbol: str, timeframe: str) -> str:
    return f"{symbol.upper()}_{timeframe.lower()}"

def generate_mock_candles(symbol: str, limit: int = 50) -> List[Dict[str, Any]]:
    now_ms = int(time.time() * 1000)
    day_ms = 86400 * 1000
    base_price = 84000.0 if "BTC" in symbol.upper() else 1.0850 if "EUR" in symbol.upper() else 2700.0 if "XAU" in symbol.upper() else 200.0
    
    candles = []
    for i in range(limit - 1, -1, -1):
        ts = now_ms - (i * day_ms)
        variation = ((i % 5) - 2) * (base_price * 0.008)
        open_p = base_price + variation
        close_p = open_p + ((i % 3) - 1) * (base_price * 0.005)
        high_p = max(open_p, close_p) + (base_price * 0.004)
        low_p = min(open_p, close_p) - (base_price * 0.004)
        volume = 1500.0 + (i * 10)
        
        candles.append({
            "timestamp": ts,
            "open": round(open_p, 4),
            "high": round(high_p, 4),
            "low": round(low_p, 4),
            "close": round(close_p, 4),
            "volume": round(volume, 2),
        })
        
    return candles

async def fetch_historical_candles(symbol: str = "BTCUSDT", timeframe: str = "1d", limit: int = 100) -> List[Dict[str, Any]]:
    cache_key = get_cache_key(symbol, timeframe)
    now = time.time()
    
    # Check cache hit
    if cache_key in _CANDLE_CACHE:
        cached = _CANDLE_CACHE[cache_key]
        if now - cached["timestamp"] < CACHE_TTL_SECONDS:
            print(f"[CACHE HIT] Returning cached candles for {cache_key}")
            return cached["data"][:limit]

    print(f"[CACHE MISS] Fetching fresh REST candles for {symbol}")
    
    # Attempt Binance REST fetch for Crypto symbols
    clean_ticker = symbol.upper().replace("-", "").replace("/", "")
    binance_interval = "1d" if "d" in timeframe.lower() else "1h" if "h" in timeframe.lower() else "15m"
    url = f"https://api.binance.com/api/v3/klines?symbol={clean_ticker}&interval={binance_interval}&limit={limit}"
    
    candles = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                for item in data:
                    candles.append({
                        "timestamp": int(item[0]),
                        "open": float(item[1]),
                        "high": float(item[2]),
                        "low": float(item[3]),
                        "close": float(item[4]),
                        "volume": float(item[5]),
                    })
    except Exception as err:
        print(f"Binance REST fetch warning for {symbol}: {err}")
        
    if not candles:
        candles = generate_mock_candles(symbol, limit)
        
    # Store in Cache
    _CANDLE_CACHE[cache_key] = {
        "timestamp": now,
        "data": candles,
    }
    
    return candles[:limit]
