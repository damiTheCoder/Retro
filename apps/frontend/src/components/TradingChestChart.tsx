import { useEffect, useRef, useState, useMemo } from 'react'
import { KLineChartPro } from 'trading-chest'
import type { SymbolInfo, Period, Datafeed } from 'trading-chest'
import { ActionType, TooltipShowRule, registerIndicator, IndicatorSeries, LineType } from 'klinecharts'
import 'trading-chest/dist/trading-chest.css'
import './TradingChestChart.css'
import { registerPositionOverlays } from '../utils/positionOverlays'
import { resolveSymbol, ALL_POPULAR_SYMBOLS } from '../utils/symbolResolver'
import { fetchMultiAssetHistory } from '../utils/multiAssetDatafeed'
import { addJournalEntry } from '../utils/tradeJournalStore'

registerPositionOverlays()

try {
  registerIndicator({
    name: 'VOL',
    shortName: 'VOL',
    series: IndicatorSeries.Volume,
    calcParams: [],
    figures: [
      {
        key: 'volume',
        title: 'VOL: ',
        type: 'bar',
        baseValue: 0,
        styles: (data: any) => {
          const currentData = data?.current?.kLineData
          if (currentData) {
            const isUp = (currentData.close ?? 0) >= (currentData.open ?? 0)
            return {
              color: isUp ? '#26a69a' : '#ef5350',
            }
          }
          return { color: '#26a69a' }
        },
      },
    ],
    styles: {
      lines: [
        { style: LineType.Solid, size: 0, color: 'transparent', dashedValue: [0, 0], smooth: false },
        { style: LineType.Solid, size: 0, color: 'transparent', dashedValue: [0, 0], smooth: false },
        { style: LineType.Solid, size: 0, color: 'transparent', dashedValue: [0, 0], smooth: false },
      ],
    },
    calc: (dataList: any[]) => dataList.map((d: any) => ({ volume: d.volume })),
  })
} catch (err) {
  console.warn('VOL register error:', err)
}

const INITIAL_RESOLVED = resolveSymbol('BTCUSDT')
const PERIOD: Period = {
  multiplier: 1,
  timespan: 'day',
  text: 'D',
}

function getDefaultSymbolPrice(ticker: string): number {
  const t = ticker.toUpperCase()
  if (t.includes('BTC')) return 84200
  if (t.includes('ETH')) return 2740
  if (t.includes('SOL')) return 192.5
  if (t.includes('EUR')) return 1.0860
  if (t.includes('GBP')) return 1.2680
  if (t.includes('XAU') || t.includes('GOLD')) return 2710
  if (t.includes('AAPL')) return 226.50
  if (t.includes('NVDA')) return 135.00
  if (t.includes('TSLA')) return 245.00
  return 100
}

interface TradingChestChartProps {
  onNavigateToJournal?: () => void
}

