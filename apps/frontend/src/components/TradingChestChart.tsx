import { useEffect, useRef, useState, useMemo } from 'react'
import { KLineChartPro } from 'trading-chest'
import type { SymbolInfo, Period, Datafeed } from 'trading-chest'
import { ActionType, TooltipShowRule, registerIndicator, IndicatorSeries, LineType } from 'klinecharts'
import 'trading-chest/dist/trading-chest.css'
import './TradingChestChart.css'
import { registerPositionOverlays } from '../utils/positionOverlays'
import { registerReplayMaskOverlay, REPLAY_MASK_OVERLAY_NAME, REPLAY_MASK_OVERLAY_ID } from '../utils/replayMaskOverlay'
import { resolveSymbol, ALL_POPULAR_SYMBOLS } from '../utils/symbolResolver'
import { loadCandles, saveCandles } from '../utils/candleDB'
import { addJournalEntry } from '../utils/tradeJournalStore'

registerPositionOverlays()
registerReplayMaskOverlay()

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
export function resolveToLseSymbol(ticker: string): string {
  const clean = (ticker || 'BTCUSDT').trim().toUpperCase()
  if (clean.includes('/')) return clean
  if (clean.endsWith('USDT')) {
    const base = clean.replace('USDT', '')
    return `${base}/USD`
  }
  const fxPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY']
  if (fxPairs.includes(clean)) {
    return `${clean.slice(0, 3)}/${clean.slice(3)}`
  }
  if (clean === 'XAUUSD' || clean === 'GOLD') return 'XAU/USD'
  if (clean === 'XAGUSD' || clean === 'SILVER') return 'XAG/USD'
  return clean
}

