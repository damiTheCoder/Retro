import type { Period } from 'trading-chest'
import type { ResolvedSymbol } from './symbolResolver'
import { loadCandles } from './candleDB'

export interface FetchKLineResult {
  candles: any[]
  isDemoData: boolean
  isStockError: boolean
  stockErrorMessage?: string
}

export function periodToBinanceInterval(period: Period): string {
  const timespan = period.timespan.toLowerCase()
  const mult = period.multiplier || 1

  if (timespan === 'minute') {
    if (mult <= 1) return '1m'
    if (mult <= 3) return '3m'
    if (mult <= 5) return '5m'
    if (mult <= 15) return '15m'
    if (mult <= 30) return '30m'
    return '15m'
  }
  if (timespan === 'hour') {
    if (mult <= 1) return '1h'
    if (mult <= 2) return '2h'
    if (mult <= 4) return '4h'
    if (mult <= 6) return '6h'
    if (mult <= 8) return '8h'
    if (mult <= 12) return '12h'
    return '4h'
  }
  if (timespan === 'day') return '1d'
  if (timespan === 'week') return '1w'
  if (timespan === 'month') return '1M'
  return '1d'
}

function periodToBiquoteInterval(period: Period): string {
  const timespan = period.timespan.toLowerCase()
  const mult = period.multiplier || 1

  if (timespan === 'minute') {
    if (mult <= 1) return '1m'
    if (mult <= 5) return '5m'
    if (mult <= 15) return '15m'
    if (mult <= 30) return '30m'
    return '1h'
  }
  if (timespan === 'hour') {
    if (mult <= 1) return '1h'
    if (mult <= 4) return '4h'
    return '1h'
  }
  if (timespan === 'day') return '1d'
  return '1d'
}



export function generateDeterministicCandles(ticker: string, count = 300, basePrice = 100): any[] {
  const list = []
  const now = Date.now()
  const intervalMs = 3600 * 1000
  let price = basePrice

  let tickerSeed = 0
  for (let i = 0; i < ticker.length; i++) {
    tickerSeed += ticker.charCodeAt(i) * (i + 1)
  }

  for (let i = count; i >= 0; i--) {
    const timestamp = Math.floor((now - i * intervalMs) / intervalMs) * intervalMs
    const stepSeed = tickerSeed + timestamp / 1000
    const rand1 = pseudoRandom(stepSeed)
    const rand2 = pseudoRandom(stepSeed + 1.1)
    const rand3 = pseudoRandom(stepSeed + 2.2)

    const changePct = (rand1 - 0.495) * 0.015
    const open = price
    const close = Math.max(0.0001, open * (1 + changePct))
    const high = Math.max(open, close) * (1 + rand2 * 0.005)
    const low = Math.min(open, close) * (1 - rand3 * 0.005)
    const volume = Math.round(10 + rand1 * 100)

    list.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    })
    price = close
  }
  return list
}

export async function fetchMultiAssetHistory(resolved: ResolvedSymbol, period: Period): Promise<FetchKLineResult> {
  const { assetClass, normalizedSymbol } = resolved
  const interval = periodToBinanceInterval(period) // using binance intervals as standard keys
  
  const ticker = normalizedSymbol

  const dbData = await loadCandles(ticker, interval)
  if (dbData && dbData.candles.length > 0) {
    return {
      candles: dbData.candles,
      isDemoData: false,
      isStockError: false,
    }
  }

  // If not cached, return empty with error instructing to download
  return {
    candles: [],
    isDemoData: false,
    isStockError: true,
    stockErrorMessage: `Data not cached. Please click "Download 5y" above to fetch historical data for ${ticker} (${interval}).`,
  }
}
