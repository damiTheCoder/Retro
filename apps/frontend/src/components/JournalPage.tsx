import { useState } from 'react'
import { PlusIcon, SearchIcon } from './ShadcnIcons'
import './JournalPage.css'

export interface StrategyEntry {
  id: string
  title: string
  assetClass: string
  symbol: string
  winRate: number
  riskReward: string
  totalReplays: number
  rules: string[]
  notes: string
  createdAt: string
  tags: string[]
}

const INITIAL_STRATEGIES: StrategyEntry[] = [
  {
    id: 'strat-1',
    title: 'Order Block & Liquidity Sweep',
    assetClass: 'Crypto',
    symbol: 'BTCUSDT',
    winRate: 68.5,
    riskReward: '1 : 2.5',
    totalReplays: 24,
    rules: [
      'Wait for liquidity sweep above 4H high or low',
      'Look for 15M Market Structure Shift (MSS)',
      'Enter limit order at unmitigated Fair Value Gap (FVG)',
      'Stop loss beyond previous swing high/low',
    ],
    notes: 'Performed exception on BTC during New York session open. High win rate when confluence with 0.618 Fibonacci level.',
    createdAt: '2026-03-12',
    tags: ['ICT', 'Liquidity', 'Replay Verified'],
  },
  {
    id: 'strat-2',
    title: 'London Session Breakout',
    assetClass: 'Forex',
    symbol: 'EURUSD',
    winRate: 62.0,
    riskReward: '1 : 2.0',
    totalReplays: 18,
    rules: [
      'Identify Asian session range (00:00 - 07:00 UTC)',
      'Place buy stop 5 pips above Asian high and sell stop 5 pips below Asian low at 07:45 UTC',
      'Take profit 2x risk distance',
      'Close open orders by 16:00 UTC',
    ],
    notes: 'Solid performance on EURUSD and GBPUSD during Tuesday and Thursday trading sessions.',
    createdAt: '2026-03-14',
    tags: ['Breakout', 'FX', 'London Open'],
  },
  {
    id: 'strat-3',
    title: 'VWAP Mean Reversion',
    assetClass: 'Stock',
    symbol: 'AAPL',
    winRate: 58.4,
    riskReward: '1 : 1.8',
    totalReplays: 12,
    rules: [
      'Wait for stock price to extend 2 standard deviations away from Session VWAP',
      'Look for RSI divergence (under 30 or over 70)',
      'Enter opposite position targeting VWAP middle line',
    ],
    notes: 'Works best on high volume US stocks during early trading hours (9:30 AM - 11:30 AM EST).',
    createdAt: '2026-03-15',
    tags: ['VWAP', 'Mean Reversion', 'US Equities'],
  },
]

