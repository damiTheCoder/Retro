import { useState, useEffect, useMemo, useRef } from 'react'
import { TrendingUpIcon } from './ShadcnIcons'
import { getJournalEntries, subscribeJournalEntries, type JournalEntry } from '../utils/tradeJournalStore'
import './AnalyticsPage.css'

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export function AnalyticsPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [selectedTimeframe, setSelectedTimeframe] = useState<'6M' | 'YTD' | 'ALL' | 'CUSTOM'>('6M')
  const [selectedYear, setSelectedYear] = useState<string>('ALL')
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL')
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false)
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setEntries(getJournalEntries())
    const unsubscribe = subscribeJournalEntries((newEntries) => {
      setEntries(newEntries)
    })
    return () => unsubscribe()
  }, [])

  // Close date dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Generate ALL available Years dynamically + past range so all years are visible
  const availableYears = useMemo(() => {
    const yrSet = new Set<string>()
    entries.forEach((e) => {
      if (e.createdAt) {
        const yr = e.createdAt.split('-')[0]
        if (yr && yr.length === 4) {
          yrSet.add(yr)
        }
      }
    })
    const currentYr = new Date().getFullYear()
    for (let i = 0; i < 7; i++) {
      yrSet.add((currentYr - i).toString())
    }

    return Array.from(yrSet).sort().reverse()
  }, [entries])

  // Get active label for dropdown trigger button
  const activeFilterLabel = useMemo(() => {
    if (selectedYear !== 'ALL') {
      if (selectedMonth !== 'ALL') {
        const mIdx = parseInt(selectedMonth, 10) - 1
        return `${selectedYear} • ${SHORT_MONTH_NAMES[mIdx]}`
      }
      return `${selectedYear} (All Months)`
    }
    if (selectedTimeframe === '6M') return '6M'
    if (selectedTimeframe === 'YTD') return 'YTD'
    return 'All Time'
  }, [selectedYear, selectedMonth, selectedTimeframe])

  // Filter entries based on selected Year, Month, or Timeframe preset
  const filteredEntries = useMemo(() => {
    if (selectedYear !== 'ALL') {
      if (selectedMonth !== 'ALL') {
        const targetPrefix = `${selectedYear}-${selectedMonth}`
        return entries.filter((e) => e.createdAt && e.createdAt.startsWith(targetPrefix))
      }
      return entries.filter((e) => e.createdAt && e.createdAt.startsWith(selectedYear))
    }

    if (selectedTimeframe === '6M') {
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - 6)
      return entries.filter((e) => new Date(e.createdAt || Date.now()) >= cutoff)
    }

    if (selectedTimeframe === 'YTD') {
      const currentYear = new Date().getFullYear().toString()
      return entries.filter((e) => e.createdAt && e.createdAt.startsWith(currentYear))
    }

    return entries
  }, [entries, selectedYear, selectedMonth, selectedTimeframe])

  // Compute key KPIs
  const totalPnL = useMemo(() => {
    return filteredEntries.reduce((acc, e) => acc + (e.pnlAmount || 0), 0)
  }, [filteredEntries])

  const totalReturnPct = useMemo(() => {
    return filteredEntries.reduce((acc, e) => acc + (e.pnlPercentage || 0), 0)
  }, [filteredEntries])

  const winCount = useMemo(() => {
    return filteredEntries.filter((e) => e.outcome === 'WIN').length
  }, [filteredEntries])

  const lossCount = useMemo(() => {
    return filteredEntries.filter((e) => e.outcome === 'LOSS').length
  }, [filteredEntries])

  const totalTrades = filteredEntries.length

  const winRatePct = useMemo(() => {
    if (totalTrades === 0) return 0
    return (winCount / totalTrades) * 100
  }, [totalTrades, winCount])

  const { profitFactor, avgWin, avgLoss, rrRatio } = useMemo(() => {
    let gp = 0
    let gl = 0
    filteredEntries.forEach((e) => {
      const pnl = e.pnlAmount || 0
      if (pnl > 0) gp += pnl
      else if (pnl < 0) gl += Math.abs(pnl)
    })

    const pf = gl > 0 ? gp / gl : gp > 0 ? 99.9 : 0
    const aWin = winCount > 0 ? gp / winCount : 0
    const aLoss = lossCount > 0 ? gl / lossCount : 0
    const rr = aLoss > 0 ? (aWin / aLoss).toFixed(2) : aWin > 0 ? 'Infinite' : '1.00'

    return {
      grossProfit: gp,
      grossLoss: gl,
      profitFactor: pf,
      avgWin: aWin,
      avgLoss: aLoss,
      rrRatio: rr,
    }
  }, [filteredEntries, winCount, lossCount])

  // Compute Monthly Performance Bar Chart Data (last 6 months distribution)
  const monthlyPerformance = useMemo(() => {
    const monthsList: { month: string; yearMonthKey: string }[] = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const yr = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const label = SHORT_MONTH_NAMES[d.getMonth()]
      monthsList.push({ month: label, yearMonthKey: `${yr}-${mo}` })
    }

    return monthsList.map(({ month, yearMonthKey }) => {
      const monthEntries = entries.filter((e) => e.createdAt && e.createdAt.startsWith(yearMonthKey))
      const pnl = monthEntries.reduce((acc, e) => acc + (e.pnlAmount || 0), 0)
      const tradesCount = monthEntries.length
      const wins = monthEntries.filter((e) => e.outcome === 'WIN').length
      const wr = tradesCount > 0 ? (wins / tradesCount) * 100 : 0

      return {
        month,
        yearMonthKey,
        pnl,
        trades: tradesCount,
        winRate: parseFloat(wr.toFixed(1)),
      }
    })
  }, [entries])

  const maxMonthlyPnL = useMemo(() => {
    const vals = monthlyPerformance.map((m) => Math.abs(m.pnl))
    return Math.max(...vals, 1000)
  }, [monthlyPerformance])

  // Compute Asset Performance Breakdown
  const assetPerformance = useMemo(() => {
    const assetMap = new Map<string, { pnl: number; count: number; wins: number }>()

    filteredEntries.forEach((e) => {
      const asset = e.assetClass || 'Other'
      const current = assetMap.get(asset) || { pnl: 0, count: 0, wins: 0 }
      current.pnl += e.pnlAmount || 0
      current.count += 1
      if (e.outcome === 'WIN') current.wins += 1
      assetMap.set(asset, current)
    })

    if (assetMap.size === 0) {
      return [
        { asset: 'Crypto', pnl: 0, winRate: 0, count: 0, isWhiteBar: true },
        { asset: 'Forex', pnl: 0, winRate: 0, count: 0, isWhiteBar: false },
        { asset: 'Commodities', pnl: 0, winRate: 0, count: 0, isWhiteBar: true },
        { asset: 'Stock', pnl: 0, winRate: 0, count: 0, isWhiteBar: false },
      ]
    }

    return Array.from(assetMap.entries()).map(([asset, data], idx) => {
      const wr = data.count > 0 ? Math.round((data.wins / data.count) * 100) : 0
      return {
        asset,
        pnl: data.pnl,
        winRate: wr,
        count: data.count,
        isWhiteBar: idx % 2 === 0,
      }
    })
  }, [filteredEntries])

  return (
    <div className="analytics-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Performance Analytics & PnL Dashboard</h1>
          <p className="page-subtitle">Track win rate, profit factor, risk ratios, and asset breakdown</p>
        </div>

        {/* Date Dropdown Component */}
        <div className="date-dropdown-container" ref={dropdownRef}>
          <button
            className={`date-dropdown-trigger ${isDropdownOpen ? 'open' : ''}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <svg className="date-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span className="trigger-label">{activeFilterLabel}</span>
            <svg className={`caret-icon ${isDropdownOpen ? 'rotate' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="date-dropdown-popover">
              {/* Presets Row */}
              <div className="popover-section">
                <div className="popover-section-label">Quick Presets</div>
                <div className="popover-pills-row">
                  <button
                    className={`pop-pill-btn ${selectedYear === 'ALL' && selectedTimeframe === '6M' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedYear('ALL')
                      setSelectedMonth('ALL')
                      setSelectedTimeframe('6M')
                      setIsDropdownOpen(false)
                    }}
                  >
                    6M
                  </button>
                  <button
                    className={`pop-pill-btn ${selectedYear === 'ALL' && selectedTimeframe === 'YTD' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedYear('ALL')
                      setSelectedMonth('ALL')
                      setSelectedTimeframe('YTD')
                      setIsDropdownOpen(false)
                    }}
                  >
                    YTD
                  </button>
                  <button
                    className={`pop-pill-btn ${selectedYear === 'ALL' && selectedTimeframe === 'ALL' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedYear('ALL')
                      setSelectedMonth('ALL')
                      setSelectedTimeframe('ALL')
                      setIsDropdownOpen(false)
                    }}
                  >
                    All Time
                  </button>
                </div>
              </div>

              {/* All Years Horizontal Buttons */}
              <div className="popover-section">
                <div className="popover-section-label">All Available Years</div>
                <div className="popover-pills-row horizontal-scroll">
                  <button
                    className={`pop-pill-btn ${selectedYear === 'ALL' && selectedTimeframe === 'ALL' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedYear('ALL')
                      setSelectedMonth('ALL')
                      setSelectedTimeframe('ALL')
                    }}
                  >
                    All Years
                  </button>
                  {availableYears.map((yr) => (
                    <button
                      key={yr}
                      className={`pop-pill-btn ${selectedYear === yr ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedYear(yr)
                        setSelectedMonth('ALL')
                        setSelectedTimeframe('CUSTOM')
                      }}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Months Horizontal Buttons (Revealed when a specific Year is selected) */}
              {selectedYear !== 'ALL' && (
                <div className="popover-section months-popover-reveal">
                  <div className="popover-section-label">Months in {selectedYear}</div>
                  <div className="popover-pills-row horizontal-scroll">
                    <button
                      className={`pop-pill-btn month-btn ${selectedMonth === 'ALL' ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedMonth('ALL')
                        setIsDropdownOpen(false)
                      }}
                    >
                      All Months
                    </button>
                    {SHORT_MONTH_NAMES.map((mName, idx) => {
                      const mVal = String(idx + 1).padStart(2, '0')
                      return (
                        <button
                          key={mVal}
                          className={`pop-pill-btn month-btn ${selectedMonth === mVal ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedMonth(mVal)
                            setIsDropdownOpen(false)
                          }}
                        >
                          {mName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* KPI Cards Header */}
      <div className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-header">
            <span className="kpi-label">Net Profit & Loss</span>
            <span className={`kpi-badge ${totalReturnPct >= 0 ? 'positive' : 'negative'}`}>
              {totalReturnPct >= 0 ? `+${totalReturnPct.toFixed(1)}% Return` : `${totalReturnPct.toFixed(1)}% Return`}
            </span>
          </div>
          <div className={`kpi-value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
            {totalPnL >= 0
              ? `+$${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `-$${Math.abs(totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div className="kpi-footer">
            <TrendingUpIcon className={totalPnL >= 0 ? 'icon-green' : 'icon-red'} /> Total net trading profit
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Win Rate</span>
            <span className="kpi-badge neutral">
              {winCount}W / {lossCount}L
            </span>
          </div>
          <div className="kpi-value">{winRatePct.toFixed(1)}%</div>
          <div className="kpi-footer">
            <div className="winrate-bar-track">
              <div className="winrate-bar-fill" style={{ width: `${Math.min(100, Math.max(0, winRatePct))}%` }} />
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Profit Factor</span>
            <span className={`kpi-badge ${profitFactor >= 2 ? 'positive' : 'neutral'}`}>
              {profitFactor >= 2 ? 'Healthy > 2.0' : profitFactor >= 1 ? 'Profitable' : 'Under 1.0'}
            </span>
          </div>
          <div className="kpi-value">{profitFactor.toFixed(2)}</div>
          <div className="kpi-footer">Gross Profit / Gross Loss</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Avg Win / Avg Loss</span>
            <span className="kpi-badge neutral">1 : {rrRatio} R:R</span>
          </div>
          <div className="kpi-value-row">
            <span className="val-win">+${Math.round(avgWin)}</span>
            <span className="val-sep">/</span>
            <span className="val-loss">-${Math.round(avgLoss)}</span>
          </div>
          <div className="kpi-footer">{totalTrades} Total Closed Trades</div>
        </div>
      </div>

      {/* Modern Black & White Shadcn Bar Charts Section */}
      <div className="charts-section">
        {/* Monthly P&L Shadcn Bar Chart */}
        <div className="chart-card flex-2">
          <div className="card-top">
            <div>
              <h3 className="card-heading">Monthly P&L Distribution ($)</h3>
              <p className="card-sub">Shadcn Black & White Bar Chart Component</p>
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-box white-bar-box" /> Profit (White with Black Border)
              </span>
              <span className="legend-item">
                <span className="legend-box black-bar-box" /> Loss (Solid Black)
              </span>
            </div>
          </div>

          <div className="shadcn-bar-chart-wrapper">
            <div className="chart-grid-lines">
              <div className="grid-line" />
              <div className="grid-line zero-line" />
              <div className="grid-line" />
            </div>

            <div className="shadcn-bars-flex">
              {monthlyPerformance.map((item, idx) => {
                const isPositive = item.pnl >= 0
                const heightPct = Math.min(100, Math.max(item.trades > 0 ? 18 : 6, (Math.abs(item.pnl) / maxMonthlyPnL) * 88))
                const isHovered = hoveredBarIndex === idx

                return (
                  <div
                    key={idx}
                    className="shadcn-bar-column"
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                  >
                    {/* Tooltip on Hover */}
                    {isHovered && (
                      <div className="shadcn-chart-tooltip">
                        <span className="tooltip-title">{item.month} Performance</span>
                        <span className="tooltip-val">
                          {isPositive ? `+$${item.pnl.toLocaleString()}` : `-$${Math.abs(item.pnl).toLocaleString()}`}
                        </span>
                        <span className="tooltip-sub">{item.trades} trades • {item.winRate}% Win Rate</span>
                      </div>
                    )}

                    <div className="bar-val-tag">
                      {item.trades > 0
                        ? isPositive
                          ? `+$${item.pnl.toLocaleString()}`
                          : `-$${Math.abs(item.pnl).toLocaleString()}`
                        : '$0'}
                    </div>

                    <div className="shadcn-bar-container">
                      {/* Black & White Bar Element (White has solid Black border) */}
                      <div
                        className={`shadcn-bar-element ${isPositive ? 'white-bordered-bar' : 'solid-black-bar'}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    <div className="shadcn-bar-month">{item.month}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Asset Class Breakdown Horizontal Bar Chart */}
        <div className="chart-card flex-1">
          <div className="card-top">
            <div>
              <h3 className="card-heading">Asset Class Breakdown</h3>
              <p className="card-sub">Shadcn Horizontal Black & White Bars</p>
            </div>
          </div>

          <div className="shadcn-horizontal-bars-list">
            {assetPerformance.map((item, idx) => (
              <div key={idx} className="horizontal-bar-item">
                <div className="hbar-label-row">
                  <span className="hbar-name">{item.asset}</span>
                  <span className="hbar-val">
                    {item.pnl >= 0 ? `+$${item.pnl.toLocaleString()}` : `-$${Math.abs(item.pnl).toLocaleString()}`}
                  </span>
                </div>
                <div className="hbar-track">
                  <div
                    className={`hbar-fill ${item.isWhiteBar ? 'white-bordered-hbar' : 'solid-black-hbar'}`}
                    style={{ width: `${item.winRate || 10}%` }}
                  />
                </div>
                <div className="hbar-sub-info">
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
            <p className="card-sub">Detailed log of real closed trades from journal</p>
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
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>
                    No trading records found for the selected timeframe.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((trade) => {
                  const tradeId = trade.tradeId || trade.id
                  const pnl = trade.pnlAmount || 0
                  const pnlPct = trade.pnlPercentage || 0
                  const isWin = trade.outcome === 'WIN'

                  return (
                    <tr key={trade.id}>
                      <td className="trade-id">{tradeId}</td>
                      <td className="trade-symbol">{trade.symbol}</td>
                      <td><span className="table-tag">{trade.assetClass}</span></td>
                      <td>
                        <span className={`type-badge ${trade.direction.toLowerCase()}`}>
                          {trade.direction}
                        </span>
                      </td>
                      <td>${trade.entryPrice?.toLocaleString() ?? 0}</td>
                      <td>${trade.exitPrice?.toLocaleString() ?? 0}</td>
                      <td className={`pnl-val ${pnl >= 0 ? 'positive' : 'negative'}`}>
                        {pnl >= 0 ? `+$${pnl.toLocaleString()}` : `-$${Math.abs(pnl).toLocaleString()}`}
                      </td>
                      <td className={`pnl-val ${pnlPct >= 0 ? 'positive' : 'negative'}`}>
                        {pnlPct >= 0 ? `+${pnlPct}%` : `${pnlPct}%`}
                      </td>
                      <td>
                        <span className={`result-pill ${isWin ? 'win' : 'loss'}`}>
                          {trade.outcome}
                        </span>
                      </td>
                      <td className="trade-date">{trade.createdAt}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