export function periodToLseTimeframe(period: Period): string {
  if (period.timespan === 'minute') return `${period.multiplier}m`
  if (period.timespan === 'hour') return `${period.multiplier}h`
  if (period.timespan === 'day') return '1d'
  if (period.timespan === 'week') return '1w'
  if (period.timespan === 'month') return '1mo'
  return '1d'
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

const triggerSolidClick = (target: HTMLElement | Element | null, e?: Event) => {
  let curr: any = target
  while (curr && curr !== document && curr !== document.body) {
    if (typeof curr.$$click === 'function') {
      try {
        curr.$$click(e || new MouseEvent('click', { bubbles: true, cancelable: true }))
      } catch (err) {
        console.error('$$click error:', err)
      }
      return true
    }
    if (typeof curr.$$input === 'function') {
      try {
        curr.$$input(e || new Event('input', { bubbles: true, cancelable: true }))
      } catch (err) {
        console.error('$$input error:', err)
      }
      return true
    }
    curr = curr.parentNode || curr.host
  }
  return false
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

  // Custom Deterministic Replay State Machine
  const [replayState, setReplayState] = useState<{
    active: boolean
    playing: boolean
    position: number
    speed: number
    totalBars: number
  }>({ active: false, playing: false, position: 0, speed: 1, totalBars: 0 })

  const fullDataRef = useRef<any[]>([])
  const originalDataRef = useRef<any[]>([])
  const timerRef = useRef<number | null>(null)
  const isReplayActiveRef = useRef(false)
  const replayStateRef = useRef(replayState)
  useEffect(() => {
    replayStateRef.current = replayState
    isReplayActiveRef.current = replayState.active
  }, [replayState])

  const updateMask = (position: number) => {
    const chartWidget = (chartRef.current as any)?.getChart?.() || chartRef.current
    if (!chartWidget) return
    const candle = fullDataRef.current[position - 1]
    if (!candle) return

    const isAtEnd = position >= fullDataRef.current.length
    const existing = chartWidget.getOverlayById?.(REPLAY_MASK_OVERLAY_ID)
    if (existing) {
      chartWidget.overrideOverlay({
        id: REPLAY_MASK_OVERLAY_ID,
        points: [{ timestamp: candle.timestamp, value: candle.close }],
        extendData: { fromTimestamp: candle.timestamp, isAtEnd },
      })
    } else {
      chartWidget.createOverlay({
        name: REPLAY_MASK_OVERLAY_NAME,
        id: REPLAY_MASK_OVERLAY_ID,
        groupId: 'replay-mask-group',
        points: [{ timestamp: candle.timestamp, value: candle.close }],
        extendData: { fromTimestamp: candle.timestamp, isAtEnd },
        lock: true,
        visible: true,
        zLevel: 1000,
      })
    }
  }

  const startOurReplay = () => {
    const chartWidget = (chartRef.current as any)?.getChart?.() || chartRef.current
    if (!chartWidget) return

    // Stop and kill any library internal ReplayEngine
    const libEngine = (chartWidget as any)?.getReplayEngine?.() || (chartRef.current as any)?.getReplayEngine?.()
    if (libEngine) {
      if (typeof libEngine.stop === 'function') libEngine.stop()
      else if (typeof libEngine.pause === 'function') libEngine.pause()
    }

    // Use the ORIGINAL full data
    let fullData = originalDataRef.current
    if (!fullData || fullData.length < 50) {
      // Fallback: if original hasn't been set, use current data
      fullData = chartWidget.getDataList()
      if (!fullData || fullData.length < 50) return
      originalDataRef.current = fullData.slice()
    }

    fullDataRef.current = fullData.slice()

    // KEY ARCHITECTURE: Load FULL data into chart (no slice)
    // The chart keeps the exact current date at the right edge!
    isReplayActiveRef.current = true
    chartWidget.applyNewData(fullData, true)
    if (typeof (chartWidget as any).setOffsetRightDistance === 'function') {
      (chartWidget as any).setOffsetRightDistance(20)
    }
    if (typeof (chartWidget as any).scrollToRealTime === 'function') {
      (chartWidget as any).scrollToRealTime(0)
    }

    // Remove any stale mask overlays
    try {
      chartWidget.removeOverlay({ name: REPLAY_MASK_OVERLAY_NAME })
      chartWidget.removeOverlay(REPLAY_MASK_OVERLAY_ID)
    } catch {}

    // Option A: Start cursor at the very end ("now")
    const initPos = fullData.length
    const cursorCandle = fullData[initPos - 1]

    if (cursorCandle) {
      chartWidget.createOverlay({
        name: REPLAY_MASK_OVERLAY_NAME,
        id: REPLAY_MASK_OVERLAY_ID,
        groupId: 'replay-mask-group',
        points: [{ timestamp: cursorCandle.timestamp, value: cursorCandle.close }],
        extendData: { fromTimestamp: cursorCandle.timestamp, isAtEnd: true },
        lock: true,
        visible: true,
        zLevel: 1000,
      })
    }

    setReplayState({
      active: true,
      playing: false,
      position: initPos,
      speed: 1,
      totalBars: fullData.length,
    })
  }

  const playReplay = () => {
    setReplayState(prev => {
      if (!prev.active || prev.playing) return prev
      if (prev.position >= prev.totalBars) {
        return prev // Cannot advance beyond end; user must drag slider back first
      }
      return { ...prev, playing: true }
    })
  }

  const pauseReplay = () => {
    setReplayState(prev => {
      if (!prev.playing) return prev
      return { ...prev, playing: false }
    })
  }

  const stopReplay = () => {
    isReplayActiveRef.current = false
    const chartWidget = (chartRef.current as any)?.getChart?.() || chartRef.current
    const libEngine = (chartWidget as any)?.getReplayEngine?.() || (chartRef.current as any)?.getReplayEngine?.()
    if (libEngine && typeof libEngine.stop === 'function') {
      libEngine.stop()
    }

    // Clean up mask overlay on exit
    if (chartWidget) {
      try {
        chartWidget.removeOverlay({ name: REPLAY_MASK_OVERLAY_NAME })
        chartWidget.removeOverlay(REPLAY_MASK_OVERLAY_ID)
      } catch {}
    }

    const full = originalDataRef.current.length > 0 ? originalDataRef.current : fullDataRef.current
    setReplayState({ active: false, playing: false, position: 0, speed: 1, totalBars: 0 })
    fullDataRef.current = []
    if (chartWidget && full.length > 0) {
      chartWidget.applyNewData(full, true)
      if (typeof (chartWidget as any).scrollToRealTime === 'function') {
        (chartWidget as any).scrollToRealTime(0)
      }
    }
  }

  const stepForward = () => {
    const state = replayStateRef.current
    if (!state.active) return
    const next = state.position + 1
    if (next > state.totalBars) return
    setReplayState(prev => ({ ...prev, position: next }))
    updateMask(next)
  }

  const stepBackward = () => {
    const state = replayStateRef.current
    if (!state.active) return
    const prev = state.position - 1
    if (prev < 1) return
    setReplayState(s => ({ ...s, position: prev }))
    updateMask(prev)
  }

  const setReplaySpeed = (speed: number) => {
    setReplayState(prev => ({ ...prev, speed }))
  }

  const goToPosition = (pos: number) => {
    const clamped = Math.max(1, Math.min(pos, replayStateRef.current.totalBars))
    setReplayState(s => ({ ...s, position: clamped }))
    updateMask(clamped)
  }

  // The replay tick loop: updates cursor and mask position only (0 chart data rebuilds)
  useEffect(() => {
    if (!replayState.active || !replayState.playing) return

    const tickMs = Math.max(100, Math.floor(1000 / replayState.speed))
    const timer = window.setInterval(() => {
      const state = replayStateRef.current
      if (!state.playing || !state.active) return

      const next = state.position + 1
      if (next > state.totalBars) {
        pauseReplay()
        return
      }

      setReplayState(prev => ({ ...prev, position: next }))
      updateMask(next)
    }, tickMs)

    return () => clearInterval(timer)
  }, [replayState.active, replayState.playing, replayState.speed])


  // Symbol & Replay State
  const [currentSymbolTicker, setCurrentSymbolTicker] = useState('BTCUSDT')
  const currentSymbolTickerRef = useRef('BTCUSDT')
  currentSymbolTickerRef.current = currentSymbolTicker
  const currentPeriodRef = useRef<Period>(PERIOD)
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

      const ticker = symbol?.ticker || 'BTCUSDT'
      const lseSymbol = resolveToLseSymbol(ticker)
      const timeframe = periodToLseTimeframe(period)
      setCurrentSymbolTicker(ticker)
      currentPeriodRef.current = period

      try {
        // Check IndexedDB first
        const cached = await loadCandles(lseSymbol, timeframe)
        if (cached && cached.candles && cached.candles.length >= 200) {
          originalDataRef.current = cached.candles.slice()
          return cached.candles
        }

        // Cache miss — call backend proxy
        const url = `/api/candles?symbol=${encodeURIComponent(lseSymbol)}&timeframe=${timeframe}&limit=2000&order=desc`
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`Failed to fetch candles: ${res.statusText}`)
        }
        const json = await res.json()
        const candles = (json.candles || []).map((c: any) => ({
          timestamp: typeof c.timestamp === 'number' ? c.timestamp : new Date(c.timestamp).getTime(),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
          volume: parseFloat(c.volume || 0),
        })).sort((a: any, b: any) => a.timestamp - b.timestamp)

        if (candles.length > 0) {
          await saveCandles(lseSymbol, timeframe, candles, true)
          originalDataRef.current = candles.slice()
        }

        return candles
      } catch (err: any) {
        console.error('getHistoryKLineData error:', err)
        setError('Failed loading chart data')
        return []
      } finally {
        setLoading(false)
      }
    },

    subscribe: (_symbol: SymbolInfo, _period: Period, _callback: (data: any) => void) => {
      // Live WebSocket data has been removed in favor of on-demand historical downloader.
      // Do nothing here. Replay mode handles data iteration internally.
    },

    unsubscribe: (_symbol: SymbolInfo, _period: Period) => {
      // No active subscriptions.
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
      subIndicators: [],
      datafeed,
      styles: {
        candle: {
          tooltip: {
            showRule: TooltipShowRule.Always,
          },
        },
        indicator: {
          tooltip: {
            showRule: TooltipShowRule.Always,
          },
        },
      },
    })

    const chartWidget = chart.getChart()

    if (chartWidget) {
      if (typeof (chartWidget as any).setOffsetRightDistance === 'function') {
        (chartWidget as any).setOffsetRightDistance(20)
      }

      chartWidget.subscribeAction(ActionType.OnDataReady, () => {
        if (isReplayActiveRef.current) return
        const data = chartWidget.getDataList()
        if (data && data.length > originalDataRef.current.length) {
          originalDataRef.current = data.slice()
        }
      })

      chartWidget.setLoadDataCallback(async (params) => {
        const { type, data, callback } = params

        // Prevent data pagination / cascades during replay
        if (isReplayActiveRef.current) {
          callback([], false)
          return
        }

        if (!data && type !== 'init') {
          callback([], false)
          return
        }

        const symbol = resolveToLseSymbol(currentSymbolTickerRef.current)
        const timeframe = periodToLseTimeframe(currentPeriodRef.current)
        const timestampIso = data?.timestamp ? new Date(data.timestamp).toISOString() : ''

        // For init/forward: check IndexedDB first
        if (type === 'init' || type === 'forward') {
          const cached = await loadCandles(symbol, timeframe)
          if (cached && cached.candles && cached.candles.length > 0) {
            // Filter cached candles by timestamp if forward
            let filtered = cached.candles
            if (type === 'forward' && data) {
              filtered = cached.candles.filter(c => c.timestamp < data.timestamp)
            }
            if (filtered.length >= 200) {
              callback(filtered.slice(-1000), filtered.length > 1000)
              return
            }
          }
        }

        // Cache miss — call backend
        let url = `/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
        if (type === 'init') url += `&limit=2000&order=desc`
        else if (type === 'forward') url += `&end=${encodeURIComponent(timestampIso)}&limit=1000&order=desc`
        else if (type === 'backward') url += `&start=${encodeURIComponent(timestampIso)}&limit=1000&order=asc`

        try {
          const res = await fetch(url)
          if (!res.ok) {
            callback([], false)
            return
          }
          const json = await res.json()
          const candles = (json.candles || []).map((c: any) => ({
            timestamp: typeof c.timestamp === 'number' ? c.timestamp : new Date(c.timestamp).getTime(),
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
            volume: parseFloat(c.volume || 0),
          })).sort((a: any, b: any) => a.timestamp - b.timestamp)

          // Save to IndexedDB (merge with existing if forward/backward)
          if (type === 'init') {
            await saveCandles(symbol, timeframe, candles, true)
          } else {
            const existing = await loadCandles(symbol, timeframe)
            if (existing) {
              const merged = [...candles, ...existing.candles]
                .sort((a, b) => a.timestamp - b.timestamp)
                .filter((c, i, arr) => i === 0 || c.timestamp !== arr[i - 1].timestamp)
              await saveCandles(symbol, timeframe, merged, true)
            } else {
              await saveCandles(symbol, timeframe, candles, true)
            }
          }

          callback(candles, candles.length >= 1000)
        } catch (err) {
          console.error('setLoadDataCallback fetch error:', err)
          callback([], false)
        }
      })
      ;(chartWidget as any).setStyles({
        tooltip: {
          showRule: TooltipShowRule.Always,
        },
        candle: {
          tooltip: {
            showRule: TooltipShowRule.Always,
          },
        },
        indicator: {
          tooltip: {
            showRule: TooltipShowRule.Always,
          },
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

    const handleResize = () => {
      const chartWidget = (chartRef.current as any)?.getChart?.() || chartRef.current
      if (!chartWidget) return

      if (typeof chartWidget.resize === 'function') {
        chartWidget.resize()
      }
    }
    window.addEventListener('resize', handleResize)

    if (containerEl) {
      resizeObserver = new ResizeObserver(() => {
        handleResize()
      })
      resizeObserver.observe(containerEl)
      const widgetEl = containerEl.querySelector('.klinecharts-pro-widget')
      if (widgetEl) {
        resizeObserver.observe(widgetEl)
      }
    }

    const handleUpdateDropdownPositions = () => {
      if (!containerEl) return
      const lists = containerEl.querySelectorAll('.klinecharts-pro-drawing-bar .item .list')
      lists.forEach((listEl) => {
        const itemEl = listEl.closest('.item') as HTMLElement
        if (itemEl && (listEl as HTMLElement).style.display !== 'none') {
          const rect = itemEl.getBoundingClientRect()
          const htmlList = listEl as HTMLElement
          const listHeight = htmlList.offsetHeight || 220
          htmlList.style.top = `${Math.max(10, rect.top - listHeight - 6)}px`
          htmlList.style.left = `${Math.max(10, Math.min(window.innerWidth - 180, rect.left))}px`
        }
      })
    }

    let lastToolTapTime = 0

    const onClick = (e: Event) => {
      const target = e.target as HTMLElement
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      if (isTouchDevice) {
        triggerSolidClick(target, e)
      }
      const now = Date.now()

      const isReplayTriggerBtn = target.closest('.replay-trigger-btn') !== null || (target.closest('.item.tools') && target.textContent?.toLowerCase().includes('replay'))
      if (isReplayTriggerBtn) {
        e.preventDefault()
        e.stopPropagation()
        if (replayStateRef.current.active) {
          // Already in replay, don't restart
          return
        }
        startOurReplay()
        return
      }

      const isReplayBarClick = target.closest('.klinecharts-pro-replay-bar, .replay-top-bar') !== null
      if (isReplayBarClick) {
        return
      }

      if (now - lastToolTapTime < 300) {
        return
      }

      // 1. Delete overlay on Trash icon tap/click
      const dangerBtn = target.closest('.klinecharts-pro-overlay-property-bar-item.danger, .danger') as HTMLElement
      if (dangerBtn) {
        lastToolTapTime = now
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', keyCode: 46, code: 'Delete', bubbles: true }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, code: 'Backspace', bubbles: true }))
        if (chartRef.current) {
          const chartWidget = (chartRef.current as any).getChart?.() || (chartRef.current as any)
          if (chartWidget && typeof chartWidget.removeOverlay === 'function') {
            chartWidget.removeOverlay()
          }
        }
        return
      }

      // 2. Sidebar drawing bar tool tap and untap deselect handler
      const itemEl = target.closest('.klinecharts-pro-drawing-bar .item') as HTMLElement
      const listLiEl = target.closest('.klinecharts-pro-drawing-bar .item .list li') as HTMLElement

      if (listLiEl) {
        lastToolTapTime = now
        requestAnimationFrame(handleUpdateDropdownPositions)
        return
      }

      if (itemEl) {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
        if (isTouchDevice) {
          itemEl.focus()
        }
        const iconOverlay = itemEl.querySelector('.icon-overlay') || itemEl.querySelector('span:first-child')
        const isAlreadySelected = itemEl.classList.contains('selected') || (iconOverlay && iconOverlay.classList.contains('selected'))

        if (isAlreadySelected) {
          // Untap / Deselect active drawing tool
          lastToolTapTime = now
          e.preventDefault()
          e.stopPropagation()

          if (containerEl) {
            const allSelected = containerEl.querySelectorAll('.klinecharts-pro-drawing-bar .selected')
            allSelected.forEach(el => el.classList.remove('selected'))
          }

          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, code: 'Escape', bubbles: true }))

          if (chartRef.current) {
            const chartWidget = (chartRef.current as any).getChart?.() || (chartRef.current as any)
            if (chartWidget) {
              if (typeof chartWidget.overrideOverlay === 'function') {
                chartWidget.overrideOverlay({ id: null, name: null })
              }
              if (typeof chartWidget.createOverlay === 'function') {
                chartWidget.createOverlay(null)
              }
            }
          }
          return
        }

        const arrow = itemEl.querySelector('.icon-arrow') as HTMLElement
        if (arrow) {
          arrow.dispatchEvent(new MouseEvent('click', { 
            bubbles: true, cancelable: true, view: window 
          }))
        }

        lastToolTapTime = now
        requestAnimationFrame(handleUpdateDropdownPositions)
        setTimeout(handleUpdateDropdownPositions, 30)
        setTimeout(handleUpdateDropdownPositions, 100)
        setTimeout(handleUpdateDropdownPositions, 250)
      }
    }

    const onDrawingBarTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      triggerSolidClick(target, e)
      const itemEl = target.closest('.klinecharts-pro-drawing-bar .item') as HTMLElement | null
      const listLiEl = target.closest('.klinecharts-pro-drawing-bar .item .list li') as HTMLElement | null

      lastToolTapTime = Date.now()

      if (listLiEl) {
        listLiEl.click()
        requestAnimationFrame(handleUpdateDropdownPositions)
        return
      }

      if (itemEl) {
        itemEl.focus()

        const iconOverlay = itemEl.querySelector('.icon-overlay') || itemEl.querySelector('span:first-child')
        const isAlreadySelected = itemEl.classList.contains('selected') || (iconOverlay && iconOverlay.classList.contains('selected'))

        if (!isAlreadySelected) {
          const arrow = itemEl.querySelector('.icon-arrow') as HTMLElement
          if (arrow) {
            setTimeout(() => {
              arrow.dispatchEvent(new MouseEvent('click', { 
                bubbles: true, cancelable: true, view: window 
              }))
            }, 10)
          }
        }

        requestAnimationFrame(handleUpdateDropdownPositions)
        setTimeout(handleUpdateDropdownPositions, 50)
        setTimeout(handleUpdateDropdownPositions, 150)
      }
    }

    const onScroll = () => {
      handleUpdateDropdownPositions()
    }

    const onInput = (e: Event) => {
      const target = e.target as HTMLElement
      if (target && target.tagName === 'INPUT') {
        triggerSolidClick(target, e)
      }
    }

    if (containerEl) {
      containerEl.addEventListener('click', onClick, { capture: true })
      containerEl.addEventListener('input', onInput, { capture: true, passive: true })
      containerEl.addEventListener('touchend', onDrawingBarTouchEnd, { passive: true })
      containerEl.addEventListener('scroll', onScroll, { capture: true, passive: true })
    }

    return () => {
      if (containerEl) {
        containerEl.removeEventListener('click', onClick, { capture: true } as any)
        containerEl.removeEventListener('touchend', onDrawingBarTouchEnd)
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
      window.removeEventListener('resize', handleResize)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      chart.dispose()
      chartRef.current = null
    }
  }, [datafeed])

  // Make Replay Bar Draggable on Mobile Touch and Desktop Mouse
  useEffect(() => {
    let isDragging = false
    let dragTarget: HTMLElement | null = null
    let startX = 0
    let startY = 0
    let initialLeft = 0
    let initialTop = 0
    let movedFar = false

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      const bar = target.closest('.klinecharts-pro-replay-bar, .replay-top-bar, .klinecharts-pro-overlay-property-bar') as HTMLElement
      if (!bar) return

      const isInput = target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range'
      const buttonTarget = target.closest('button, .replay-btn, .replay-speed, .replay-exit, .replay-action-btn, [role="button"]')

      if (buttonTarget || isInput) {
        return
      }

      const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as MouseEvent).clientX || 0
      const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as MouseEvent).clientY || 0

      const rect = bar.getBoundingClientRect()
      startX = clientX
      startY = clientY
      initialLeft = rect.left
      initialTop = rect.top
      dragTarget = bar
      movedFar = false

      const handlePointerMove = (moveEv: MouseEvent | TouchEvent) => {
        if (!dragTarget || (moveEv.target as HTMLElement)?.tagName === 'INPUT') return

        const currentX = 'touches' in moveEv && moveEv.touches[0] ? moveEv.touches[0].clientX : (moveEv as MouseEvent).clientX || 0
        const currentY = 'touches' in moveEv && moveEv.touches[0] ? moveEv.touches[0].clientY : (moveEv as MouseEvent).clientY || 0

        const deltaX = currentX - startX
        const deltaY = currentY - startY

        if (!movedFar && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
          movedFar = true
          isDragging = true
        }

        if (isDragging) {
          if (moveEv.cancelable) moveEv.preventDefault()

          let newLeft = initialLeft + deltaX
          let newTop = initialTop + deltaY

          const maxLeft = window.innerWidth - dragTarget.offsetWidth - 10
          const maxTop = window.innerHeight - dragTarget.offsetHeight - 10

          newLeft = Math.max(10, Math.min(maxLeft, newLeft))
          newTop = Math.max(10, Math.min(maxTop, newTop))

          dragTarget.style.position = 'fixed'
          dragTarget.style.left = `${newLeft}px`
          dragTarget.style.top = `${newTop}px`
          dragTarget.style.bottom = 'auto'
          dragTarget.style.right = 'auto'
          dragTarget.style.transform = 'none'
          dragTarget.style.zIndex = '999999'
          dragTarget.classList.add('is-dragging')
        }
      }

      const handlePointerUp = (upEv: MouseEvent | TouchEvent) => {
        if (dragTarget) {
          dragTarget.classList.remove('is-dragging')
        }

        const isTouch = 'changedTouches' in upEv
        if (isTouch && isDragging && upEv.cancelable) {
          upEv.preventDefault()
        }

        isDragging = false
        dragTarget = null
        window.removeEventListener('mousemove', handlePointerMove, { capture: true })
        window.removeEventListener('mouseup', handlePointerUp, { capture: true })
        window.removeEventListener('touchmove', handlePointerMove, { capture: true })
        window.removeEventListener('touchend', handlePointerUp, { capture: true })
        window.removeEventListener('touchcancel', handlePointerUp, { capture: true })
      }

      window.addEventListener('mousemove', handlePointerMove, { passive: false, capture: true })
      window.addEventListener('mouseup', handlePointerUp, { capture: true })
      window.addEventListener('touchmove', handlePointerMove, { passive: false, capture: true })
      window.addEventListener('touchend', handlePointerUp, { capture: true })
      window.addEventListener('touchcancel', handlePointerUp, { capture: true })
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, { passive: false })

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [])

  // Enable Sub-Pane (Volume Indicator) Resizing via Touch on Mobile Devices
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let activeTouchId: number | null = null
    let isSeparatorTouch = false

    const createMouseEvent = (type: string, touch: Touch, _target: Element) => {
      return new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        screenX: touch.screenX,
        screenY: touch.screenY,
        clientX: touch.clientX,
        clientY: touch.clientY,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        button: 0,
        buttons: 1,
        relatedTarget: null,
      })
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (!target || !container.contains(target)) return

      const isInteractiveUI = target.closest(
        'button, input, select, a, .klinecharts-pro-replay-bar, .replay-top-bar, .auto-document-logo-btn, .klinecharts-pro-period-bar, .klinecharts-pro-drawing-bar, .klinecharts-pro-modal, .klinecharts-pro-overlay-property-bar'
      )
      if (isInteractiveUI) return

      const isSeparator = target.classList.contains('klinecharts-pro-pane-separator') ||
                          target.classList.contains('klinecharts-pro-separator') ||
                          target.closest('[class*="separator"]') !== null ||
                          target.closest('[class*="pane-separator"]') !== null

      const computedCursor = window.getComputedStyle(target).cursor
      const isRowResize = computedCursor.includes('resize') || computedCursor === 'row-resize' || computedCursor === 'ns-resize'

      const rect = container.getBoundingClientRect()
      const relY = touch.clientY - rect.top
      const heightRatio = relY / rect.height
      const isNearPaneBoundary = isSeparator || isRowResize || (heightRatio > 0.50 && heightRatio < 0.92)

      if (isNearPaneBoundary) {
        activeTouchId = touch.identifier
        isSeparatorTouch = true

        if (e.cancelable) e.preventDefault()
        const mouseEv = createMouseEvent('mousedown', touch, target)
        target.dispatchEvent(mouseEv)
        document.dispatchEvent(mouseEv)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isSeparatorTouch || activeTouchId === null) return
      const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId)
      if (!touch) return

      if (e.cancelable) e.preventDefault()

      const mouseEv = createMouseEvent('mousemove', touch, window.document.body)
      window.dispatchEvent(mouseEv)
      document.dispatchEvent(mouseEv)
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!isSeparatorTouch || activeTouchId === null) return
      const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId)
      if (!touch) return

      const mouseEv = createMouseEvent('mouseup', touch, window.document.body)
      window.dispatchEvent(mouseEv)
      document.dispatchEvent(mouseEv)

      activeTouchId = null
      isSeparatorTouch = false
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false, capture: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    window.addEventListener('touchend', onTouchEnd, { capture: true })
    window.addEventListener('touchcancel', onTouchEnd, { capture: true })

    return () => {
      container.removeEventListener('touchstart', onTouchStart, { capture: true })
      window.removeEventListener('touchmove', onTouchMove, { capture: true })
      window.removeEventListener('touchend', onTouchEnd, { capture: true })
      window.removeEventListener('touchcancel', onTouchEnd, { capture: true })
    }
  }, [])

  // Universal Mobile Touch-to-Mouse Proxy for All Chart Canvas Interactions
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let activeTouchId: number | null = null
    let isTouchActive = false
    let touchStartTarget: Element | null = null
    let touchStartX = 0
    let touchStartY = 0

    const createMouseEvent = (type: string, touch: Touch, _target: Element) => {
      return new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        screenX: touch.screenX,
        screenY: touch.screenY,
        clientX: touch.clientX,
        clientY: touch.clientY,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        button: 0,
        buttons: 1,
        relatedTarget: null,
      })
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return

      const touch = e.touches[0]
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (!target || !container.contains(target)) return

      const isInteractiveUI = target.closest(
        'button, input, select, a, .klinecharts-pro-replay-bar, .replay-top-bar, .auto-document-logo-btn, .klinecharts-pro-period-bar, .klinecharts-pro-drawing-bar, .klinecharts-pro-modal, .klinecharts-pro-overlay-property-bar, .klinecharts-pro-pane-separator, .klinecharts-pro-separator, [class*="pane-separator"], [class*="separator"]'
      )
      if (isInteractiveUI) return

      activeTouchId = touch.identifier
      isTouchActive = true
      touchStartTarget = target
      touchStartX = touch.clientX
      touchStartY = touch.clientY

      const mouseEv = createMouseEvent('mousedown', touch, target)
      target.dispatchEvent(mouseEv)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchActive || activeTouchId === null || !touchStartTarget) return
      const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId)
      if (!touch) return

      const deltaX = Math.abs(touch.clientX - touchStartX)
      const deltaY = Math.abs(touch.clientY - touchStartY)
      if (deltaX > deltaY && e.cancelable) {
        e.preventDefault()
      }

      const mouseEv = createMouseEvent('mousemove', touch, touchStartTarget)
      touchStartTarget.dispatchEvent(mouseEv)
      window.dispatchEvent(mouseEv)
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!isTouchActive || activeTouchId === null || !touchStartTarget) return
      const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId)
      if (!touch) return

      const mouseEv = createMouseEvent('mouseup', touch, touchStartTarget)
      touchStartTarget.dispatchEvent(mouseEv)
      window.dispatchEvent(mouseEv)

      const deltaX = Math.abs(touch.clientX - touchStartX)
      const deltaY = Math.abs(touch.clientY - touchStartY)
      if (deltaX < 5 && deltaY < 5) {
        const clickEv = createMouseEvent('click', touch, touchStartTarget)
        touchStartTarget.dispatchEvent(clickEv)
      }

      activeTouchId = null
      isTouchActive = false
      touchStartTarget = null
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

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

  const handleStartDrag = (clientX: number, clientY: number) => {
    setIsDragging(true)
    hasDraggedRef.current = false
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      initialX: logoPos.x,
      initialY: logoPos.y,
    }
  }

  const handleMoveDrag = (clientX: number, clientY: number) => {
    if (!dragStartRef.current) return
    const dx = clientX - dragStartRef.current.mouseX
    const dy = clientY - dragStartRef.current.mouseY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasDraggedRef.current = true
    }
    setLogoPos({
      x: Math.max(10, dragStartRef.current.initialX + dx),
      y: Math.max(45, dragStartRef.current.initialY + dy),
    })
  }

  const handleEndDrag = () => {
    if (dragStartRef.current) {
      dragStartRef.current = null
      setIsDragging(false)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleMoveDrag(e.clientX, e.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        handleMoveDrag(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const handleMouseUp = () => {
      handleEndDrag()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleMouseUp)
    window.addEventListener('touchcancel', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleMouseUp)
      window.removeEventListener('touchcancel', handleMouseUp)
    }
  }, [])

  // Replay Slider 0.5x Speed Drag Handler for Smooth Chart Movement
  const sliderDragRef = useRef<{
    active: boolean
    startX: number
    startPos: number
    trackWidth: number
    hasMoved: boolean
  } | null>(null)

  const handleSliderPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    sliderDragRef.current = {
      active: true,
      startX: e.clientX,
      startPos: replayStateRef.current.position,
      trackWidth: rect.width > 0 ? rect.width : 110,
      hasMoved: false,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLInputElement>) => {
    if (!sliderDragRef.current || !sliderDragRef.current.active) return
    const { startX, startPos, trackWidth } = sliderDragRef.current
    const deltaX = e.clientX - startX

    if (Math.abs(deltaX) > 2) {
      sliderDragRef.current.hasMoved = true
    }
    if (!sliderDragRef.current.hasMoved) return

    const totalBars = replayStateRef.current.totalBars || 100
    // Default 0.5x speed effect on chart movement when moving the slider
    const sliderSpeed = 0.5
    const deltaBars = (deltaX / trackWidth) * totalBars * sliderSpeed
    const newPos = Math.max(1, Math.min(totalBars, Math.round(startPos + deltaBars)))
    goToPosition(newPos)
  }

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    if (sliderDragRef.current) {
      if (!sliderDragRef.current.hasMoved) {
        // Direct click/tap on track without drag: advance with 0.5x damping towards click target
        const rect = e.currentTarget.getBoundingClientRect()
        const totalBars = replayStateRef.current.totalBars || 100
        const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const clickedPos = Math.round(1 + clickRatio * (totalBars - 1))
        const currentPos = replayStateRef.current.position
        const dampenedPos = Math.round(currentPos + (clickedPos - currentPos) * 0.5)
        goToPosition(dampenedPos)
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {}
    }
    sliderDragRef.current = null
  }

  const handleSliderTouchStart = (e: React.TouchEvent<HTMLInputElement>) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const rect = e.currentTarget.getBoundingClientRect()
    sliderDragRef.current = {
      active: true,
      startX: touch.clientX,
      startPos: replayStateRef.current.position,
      trackWidth: rect.width > 0 ? rect.width : 110,
      hasMoved: false,
    }
  }

  const handleSliderTouchMove = (e: React.TouchEvent<HTMLInputElement>) => {
    if (!sliderDragRef.current || !sliderDragRef.current.active) return
    const touch = e.touches[0]
    if (!touch) return
    const { startX, startPos, trackWidth } = sliderDragRef.current
    const deltaX = touch.clientX - startX

    if (Math.abs(deltaX) > 2) {
      sliderDragRef.current.hasMoved = true
    }
    if (!sliderDragRef.current.hasMoved) return

    const totalBars = replayStateRef.current.totalBars || 100
    const sliderSpeed = 0.5
    const deltaBars = (deltaX / trackWidth) * totalBars * sliderSpeed
    const newPos = Math.max(1, Math.min(totalBars, Math.round(startPos + deltaBars)))
    goToPosition(newPos)
  }

  const handleSliderTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    if (sliderDragRef.current) {
      if (!sliderDragRef.current.hasMoved && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0]
        const rect = e.currentTarget.getBoundingClientRect()
        const totalBars = replayStateRef.current.totalBars || 100
        const clickRatio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
        const clickedPos = Math.round(1 + clickRatio * (totalBars - 1))
        const currentPos = replayStateRef.current.position
        const dampenedPos = Math.round(currentPos + (clickedPos - currentPos) * 0.5)
        goToPosition(dampenedPos)
      }
    }
    sliderDragRef.current = null
  }

  const handleLogoClick = (e: React.MouseEvent | React.TouchEvent) => {
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
        onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          if (e.touches && e.touches[0]) {
            handleStartDrag(e.touches[0].clientX, e.touches[0].clientY)
          }
        }}
        onClick={handleLogoClick}
        title="Execute Trade & Log to Journal (Click to toggle order panel)"
      >
        <img src="/Logo.jpeg" alt="Logo" className="rounded-logo-img" draggable={false} />
      </button>

      {stockErrorMessage && !replayState.active && (
        <div className="stock-error-banner">
          ⚠️ {stockErrorMessage}
        </div>
      )}

      {/* Deterministic Replay Console UI */}
      {replayState.active && (
        <div className="klinecharts-pro-replay-bar replay-top-bar">
          <div
            className="replay-btn"
            title="Step Back"
            onClick={(e) => {
              e.stopPropagation()
              stepBackward()
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" transform="scale(-1,1) translate(-24,0)" fill="currentColor"></path>
            </svg>
          </div>

          <div
            className={`replay-btn ${replayState.position >= replayState.totalBars && !replayState.playing ? 'disabled' : ''}`}
            title={
              replayState.playing
                ? 'Pause'
                : replayState.position >= replayState.totalBars
                ? 'Drag slider back to set a start position, then press play'
                : 'Play'
            }
            style={{
              opacity: replayState.position >= replayState.totalBars && !replayState.playing ? 0.45 : 1,
              cursor: replayState.position >= replayState.totalBars && !replayState.playing ? 'not-allowed' : 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (replayState.playing) pauseReplay()
              else playReplay()
            }}
          >
            {replayState.playing ? (
              <svg viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"></path>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" fill="currentColor"></path>
              </svg>
            )}
          </div>

          <div
            className="replay-btn"
            title="Step Forward"
            onClick={(e) => {
              e.stopPropagation()
              stepForward()
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"></path>
            </svg>
          </div>

          <span
            className="replay-speed"
            title="Replay Speed"
            onClick={(e) => {
              e.stopPropagation()
              const speeds = [1, 2, 4]
              const idx = speeds.indexOf(replayState.speed)
              const next = speeds[(idx + 1) % speeds.length]
              setReplaySpeed(next)
            }}
          >
            {replayState.speed}x
          </span>

          <div className="replay-progress">
            <span>{replayState.position}</span>
            <input
              type="range"
              min={1}
              max={replayState.totalBars || 100}
              value={replayState.position}
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
              onPointerCancel={handleSliderPointerUp}
              onTouchStart={handleSliderTouchStart}
              onTouchMove={handleSliderTouchMove}
              onTouchEnd={handleSliderTouchEnd}
              onTouchCancel={handleSliderTouchEnd}
              onChange={(e) => {
                if (sliderDragRef.current?.active) return
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val)) goToPosition(val)
              }}
            />
            <span>{replayState.totalBars}</span>
            {replayState.position >= replayState.totalBars && !replayState.playing && (
              <span
                style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  marginLeft: '8px',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                (drag back to start)
              </span>
            )}
          </div>

          <span
            className="replay-exit"
            title="Exit Replay"
            onClick={(e) => {
              e.stopPropagation()
              stopReplay()
            }}
          >
            Exit
          </span>
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

    </div>
  )
}

export default TradingChestChart
