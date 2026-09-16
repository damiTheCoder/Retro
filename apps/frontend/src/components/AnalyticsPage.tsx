import { useState } from 'react'
import { TrendingUpIcon } from './ShadcnIcons'
import './AnalyticsPage.css'

interface MonthlyData {
  month: string
  pnl: number
  trades: number
  winRate: number
}

interface TradeLog {
  id: string
  symbol: string
  assetClass: string
  type: 'LONG' | 'SHORT'
  entry: number
  exit: number
  pnl: number
  pnlPercent: number
  result: 'WIN' | 'LOSS'
  date: string
}

const MONTHLY_PERFORMANCE: MonthlyData[] = [
  { month: 'Oct', pnl: 1450, trades: 8, winRate: 62.5 },
  { month: 'Nov', pnl: 2800, trades: 12, winRate: 75.0 },
  { month: 'Dec', pnl: -950, trades: 6, winRate: 33.3 },
  { month: 'Jan', pnl: 3400, trades: 14, winRate: 71.4 },
  { month: 'Feb', pnl: 2150, trades: 9, winRate: 66.7 },
  { month: 'Mar', pnl: 5430, trades: 15, winRate: 73.3 },
]

const ASSET_PERFORMANCE = [
  { asset: 'Crypto', pnl: 8420, winRate: 72, count: 22, color: '#f59e0b' },
  { asset: 'Forex', pnl: 3240, winRate: 64, count: 18, color: '#10b981' },
  { asset: 'Commodities', pnl: 2150, winRate: 60, count: 10, color: '#ec4899' },
  { asset: 'US Stocks', pnl: 470, winRate: 50, count: 4, color: '#6366f1' },
]

const RECENT_TRADES: TradeLog[] = [
  { id: 'T-101', symbol: 'BTCUSDT', assetClass: 'Crypto', type: 'LONG', entry: 83500, exit: 85200, pnl: 1700, pnlPercent: 2.03, result: 'WIN', date: '2026-03-15' },
  { id: 'T-102', symbol: 'EURUSD', assetClass: 'Forex', type: 'SHORT', entry: 1.0890, exit: 1.0840, pnl: 500, pnlPercent: 0.46, result: 'WIN', date: '2026-03-14' },
  { id: 'T-103', symbol: 'XAUUSD', assetClass: 'Commodities', type: 'LONG', entry: 2690, exit: 2675, pnl: -300, pnlPercent: -0.56, result: 'LOSS', date: '2026-03-13' },
  { id: 'T-104', symbol: 'SOLUSDT', assetClass: 'Crypto', type: 'LONG', entry: 185.0, exit: 198.5, pnl: 1350, pnlPercent: 7.30, result: 'WIN', date: '2026-03-12' },
  { id: 'T-105', symbol: 'AAPL', assetClass: 'Stock', type: 'SHORT', entry: 228.0, exit: 224.5, pnl: 350, pnlPercent: 1.53, result: 'WIN', date: '2026-03-11' },
  { id: 'T-106', symbol: 'ETHUSDT', assetClass: 'Crypto', type: 'SHORT', entry: 2720, exit: 2780, pnl: -600, pnlPercent: -2.20, result: 'LOSS', date: '2026-03-10' },
]