function TradingChestChart({ onNavigateToJournal }: TradingChestChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<KLineChartPro | null>(null)
  const activeWsRef = useRef<WebSocket | null>(null)
  const liveTimerRef = useRef<any>(null)
  const replayIntervalRef = useRef<any>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stockErrorMessage, setStockErrorMessage] = useState<string | null>(null)

  // Symbol & Replay State
  const [currentSymbolTicker, setCurrentSymbolTicker] = useState('BTCUSDT')
  const [showToast, setShowToast] = useState<string | null>(null)

  // Interactive Order Execution Panel State
  const [showOrderPanel, setShowOrderPanel] = useState(false)
  const [tradeDirection, setTradeDirection] = useState<'LONG' | 'SHORT'>('LONG')
  const [entryPrice, setEntryPrice] = useState<number>(84200)
  const [targetPrice, setTargetPrice] = useState<number>(86500)
  const [stopPrice, setStopPrice] = useState<number>(83200)
  const [positionUnits, setPositionUnits] = useState<number>(1)
  const [tradeNotes, setTradeNotes] = useState<string>('')

  // Sync default prices when symbol changes
  useEffect(() => {
    const baseP = getDefaultSymbolPrice(currentSymbolTicker)
    setEntryPrice(baseP)
    setTargetPrice(parseFloat((baseP * 1.025).toFixed(baseP < 10 ? 4 : 2)))
    setStopPrice(parseFloat((baseP * 0.988).toFixed(baseP < 10 ? 4 : 2)))
  }, [currentSymbolTicker])

  const datafeed = useMemo<Datafeed>(() => ({
    searchSymbols: async (query?: string) => {
      if (!query || !query.trim()) return ALL_POPULAR_SYMBOLS
      const q = query.trim().toUpperCase()

      const matches = ALL_POPULAR_SYMBOLS.filter(
        (s) => s.ticker.includes(q) || (s.name && s.name.toUpperCase().includes(q)) || (s.shortName && s.shortName.toUpperCase().includes(q))
      )
      if (matches.length > 0) return matches

      const resolved = resolveSymbol(q)
      return [resolved.symbolInfo]
    },

    getHistoryKLineData: async (symbol: SymbolInfo, period: Period, _from: number, _to: number) => {
      setLoading(true)
      setError(null)
      setStockErrorMessage(null)

      const resolved = resolveSymbol(symbol?.ticker || 'BTCUSDT')
      setCurrentSymbolTicker(resolved.symbolInfo.ticker)

      try {
        const res = await fetchMultiAssetHistory(resolved, period)
        if (res.isStockError) {
          setStockErrorMessage(res.stockErrorMessage || 'Stock data unavailable — free tier limit reached or symbol not covered')
        }
        return res.candles
      } catch (err) {
        console.error('getHistoryKLineData error:', err)
        setError('Failed loading chart data')
        return []
      } finally {
        setLoading(false)
      }
    },

    subscribe: (symbol: SymbolInfo, _period: Period, callback: (data: any) => void) => {
      if (activeWsRef.current) {
        activeWsRef.current.close()
        activeWsRef.current = null
      }
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current)
        liveTimerRef.current = null
      }

      const resolved = resolveSymbol(symbol?.ticker || 'BTCUSDT')
      setCurrentSymbolTicker(resolved.symbolInfo.ticker)

      if (resolved.assetClass === 'crypto') {
        const ticker = resolved.normalizedSymbol.toLowerCase()
        try {
          const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${ticker}@kline_1d`)
          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data)
              if (msg && msg.k) {
                const k = msg.k
                const closeP = parseFloat(k.c)
                if (!isNaN(closeP)) {
                  setEntryPrice((prev) => (Math.abs(prev - closeP) > closeP * 0.1 ? closeP : prev))
                }
                callback({
                  timestamp: Number(k.t),
                  open: parseFloat(k.o),
                  high: parseFloat(k.h),
                  low: parseFloat(k.l),
                  close: closeP,
                  volume: parseFloat(k.v),
                })
              }
            } catch (err) {
              console.error('WS parse error:', err)
            }
          }
          activeWsRef.current = ws
        } catch (err) {
          console.warn('WS connect error:', err)
        }
      }
    },

    unsubscribe: (_symbol: SymbolInfo, _period: Period) => {
      if (activeWsRef.current) {
        activeWsRef.current.close()
        activeWsRef.current = null
      }
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current)
        liveTimerRef.current = null
      }
    },
  }), [])

  useEffect(() => {
    if (!containerRef.current) return

    const chart = new KLineChartPro({
      container: containerRef.current,
      symbol: INITIAL_RESOLVED.symbolInfo,
      period: PERIOD,
      theme: 'light',
      locale: 'en',
      drawingBarVisible: true,
      timezone: 'Etc/UTC',
      mainIndicators: [],
      subIndicators: ['VOL'],
      datafeed,
    })

    const chartWidget = chart.getChart()
    if (chartWidget) {
      chartWidget.subscribeAction(ActionType.OnCrosshairChange, () => {})
      ;(chartWidget as any).setStyles({
        tooltip: {
          showRule: TooltipShowRule.None,
        },
        yAxis: {
          axisLine: {
            show: false,
            color: 'transparent',
            size: 0,
          },
          tickLine: {
            show: false,
            length: 0,
          },
        },
        xAxis: {
          axisLine: {
            show: false,
            color: 'transparent',
            size: 0,
          },
          tickLine: {
            show: false,
            length: 0,
          },
        },
      })
    }

    chartRef.current = chart

    const containerEl = containerRef.current
    let resizeObserver: ResizeObserver | null = null

    if (containerEl) {
      resizeObserver = new ResizeObserver(() => {
        if (typeof (chart as any).resize === 'function') {
          (chart as any).resize()
        }
      })
      resizeObserver.observe(containerEl)
    }

    const handleUpdateDropdownPositions = () => {
      if (!containerEl) return
      const lists = containerEl.querySelectorAll('.klinecharts-pro-drawing-bar .item .list')
      lists.forEach((listEl) => {
        const itemEl = listEl.closest('.item') as HTMLElement
        if (itemEl && (listEl as HTMLElement).style.display !== 'none') {
          const rect = itemEl.getBoundingClientRect()
          const htmlList = listEl as HTMLElement
          htmlList.style.top = `${rect.top}px`
          htmlList.style.left = `${rect.right + 6}px`
        }
      })
    }

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.klinecharts-pro-drawing-bar .item')) {
        requestAnimationFrame(handleUpdateDropdownPositions)
        setTimeout(handleUpdateDropdownPositions, 50)
      }
    }
    const onScroll = () => {
      handleUpdateDropdownPositions()
    }

    if (containerEl) {
      containerEl.addEventListener('click', onClick)
      containerEl.addEventListener('scroll', onScroll, { capture: true, passive: true })
    }

    return () => {
      if (containerEl) {
        containerEl.removeEventListener('click', onClick)
        containerEl.removeEventListener('scroll', onScroll, { capture: true } as any)
      }
      if (activeWsRef.current) {
        activeWsRef.current.close()
        activeWsRef.current = null
      }
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current)
        liveTimerRef.current = null
      }
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current)
        replayIntervalRef.current = null
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      chart.dispose()
      chartRef.current = null
    }
  }, [datafeed])

  // Calculate Real-Time Trade Metrics for Order Execution
  const calculatedMetrics = useMemo(() => {
    const isLong = tradeDirection === 'LONG'
    const priceDiff = isLong ? targetPrice - entryPrice : entryPrice - targetPrice
    const pnlAmount = parseFloat((priceDiff * positionUnits).toFixed(2))
    const pnlPercentage = parseFloat(((priceDiff / entryPrice) * 100).toFixed(2))
    const outcome = pnlAmount >= 0 ? 'WIN' : 'LOSS'

    const slDistance = Math.abs(entryPrice - stopPrice)
    const tpDistance = Math.abs(targetPrice - entryPrice)
    const rr = slDistance > 0 ? (tpDistance / slDistance).toFixed(1) : '2.0'

    return {
      pnlAmount,
      pnlPercentage,
      outcome,
      riskReward: `1 : ${rr}`,
    }
  }, [tradeDirection, entryPrice, targetPrice, stopPrice, positionUnits])

  // Execute Order and save REAL trade log to journal store
  const handleExecuteOrder = (e: React.FormEvent) => {
    e.preventDefault()

    const resolved = resolveSymbol(currentSymbolTicker)

    addJournalEntry({
      title: `${currentSymbolTicker} ${tradeDirection} Execution`,
      assetClass: resolved.assetClass.toUpperCase(),
      symbol: currentSymbolTicker.toUpperCase(),
      direction: tradeDirection,
      entryPrice,
      exitPrice: targetPrice,
      targetPrice,
      stopPrice,
      outcome: calculatedMetrics.outcome as 'WIN' | 'LOSS',
      pnlAmount: calculatedMetrics.pnlAmount,
      pnlPercentage: calculatedMetrics.pnlPercentage,
      winRate: 70.0,
      riskReward: calculatedMetrics.riskReward,
      totalReplays: 1,
      rules: [
        `1. Executed ${tradeDirection} on ${currentSymbolTicker}`,
        `2. SL at $${stopPrice} | TP at $${targetPrice}`,
        `3. Risk-to-Reward: ${calculatedMetrics.riskReward}`,
      ],
      notes: tradeNotes.trim() || `Real order executed from chart trading view on ${new Date().toLocaleDateString()}.`,
      tags: ['Live Chart Trade', resolved.assetClass.toUpperCase(), tradeDirection],
    })

    setShowToast(`✨ ${tradeDirection} ${currentSymbolTicker} Trade Logged! (${calculatedMetrics.pnlAmount >= 0 ? '+' : ''}$${calculatedMetrics.pnlAmount})`)
    setShowOrderPanel(false)

    setTimeout(() => setShowToast(null), 3500)

    if (onNavigateToJournal) {
      setTimeout(() => {
        onNavigateToJournal()
      }, 700)
    }
  }

  // Draggable Logo Button Position inside chart area
  const [logoPos, setLogoPos] = useState({ x: 70, y: 56 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number } | null>(null)
  const hasDraggedRef = useRef(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    hasDraggedRef.current = false
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: logoPos.x,
      initialY: logoPos.y,
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return
      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDraggedRef.current = true
      }
      setLogoPos({
        x: Math.max(10, dragStartRef.current.initialX + dx),
        y: Math.max(45, dragStartRef.current.initialY + dy),
      })
    }

    const handleMouseUp = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null
        setIsDragging(false)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleLogoClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    setShowOrderPanel(!showOrderPanel)
  }

  return (
    <div className="tradingchest-wrapper">
      {/* Draggable Icon-Only Green Logo Button inside chart area */}
      <button
        className={`auto-document-logo-btn icon-only ${isDragging ? 'dragging' : ''} ${showOrderPanel ? 'active' : ''}`}
        style={{ left: `${logoPos.x}px`, top: `${logoPos.y}px` }}
        onMouseDown={handleMouseDown}
        onClick={handleLogoClick}
        title="Execute Trade & Log to Journal (Click to toggle order panel)"
      >
        <img src="/Logo.jpeg" alt="Logo" className="rounded-logo-img" draggable={false} />
      </button>

      {stockErrorMessage && (
        <div className="stock-error-banner">
          ⚠️ {stockErrorMessage}
        </div>
      )}

      {/* Floating Interactive Order Execution Overlay Panel */}
      {showOrderPanel && (
        <div className="chart-order-panel-overlay">
          <div className="order-panel-header">
            <div className="panel-title-group">
              <span className="panel-symbol-badge">{currentSymbolTicker}</span>
              <span className="panel-title-text">Execute Live Trade</span>
            </div>
            <button className="panel-close-btn" onClick={() => setShowOrderPanel(false)}>✕</button>
          </div>

          <form onSubmit={handleExecuteOrder} className="order-panel-body">
            {/* Direction Toggle Pills */}
            <div className="direction-toggle-row">
              <button
                type="button"
                className={`dir-pill-btn long ${tradeDirection === 'LONG' ? 'active' : ''}`}
                onClick={() => setTradeDirection('LONG')}
              >
                ▲ BUY / LONG
              </button>
              <button
                type="button"
                className={`dir-pill-btn short ${tradeDirection === 'SHORT' ? 'active' : ''}`}
                onClick={() => setTradeDirection('SHORT')}
              >
                ▼ SELL / SHORT
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="order-inputs-grid">
              <div className="input-field">
                <label>Entry Price ($)</label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="input-field">
                <label>Take Profit ($)</label>
                <input
                  type="number"
                  step="any"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="input-field">
                <label>Stop Loss ($)</label>
                <input
                  type="number"
                  step="any"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="input-field">
                <label>Units / Size</label>
                <input
                  type="number"
                  step="any"
                  value={positionUnits}
                  onChange={(e) => setPositionUnits(parseFloat(e.target.value) || 1)}
                  required
                />
              </div>
            </div>

            {/* Live Metrics Summary */}
            <div className="order-metrics-summary">
              <div className="metric-box">
                <span className="m-label">Projected Net P&L</span>
                <span className={`m-val ${calculatedMetrics.pnlAmount >= 0 ? 'win' : 'loss'}`}>
                  {calculatedMetrics.pnlAmount >= 0 ? `+$${calculatedMetrics.pnlAmount.toLocaleString()}` : `-$${Math.abs(calculatedMetrics.pnlAmount).toLocaleString()}`}
                </span>
              </div>
              <div className="metric-box">
                <span className="m-label">Target Return</span>
                <span className={`m-val ${calculatedMetrics.pnlPercentage >= 0 ? 'win' : 'loss'}`}>
                  {calculatedMetrics.pnlPercentage >= 0 ? `+${calculatedMetrics.pnlPercentage}%` : `${calculatedMetrics.pnlPercentage}%`}
                </span>
              </div>
              <div className="metric-box">
                <span className="m-label">Risk : Reward</span>
                <span className="m-val neutral">{calculatedMetrics.riskReward}</span>
              </div>
            </div>

            <div className="input-field full-width">
              <label>Strategy Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 4H Order block retest entry at FVG..."
                value={tradeNotes}
                onChange={(e) => setTradeNotes(e.target.value)}
              />
            </div>

            <button type="submit" className={`execute-trade-submit-btn ${tradeDirection.toLowerCase()}`}>
              ⚡ Execute {tradeDirection} & Log to Journal
            </button>
          </form>
        </div>
      )}

      <div ref={containerRef} className="tradingchest-container" />
      {loading && <div className="tradingchest-loading">Loading...</div>}
      {error && <div className="tradingchest-error">{error}</div>}

      {/* Toast Notification */}
      {showToast && (
        <div className="document-toast">
          <img src="/Logo.jpeg" alt="Logo" className="toast-logo-icon" />
          <span>{showToast}</span>
        </div>
      )}
    </div>
  )
}

export default TradingChestChart
