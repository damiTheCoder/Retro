from typing import List, Dict, Any
from app.models.journal import JournalEntryModel

SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

def calculate_analytics_summary(entries: List[JournalEntryModel]) -> Dict[str, Any]:
    total_trades = len(entries)
    if total_trades == 0:
        return {
            "net_pnl": 0.0,
            "total_return_pct": 0.0,
            "win_count": 0,
            "loss_count": 0,
            "win_rate_pct": 0.0,
            "profit_factor": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "rr_ratio": "1 : 0.00",
            "total_trades": 0,
        }

    net_pnl = round(sum(e.pnl_amount for e in entries), 2)
    total_return_pct = round(sum(e.pnl_percentage for e in entries), 2)
    
    wins = [e for e in entries if e.outcome == "WIN" or e.pnl_amount > 0]
    losses = [e for e in entries if e.outcome == "LOSS" or e.pnl_amount < 0]
    
    win_count = len(wins)
    loss_count = len(losses)
    win_rate_pct = round((win_count / total_trades) * 100, 2)
    
    gross_profit = sum(e.pnl_amount for e in wins)
    gross_loss = sum(abs(e.pnl_amount) for e in losses)
    
    if gross_loss > 0:
        profit_factor = round(gross_profit / gross_loss, 2)
    elif gross_profit > 0:
        profit_factor = 99.9
    else:
        profit_factor = 0.0
        
    avg_win = round(gross_profit / win_count, 2) if win_count > 0 else 0.0
    avg_loss = round(gross_loss / loss_count, 2) if loss_count > 0 else 0.0
    
    if avg_loss > 0:
        rr_val = round(avg_win / avg_loss, 2)
        rr_ratio = f"1 : {rr_val:.2f}"
    elif avg_win > 0:
        rr_ratio = "1 : Infinite"
    else:
        rr_ratio = "1 : 1.00"

    return {
        "net_pnl": net_pnl,
        "total_return_pct": total_return_pct,
        "win_count": win_count,
        "loss_count": loss_count,
        "win_rate_pct": win_rate_pct,
        "profit_factor": profit_factor,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "rr_ratio": rr_ratio,
        "total_trades": total_trades,
    }

def calculate_monthly_performance(entries: List[JournalEntryModel]) -> List[Dict[str, Any]]:
    from datetime import datetime
    now = datetime.now()
    months_list = []
    
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        if month <= 0:
            month += 12
            year -= 1
        mo_str = f"{month:02d}"
        key = f"{year}-{mo_str}"
        label = SHORT_MONTH_NAMES[month - 1]
        months_list.append({"month": label, "year_month_key": key})
        
    result = []
    for item in months_list:
        m_key = item["year_month_key"]
        month_entries = [e for e in entries if e.created_at and e.created_at.startswith(m_key)]
        pnl = round(sum(e.pnl_amount for e in month_entries), 2)
        count = len(month_entries)
        wins = len([e for e in month_entries if e.outcome == "WIN" or e.pnl_amount > 0])
        wr = round((wins / count) * 100, 1) if count > 0 else 0.0
        
        result.append({
            "month": item["month"],
            "year_month_key": m_key,
            "pnl": pnl,
            "trades": count,
            "win_rate": wr,
        })
        
    return result

def calculate_asset_breakdown(entries: List[JournalEntryModel]) -> List[Dict[str, Any]]:
    asset_map: Dict[str, Dict[str, Any]] = {}
    
    for e in entries:
        asset = e.asset_class or "Other"
        if asset not in asset_map:
            asset_map[asset] = {"pnl": 0.0, "count": 0, "wins": 0}
        asset_map[asset]["pnl"] += e.pnl_amount or 0.0
        asset_map[asset]["count"] += 1
        if e.outcome == "WIN" or (e.pnl_amount or 0) > 0:
            asset_map[asset]["wins"] += 1
            
    if not asset_map:
        return [
            {"asset": "Crypto", "pnl": 0.0, "win_rate": 0.0, "count": 0, "is_white_bar": True},
            {"asset": "Forex", "pnl": 0.0, "win_rate": 0.0, "count": 0, "is_white_bar": False},
            {"asset": "Commodities", "pnl": 0.0, "win_rate": 0.0, "count": 0, "is_white_bar": True},
            {"asset": "Stock", "pnl": 0.0, "win_rate": 0.0, "count": 0, "is_white_bar": False},
        ]
        
    result = []
    for idx, (asset, data) in enumerate(asset_map.items()):
        wr = round((data["wins"] / data["count"]) * 100, 1) if data["count"] > 0 else 0.0
        result.append({
            "asset": asset,
            "pnl": round(data["pnl"], 2),
            "win_rate": wr,
            "count": data["count"],
            "is_white_bar": idx % 2 == 0,
        })
        
    return result