export function AnalyticsPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'6M' | 'YTD' | 'ALL'>('6M')

  const totalPnL = MONTHLY_PERFORMANCE.reduce((acc, m) => acc + m.pnl, 0)
  const totalTrades = MONTHLY_PERFORMANCE.reduce((acc, m) => acc + m.trades, 0)
  const maxMonthlyPnL = Math.max(...MONTHLY_PERFORMANCE.map((m) => Math.abs(m.pnl)))

  return (
    <div className="analytics-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Performance Analytics & PnL Dashboard</h1>
          <p className="page-subtitle">Track win rate, profit factor, risk ratios, and asset breakdown</p>
        </div>
        <div className="timeframe-picker">
          {(['6M', 'YTD', 'ALL'] as const).map((tf) => (
            <button
              key={tf}
              className={`tf-btn ${selectedTimeframe === tf ? 'active' : ''}`}
              onClick={() => setSelectedTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </header>

      {/* KPI Cards Header */}
      <div className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-header">
            <span className="kpi-label">Net Profit & Loss</span>
            <span className="kpi-badge positive">+28.4% Return</span>
          </div>
          <div className="kpi-value positive">
            +${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-footer">
            <TrendingUpIcon className="icon-green" /> Total net trading profit
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Win Rate</span>
            <span className="kpi-badge neutral">36W / 18L</span>
          </div>
          <div className="kpi-value">66.7%</div>
          <div className="kpi-footer">
            <div className="winrate-bar-track">
              <div className="winrate-bar-fill" style={{ width: '66.7%' }} />
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Profit Factor</span>
            <span className="kpi-badge positive">Healthy &gt; 2.0</span>
          </div>
          <div className="kpi-value">2.45</div>
          <div className="kpi-footer">Gross Profit / Gross Loss</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Avg Win / Avg Loss</span>
            <span className="kpi-badge neutral">1 : 2.46 R:R</span>
          </div>
          <div className="kpi-value-row">
            <span className="val-win">+$640</span>
            <span className="val-sep">/</span>
            <span className="val-loss">-$260</span>
          </div>
          <div className="kpi-footer">{totalTrades} Total Closed Trades</div>
        </div>
      </div>

      {/* Bar Charts Section */}
      <div className="charts-section">
        {/* Monthly P&L Bar Chart */}
        <div className="chart-card flex-2">
          <div className="card-top">
            <div>
              <h3 className="card-heading">Monthly P&L Distribution ($)</h3>
              <p className="card-sub">Net profit and loss broken down by month</p>
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="dot green" /> Profit</span>
              <span className="legend-item"><span className="dot red" /> Loss</span>
            </div>
          </div>

          <div className="pnl-bar-chart">
            <div className="chart-zero-line" />
            <div className="bars-container">
              {MONTHLY_PERFORMANCE.map((item, idx) => {
                const heightPct = Math.min(100, (Math.abs(item.pnl) / maxMonthlyPnL) * 85)
                const isPositive = item.pnl >= 0

                return (
                  <div key={idx} className="bar-column">
                    <div className="bar-value-label">
                      {isPositive ? `+$${item.pnl}` : `-$${Math.abs(item.pnl)}`}
                    </div>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${isPositive ? 'bar-positive' : 'bar-negative'}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <div className="bar-label">{item.month}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Asset Class Performance */}
        <div className="chart-card flex-1">
          <div className="card-top">
            <div>
              <h3 className="card-heading">Asset Class Breakdown</h3>
              <p className="card-sub">Profit distribution by market type</p>
            </div>
          </div>

          <div className="asset-breakdown-list">
            {ASSET_PERFORMANCE.map((item, idx) => (
              <div key={idx} className="asset-breakdown-item">
                <div className="asset-info-row">
                  <span className="asset-name" style={{ borderLeft: `3px solid ${item.color}` }}>
                    {item.asset}
                  </span>
                  <span className="asset-pnl positive">+${item.pnl.toLocaleString()}</span>
                </div>
                <div className="asset-progress-bar">
                  <div
                    className="asset-progress-fill"
                    style={{ width: `${item.winRate}%`, backgroundColor: item.color }}
                  />
                </div>
                <div className="asset-sub-info">
                  <span>{item.winRate}% Win Rate</span>
                  <span>{item.count} Trades</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trade Log History Table */}
      <div className="table-card">
        <div className="card-top">
          <div>
            <h3 className="card-heading">Recent Executed Trades</h3>
            <p className="card-sub">Detailed log of recent closed trades</p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="trades-table">
            <thead>
              <tr>
                <th>Trade ID</th>
                <th>Symbol</th>
                <th>Asset Class</th>
                <th>Type</th>
                <th>Entry Price</th>
                <th>Exit Price</th>
                <th>Net P&L ($)</th>
                <th>Return (%)</th>
                <th>Result</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_TRADES.map((trade) => (
                <tr key={trade.id}>
                  <td className="trade-id">{trade.id}</td>
                  <td className="trade-symbol">{trade.symbol}</td>
                  <td><span className="table-tag">{trade.assetClass}</span></td>
                  <td>
                    <span className={`type-badge ${trade.type.toLowerCase()}`}>
                      {trade.type}
                    </span>
                  </td>
                  <td>${trade.entry.toLocaleString()}</td>
                  <td>${trade.exit.toLocaleString()}</td>
                  <td className={`pnl-val ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                    {trade.pnl >= 0 ? `+$${trade.pnl.toLocaleString()}` : `-$${Math.abs(trade.pnl).toLocaleString()}`}
                  </td>
                  <td className={`pnl-val ${trade.pnlPercent >= 0 ? 'positive' : 'negative'}`}>
                    {trade.pnlPercent >= 0 ? `+${trade.pnlPercent}%` : `${trade.pnlPercent}%`}
                  </td>
                  <td>
                    <span className={`result-pill ${trade.result.toLowerCase()}`}>
                      {trade.result}
                    </span>
                  </td>
                  <td className="trade-date">{trade.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
