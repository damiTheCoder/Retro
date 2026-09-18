import type { ResolvedSymbol } from './symbolResolver'
import type { Period } from 'trading-chest'

function getIntervalMs(interval: string): number {
  if (interval.endsWith('m')) return parseInt(interval) * 60 * 1000
  if (interval.endsWith('h')) return parseInt(interval) * 60 * 60 * 1000
  if (interval.endsWith('d')) return parseInt(interval) * 24 * 60 * 60 * 1000
  if (interval.endsWith('w')) return parseInt(interval) * 7 * 24 * 60 * 60 * 1000
  if (interval.endsWith('M')) return parseInt(interval) * 30 * 24 * 60 * 60 * 1000
  return 60 * 1000
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type ProgressCallback = (info: { fetched: number; current: string }) => void

export async function downloadBinanceHistory(
  symbol: string,
  interval: string,
  yearsBack: number,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
) {
  // TODO(v2): Use https://data.binance.vision/data/spot/monthly/klines/
  // {symbol}/{interval}/{symbol}-{interval}-{YYYY-MM}.zip for bulk 
  // downloads. Requires JSZip. ~30s vs ~10min for 1m 5-year data.

  const now = Date.now()
  const start = now - yearsBack * 365 * 24 * 60 * 60 * 1000
  const intervalMs = getIntervalMs(interval)
  const maxRange = 200 * 24 * 60 * 60 * 1000
  const allCandles: any[] = []
  let currentStart = start

  while (currentStart < now) {
    if (signal?.aborted) throw new Error('Aborted')

    const currentEnd = Math.min(currentStart + maxRange, now)
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&startTime=${currentStart}&endTime=${currentEnd}&limit=1500`
    
    let res: Response
    try {
      res = await fetch(url, { signal })
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('Aborted')
      console.warn('Fetch error', err)
      await sleep(1000)
      continue
    }

    if (res.status === 429) {
      console.warn('Rate limit 429! Sleeping 60s...')
      await sleep(60000)
      continue
    }

    if (!res.ok) {
      await sleep(1000)
      continue
    }

    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break

    for (const k of batch) {
      allCandles.push({
        timestamp: Number(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      })
    }

    currentStart = Number(batch[batch.length - 1][0]) + intervalMs
    onProgress?.({
      fetched: allCandles.length,
      current: new Date(currentStart).toISOString().split('T')[0],
    })
    
    await sleep(250)
  }

  // Deduplicate and sort
  const seen = new Set<number>()
  const unique = allCandles.filter((c) => {
    if (seen.has(c.timestamp)) return false
    seen.add(c.timestamp)
    return true
  })
  unique.sort((a, b) => a.timestamp - b.timestamp)
  return unique
}

export async function downloadBiquoteHistory(
  symbol: string,
  interval: string,
  yearsBack: number,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
) {
  const now = Date.now()
  const start = now - yearsBack * 365 * 24 * 60 * 60 * 1000
  let BiquotePackage: any
  try {
    const pkgName = 'biquote'
    // @ts-ignore
    const module = await import(/* @vite-ignore */ pkgName)
    BiquotePackage = module.default || module
  } catch (err) {
    console.warn('biquote import failed', err)
  }

  const allCandles: any[] = []
  let currentEnd = now

  while (currentEnd > start) {
    if (signal?.aborted) throw new Error('Aborted')

    let rawBars: any[] = []
    try {
      if (BiquotePackage) {
        const bq = typeof BiquotePackage === 'function' ? new BiquotePackage() : BiquotePackage
        if (bq && typeof bq.ohlc === 'function') {
          // Biquote doesn't strictly paginate perfectly with end time alone without knowing if it's supported
          // If Biquote is just a static feed or proxy, we simulate backward pagination.
          // Wait, the API spec says `bq.ohlc(symbol, { interval, limit: 500, endTime: currentEnd })` usually.
          // If endTime is not strictly supported by biquote package, we'll try fetch wrapper
          const params = { interval, limit: 500, endTime: currentEnd }
          // The proxy url
          const url = `https://api.biquote.com/v1/ohlc?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=500&endTime=${currentEnd}`
          const res = await fetch(url, { signal })
          if (res.ok) {
            const json = await res.json()
            if (Array.isArray(json)) rawBars = json
            else if (Array.isArray(json?.data)) rawBars = json.data
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('Aborted')
      await sleep(1000)
    }

    if (!Array.isArray(rawBars) || rawBars.length === 0) break

    // Format Biquote bars
    for (const b of rawBars) {
      const openPrice = parseFloat(b.open ?? b.o ?? b.mid ?? b.close ?? b.c ?? 1)
      const highPrice = parseFloat(b.high ?? b.h ?? b.mid ?? b.close ?? b.c ?? openPrice)
      const lowPrice = parseFloat(b.low ?? b.l ?? b.mid ?? b.close ?? b.c ?? openPrice)
      const closePrice = parseFloat(b.mid ?? b.close ?? b.c ?? b.last ?? openPrice)
      const time = Number(b.timestamp || b.time || b.t || Date.now())
      
      allCandles.push({
        timestamp: time > 10000000000 ? time : time * 1000,
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        close: closePrice,
        volume: parseFloat(b.volume || b.v || 0),
      })
    }

    // Sort to find the oldest in this batch
    rawBars.sort((a, b) => {
      const ta = Number(a.timestamp || a.time || a.t)
      const tb = Number(b.timestamp || b.time || b.t)
      return (ta > 10000000000 ? ta : ta * 1000) - (tb > 10000000000 ? tb : tb * 1000)
    })
    
    const oldestTime = Number(rawBars[0].timestamp || rawBars[0].time || rawBars[0].t)
    const oldestMs = oldestTime > 10000000000 ? oldestTime : oldestTime * 1000

    if (oldestMs >= currentEnd) break // prevent infinite loop if backend ignores endTime
    currentEnd = oldestMs - 1

    onProgress?.({
      fetched: allCandles.length,
      current: new Date(currentEnd).toISOString().split('T')[0],
    })
    await sleep(200)
  }

  // Deduplicate and sort
  const seen = new Set<number>()
  const unique = allCandles.filter((c) => {
    if (seen.has(c.timestamp)) return false
    seen.add(c.timestamp)
    return true
  })
  unique.sort((a, b) => a.timestamp - b.timestamp)
  return unique
}

export async function downloadFmpHistory(
  symbol: string,
  yearsBack: number,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
) {
  // FMP free tier gives max 5 years daily data in one hit with historical-price-full
  const apiKey = import.meta.env?.VITE_STOCK_API_KEY || ''
  if (!apiKey) throw new Error('Stock API Key missing')

  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?apikey=${apiKey}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('FMP API request failed')

  const json = await res.json()
  const historical = json?.historical
  
  if (!Array.isArray(historical) || historical.length === 0) return []

  const allCandles = historical.map((d: any) => ({
    timestamp: new Date(d.date).getTime(),
    open: parseFloat(d.open),
    high: parseFloat(d.high),
    low: parseFloat(d.low),
    close: parseFloat(d.close),
    volume: parseFloat(d.volume || 0),
  }))

  onProgress?.({ fetched: allCandles.length, current: new Date().toISOString().split('T')[0] })

  // Deduplicate and sort
  const seen = new Set<number>()
  const unique = allCandles.filter((c) => {
    if (seen.has(c.timestamp)) return false
    seen.add(c.timestamp)
    return true
  })
  unique.sort((a, b) => a.timestamp - b.timestamp)
  
  // Filter for yearsBack
  const start = Date.now() - yearsBack * 365 * 24 * 60 * 60 * 1000
  return unique.filter(c => c.timestamp >= start)
}
