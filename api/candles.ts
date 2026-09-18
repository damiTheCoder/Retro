export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { symbol = 'BTC/USD', timeframe = '1d', limit = '1000' } = req.query || {}
  const rawSymbol = String(symbol).toUpperCase().replace('/', '').replace('USD', 'USDT')
  const tf = String(timeframe).toLowerCase()
  const binanceTf = tf === '1mo' ? '1M' : tf
  const numLimit = Math.min(Math.max(parseInt(String(limit), 10) || 1000, 1), 1000)

  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(rawSymbol)}&interval=${binanceTf}&limit=${numLimit}`
    const r = await fetch(url)
    if (r.ok) {
      const data = await r.json()
      if (Array.isArray(data)) {
        const candles = data.map((d: any) => ({
          timestamp: Number(d[0]),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5]),
        }))
        res.status(200).json({ symbol, timeframe, count: candles.length, candles, source: 'binance' })
        return
      }
    }
  } catch {}

  res.status(200).json({ symbol, timeframe, count: 0, candles: [], source: 'fallback' })
}
