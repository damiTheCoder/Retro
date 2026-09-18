import os
import certifi
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from lse import LSE, LSEError

load_dotenv()
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

class LseClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("LSE_API_KEY")
        self.client = LSE(api_key=self.api_key)

    def get_candles(
        self,
        symbol: str,
        timeframe: str = "1d",
        start: Optional[str] = None,
        end: Optional[str] = None,
        limit: int = 2000,
        order: str = "desc",
    ) -> List[Dict[str, Any]]:
        """
        Fetch OHLCV candles from London Strategic Edge (LSE) Data Vault.
        - symbol: e.g. 'BTC/USD', 'AAPL', 'EUR/USD'
        - timeframe: '1s', '5s', '15s', '30s', '1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1mo'
        - start / end: ISO formatted timestamp or date filter
        - limit: row count (capped at 5,000 per request)
        - order: 'asc' or 'desc'
        """
        capped_limit = min(max(int(limit), 1), 5000)
        clean_start = start.split("T")[0] if start and "T" in start else start
        clean_end = end.split("T")[0] if end and "T" in end else end
        return self.client.candles(
            symbol=symbol,
            timeframe=timeframe,
            start=clean_start,
            end=clean_end,
            limit=capped_limit,
            order=order,
        )
