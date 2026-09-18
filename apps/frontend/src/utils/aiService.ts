import { getJournalEntries } from './tradeJournalStore'
import { dispatchChartAction, type ChartActionPayload } from './chartActionStore'
import { addJournalEntry } from './tradeJournalStore'

const OPENROUTER_API_KEY =
  (import.meta.env?.VITE_OPENROUTER_API_KEY as string) || ''

// Top function-calling capable models on OpenRouter - Nex 2.5 Pro prioritized
export const CANDIDATE_MODELS = [
  'nex-agi/nex-n2.5-pro',
  'nex-agi/nex-n2.5-pro:free',
  'nex-agi/nex-n2.5-mini',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
  'qwen/qwen-2.5-72b-instruct',
  'google/gemini-2.0-flash-001',
]

// Native OpenRouter Tool Definitions
export const OPENROUTER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'draw_chart_setup',
      description: 'Plots technical analysis overlays, Order Blocks, Fair Value Gaps (FVG), Support/Resistance levels, Trendlines, and Long/Short Position risk-reward setups directly onto the live trading chart canvas.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The market ticker symbol (e.g. BTCUSDT, ETHUSDT, SOLUSDT, EURUSD, XAUUSD, AAPL)',
          },
          timeframe: {
            type: 'string',
            description: 'The chart timeframe (e.g. 1m, 5m, 15m, 1h, 4h, 1d)',
          },
          title: {
            type: 'string',
            description: 'Clear title of the plotted setup (e.g. "BTCUSDT 15M Bullish Order Block + Long Setup")',
          },
          description: {
            type: 'string',
            description: 'Analytical summary of the technical setup and trade rationale',
          },
          drawings: {
            type: 'array',
            description: 'Array of geometric overlays and position boxes to draw on the chart canvas',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  enum: [
                    'rect',
                    'horizontalStraightLine',
                    'longPositionOverlay',
                    'shortPositionOverlay',
                    'fibonacciRetracement',
                    'segmentLine',
                    'priceLine',
                  ],
                  description: 'The chart overlay type: rect (Order Block/FVG), horizontalStraightLine (Support/Resistance), longPositionOverlay (Long risk/reward: entry, TP, SL), shortPositionOverlay (Short risk/reward: entry, TP, SL), fibonacciRetracement (Fib levels), segmentLine (Trendline)',
                },
                label: {
                  type: 'string',
                  description: 'Display label for the overlay (e.g. "4H Bullish Order Block", "Daily Resistance", "Long Position Setup")',
                },
                zoneType: {
                  type: 'string',
                  enum: ['order_block', 'fvg', 'support', 'resistance', 'liquidity', 'position'],
                },
                points: {
                  type: 'array',
                  description: 'Price coordinates for the overlay. For rect: 2 price levels [bottom, top]. For longPositionOverlay/shortPositionOverlay: 3 price levels [entryPrice, takeProfitPrice, stopLossPrice]. For horizontalStraightLine: 1 price level [price].',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'number', description: 'Price level in dollars / quotes' },
                    },
                    required: ['value'],
                  },
                },
              },
              required: ['name', 'points'],
            },
          },
        },
        required: ['symbol', 'title', 'drawings'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'activate_chart_tool',
      description: 'Activates a drawing tool from the chart toolbar so the user can interactively draw on the chart canvas.',
      parameters: {
        type: 'object',
        properties: {
          toolName: {
            type: 'string',
            enum: [
              'fibonacciRetracement',
              'longPositionOverlay',
              'shortPositionOverlay',
              'rect',
              'horizontalStraightLine',
              'segmentLine',
              'straightLine',
              'rayLine',
              'priceRange',
              'brush',
            ],
            description: 'Name of the toolbar tool to activate',
          },
          title: {
            type: 'string',
            description: 'Title explaining which tool is active',
          },
        },
        required: ['toolName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_chart_symbol',
      description: 'Switches the live chart to a specific trading pair and timeframe.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'e.g. BTCUSDT, ETHUSDT, SOLUSDT, EURUSD, XAUUSD' },
          timeframe: { type: 'string', description: 'e.g. 1m, 5m, 15m, 1h, 4h, 1d' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_bar_replay',
      description: 'Starts deterministic bar replay mode for market structure backtesting.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          session: { type: 'string', description: 'e.g. "NY Open", "London Open", "Asia Session"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_trade_journal',
      description: 'Automatically records a trade execution into the user live Trade Journal and Performance Analytics.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'e.g. BTCUSDT' },
          direction: { type: 'string', enum: ['LONG', 'SHORT'] },
          entryPrice: { type: 'number' },
          stopLoss: { type: 'number' },
          takeProfit: { type: 'number' },
          pnlAmount: { type: 'number', description: 'Profit or loss amount in USD' },
          outcome: { type: 'string', enum: ['WIN', 'LOSS', 'OPEN'] },
          notes: { type: 'string' },
        },
        required: ['symbol', 'direction', 'entryPrice', 'outcome'],
      },
    },
  },
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

  return (
    `You are Chart Rabbit AI, an autonomous agentic trading co-pilot and ICT strategy analyst.\n\n` +
    `CURRENT ACTIVE PAGE CONTEXT: [${activePage.toUpperCase()}]\n` +
    `USER LIVE TRADE JOURNAL METRICS:\n` +
    `- Total Logged Trades: ${totalTrades}\n` +
    `- Net PnL: ${totalPnL >= 0 ? `+$${totalPnL.toFixed(2)}` : `-$${Math.abs(totalPnL).toFixed(2)}`}\n` +
    `- Win Rate: ${winRate}% (${winCount} Wins / ${lossCount} Losses)\n` +
    `- Profit Factor: ${profitFactor}\n` +
    `- Risk-to-Reward Target: 1:2.0\n\n` +
    `TOOL CALLING INSTRUCTIONS:\n` +
    `- When asked to analyze a chart, draw levels, plot Order Blocks / Fair Value Gaps, or setup a trade, CALL the 'draw_chart_setup' tool with exact price coordinates!\n` +
    `- When asked to select or activate a drawing tool, CALL 'activate_chart_tool'.\n` +
    `- When asked to switch symbols or timeframes, CALL 'switch_chart_symbol'.\n` +
    `- When asked to log a trade, CALL 'log_trade_journal'.\n` +
    `- Keep your textual commentary concise, highly analytical, actionable, and agentic. Do NOT use double asterisks (**) in your markdown output.`
  )
}

