import type { Period } from 'trading-chest'
import type { ResolvedSymbol } from './symbolResolver'
import { getCachedStockCandles, setCachedStockCandles, type CachedCandle } from './stockCache'

export interface FetchKLineResult {
  candles: any[]
  isDemoData: boolean
  isStockError: boolean
  stockErrorMessage?: string
}

function periodToBinanceInterval(period: Period): string {
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

const fetchWithTimeout = async (url: string, ms = 2000) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(id)
    if (res.ok) return await res.json()
  } catch {
    clearTimeout(id)
  }
  return null
}

function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
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

  // 1. Crypto Fetcher (Binance primary, Bybit & CoinPaprika fallbacks)
  if (assetClass === 'crypto') {
    const interval = periodToBinanceInterval(period)
    const ticker = normalizedSymbol

    // Primary: Binance REST
    try {
      let raw = await fetchWithTimeout(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(ticker)}&interval=${interval}&limit=1000`)
      if (!Array.isArray(raw)) {
        raw = await fetchWithTimeout(`https://api.binance.us/api/v3/klines?symbol=${encodeURIComponent(ticker)}&interval=${interval}&limit=1000`)
      }
      if (Array.isArray(raw) && raw.length > 0) {
        return {
          candles: raw.map((d: any) => ({
            timestamp: Number(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
          })),
          isDemoData: false,
          isStockError: false,
        }
      }
    } catch (e) {
      console.warn('Binance fetch failed, trying Bybit...', e)
    }

    // Fallback 1: Bybit
    try {
      const json = await fetchWithTimeout(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${encodeURIComponent(ticker)}&interval=60&limit=1000`)
      const list = json?.result?.list
      if (Array.isArray(list) && list.length > 0) {
        return {
          candles: list.slice().reverse().map((d: any) => ({
            timestamp: Number(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
          })),
          isDemoData: false,
          isStockError: false,
        }
      }
    } catch (e) {
      console.warn('Bybit fetch failed, trying CoinPaprika...', e)
    }

    // Fallback 2: CoinPaprika / CryptoCompare
    try {
      const baseAsset = resolved.shortName.toUpperCase()
      const json = await fetchWithTimeout(`https://min-api.cryptocompare.com/data/v2/histohour?fsym=${baseAsset}&tsym=USD&limit=300`)
      const raw = json?.Data?.Data
      if (Array.isArray(raw) && raw.length > 0) {
        return {
          candles: raw.map((d: any) => ({
            timestamp: Number(d.time) * 1000,
            open: parseFloat(d.open),
            high: parseFloat(d.high),
            low: parseFloat(d.low),
            close: parseFloat(d.close),
            volume: parseFloat(d.volumeto || d.volumefrom || 0),
          })),
          isDemoData: false,
          isStockError: false,
        }
      }
    } catch (e) {
      console.warn('CryptoCompare fallback failed...', e)
    }

    // Deterministic fallback if all APIs fail
    const basePrice = ticker.includes('ETH') ? 2650 : ticker.includes('SOL') ? 195 : ticker.includes('XRP') ? 2.4 : ticker.includes('BNB') ? 620 : 75788
    return {
      candles: generateDeterministicCandles(ticker, 300, basePrice),
      isDemoData: true,
      isStockError: false,
    }
  }

  // 2. Forex, Commodity & Index Fetcher (Biquote NPM package)
  if (assetClass === 'forex' || assetClass === 'commodity' || assetClass === 'index') {
    const bqSymbol = resolved.normalizedSymbol
    const bqInterval = periodToBiquoteInterval(period)

    try {
      let BiquotePackage: any
      try {
        const pkgName = 'biquote'
        // @ts-ignore
        const module = await import(/* @vite-ignore */ pkgName)
        BiquotePackage = module.default || module
      } catch (err) {
        console.warn('biquote import failed, trying REST proxy...', err)
      }

      let rawBars: any[] | null = null

      if (BiquotePackage) {
        const bq = typeof BiquotePackage === 'function' ? new BiquotePackage() : BiquotePackage
        if (bq && typeof bq.ohlc === 'function') {
          rawBars = await bq.ohlc(bqSymbol, { interval: bqInterval, limit: 500 })
        }
      }

      // REST fallback for Biquote if package call returned null or failed
      if (!Array.isArray(rawBars) || rawBars.length === 0) {
        const json = await fetchWithTimeout(`https://api.biquote.com/v1/ohlc?symbol=${encodeURIComponent(bqSymbol)}&interval=${bqInterval}&limit=500`)
        if (Array.isArray(json)) {
          rawBars = json
        } else if (Array.isArray(json?.data)) {
          rawBars = json.data
        }
      }

      if (Array.isArray(rawBars) && rawBars.length > 0) {
        const formatted = rawBars.map((b: any) => {
          // CRITICAL: On FX/CFD feeds, `last` and `volume` are 0. Use `mid` price!
          const openPrice = parseFloat(b.open ?? b.o ?? b.mid ?? b.close ?? b.c ?? 1)
          const highPrice = parseFloat(b.high ?? b.h ?? b.mid ?? b.close ?? b.c ?? openPrice)
          const lowPrice = parseFloat(b.low ?? b.l ?? b.mid ?? b.close ?? b.c ?? openPrice)
          const closePrice = parseFloat(b.mid ?? b.close ?? b.c ?? b.last ?? openPrice)
          const time = Number(b.timestamp || b.time || b.t || Date.now())

          return {
            timestamp: time > 10000000000 ? time : time * 1000,
            open: openPrice,
            high: highPrice,
            low: lowPrice,
            close: closePrice,
            volume: parseFloat(b.volume || b.v || 0),
          }
        })

        return {
          candles: formatted,
          isDemoData: false,
          isStockError: false,
        }
      }
    } catch (e) {
      console.warn('Biquote fetch error:', e)
    }

    // Deterministic fallback for Forex / Commodities if offline
    const basePrice = assetClass === 'commodity' ? 2680 : assetClass === 'index' ? 5600 : 1.085
    return {
      candles: generateDeterministicCandles(normalizedSymbol, 300, basePrice),
      isDemoData: true,
      isStockError: false,
    }
  }

  // 3. US Stock Fetcher (FCS API / FMP + Local Cache)
  if (assetClass === 'stock') {
    const symbol = normalizedSymbol.toUpperCase()

    // Step A: Check local cache first (24h TTL)
    const cached = getCachedStockCandles(symbol)
    if (cached && cached.length > 0) {
      return {
        candles: cached,
        isDemoData: false,
        isStockError: false,
      }
    }

    // Step B: Fetch from Stock API (requires VITE_STOCK_API_KEY in .env)
    // TODO: Add free FCS API or Financial Modeling Prep (FMP) key to .env as VITE_STOCK_API_KEY
    const apiKey = import.meta.env?.VITE_STOCK_API_KEY || ''

    if (apiKey) {
      try {
        const json = await fetchWithTimeout(`https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?apikey=${apiKey}`, 2500)
        const historical = json?.historical
        if (Array.isArray(historical) && historical.length > 0) {
          const candles: CachedCandle[] = historical
            .slice()
            .reverse()
            .map((d: any) => ({
              timestamp: new Date(d.date).getTime(),
              open: parseFloat(d.open),
              high: parseFloat(d.high),
              low: parseFloat(d.low),
              close: parseFloat(d.close),
              volume: parseFloat(d.volume || 0),
            }))

          setCachedStockCandles(symbol, candles)
          return {
            candles,
            isDemoData: false,
            isStockError: false,
          }
        }
      } catch (e) {
        console.warn('Stock API fetch failed:', e)
      }
    }

    // Step C: If no key or stock fetch failed, return fallback with clear Stock Error Banner
    const stockBasePrice = symbol === 'AAPL' ? 225 : symbol === 'NVDA' ? 120 : symbol === 'TSLA' ? 240 : 450
    return {
      candles: generateDeterministicCandles(symbol, 300, stockBasePrice),
      isDemoData: true,
      isStockError: true,
      stockErrorMessage: 'Stock data unavailable — free tier limit reached or symbol not covered',
    }
  }

  // Fallback default
  return {
    candles: generateDeterministicCandles(normalizedSymbol, 300, 100),
    isDemoData: true,
    isStockError: false,
  }
}
