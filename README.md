# Chart Rabbit 🐇

A high-performance, modern multi-asset trading chart platform with interactive strategy replay, live order execution, transparent trade logging, and an intelligent agentic AI Co-Pilot assistant.

## Features
- **Borderless Modern UI**: Clean interface with top tool, sidetool, price scale, and bottom time bars designed with borderless layout aesthetics.
- **Multi-Asset Live Streaming**: Supports Crypto, Forex, Commodities, and Stock chart symbols with real-time WebSocket feeds and fallback APIs.
- **Interactive Order Execution**: Execute Long/Short positions directly from the chart screen and automatically document trades to your trading journal.
- **Agentic AI Trading Assistant**: Context-aware AI Co-Pilot capable of reading active chart views, analyzing strategy metrics, and guiding trading decisions.
- **Analytics & PnL Insights**: Real-time performance breakdown, win rates, risk-to-reward metrics, and cumulative PnL tracking.

## Getting Started

### Backend
```bash
cd apps/backend
source venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend
```bash
cd apps/frontend
npm install
npm run dev
```
