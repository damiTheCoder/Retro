export interface ChartPoint {
  timestamp?: number
  value?: number
  dataIndex?: number
}

export interface ChartDrawing {
  id: string
  name: string // 'rect' | 'horizontalStraightLine' | 'longPositionOverlay' | 'shortPositionOverlay' | 'fibonacciRetracement' | 'segmentLine' | 'straightLine' | 'priceLine' | 'text'
  symbol: string
  timeframe?: string
  points: ChartPoint[]
  styles?: Record<string, any>
  extendData?: {
    label?: string
    description?: string
    zoneType?: 'order_block' | 'fvg' | 'support' | 'resistance' | 'liquidity' | 'position'
    isAiGenerated?: boolean
    [key: string]: any
  }
  lock?: boolean
  visible?: boolean
  zLevel?: number
  createdAt: number
}

export type ChartActionType =
  | 'draw_setup'
  | 'activate_tool'
  | 'switch_chart'
  | 'start_replay'
  | 'clear_drawings'
  | 'log_trade'
  | 'navigate'

export interface ChartActionPayload {
  type: ChartActionType
  symbol?: string
  timeframe?: string
  title?: string
  description?: string
  toolName?: string
  drawings?: Array<{
    name: string
    points: ChartPoint[]
    label?: string
    zoneType?: string
    styles?: Record<string, any>
    extendData?: Record<string, any>
  }>
  replayTimestamp?: number
  tradeData?: {
    symbol: string
    type: 'LONG' | 'SHORT'
    entryPrice: number
    stopLoss?: number
    takeProfit?: number
    pnlAmount?: number
    outcome?: 'WIN' | 'LOSS' | 'OPEN'
    notes?: string
  }
}

export interface PendingChartNavigation {
  page: 'chart' | 'journal' | 'analytics' | 'aichat'
  symbol?: string
  timeframe?: string
  focusOverlayId?: string
  timestamp: number
}

const STORAGE_PREFIX = 'chart_rabbit_drawings_'
const PENDING_NAV_KEY = 'chart_rabbit_pending_nav'

// Listeners for live action events
type ActionSubscriber = (action: ChartActionPayload) => void
const actionSubscribers = new Set<ActionSubscriber>()

export function subscribeChartActions(subscriber: ActionSubscriber): () => void {
  actionSubscribers.add(subscriber)
  return () => {
    actionSubscribers.delete(subscriber)
  }
}

export function dispatchChartAction(action: ChartActionPayload) {
  // If the action contains drawings, persist them immediately
  if (action.drawings && action.drawings.length > 0 && action.symbol) {
    const cleanSymbol = action.symbol.toUpperCase().replace('/', '')
    action.drawings.forEach((d, idx) => {
      const drawing: ChartDrawing = {
        id: `ai_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        name: d.name,
        symbol: cleanSymbol,
        timeframe: action.timeframe || '15m',
        points: d.points,
        styles: d.styles,
        extendData: {
          label: d.label || action.title || 'AI Setup',
          zoneType: (d.zoneType as any) || 'order_block',
          isAiGenerated: true,
          ...d.extendData,
        },
        lock: false,
        visible: true,
        createdAt: Date.now(),
      }
      savePersistedDrawing(cleanSymbol, drawing)
    })
  }

  // Notify all active listeners (e.g. TradingChestChart)
  actionSubscribers.forEach((sub) => {
    try {
      sub(action)
    } catch (err) {
      console.error('[chartActionStore] Error in action subscriber:', err)
    }
  })
}

// Persistent Drawings API
export function getPersistedDrawings(symbol: string): ChartDrawing[] {
  if (typeof window === 'undefined') return []
  const cleanSymbol = (symbol || 'BTCUSDT').toUpperCase().replace('/', '')
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${cleanSymbol}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn(`[chartActionStore] Failed to read drawings for ${cleanSymbol}:`, err)
    return []
  }
}

export function savePersistedDrawing(symbol: string, drawing: ChartDrawing): void {
  if (typeof window === 'undefined') return
  const cleanSymbol = (symbol || 'BTCUSDT').toUpperCase().replace('/', '')
  const current = getPersistedDrawings(cleanSymbol)
  const existingIdx = current.findIndex((d) => d.id === drawing.id)
  let updated: ChartDrawing[]
  if (existingIdx >= 0) {
    updated = [...current]
    updated[existingIdx] = drawing
  } else {
    updated = [...current, drawing]
  }
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${cleanSymbol}`, JSON.stringify(updated))
  } catch (err) {
    console.warn(`[chartActionStore] Failed to save drawing for ${cleanSymbol}:`, err)
  }
}

export function removePersistedDrawing(symbol: string, id: string): void {
  if (typeof window === 'undefined') return
  const cleanSymbol = (symbol || 'BTCUSDT').toUpperCase().replace('/', '')
  const current = getPersistedDrawings(cleanSymbol)
  const filtered = current.filter((d) => d.id !== id)
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${cleanSymbol}`, JSON.stringify(filtered))
  } catch (err) {
    console.warn(`[chartActionStore] Failed to remove drawing ${id} for ${cleanSymbol}:`, err)
  }
}

export function clearPersistedDrawings(symbol: string): void {
  if (typeof window === 'undefined') return
  const cleanSymbol = (symbol || 'BTCUSDT').toUpperCase().replace('/', '')
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${cleanSymbol}`)
  } catch (err) {
    console.warn(`[chartActionStore] Failed to clear drawings for ${cleanSymbol}:`, err)
  }
}

// Cross-Page Pending Navigation API
export function setPendingChartNavigation(nav: PendingChartNavigation): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PENDING_NAV_KEY, JSON.stringify(nav))
  } catch (err) {
    console.warn('[chartActionStore] Failed to set pending nav:', err)
  }
}

export function getPendingChartNavigation(): PendingChartNavigation | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PENDING_NAV_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    return null
  }
}

export function clearPendingChartNavigation(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(PENDING_NAV_KEY)
  } catch (err) {}
}
