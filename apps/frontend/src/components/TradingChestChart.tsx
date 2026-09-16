import { useEffect, useRef, useState, useMemo } from 'react'
import { KLineChartPro } from 'trading-chest'
import type { SymbolInfo, Period, Datafeed } from 'trading-chest'
import { ActionType, TooltipShowRule, registerIndicator, IndicatorSeries, LineType } from 'klinecharts'
import 'trading-chest/dist/trading-chest.css'
import './TradingChestChart.css'
import { registerPositionOverlays } from '../utils/positionOverlays'
import { resolveSymbol, ALL_POPULAR_SYMBOLS } from '../utils/symbolResolver'
import { fetchMultiAssetHistory } from '../utils/multiAssetDatafeed'

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

function TradingChestChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<KLineChartPro | null>(null)
  const activeWsRef = useRef<WebSocket | null>(null)
  const liveTimerRef = useRef<any>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stockErrorMessage, setStockErrorMessage] = useState<string | null>(null)

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

      if (resolved.assetClass === 'crypto') {
        const ticker = resolved.normalizedSymbol.toLowerCase()
        try {
          const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${ticker}@kline_1d`)
          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data)
              if (msg && msg.k) {
                const k = msg.k
                callback({
                  timestamp: Number(k.t),
                  open: parseFloat(k.o),
                  high: parseFloat(k.h),
                  low: parseFloat(k.l),
                  close: parseFloat(k.c),
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
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      chart.dispose()
      chartRef.current = null
    }
  }, [datafeed])

  return (
    <div className="tradingchest-wrapper">

      {stockErrorMessage && (
        <div className="stock-error-banner">
          ⚠️ {stockErrorMessage}
        </div>
      )}

      <div ref={containerRef} className="tradingchest-container" />
      {loading && <div className="tradingchest-loading">Loading...</div>}
      {error && <div className="tradingchest-error">{error}</div>}
    </div>
  )
}

export default TradingChestChart
