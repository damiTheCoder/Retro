import type { SymbolInfo } from 'trading-chest'

export type AssetClass = 'crypto' | 'stock' | 'forex' | 'commodity' | 'index'
export type Provider = 'binance' | 'biquote' | 'fcsapi'

export interface ResolvedSymbol {
  assetClass: AssetClass
  provider: Provider
  normalizedSymbol: string
  name: string
  shortName: string
  exchange: string
  symbolInfo: SymbolInfo
}

const POPULAR_CRYPTO: SymbolInfo[] = [
  { ticker: 'BTCUSDT', name: 'Bitcoin', shortName: 'BTC', exchange: 'Binance', market: 'Crypto', pricePrecision: 2, volumePrecision: 4, priceCurrency: 'USD', type: 'crypto' },
  { ticker: 'ETHUSDT', name: 'Ethereum', shortName: 'ETH', exchange: 'Binance', market: 'Crypto', pricePrecision: 2, volumePrecision: 4, priceCurrency: 'USD', type: 'crypto' },
  { ticker: 'SOLUSDT', name: 'Solana', shortName: 'SOL', exchange: 'Binance', market: 'Crypto', pricePrecision: 2, volumePrecision: 4, priceCurrency: 'USD', type: 'crypto' },
  { ticker: 'BNBUSDT', name: 'BNB', shortName: 'BNB', exchange: 'Binance', market: 'Crypto', pricePrecision: 2, volumePrecision: 4, priceCurrency: 'USD', type: 'crypto' },
  { ticker: 'XRPUSDT', name: 'XRP', shortName: 'XRP', exchange: 'Binance', market: 'Crypto', pricePrecision: 4, volumePrecision: 2, priceCurrency: 'USD', type: 'crypto' },
  { ticker: 'DOGEUSDT', name: 'Dogecoin', shortName: 'DOGE', exchange: 'Binance', market: 'Crypto', pricePrecision: 5, volumePrecision: 2, priceCurrency: 'USD', type: 'crypto' },
]

const POPULAR_FOREX: SymbolInfo[] = [
  { ticker: 'EURUSD', name: 'Euro / US Dollar', shortName: 'EUR/USD', exchange: 'FX', market: 'Forex', pricePrecision: 5, volumePrecision: 0, priceCurrency: 'USD', type: 'forex' },
  { ticker: 'GBPUSD', name: 'British Pound / US Dollar', shortName: 'GBP/USD', exchange: 'FX', market: 'Forex', pricePrecision: 5, volumePrecision: 0, priceCurrency: 'USD', type: 'forex' },
  { ticker: 'USDJPY', name: 'US Dollar / Japanese Yen', shortName: 'USD/JPY', exchange: 'FX', market: 'Forex', pricePrecision: 3, volumePrecision: 0, priceCurrency: 'JPY', type: 'forex' },
  { ticker: 'AUDUSD', name: 'Australian Dollar / US Dollar', shortName: 'AUD/USD', exchange: 'FX', market: 'Forex', pricePrecision: 5, volumePrecision: 0, priceCurrency: 'USD', type: 'forex' },
  { ticker: 'USDCAD', name: 'US Dollar / Canadian Dollar', shortName: 'USD/CAD', exchange: 'FX', market: 'Forex', pricePrecision: 5, volumePrecision: 0, priceCurrency: 'CAD', type: 'forex' },
  { ticker: 'USDCHF', name: 'US Dollar / Swiss Franc', shortName: 'USD/CHF', exchange: 'FX', market: 'Forex', pricePrecision: 5, volumePrecision: 0, priceCurrency: 'CHF', type: 'forex' },
]

const POPULAR_COMMODITIES: SymbolInfo[] = [
  { ticker: 'XAUUSD', name: 'Gold / US Dollar', shortName: 'Gold', exchange: 'COMM', market: 'Commodities', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'commodity' },
  { ticker: 'XAGUSD', name: 'Silver / US Dollar', shortName: 'Silver', exchange: 'COMM', market: 'Commodities', pricePrecision: 3, volumePrecision: 0, priceCurrency: 'USD', type: 'commodity' },
  { ticker: 'WTI', name: 'Crude Oil WTI', shortName: 'WTI', exchange: 'COMM', market: 'Commodities', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'commodity' },
  { ticker: 'BRENT', name: 'Brent Crude Oil', shortName: 'BRENT', exchange: 'COMM', market: 'Commodities', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'commodity' },
]

const POPULAR_INDICES: SymbolInfo[] = [
  { ticker: 'US500', name: 'S&P 500 Index', shortName: 'US500', exchange: 'INDEX', market: 'Indices', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'index' },
  { ticker: 'US30', name: 'Dow Jones Industrial', shortName: 'US30', exchange: 'INDEX', market: 'Indices', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'index' },
  { ticker: 'NAS100', name: 'Nasdaq 100 Index', shortName: 'NAS100', exchange: 'INDEX', market: 'Indices', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'index' },
]

