import os
import certifi
from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

from lse import LSE, LSEError

api_key = os.getenv("LSE_API_KEY")
print(f"API key present: {bool(api_key)}")
print(f"API key prefix: {api_key[:8] if api_key else 'NONE'}...")

client = LSE(api_key=api_key)

for symbol, tf in [("BTC/USD", "1d"), ("AAPL", "1d"), ("EUR/USD", "1h")]:
    try:
        bars = client.candles(symbol, tf, limit=3)
        print(f"{symbol} {tf}: {len(bars)} bars")
        if bars:
            print(f"  first: {bars[0]}")
    except LSEError as e:
        print(f"{symbol} {tf}: LSEError {e.status} — {e.message}")
    except Exception as e:
        print(f"{symbol} {tf}: {type(e).__name__} — {e}")
