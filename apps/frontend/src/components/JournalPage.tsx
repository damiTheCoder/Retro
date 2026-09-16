import { useState, useEffect, useMemo } from 'react'
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  ScrollTextIcon,
} from './ShadcnIcons'
import {
  getJournalEntries,
  deleteJournalEntry,
  subscribeJournalEntries,
  addJournalEntry,
  type JournalEntry,
} from '../utils/tradeJournalStore'
import './JournalPage.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAssetFilter, setSelectedAssetFilter] = useState<string>('All')
  const [selectedOutcomeFilter, setSelectedOutcomeFilter] = useState<string>('All')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // Calendar View Month & Year state (Defaults to March 2026)
  const [viewYear, setViewYear] = useState<number>(2026)
  const [viewMonth, setViewMonth] = useState<number>(2) // 0-indexed: 2 = March

  const [selectedEntryDetails, setSelectedEntryDetails] = useState<JournalEntry | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Form State for new strategy documentation
  const [title, setTitle] = useState('')
  const [assetClass, setAssetClass] = useState('Crypto')
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG')
  const [entryPrice, setEntryPrice] = useState('83500')
  const [exitPrice, setExitPrice] = useState('85200')
  const [rules, setRules] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setEntries(getJournalEntries())
    const unsubscribe = subscribeJournalEntries((updated) => {
      setEntries(updated)
    })
    return () => unsubscribe()
  }, [])

  // Aggregate trade entry stats by date 'YYYY-MM-DD'
  const entriesByDate = useMemo(() => {
    const map: Record<string, { total: number; wins: number; losses: number; entries: JournalEntry[] }> = {}
    entries.forEach((e) => {
      if (!e.createdAt) return
      if (!map[e.createdAt]) {
        map[e.createdAt] = { total: 0, wins: 0, losses: 0, entries: [] }
      }
      map[e.createdAt].total += 1
      if (e.outcome === 'WIN') map[e.createdAt].wins += 1
      else map[e.createdAt].losses += 1
      map[e.createdAt].entries.push(e)
    })
    return map
  }, [entries])

  // Calendar Days calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay()
    const totalDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const totalDaysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const days: Array<{
      day: number
      monthOffset: -1 | 0 | 1
      dateStr: string
    }> = []

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      days.push({ day: dayNum, monthOffset: -1, dateStr })
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ day, monthOffset: 0, dateStr })
    }

    // Next month padding days to reach multiple of 7
    const remainingSlots = 35 - days.length
    for (let day = 1; day <= (remainingSlots < 0 ? 42 - days.length : remainingSlots); day++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ day, monthOffset: 1, dateStr })
    }

    return days
  }, [viewYear, viewMonth])

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((prev) => prev - 1)
    } else {
      setViewMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((prev) => prev + 1)
    } else {
      setViewMonth((prev) => prev + 1)
    }
  }

  const handleDateClick = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null) // Toggle off if clicked again
    } else {
      setSelectedDate(dateStr)
    }
  }

  const handleAddStrategy = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const ep = parseFloat(entryPrice) || 100
    const xp = parseFloat(exitPrice) || 105
    const isLong = direction === 'LONG'
    const outcome = (isLong ? xp > ep : xp < ep) ? 'WIN' : 'LOSS'
    const pnl = Math.round((isLong ? xp - ep : ep - xp) * 10)
    const pct = parseFloat(((isLong ? (xp - ep) / ep : (ep - xp) / ep) * 100).toFixed(2))

    addJournalEntry({
      title: title.trim(),
      assetClass,
      symbol: symbol.toUpperCase(),
      direction,
      entryPrice: ep,
      exitPrice: xp,
      targetPrice: xp,
      stopPrice: ep * 0.98,
      outcome,
      pnlAmount: pnl,
      pnlPercentage: pct,
      winRate: 68.5,
      riskReward: '1 : 2.5',
      totalReplays: 1,
      rules: rules.split('\n').filter((r) => r.trim().length > 0),
      notes: notes.trim(),
      tags: [assetClass, 'Replay Documented'],
    })

    setShowAddModal(false)
    setTitle('')
    setRules('')
    setNotes('')
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to remove this trade entry?')) {
      deleteJournalEntry(id)
    }
  }

  const filteredEntries = entries.filter((entry) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      entry.symbol.toLowerCase().includes(q) ||
      entry.title.toLowerCase().includes(q) ||
      (entry.tradeId && entry.tradeId.toLowerCase().includes(q)) ||
      entry.assetClass.toLowerCase().includes(q)

    const matchesAsset = selectedAssetFilter === 'All' || entry.assetClass.toLowerCase() === selectedAssetFilter.toLowerCase()
    const matchesOutcome =
      selectedOutcomeFilter === 'All' ||
      (selectedOutcomeFilter === 'Wins' && entry.outcome === 'WIN') ||
      (selectedOutcomeFilter === 'Losses' && entry.outcome === 'LOSS')

    const matchesDate = !selectedDate || entry.createdAt === selectedDate

    return matchesSearch && matchesAsset && matchesOutcome && matchesDate
  })

  const formatPrice = (val?: number) => {
    if (val == null) return '-'
    if (val >= 100) {
      return `$${val.toLocaleString('en-US')}`
    } else {
      return `$${val.toString()}`
    }
  }

  return (
    <div className="journal-page">
      {/* Top Header & Actions Bar */}
      <div className="journal-top-bar">
        <div>
          <h1 className="journal-title">Trade Journal</h1>
          <p className="journal-subtitle">Log, review, and analyze your executed trades & replay sessions</p>
        </div>
        <button className="add-strat-btn" onClick={() => setShowAddModal(true)}>
          <PlusIcon /> Document Trade
        </button>
      </div>

      {/* Interactive Calendar Component (Placed directly below header text) */}
      <div className="journal-calendar-card">
        <div className="calendar-header-bar">
          <div className="calendar-title-group">
            <CalendarIcon className="calendar-header-icon" />
            <span className="calendar-section-title">Execution Calendar</span>
            {selectedDate && (
              <span className="selected-date-badge">
                Showing trades for {selectedDate}
                <button className="btn-clear-date" onClick={() => setSelectedDate(null)}>
                  ✕ Clear
                </button>
              </span>
            )}
          </div>

          <div className="calendar-nav-controls">
            <button className="calendar-nav-btn" onClick={handlePrevMonth} title="Previous Month">
              <ChevronLeftIcon />
            </button>
            <span className="current-month-year-text">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button className="calendar-nav-btn" onClick={handleNextMonth} title="Next Month">
              <ChevronRightIcon />
            </button>

            {/* Quick Year Selector */}
            <div className="calendar-year-pills">
              {[2024, 2025, 2026, 2027].map((yr) => (
                <button
                  key={yr}
                  className={`year-pill-btn ${viewYear === yr ? 'active' : ''}`}
                  onClick={() => setViewYear(yr)}
                >
                  {yr}
                </button>
              ))}
            </div>

            <button
              className={`calendar-all-dates-btn ${selectedDate === null ? 'active' : ''}`}
              onClick={() => setSelectedDate(null)}
            >
              All Days
            </button>
          </div>
        </div>

        {/* Weekday Labels Grid */}
        <div className="calendar-weekdays-grid">
          {WEEKDAY_NAMES.map((w) => (
            <div key={w} className="calendar-weekday-cell">
              {w}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="calendar-days-grid">
          {calendarDays.map(({ day, monthOffset, dateStr }, index) => {
            const dateStats = entriesByDate[dateStr]
            const isSelected = selectedDate === dateStr
            const isOtherMonth = monthOffset !== 0

            return (
              <div
                key={`${dateStr}-${index}`}
                className={`calendar-day-cell ${isOtherMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${dateStats ? 'has-trades' : ''}`}
                onClick={() => handleDateClick(dateStr)}
              >
                <span className="day-number">{day}</span>
                {dateStats && (
                  <div className="day-trade-indicators">
                    {dateStats.wins > 0 && <span className="trade-dot win" title={`${dateStats.wins} Win(s)`} />}
                    {dateStats.losses > 0 && <span className="trade-dot loss" title={`${dateStats.losses} Loss(es)`} />}
                    <span className="day-trade-count">{dateStats.total}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="journal-controls">
        <div className="search-box">
          <SearchIcon className="search-icon" />
          <input
            type="text"
            placeholder="Search by Trade ID, symbol, asset class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <div className="asset-filter-pills">
            {['All', 'Crypto', 'Forex', 'Commodities', 'Stock'].map((asset) => (
              <button
                key={asset}
                className={`filter-pill ${selectedAssetFilter === asset ? 'active' : ''}`}
                onClick={() => setSelectedAssetFilter(asset)}
              >
                {asset}
              </button>
            ))}
          </div>

          <div className="outcome-filter-pills">
            {['All', 'Wins', 'Losses'].map((outcome) => (
              <button
                key={outcome}
                className={`outcome-pill ${selectedOutcomeFilter === outcome ? 'active' : ''}`}
                onClick={() => setSelectedOutcomeFilter(outcome)}
              >
                {outcome}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Trade Journal Card Container (Matches Screenshot 1:1) */}
      <div className="journal-card-container">
        <div className="recent-trades-header">
          <h2 className="recent-trades-title">Recent Executed Trades</h2>
          <p className="recent-trades-subtitle">Detailed log of recent closed trades</p>
        </div>

        <div className="journal-table-scroll-container">
          <table className="journal-data-table">
            <thead>
              <tr>
                <th>TRADE ID</th>
                <th>SYMBOL</th>
                <th>ASSET CLASS</th>
                <th>TYPE</th>
                <th>ENTRY PRICE</th>
                <th>EXIT PRICE</th>
                <th>NET P&L ($)</th>
                <th>RETURN (%)</th>
                <th>RESULT</th>
                <th>DATE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-table-cell">
                    <div className="empty-state-box">
                      <span><ScrollTextIcon style={{ verticalAlign: 'middle', marginRight: 6 }} /> No closed trade logs match your filter search.</span>
                      <button className="reset-filter-btn" onClick={() => { setSearchQuery(''); setSelectedAssetFilter('All'); setSelectedOutcomeFilter('All'); setSelectedDate(null) }}>
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} onClick={() => setSelectedEntryDetails(entry)} className="journal-table-row">
                    {/* TRADE ID */}
                    <td className="cell-trade-id">{entry.tradeId || 'T-101'}</td>

                    {/* SYMBOL */}
                    <td className="cell-symbol">{entry.symbol}</td>

                    {/* ASSET CLASS */}
                    <td className="cell-asset">
                      <span className="asset-pill-badge">{entry.assetClass}</span>
                    </td>

                    {/* TYPE (LONG / SHORT) */}
                    <td className="cell-type">
                      <span className={`type-pill-badge ${entry.direction.toLowerCase()}`}>
                        {entry.direction}
                      </span>
                    </td>

                    {/* ENTRY PRICE */}
                    <td className="cell-price">{formatPrice(entry.entryPrice)}</td>

                    {/* EXIT PRICE */}
                    <td className="cell-price">{formatPrice(entry.exitPrice || entry.targetPrice)}</td>

                    {/* NET P&L ($) */}
                    <td className={`cell-pnl ${entry.pnlAmount >= 0 ? 'positive' : 'negative'}`}>
                      {entry.pnlAmount >= 0 ? `+$${entry.pnlAmount.toLocaleString('en-US')}` : `-$${Math.abs(entry.pnlAmount).toLocaleString('en-US')}`}
                    </td>

                    {/* RETURN (%) */}
                    <td className={`cell-return ${entry.pnlPercentage >= 0 ? 'positive' : 'negative'}`}>
                      {entry.pnlPercentage >= 0 ? `+${entry.pnlPercentage}%` : `${entry.pnlPercentage}%`}
                    </td>

                    {/* RESULT (WIN / LOSS) */}
                    <td className="cell-result">
                      <span className={`result-pill-badge ${entry.outcome.toLowerCase()}`}>
                        {entry.outcome}
                      </span>
                    </td>

                    {/* DATE */}
                    <td className="cell-date">{entry.createdAt}</td>

                    {/* ACTIONS */}
                    <td className="cell-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-delete-entry" onClick={(e) => handleDelete(entry.id, e)} title="Delete trade entry">
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade Details Popover / Modal */}
      {selectedEntryDetails && (
        <div className="modal-overlay" onClick={() => setSelectedEntryDetails(null)}>
          <div className="modal-content details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-left">
                <span className="asset-pill-badge">{selectedEntryDetails.assetClass}</span>
                <h2>{selectedEntryDetails.tradeId}: {selectedEntryDetails.symbol} Trade Details</h2>
              </div>
              <button className="btn-close-modal" onClick={() => setSelectedEntryDetails(null)}>✕</button>
            </div>

            <div className="details-grid">
              <div className="detail-box">
                <span className="detail-label">Symbol & Type</span>
                <span className="detail-value">{selectedEntryDetails.symbol} ({selectedEntryDetails.direction})</span>
              </div>
              <div className="detail-box">
                <span className="detail-label">Result & Net PnL</span>
                <span className={`detail-value ${selectedEntryDetails.outcome === 'WIN' ? 'win' : 'loss'}`}>
                  {selectedEntryDetails.outcome} (${selectedEntryDetails.pnlAmount?.toLocaleString()})
                </span>
              </div>
              <div className="detail-box">
                <span className="detail-label">Entry Price</span>
                <span className="detail-value">{formatPrice(selectedEntryDetails.entryPrice)}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label">Exit Price</span>
                <span className="detail-value">{formatPrice(selectedEntryDetails.exitPrice || selectedEntryDetails.targetPrice)}</span>
              </div>
              <div className="detail-box">
                <span className="detail-label">Return (%)</span>
                <span className={`detail-value ${selectedEntryDetails.pnlPercentage >= 0 ? 'win' : 'loss'}`}>
                  {selectedEntryDetails.pnlPercentage >= 0 ? `+${selectedEntryDetails.pnlPercentage}%` : `${selectedEntryDetails.pnlPercentage}%`}
                </span>
              </div>
              <div className="detail-box">
                <span className="detail-label">Risk : Reward</span>
                <span className="detail-value">{selectedEntryDetails.riskReward || '1 : 2.5'}</span>
              </div>
            </div>

            {selectedEntryDetails.rules && selectedEntryDetails.rules.length > 0 && (
              <div className="modal-section">
                <h3>Strategy Rules</h3>
                <ul className="rules-list">
                  {selectedEntryDetails.rules.map((rule, i) => (
                    <li key={i}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedEntryDetails.notes && (
              <div className="modal-section">
                <h3>Replay Notes</h3>
                <p className="notes-text">{selectedEntryDetails.notes}</p>
              </div>
            )}

            <div className="modal-footer">
              <span className="entry-created-date">Logged on {selectedEntryDetails.createdAt}</span>
              <button className="btn-close-action" onClick={() => setSelectedEntryDetails(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Document New Strategy Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Document New Trade Log</h2>
            <form onSubmit={handleAddStrategy} className="modal-form">
              <div className="form-group">
                <label>Strategy / Trade Title</label>
                <input
                  type="text"
                  placeholder="e.g. BTCUSDT Order Block Sweep"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Asset Class</label>
                  <select value={assetClass} onChange={(e) => setAssetClass(e.target.value)}>
                    <option value="Crypto">Crypto</option>
                    <option value="Forex">Forex</option>
                    <option value="Commodities">Commodities</option>
                    <option value="Stock">Stock</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Ticker Symbol</label>
                  <input
                    type="text"
                    placeholder="BTCUSDT, EURUSD..."
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select value={direction} onChange={(e) => setDirection(e.target.value as any)}>
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Entry Price</label>
                  <input
                    type="number"
                    step="any"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Exit Price</label>
                <input
                  type="number"
                  step="any"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Execution Notes & Strategy Rules</label>
                <textarea
                  rows={3}
                  placeholder="Notes on trade setup, session timing, or Fib level..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  Save Trade Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
