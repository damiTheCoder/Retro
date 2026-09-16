import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_market_history_endpoint():
    response = client.get("/api/v1/market/history?symbol=BTCUSDT&timeframe=1d&limit=3")
    assert response.status_code == 200
    candles = response.json()

    print("\n--- RAW MARKET HISTORY RESPONSE ---")
    print(candles)

    # Assert 3 candles returned
    assert len(candles) == 3

    # Assert valid OHLC keys
    for candle in candles:
        assert "timestamp" in candle
        assert "open" in candle
        assert "high" in candle
        assert "low" in candle
        assert "close" in candle
        assert "volume" in candle
        assert isinstance(candle["open"], float) or isinstance(candle["open"], int)

def test_market_history_cache_hit():
    # First call primes the cache
    resp1 = client.get("/api/v1/market/history?symbol=ETHUSDT&timeframe=1d&limit=5")
    assert resp1.status_code == 200
    
    # Second call should hit the cache
    resp2 = client.get("/api/v1/market/history?symbol=ETHUSDT&timeframe=1d&limit=5")
    assert resp2.status_code == 200
    assert resp1.json() == resp2.json()