export function JournalPage() {
  const [strategies, setStrategies] = useState<StrategyEntry[]>(INITIAL_STRATEGIES)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAssetFilter, setSelectedAssetFilter] = useState<string>('All')
  const [showAddModal, setShowAddModal] = useState(false)

  // Form State for new strategy documentation
  const [title, setTitle] = useState('')
  const [assetClass, setAssetClass] = useState('Crypto')
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [winRate, setWinRate] = useState('65.0')
  const [riskReward, setRiskReward] = useState('1 : 2.0')
  const [rules, setRules] = useState('')
  const [notes, setNotes] = useState('')

  const handleAddStrategy = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const newStrat: StrategyEntry = {
      id: `strat-${Date.now()}`,
      title: title.trim(),
      assetClass,
      symbol: symbol.toUpperCase(),
      winRate: parseFloat(winRate) || 60.0,
      riskReward,
      totalReplays: 1,
      rules: rules.split('\n').filter((r) => r.trim().length > 0),
      notes: notes.trim(),
      createdAt: new Date().toISOString().split('T')[0],
      tags: [assetClass, 'Replay Documented'],
    }

    setStrategies([newStrat, ...strategies])
    setShowAddModal(false)
    setTitle('')
    setRules('')
    setNotes('')
  }

  const filteredStrategies = strategies.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.notes.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesAsset = selectedAssetFilter === 'All' || s.assetClass === selectedAssetFilter
    return matchesSearch && matchesAsset
  })

  return (
    <div className="journal-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Trading Journal & Strategy Hub</h1>
          <p className="page-subtitle">Document, test, and refine your replay strategies across all asset classes</p>
        </div>
        <button className="add-strat-btn" onClick={() => setShowAddModal(true)}>
          <PlusIcon /> Document New Strategy
        </button>
      </header>

      {/* Filter and Search Bar */}
      <div className="journal-controls">
        <div className="search-box">
          <SearchIcon className="search-icon" />
          <input
            type="text"
            placeholder="Search strategies, rules, notes, or symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="asset-filter-pills">
          {['All', 'Crypto', 'Forex', 'Stock', 'Commodity'].map((asset) => (
            <button
              key={asset}
              className={`filter-pill ${selectedAssetFilter === asset ? 'active' : ''}`}
              onClick={() => setSelectedAssetFilter(asset)}
            >
              {asset}
            </button>
          ))}
        </div>
      </div>

      {/* Strategies Grid */}
      <div className="strategies-grid">
        {filteredStrategies.map((strat) => (
          <div key={strat.id} className="strategy-card">
            <div className="card-header">
              <div>
                <span className={`asset-tag tag-${strat.assetClass.toLowerCase()}`}>{strat.assetClass}</span>
                <h3 className="strat-title">{strat.title}</h3>
              </div>
              <div className="symbol-badge">{strat.symbol}</div>
            </div>

            <div className="card-metrics">
              <div className="metric">
                <span className="metric-label">Win Rate</span>
                <span className={`metric-value ${strat.winRate >= 60 ? 'high' : 'medium'}`}>
                  {strat.winRate}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Risk : Reward</span>
                <span className="metric-value">{strat.riskReward}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Replays</span>
                <span className="metric-value">{strat.totalReplays} sessions</span>
              </div>
            </div>

            <div className="card-section">
              <h4 className="section-title">Strategy Rules</h4>
              <ul className="rules-list">
                {strat.rules.map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ul>
            </div>

            {strat.notes && (
              <div className="card-section">
                <h4 className="section-title">Replay Findings & Notes</h4>
                <p className="strat-notes">{strat.notes}</p>
              </div>
            )}

            <div className="card-footer">
              <div className="tags-row">
                {strat.tags.map((tag, idx) => (
                  <span key={idx} className="mini-tag">
                    #{tag}
                  </span>
                ))}
              </div>
              <span className="date-created">{strat.createdAt}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Strategy Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Document New Strategy</h2>
            <form onSubmit={handleAddStrategy} className="modal-form">
              <div className="form-group">
                <label>Strategy Title</label>
                <input
                  type="text"
                  placeholder="e.g. 15M Liquidity Reversal Pattern"
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
                    <option value="Stock">Stock</option>
                    <option value="Commodity">Commodity</option>
                    <option value="Index">Index</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Default Ticker Symbol</label>
                  <input
                    type="text"
                    placeholder="BTCUSDT, EURUSD, AAPL..."
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Estimated Win Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={winRate}
                    onChange={(e) => setWinRate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Risk : Reward Ratio</label>
                  <input
                    type="text"
                    placeholder="1 : 2.5"
                    value={riskReward}
                    onChange={(e) => setRiskReward(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Entry & Exit Rules (1 per line)</label>
                <textarea
                  rows={3}
                  placeholder="1. Wait for 4H support break&#10;2. Enter on 15M Fair Value Gap&#10;3. Stop Loss at recent swing high"
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Replay Findings & Strategy Notes</label>
                <textarea
                  rows={3}
                  placeholder="Notes on performance during specific sessions, news events, or timeframes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  Save Strategy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