export function convertToolCallToAction(toolCall: any): ChartActionPayload | null {
  try {
    const fnName = toolCall?.function?.name
    const rawArgs = toolCall?.function?.arguments
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs || {}

    if (fnName === 'draw_chart_setup') {
      return {
        type: 'draw_setup',
        symbol: args.symbol || 'BTCUSDT',
        timeframe: args.timeframe || '15m',
        title: args.title || `${args.symbol || 'BTCUSDT'} Setup Plotted`,
        description: args.description || 'AI Plotted Technical Analysis Setup',
        drawings: args.drawings || [],
      }
    }
    if (fnName === 'activate_chart_tool') {
      return {
        type: 'activate_tool',
        toolName: args.toolName,
        title: args.title || `${args.toolName} Activated`,
      }
    }
    if (fnName === 'switch_chart_symbol') {
      return {
        type: 'switch_chart',
        symbol: args.symbol,
        timeframe: args.timeframe,
      }
    }
    if (fnName === 'start_bar_replay') {
      return {
        type: 'start_replay',
        symbol: args.symbol,
      }
    }
    if (fnName === 'log_trade_journal') {
      return {
        type: 'log_trade',
        title: `Logged ${args.direction} ${args.symbol}`,
        tradeData: {
          symbol: args.symbol || 'BTCUSDT',
          type: args.direction || 'LONG',
          entryPrice: args.entryPrice || 0,
          stopLoss: args.stopLoss,
          takeProfit: args.takeProfit,
          pnlAmount: args.pnlAmount,
          outcome: args.outcome || 'WIN',
          notes: args.notes || 'Logged by AI Agent tool call',
        },
      }
    }
  } catch (err) {
    console.warn('[aiService] Error parsing tool call:', err)
  }
  return null
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
      const timeoutId = setTimeout(() => controller.abort(), 25000)

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
          tools: OPENROUTER_TOOLS,
          tool_choice: 'auto',
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
      const choice = json?.choices?.[0]
      const message = choice?.message

      if (message) {
        let content = (message.content || '').trim()

        // Check if the model performed native tool calling
        if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
          for (const tc of message.tool_calls) {
            const action = convertToolCallToAction(tc)
            if (action) {
              dispatchChartAction(action)

              if (action.type === 'log_trade' && action.tradeData) {
                try {
                  addJournalEntry({
                    id: `trade_${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    symbol: action.tradeData.symbol || 'BTCUSDT',
                    direction: action.tradeData.type || 'LONG',
                    entryPrice: action.tradeData.entryPrice || 0,
                    stopLoss: action.tradeData.stopLoss,
                    takeProfit: action.tradeData.takeProfit,
                    pnlAmount: action.tradeData.pnlAmount || 0,
                    outcome: action.tradeData.outcome || 'WIN',
                    notes: action.tradeData.notes || 'Auto-logged by AI Tool Call',
                  })
                } catch {}
              }

              // Append formatted action block so UI creates interactive card
              content += `\n\n\`\`\`chart-action\n${JSON.stringify(action, null, 2)}\n\`\`\``
            }
          }
        }

        if (content.length > 0) {
          return content
        }
      }
    } catch (err) {
      console.warn(`[OpenRouter] Failed with model ${model}:`, err)
    }
  }

  throw new Error('All OpenRouter AI candidate models exhausted')
}
