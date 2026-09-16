import pytest
from app.models.journal import JournalEntryModel
from app.services.analytics_engine import calculate_analytics_summary

def test_analytics_correctness():
    # Seed 3 known entries:
    # Trade 1: entry=100, exit=110, pnl=+10, long
    # Trade 2: entry=100, exit=95, pnl=-5, long
    # Trade 3: entry=100, exit=120, pnl=+20, long
    trade1 = JournalEntryModel(
        id="test-1", trade_id="T-1", title="Trade 1", asset_class="crypto",
        symbol="BTCUSDT", direction="LONG", entry_price=100.0, exit_price=110.0,
        outcome="WIN", pnl_amount=10.0, pnl_percentage=10.0, created_at="2026-03-01"
    )
    trade2 = JournalEntryModel(
        id="test-2", trade_id="T-2", title="Trade 2", asset_class="crypto",
        symbol="BTCUSDT", direction="LONG", entry_price=100.0, exit_price=95.0,
        outcome="LOSS", pnl_amount=-5.0, pnl_percentage=-5.0, created_at="2026-03-02"
    )
    trade3 = JournalEntryModel(
        id="test-3", trade_id="T-3", title="Trade 3", asset_class="crypto",
        symbol="BTCUSDT", direction="LONG", entry_price=100.0, exit_price=120.0,
        outcome="WIN", pnl_amount=20.0, pnl_percentage=20.0, created_at="2026-03-03"
    )

    seeded_entries = [trade1, trade2, trade3]
    stats = calculate_analytics_summary(seeded_entries)

    print("\n--- RAW ANALYTICS TEST RESULT ---")
    print(stats)

    # Assertions:
    # Net PnL = 10 - 5 + 20 = 25.0
    assert stats["net_pnl"] == 25.0
    
    # Win Rate = 2 / 3 = 66.67%
    assert stats["win_rate_pct"] == 66.67
    
    # Profit Factor = Gross Profit (30) / Gross Loss (5) = 6.0
    assert stats["profit_factor"] == 6.0
    
    # Average Win = (10 + 20) / 2 = 15.0
    assert stats["avg_win"] == 15.0
    
    # Average Loss = 5.0 / 1 = 5.0
    assert stats["avg_loss"] == 5.0
    
    # Total trades
    assert stats["total_trades"] == 3
