export interface JournalEntry {
  id: string
  tradeId: string
  title: string
  assetClass: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  exitPrice: number
  targetPrice: number
  stopPrice: number
  outcome: 'WIN' | 'LOSS'
  pnlAmount: number
  pnlPercentage: number
  winRate: number
  riskReward: string
  totalReplays: number
  rules: string[]
  notes: string
  createdAt: string
  tags: string[]
}

const STORAGE_KEY = 'retro_trade_journal_entries_v2'

const INITIAL_ENTRIES: JournalEntry[] = [
  {
    id: 'entry-101',
    tradeId: 'T-101',
    title: 'BTCUSDT Order Block Sweep',
    assetClass: 'Crypto',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    entryPrice: 83500,
    exitPrice: 85200,
    targetPrice: 85200,
    stopPrice: 82500,
    outcome: 'WIN',
    pnlAmount: 1700,
    pnlPercentage: 2.03,
    winRate: 68.5,
    riskReward: '1 : 2.5',
    totalReplays: 24,
    rules: [
      'Wait for 4H liquidity sweep below support',
      'Look for 15M Market Structure Shift (MSS)',
      'Enter at Fair Value Gap with SL below recent low',
    ],
    notes: 'Clean execution during NY session open. Target reached within 2 hours.',
    createdAt: '2026-03-15',
    tags: ['Crypto', 'ICT', 'Replay Verified'],
  },
  {
    id: 'entry-102',
    tradeId: 'T-102',
    title: 'EURUSD London Breakout',
    assetClass: 'Forex',
    symbol: 'EURUSD',
    direction: 'SHORT',
    entryPrice: 1.089,
    exitPrice: 1.084,
    targetPrice: 1.084,
    stopPrice: 1.0925,
    outcome: 'WIN',
    pnlAmount: 500,
    pnlPercentage: 0.46,
    winRate: 62.0,
    riskReward: '1 : 2.0',
    totalReplays: 18,
    rules: [
      'Identify Asian session high and low range',
      'Breakout entry below Asian low at London open',
      'Target 2.0x risk-to-reward ratio',
    ],
    notes: 'Solid London open momentum on EURUSD.',
    createdAt: '2026-03-14',
    tags: ['Forex', 'Breakout', 'London Open'],
  },
  {
    id: 'entry-103',
    tradeId: 'T-103',
    title: 'XAUUSD Gold Support Reversal',
    assetClass: 'Commodities',
    symbol: 'XAUUSD',
    direction: 'LONG',
    entryPrice: 2690,
    exitPrice: 2675,
    targetPrice: 2720,
    stopPrice: 2675,
    outcome: 'LOSS',
    pnlAmount: -300,
    pnlPercentage: -0.56,
    winRate: 55.0,
    riskReward: '1 : 2.0',
    totalReplays: 15,
    rules: [
      'Wait for daily key support retest on Gold',
      'Look for bullish engulfing candle on 1H',
    ],
    notes: 'Stopped out due to high volatility before CPI news release.',
    createdAt: '2026-03-13',
    tags: ['Commodities', 'Gold', 'News Event'],
  },
  {
    id: 'entry-104',
    tradeId: 'T-104',
    title: 'SOLUSDT Trend Continuation',
    assetClass: 'Crypto',
    symbol: 'SOLUSDT',
    direction: 'LONG',
    entryPrice: 185,
    exitPrice: 198.5,
    targetPrice: 198.5,
    stopPrice: 180,
    outcome: 'WIN',
    pnlAmount: 1350,
    pnlPercentage: 7.3,
    winRate: 70.0,
    riskReward: '1 : 2.7',
    totalReplays: 20,
    rules: [
      'Enter on 1H higher low confirmation',
      'Target previous swing high resistance',
    ],
    notes: 'Strong bullish continuation trend across crypto altcoins.',
    createdAt: '2026-03-12',
    tags: ['Crypto', 'Solana', 'Trend'],
  },
  {
    id: 'entry-105',
    tradeId: 'T-105',
    title: 'AAPL VWAP Mean Reversion',
    assetClass: 'Stock',
    symbol: 'AAPL',
    direction: 'SHORT',
    entryPrice: 228,
    exitPrice: 224.5,
    targetPrice: 224.5,
    stopPrice: 231,
    outcome: 'WIN',
    pnlAmount: 350,
    pnlPercentage: 1.53,
    winRate: 64.0,
    riskReward: '1 : 1.8',
    totalReplays: 12,
    rules: [
      'Price extended 2 standard deviations away from VWAP',
      'RSI overbought (>70) divergence',
    ],
    notes: 'Reverted cleanly to session VWAP baseline.',
    createdAt: '2026-03-11',
    tags: ['Stock', 'VWAP', 'Equities'],
  },
  {
    id: 'entry-106',
    tradeId: 'T-106',
    title: 'ETHUSDT Breakdown Breakdown',
    assetClass: 'Crypto',
    symbol: 'ETHUSDT',
    direction: 'SHORT',
    entryPrice: 2720,
    exitPrice: 2780,
    targetPrice: 2650,
    stopPrice: 2780,
    outcome: 'LOSS',
    pnlAmount: -600,
    pnlPercentage: -2.2,
    winRate: 52.0,
    riskReward: '1 : 2.1',
    totalReplays: 10,
    rules: [
      'Enter short below key 4H support breakdown',
    ],
    notes: 'Fakeout breakdown; market reversed sharply above 2750.',
    createdAt: '2026-03-10',
    tags: ['Crypto', 'Ethereum', 'Fakeout'],
  },
]

type Listener = (entries: JournalEntry[]) => void
const listeners: Set<Listener> = new Set()

export function getJournalEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ENTRIES))
      return INITIAL_ENTRIES
    }
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed loading journal entries from storage:', err)
    return INITIAL_ENTRIES
  }
}

export function saveJournalEntries(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    listeners.forEach((listener) => listener(entries))
  } catch (err) {
    console.error('Failed saving journal entries:', err)
  }
}

export function addJournalEntry(entryData: Omit<JournalEntry, 'id' | 'tradeId' | 'createdAt'>): JournalEntry {
  const current = getJournalEntries()
  const nextNumber = 101 + current.length
  const newEntry: JournalEntry = {
    ...entryData,
    id: `entry-${Date.now()}`,
    tradeId: `T-${nextNumber}`,
    createdAt: new Date().toISOString().split('T')[0],
  }
  const updated = [newEntry, ...current]
  saveJournalEntries(updated)
  return newEntry
}

export function deleteJournalEntry(id: string): void {
  const current = getJournalEntries()
  const updated = current.filter((item) => item.id !== id)
  saveJournalEntries(updated)
}

export function subscribeJournalEntries(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
