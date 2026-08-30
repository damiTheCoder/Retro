import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { KLineChartPro } from 'trading-chest'
import type { SymbolInfo, Period, Datafeed } from 'trading-chest'
import { ActionType, TooltipShowRule } from 'klinecharts'
import 'trading-chest/dist/trading-chest.css'

const SYMBOL: SymbolInfo = {
  ticker: 'BTCUSDT',
  name: 'Bitcoin',
  shortName: 'BTC',
  exchange: 'Binance',
  market: 'Crypto',
  pricePrecision: 2,
  volumePrecision: 8,
  priceCurrency: 'USD',
  type: 'crypto',
}

const PERIOD: Period = {
  multiplier: 1,
  timespan: 'day',
  text: 'D',
}

const COIN_GECKO_IDS: Record<string, string> = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  BNBUSDT: 'binancecoin',
  SOLUSDT: 'solana',
  XRPUSDT: 'ripple',
  ADAUSDT: 'cardano',
  DOGEUSDT: 'dogecoin',
  AVAXUSDT: 'avalanche-2',
  DOTUSDT: 'polkadot',
  MATICUSDT: 'matic-network',
  LINKUSDT: 'chainlink',
  UNIUSDT: 'uniswap',
  ATOMUSDT: 'cosmos',
  LTCUSDT: 'litecoin',
  ETCUSDT: 'ethereum-classic',
  FILUSDT: 'filecoin',
  APTUSDT: 'aptos',
  ARBUSDT: 'arbitrum',
  OPUSDT: 'optimism',
  SUIUSDT: 'sui',
}

function toCoinGeckoId(ticker: string): string {
  const upper = ticker.toUpperCase()
  if (COIN_GECKO_IDS[upper]) return COIN_GECKO_IDS[upper]
  const base = upper.replace('USDT', '').replace('USD', '').toLowerCase()
  const reverseMap: Record<string, string> = {
    btc: 'bitcoin',
    eth: 'ethereum',
    bnb: 'binancecoin',
    sol: 'solana',
    xrp: 'ripple',
    ada: 'cardano',
    doge: 'dogecoin',
    avax: 'avalanche-2',
    dot: 'polkadot',
    matic: 'matic-network',
    link: 'chainlink',
    uni: 'uniswap',
    atom: 'cosmos',
    ltc: 'litecoin',
    etc: 'ethereum-classic',
    fil: 'filecoin',
    apt: 'aptos',
    arb: 'arbitrum',
    op: 'optimism',
    sui: 'sui',
  }
  return reverseMap[base] || base
}

function TradingChestChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<KLineChartPro | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ohlc, setOhlc] = useState<{ time: string; open: string; high: string; low: string; close: string; volume: string } | null>(null)

  const datafeed = useMemo<Datafeed>(() => ({
    searchSymbols: async (query?: string) => {
      if (!query) return [SYMBOL]
      try {
        const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`)
        if (!res.ok) return [SYMBOL]
        const data = await res.json()
        return (data.coins || []).slice(0, 20).map((coin: any) => ({
          ticker: `${coin.symbol.toUpperCase()}USDT`,
          name: coin.name,
          shortName: coin.symbol.toUpperCase(),
          exchange: 'CoinGecko',
          market: 'Crypto',
          pricePrecision: 2,
          volumePrecision: 8,
          priceCurrency: 'USD',
          type: 'crypto',
        }))
      } catch {
        return [SYMBOL]
      }
    },

    getHistoryKLineData: async (_symbol: SymbolInfo, _period: Period, _from: number, _to: number) => {
      setLoading(true)
      setError(null)
      try {
        const coinId = toCoinGeckoId(_symbol.ticker)
        const daysMap: Record<string, number> = {
          minute: 1,
          hour: 7,
          day: 30,
          week: 90,
          month: 365,
          year: 365,
        }
        const timespan = _period.timespan.toLowerCase()
        const days = daysMap[timespan] || 30
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`)
        if (!res.ok) throw new Error('Failed to fetch kline data')
        const raw = await res.json()
        if (!Array.isArray(raw) || raw.length === 0) return []
        return raw.map((d: [number, number, number, number, number]) => ({
          timestamp: d[0],
          open: d[1],
          high: d[2],
          low: d[3],
          close: d[4],
          volume: 0,
        }))
      } catch (e) {
        console.error('Datafeed error:', e)
        setError('Failed to load chart data')
        return []
      } finally {
        setLoading(false)
      }
    },

    subscribe: (_symbol: SymbolInfo, _period: Period, _callback: (data: any) => void) => {
    },

    unsubscribe: (_symbol: SymbolInfo, _period: Period) => {
    },
  }), [])

  useEffect(() => {
    if (!containerRef.current) return

    const chart = new KLineChartPro({
      container: containerRef.current,
      symbol: SYMBOL,
      period: PERIOD,
      theme: 'light',
      locale: 'en',
      drawingBarVisible: true,
      timezone: 'Etc/UTC',
      mainIndicators: ['MA'],
      subIndicators: ['VOL'],
      datafeed,
      styles: {
        candle: {
          tooltip: {
            showRule: TooltipShowRule.None,
          },
        },
        indicator: {
          tooltip: {
            showRule: TooltipShowRule.None,
          },
        },
      },
      onError: (e) => {
        console.error('Chart error:', e)
        setError(e.message)
      },
    })

    chartRef.current = chart

    chart.setStyles({
      candle: {
        tooltip: { showRule: TooltipShowRule.None },
      },
      indicator: {
        tooltip: { showRule: TooltipShowRule.None },
      },
      crosshair: {
        show: false,
      },
    })

    const underlying = chart.getChart()
    if (underlying) {
      const updateOhlc = (data?: any) => {
        const kline = data?.kLineData || data?.current || data
        if (!kline) return
        const format = (v: number, digits = 2) => Number(v).toFixed(digits)
        const date = new Date((kline.timestamp || kline.time || 0) * 1000)
        const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        setOhlc({
          time: timeStr,
          open: format(kline.open),
          high: format(kline.high),
          low: format(kline.low),
          close: format(kline.close),
          volume: format(kline.volume || 0, 8),
        })
      }

      underlying.subscribeAction(ActionType.OnCrosshairChange, (event?: any) => {
        const kline = event?.kLineData || event?.current || event
        if (kline?.timestamp != null) {
          updateOhlc(kline)
        }
      })
    }

    return () => {
      chart.dispose()
      chartRef.current = null
    }
  }, [datafeed])

  const handleStartReplay = useCallback(() => {
    chartRef.current?.startReplay()
  }, [])

  return (
    <div className="tradingchest-wrapper">
      <div ref={containerRef} className="tradingchest-container" />
      {loading && <div className="tradingchest-loading">Loading...</div>}
      {error && <div className="tradingchest-error">{error}</div>}
      {ohlc && (
        <div className="ohlc-info-bar">
          <span className="ohlc-item"><span className="ohlc-label">Time</span> {ohlc.time}</span>
          <span className="ohlc-item"><span className="ohlc-label">Open</span> {ohlc.open}</span>
          <span className="ohlc-item"><span className="ohlc-label">High</span> {ohlc.high}</span>
          <span className="ohlc-item"><span className="ohlc-label">Low</span> {ohlc.low}</span>
          <span className="ohlc-item"><span className="ohlc-label">Close</span> {ohlc.close}</span>
          <span className="ohlc-item"><span className="ohlc-label">Vol</span> {ohlc.volume}</span>
        </div>
      )}
      <div className="replay-trigger">
        <button onClick={handleStartReplay} className="replay-trigger-btn">
          ▶ Replay
        </button>
      </div>
    </div>
  )
}

export default TradingChestChart
