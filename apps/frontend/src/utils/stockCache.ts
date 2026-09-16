export interface CachedCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CacheEntry {
  timestamp: number
  candles: CachedCandle[]
}

const CACHE_PREFIX = 'stock_candles_cache_'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours TTL for free tier protection

export function getCachedStockCandles(symbol: string): CachedCandle[] | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(`${CACHE_PREFIX}${symbol.toUpperCase()}`)
    if (!raw) return null

    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.timestamp < TTL_MS && Array.isArray(entry.candles) && entry.candles.length > 0) {
      return entry.candles
    }
  } catch (e) {
    console.warn('Failed reading stock cache:', e)
  }
  return null
}

export function setCachedStockCandles(symbol: string, candles: CachedCandle[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (!Array.isArray(candles) || candles.length === 0) return
    const entry: CacheEntry = {
      timestamp: Date.now(),
      candles,
    }
    localStorage.setItem(`${CACHE_PREFIX}${symbol.toUpperCase()}`, JSON.stringify(entry))
  } catch (e) {
    console.warn('Failed writing stock cache:', e)
  }
}
