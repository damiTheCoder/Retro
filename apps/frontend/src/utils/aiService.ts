import { getJournalEntries } from './tradeJournalStore'

const OPENROUTER_API_KEY =
  (import.meta.env?.VITE_OPENROUTER_API_KEY as string) || ''

// Reliable active free models on OpenRouter (tested & verified working)
const CANDIDATE_MODELS = [
  'deepseek/deepseek-v4-flash-0731:free',
  'inclusionai/ling-3.0-flash-fin:free',
  'qwen/qwen3.8-27b:free',
  'nex-agi/nex-n2.5-mini:free',
]

export function buildSystemContext(activePage: string = 'aichat'): string {
  const entries = getJournalEntries()
  const totalTrades = entries.length
  const totalPnL = entries.reduce((acc, e) => acc + (e.pnlAmount || 0), 0)
  const winCount = entries.filter((e) => e.outcome === 'WIN').length
  const lossCount = entries.filter((e) => e.outcome === 'LOSS').length
  const winRate = totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(1) : '0'

  const wins = entries.filter((e) => e.outcome === 'WIN').map((e) => e.pnlAmount || 0)
  const losses = entries.filter((e) => e.outcome === 'LOSS').map((e) => Math.abs(e.pnlAmount || 0))
  const grossProfit = wins.reduce((a, b) => a + b, 0)
  const grossLoss = losses.reduce((a, b) => a + b, 0)
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '99.0' : '0.0'

  const pageFocus: Record<string, string> = {
    chart:
      'The user is viewing the Live Trading Chart. Act as an active chart co-pilot: provide immediate ICT technical analysis (Order Blocks, Fair Value Gaps, Market Structure Shifts), suggest exact Entry / Stop Loss / Take Profit prices, and trigger chart drawings & tools.',
    journal:
      'The user is viewing the Trade Journal. Act as a trading journal auditor: analyze their logged trades, identify revenge trading or risk rule violations, evaluate win/loss distribution, and auto-log trades.',
    analytics:
      'The user is viewing Performance Analytics. Act as a quantitative portfolio strategist: break down Net PnL, Win Rate %, Profit Factor, R:R ratios, and performance curves.',
    aichat:
      'The user is in the main AI Co-Pilot Chat view. Provide comprehensive, agentic trading assistance across technical chart setups, risk management, and journal history.',
  }

  const focusDesc = pageFocus[activePage.toLowerCase()] || pageFocus.aichat

  return (
    `You are Chart Rabbit AI, an autonomous agentic trading co-pilot and ICT strategy analyst.\n\n` +
    `CURRENT ACTIVE PAGE CONTEXT: [${activePage.toUpperCase()}]\n` +
    `${focusDesc}\n\n` +
    `USER LIVE TRADE JOURNAL METRICS:\n` +
    `- Total Logged Trades: ${totalTrades}\n` +
    `- Net PnL: ${totalPnL >= 0 ? `+$${totalPnL.toFixed(2)}` : `-$${Math.abs(totalPnL).toFixed(2)}`}\n` +
    `- Win Rate: ${winRate}% (${winCount} Wins / ${lossCount} Losses)\n` +
    `- Profit Factor: ${profitFactor}\n` +
    `- Risk-to-Reward Target: 1:2.0\n\n` +
    `AGENTIC ACTION SYSTEM:\n` +
    `Whenever you provide technical analysis, draw levels/order blocks, suggest a trade setup, activate a tool, or log a trade, always include a structured action block at the very end of your response in this exact format:\n` +
    `\`\`\`chart-action\n` +
    `{\n` +
    `  "type": "draw_setup",\n` +
    `  "symbol": "BTCUSDT",\n` +
    `  "timeframe": "15m",\n` +
    `  "title": "Bullish Order Block & Long Setup",\n` +
    `  "description": "ICT Bullish Order Block with 1:2.5 R:R Long Setup",\n` +
    `  "drawings": [\n` +
    `    {\n` +
    `      "name": "rect",\n` +
    `      "label": "Bullish Order Block",\n` +
    `      "points": [{ "value": 63800 }, { "value": 64200 }],\n` +
    `      "zoneType": "order_block"\n` +
    `    },\n` +
    `    {\n` +
    `      "name": "longPositionOverlay",\n` +
    `      "label": "Long Setup",\n` +
    `      "points": [{ "value": 64100 }, { "value": 66200 }, { "value": 63400 }],\n` +
    `      "zoneType": "position"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n` +
    `\`\`\`\n\n` +
    `Supported drawing names:\n` +
    `- "rect" (Order Blocks, Fair Value Gaps, Consolidation zones)\n` +
    `- "horizontalStraightLine" (Support, Resistance, Daily Highs/Lows)\n` +
    `- "longPositionOverlay" (Long Position risk/reward: points: [entry, takeProfit, stopLoss])\n` +
    `- "shortPositionOverlay" (Short Position risk/reward: points: [entry, takeProfit, stopLoss])\n` +
    `- "fibonacciRetracement" (Fibonacci levels: points: [swingHigh, swingLow])\n` +
    `- "segmentLine" (Trendlines, liquidity sweeps)\n\n` +
    `If the user asks to log a trade:\n` +
    `\`\`\`chart-action\n` +
    `{\n` +
    `  "type": "log_trade",\n` +
    `  "title": "Trade Logged to Journal",\n` +
    `  "tradeData": {\n` +
    `    "symbol": "BTCUSDT",\n` +
    `    "type": "LONG",\n` +
    `    "entryPrice": 64100,\n` +
    `    "pnlAmount": 450,\n` +
    `    "outcome": "WIN",\n` +
    `    "notes": "ICT MSS confirmation"\n` +
    `  }\n` +
    `}\n` +
    `\`\`\`\n\n` +
    `Instructions: Be direct, highly analytical, actionable, and agentic. Do NOT use double asterisks (**) in your regular commentary.`
  )
}

export async function generateClientAiResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  activePage: string = 'aichat'
): Promise<string> {
  const systemPrompt = buildSystemContext(activePage)
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages]

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chartrabbit.vercel.app'

  const apiKey =
    OPENROUTER_API_KEY ||
    (typeof window !== 'undefined' ? localStorage.getItem('openrouter_api_key') || '' : '')

  if (!apiKey) {
    throw new Error('No OpenRouter API key configured')
  }

  for (const model of CANDIDATE_MODELS) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': origin,
          'X-Title': 'Chart Rabbit Trading Platform',
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          stream: false,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        console.warn(`[OpenRouter] Model ${model} returned status ${res.status}, trying next...`)
        continue
      }

      const json = await res.json()
      const content = json?.choices?.[0]?.message?.content
      if (content && typeof content === 'string' && content.trim().length > 0) {
        return content.trim()
      }
    } catch (err) {
      console.warn(`[OpenRouter] Failed with model ${model}:`, err)
    }
  }

  throw new Error('All OpenRouter AI candidate models exhausted')
}