const POPULAR_STOCKS: SymbolInfo[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', shortName: 'AAPL', exchange: 'NASDAQ', market: 'US Stocks', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'stock' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', shortName: 'SPY', exchange: 'NYSE', market: 'US Stocks', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'stock' },
  { ticker: 'TSLA', name: 'Tesla Inc.', shortName: 'TSLA', exchange: 'NASDAQ', market: 'US Stocks', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'stock' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', shortName: 'NVDA', exchange: 'NASDAQ', market: 'US Stocks', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'stock' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', shortName: 'MSFT', exchange: 'NASDAQ', market: 'US Stocks', pricePrecision: 2, volumePrecision: 0, priceCurrency: 'USD', type: 'stock' },
]

export const ALL_POPULAR_SYMBOLS: SymbolInfo[] = [
  ...POPULAR_CRYPTO,
  ...POPULAR_FOREX,
  ...POPULAR_COMMODITIES,
  ...POPULAR_INDICES,
  ...POPULAR_STOCKS,
]

export function resolveSymbol(input: string): ResolvedSymbol {
  const clean = (input || 'BTCUSDT').trim().toUpperCase().replace('/', '').replace('_', '')

  // 1. Commodities check (must be before forex to catch XAUUSD/XAGUSD)
  if (['XAUUSD', 'XAGUSD', 'WTI', 'BRENT', 'GOLD', 'SILVER'].includes(clean)) {
    const matched = POPULAR_COMMODITIES.find((s) => s.ticker === clean)
    return {
      assetClass: 'commodity',
      provider: 'biquote',
      normalizedSymbol: clean,
      name: matched?.name || clean,
      shortName: matched?.shortName || clean,
      exchange: 'COMM',
      symbolInfo: matched || {
        ticker: clean,
        name: clean,
        shortName: clean,
        exchange: 'COMM',
        market: 'Commodities',
        pricePrecision: 2,
        volumePrecision: 0,
        priceCurrency: 'USD',
        type: 'commodity',
      },
    }
  }

  // 2. Forex check
  const fxPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY']
  if (fxPairs.includes(clean) || (clean.length === 6 && (clean.endsWith('USD') || clean.startsWith('EUR') || clean.startsWith('GBP') || clean.startsWith('USD')) && !clean.includes('USDT'))) {
    const matched = POPULAR_FOREX.find((s) => s.ticker === clean)
    return {
      assetClass: 'forex',
      provider: 'biquote',
      normalizedSymbol: clean,
      name: matched?.name || `${clean.substring(0, 3)}/${clean.substring(3)}`,
      shortName: matched?.shortName || clean,
      exchange: 'FX',
      symbolInfo: matched || {
        ticker: clean,
        name: clean,
        shortName: clean,
        exchange: 'FX',
        market: 'Forex',
        pricePrecision: 5,
        volumePrecision: 0,
        priceCurrency: 'USD',
        type: 'forex',
      },
    }
  }

  // 3. Indices check
  if (['US500', 'US30', 'NAS100', 'GER30', 'UK100', 'SPX', 'NDX', 'DJI'].includes(clean)) {
    const matched = POPULAR_INDICES.find((s) => s.ticker === clean)
    return {
      assetClass: 'index',
      provider: 'biquote',
      normalizedSymbol: clean,
      name: matched?.name || clean,
      shortName: matched?.shortName || clean,
      exchange: 'INDEX',
      symbolInfo: matched || {
        ticker: clean,
        name: clean,
        shortName: clean,
        exchange: 'INDEX',
        market: 'Indices',
        pricePrecision: 2,
        volumePrecision: 0,
        priceCurrency: 'USD',
        type: 'index',
      },
    }
  }

  // 4. US Stocks check
  const knownStocks = ['AAPL', 'SPY', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'QQQ', 'META', 'NFLX', 'AMD', 'INTC']
  if (knownStocks.includes(clean) || (!clean.endsWith('USDT') && !clean.endsWith('BUSD') && clean.length <= 5 && !clean.includes('USD'))) {
    const matched = POPULAR_STOCKS.find((s) => s.ticker === clean)
    return {
      assetClass: 'stock',
      provider: 'fcsapi',
      normalizedSymbol: clean,
      name: matched?.name || `${clean} Stock`,
      shortName: clean,
      exchange: 'US Equity',
      symbolInfo: matched || {
        ticker: clean,
        name: clean,
        shortName: clean,
        exchange: 'US Equity',
        market: 'US Stocks',
        pricePrecision: 2,
        volumePrecision: 0,
        priceCurrency: 'USD',
        type: 'stock',
      },
    }
  }

  // 5. Crypto default
  const cryptoTicker = clean.endsWith('USDT') ? clean : `${clean}USDT`
  const matched = POPULAR_CRYPTO.find((s) => s.ticker === cryptoTicker || s.shortName === clean)
  return {
    assetClass: 'crypto',
    provider: 'binance',
    normalizedSymbol: cryptoTicker,
    name: matched?.name || cryptoTicker,
    shortName: matched?.shortName || clean,
    exchange: 'Binance',
    symbolInfo: matched || {
      ticker: cryptoTicker,
      name: cryptoTicker,
      shortName: clean,
      exchange: 'Binance',
      market: 'Crypto',
      pricePrecision: 2,
      volumePrecision: 4,
      priceCurrency: 'USD',
      type: 'crypto',
    },
  }
}
