import { useState } from 'react'

interface BacktestResult {
  returnPct: number
  pnl: number
  riskReward: number | null
}

export default function BacktestPanel() {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [asset, setAsset] = useState('BTC/USD')
  const [timeframe, setTimeframe] = useState('4H')
  const [entry, setEntry] = useState('')
  const [exit, setExit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [lotSize, setLotSize] = useState('0.25')
  const [useStopLoss, setUseStopLoss] = useState(false)
  const [useTakeProfit, setUseTakeProfit] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    setResult(null)

    const entryVal = parseFloat(entry)
    const exitVal = parseFloat(exit)
    const slVal = stopLoss ? parseFloat(stopLoss) : NaN
    const tpVal = takeProfit ? parseFloat(takeProfit) : NaN
    const lots = parseFloat(lotSize)

    if (!entryVal || !exitVal || !lots) {
      setError('Please fill in Entry, Exit, and Lot Size.')
      return
    }

    const returnPct = ((exitVal - entryVal) / entryVal) * 100
    const pnl = (exitVal - entryVal) * lots

    let riskReward: number | null = null
    if (useStopLoss && useTakeProfit && !isNaN(slVal) && !isNaN(tpVal) && slVal !== entryVal) {
      const risk = Math.abs(entryVal - slVal)
      const reward = Math.abs(tpVal - entryVal)
      if (risk !== 0) {
        riskReward = reward / risk
      }
    }

    setResult({ returnPct, pnl, riskReward })
  }

  return (
    <div className="backtest-panel">
      <div className="backtest-tabs">
        <button
          className={`backtest-tab sell ${side === 'sell' ? 'active' : ''}`}
          onClick={() => setSide('sell')}
        >
          <span className="tab-icon">↓</span> Sell
        </button>
        <button
          className={`backtest-tab buy ${side === 'buy' ? 'active' : ''}`}
          onClick={() => setSide('buy')}
        >
          Buy <span className="tab-icon">↑</span>
        </button>
      </div>

      <div className="backtest-body">
        <div className="backtest-available">
          <span className="available-label">Asset</span>
          <span className="available-value">{asset}</span>
        </div>

        <div className="backtest-section">
          <label className="backtest-label">Timeframe</label>
          <select
            className="backtest-select"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1H">1H</option>
            <option value="2H">2H</option>
            <option value="4H" selected>4H</option>
            <option value="D">D</option>
            <option value="W">W</option>
            <option value="M">M</option>
            <option value="Y">Y</option>
          </select>
        </div>

        <div className="backtest-section">
          <label className="backtest-label">Entry Price</label>
          <div className="backtest-input-row">
            <input
              type="number"
              className="backtest-input"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="60000"
              step="any"
            />
            <span className="backtest-currency">USD</span>
          </div>
        </div>

        <div className="backtest-section">
          <label className="backtest-label">Exit Price</label>
          <div className="backtest-input-row">
            <input
              type="number"
              className="backtest-input"
              value={exit}
              onChange={(e) => setExit(e.target.value)}
              placeholder="66000"
              step="any"
            />
            <span className="backtest-currency">USD</span>
          </div>
        </div>

        <div className="backtest-toggles">
          <div className="backtest-toggle-row">
            <label className="backtest-label">Take profit</label>
            <button
              className={`backtest-toggle ${useTakeProfit ? 'active' : ''}`}
              onClick={() => setUseTakeProfit(!useTakeProfit)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          <div className="backtest-toggle-row">
            <label className="backtest-label">Stop loss</label>
            <button
              className={`backtest-toggle ${useStopLoss ? 'active' : ''}`}
              onClick={() => setUseStopLoss(!useStopLoss)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        </div>

        {useTakeProfit && (
          <div className="backtest-section">
            <label className="backtest-label">Take Profit Price</label>
            <div className="backtest-input-row">
              <input
                type="number"
                className="backtest-input"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="Optional"
                step="any"
              />
              <span className="backtest-currency">USD</span>
            </div>
          </div>
        )}

        {useStopLoss && (
          <div className="backtest-section">
            <label className="backtest-label">Stop Loss Price</label>
            <div className="backtest-input-row">
              <input
                type="number"
                className="backtest-input"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="Optional"
                step="any"
              />
              <span className="backtest-currency">USD</span>
            </div>
          </div>
        )}

        <div className="backtest-section">
          <label className="backtest-label">Lot Size</label>
          <div className="backtest-input-row">
            <input
              type="number"
              className="backtest-input"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              placeholder="0.25"
              step="any"
              min="0"
            />
            <span className="backtest-currency">lots</span>
          </div>
        </div>

        <button className="backtest-submit" onClick={calculate}>
          Run Backtest
        </button>

        {error && <div className="backtest-error">{error}</div>}

        {result && (
          <div className="backtest-result">
            <div className="backtest-result-row">
              <span>Asset</span>
              <span>{asset}</span>
            </div>
            <div className="backtest-result-row">
              <span>Timeframe</span>
              <span>{timeframe}</span>
            </div>
            <div className="backtest-result-row">
              <span>Entry</span>
              <span>${Number(entry).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="backtest-result-row">
              <span>Exit</span>
              <span>${Number(exit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="backtest-result-row">
              <span>Return</span>
              <span className={result.returnPct >= 0 ? 'positive' : 'negative'}>
                {result.returnPct >= 0 ? '+' : ''}{result.returnPct.toFixed(2)}%
              </span>
            </div>
            <div className="backtest-result-row">
              <span>P&L</span>
              <span className={result.pnl >= 0 ? 'positive' : 'negative'}>
                {result.pnl >= 0 ? '+' : ''}${result.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {result.riskReward !== null && (
              <div className="backtest-result-row">
                <span>Risk/Reward</span>
                <span>1:{result.riskReward.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
