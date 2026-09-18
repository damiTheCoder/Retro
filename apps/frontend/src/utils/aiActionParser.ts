import { dispatchChartAction, type ChartActionPayload } from './chartActionStore'
import { addJournalEntry } from './tradeJournalStore'

export interface ParsedAiResponse {
  cleanText: string
  action: ChartActionPayload | null
}

export function parseAiResponseActions(rawText: string): ParsedAiResponse {
  if (!rawText) {
    return { cleanText: '', action: null }
  }

  // 1. Check for ```chart-action ... ``` markdown block
  const actionRegex = /```(?:chart-action|json:action|action)\s*([\s\S]*?)\s*```/i
  const match = rawText.match(actionRegex)

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1].trim()) as ChartActionPayload
      if (parsed && parsed.type) {
        // Dispatch the action to our unified store
        dispatchChartAction(parsed)

        // If it's a journal logging action, auto-log it
        if (parsed.type === 'log_trade' && parsed.tradeData) {
          try {
            addJournalEntry({
              id: `trade_${Date.now()}`,
              timestamp: new Date().toISOString(),
              symbol: parsed.tradeData.symbol || 'BTCUSDT',
              direction: parsed.tradeData.type || 'LONG',
              entryPrice: parsed.tradeData.entryPrice || 0,
              stopLoss: parsed.tradeData.stopLoss,
              takeProfit: parsed.tradeData.takeProfit,
              pnlAmount: parsed.tradeData.pnlAmount || 0,
              outcome: parsed.tradeData.outcome || 'WIN',
              notes: parsed.tradeData.notes || 'Auto-logged by Chart Rabbit AI',
            })
          } catch (err) {
            console.warn('[aiActionParser] Failed to auto-log trade:', err)
          }
        }

        const cleanText = rawText.replace(match[0], '').trim()
        return {
          cleanText,
          action: parsed,
        }
      }
    } catch (err) {
      console.warn('[aiActionParser] Failed to parse action JSON:', err)
    }
  }

  return {
    cleanText: rawText,
    action: null,
  }
}
