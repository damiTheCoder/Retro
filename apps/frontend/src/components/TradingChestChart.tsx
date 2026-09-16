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
      subIndicators: [],
      datafeed,
    })

    const chartWidget = chart.getChart()
    if (chartWidget) {
      chartWidget.subscribeAction(ActionType.OnCrosshairChange, () => {})
      ;(chartWidget as any).setStyles({
        tooltip: {
          showRule: TooltipShowRule.None,
        },
        candle: {
          tooltip: {
            showRule: TooltipShowRule.Always,
            showType: 'standard',
            text: {
              size: 10,
              marginLeft: 4,
              marginRight: 4,
              marginTop: 4,
              marginBottom: 4,
            },
            custom: (data: any) => {
              const kLineData = data?.current?.kLineData || data?.current || data
              if (!kLineData || !kLineData.timestamp) return []
              const d = new Date(kLineData.timestamp)
              const yr = d.getFullYear()
              const mo = String(d.getMonth() + 1).padStart(2, '0')
              const da = String(d.getDate()).padStart(2, '0')
              const dateStr = `${yr}-${mo}-${da}`

              const fmt = (v: any) => {
                if (typeof v !== 'number' || isNaN(v)) return '0'
                if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
                return v.toFixed(2)
              }

              return [
                { title: 'time', value: dateStr },
                { title: 'open', value: fmt(kLineData.open) },
                { title: 'high', value: fmt(kLineData.high) },
                { title: 'low', value: fmt(kLineData.low) },
                { title: 'close', value: fmt(kLineData.close) },
                { title: 'volume', value: fmt(kLineData.volume) },
              ]
            },
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
          const listHeight = htmlList.offsetHeight || 220
          htmlList.style.top = `${Math.max(10, rect.top - listHeight - 6)}px`
          htmlList.style.left = `${Math.max(10, Math.min(window.innerWidth - 180, rect.left))}px`
        }
      })
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
        curr = curr.parentNode || curr.host
      }
      return false
    }

    let lastToolTapTime = 0

    const onClick = (e: Event) => {
      const target = e.target as HTMLElement
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      if (isTouchDevice) {
        triggerSolidClick(target, e)
      }
      const now = Date.now()

      const isReplayBarClick = target.closest('.klinecharts-pro-replay-bar, .replay-top-bar') !== null
      if (!isReplayBarClick) {
        if (now - lastToolTapTime < 300) {
          return
        }
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
        const isArrowTap = target.closest('.icon-arrow') !== null

        if (isAlreadySelected && !isArrowTap) {
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

      if (listLiEl) {
        listLiEl.click()
        requestAnimationFrame(handleUpdateDropdownPositions)
        return
      }

      if (itemEl) {
        itemEl.focus()
        requestAnimationFrame(handleUpdateDropdownPositions)
        setTimeout(handleUpdateDropdownPositions, 50)
        setTimeout(handleUpdateDropdownPositions, 150)
      }
    }

    const onScroll = () => {
      handleUpdateDropdownPositions()
    }

    if (containerEl) {
      containerEl.addEventListener('click', onClick)
      containerEl.addEventListener('touchend', onDrawingBarTouchEnd, { passive: true })
      containerEl.addEventListener('scroll', onScroll, { capture: true, passive: true })
    }

    return () => {
      if (containerEl) {
        containerEl.removeEventListener('click', onClick)
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
      const bar = target.closest('.klinecharts-pro-replay-bar, .replay-top-bar') as HTMLElement
      if (!bar) return

      const isInput = target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range'
      const buttonTarget = target.closest('button, .replay-btn, .replay-speed, .replay-exit, .replay-action-btn, [role="button"]')

      if (buttonTarget) {
        triggerSolidClick(target, e)
        return
      }

      if (isInput) return

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

      const rect = bar.getBoundingClientRect()
      startX = clientX
      startY = clientY
      initialLeft = rect.left
      initialTop = rect.top
      dragTarget = bar
      movedFar = false

      const handlePointerMove = (moveEv: MouseEvent | TouchEvent) => {
        if (!dragTarget) return
        const currentX = 'touches' in moveEv ? moveEv.touches[0].clientX : (moveEv as MouseEvent).clientX
        const currentY = 'touches' in moveEv ? moveEv.touches[0].clientY : (moveEv as MouseEvent).clientY

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
        window.removeEventListener('mousemove', handlePointerMove)
        window.removeEventListener('mouseup', handlePointerUp)
        window.removeEventListener('touchmove', handlePointerMove)
        window.removeEventListener('touchend', handlePointerUp)
      }

      window.addEventListener('mousemove', handlePointerMove, { passive: false })
      window.addEventListener('mouseup', handlePointerUp)
      window.addEventListener('touchmove', handlePointerMove, { passive: false })
      window.addEventListener('touchend', handlePointerUp, { passive: false })
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

    const createMouseEvent = (type: string, touch: Touch, target: Element) => {
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

  // Universal Mobile Touch-to-Mouse Proxy for All Chart Canvas Interactions
  // (Chart Panning, Drawing Overlay Handles, Axis Resizing, Shapes & Control Points)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let activeTouchId: number | null = null
    let isTouchActive = false
    let touchStartTarget: Element | null = null
    let touchStartX = 0
    let touchStartY = 0

    const createMouseEvent = (type: string, touch: Touch, target: Element) => {
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

  // Draggable Logo Button Position inside chart area (Supports Mouse & Mobile Touch)
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

    </div>
  )
}

export default TradingChestChart
