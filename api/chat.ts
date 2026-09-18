export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    const { text, message, messages, active_page = 'aichat' } = req.body || {}
    const userText = text || message || ''
    
    // Support all case variations of OpenRouter API key environment variable on Vercel
    const apiKey =
      process.env.OPENROUTER_API_KEY ||
      process.env.openrouter ||
      process.env.OPENROUTER ||
      process.env.VITE_OPENROUTER_API_KEY ||
      process.env.openrouter_api_key ||
      process.env.OPEN_ROUTER_API_KEY ||
      process.env.OPENROUTER_KEY ||
      ''

    if (!apiKey) {
      console.error('[api/chat] No OpenRouter API key found in process.env. Checked: OPENROUTER_API_KEY, openrouter, OPENROUTER, VITE_OPENROUTER_API_KEY')
      res.status(500).json({ error: 'Missing OpenRouter API key. Please check your Vercel Environment Variables (e.g. OPENROUTER_API_KEY or openrouter).' })
      return
    }

    const promptMessages =
      Array.isArray(messages) && messages.length > 0
        ? messages
        : [{ role: 'user', content: userText }]

    const candidateModels = [
      'nex-agi/nex-n2.5-pro',
      'nex-agi/nex-n2.5-pro:free',
      'nex-agi/nex-n2.5-mini',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'qwen/qwen-2.5-72b-instruct',
      'google/gemini-2.0-flash-001',
    ]

    const tools = [
      {
        type: 'function',
        function: {
          name: 'draw_chart_setup',
          description: 'Plots technical analysis overlays, Order Blocks, Fair Value Gaps (FVG), Support/Resistance levels, Trendlines, and Long/Short Position risk-reward setups directly onto the live trading chart canvas.',
          parameters: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'e.g. BTCUSDT, ETHUSDT, SOLUSDT, EURUSD, XAUUSD' },
              timeframe: { type: 'string', description: 'e.g. 1m, 5m, 15m, 1h, 4h, 1d' },
              title: { type: 'string', description: 'Setup title' },
              description: { type: 'string', description: 'Setup description' },
              drawings: {
                type: 'array',
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
                    },
                    label: { type: 'string' },
                    zoneType: { type: 'string', enum: ['order_block', 'fvg', 'support', 'resistance', 'liquidity', 'position'] },
                    points: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { value: { type: 'number' } },
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
          description: 'Activates a drawing tool from the chart toolbar so the user can draw immediately.',
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
              },
              title: { type: 'string' },
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
              symbol: { type: 'string' },
              timeframe: { type: 'string' },
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
              session: { type: 'string' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'log_trade_journal',
          description: 'Automatically records a trade execution into the user live Trade Journal.',
          parameters: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              direction: { type: 'string', enum: ['LONG', 'SHORT'] },
              entryPrice: { type: 'number' },
              stopLoss: { type: 'number' },
              takeProfit: { type: 'number' },
              pnlAmount: { type: 'number' },
              outcome: { type: 'string', enum: ['WIN', 'LOSS', 'OPEN'] },
              notes: { type: 'string' },
            },
            required: ['symbol', 'direction', 'entryPrice', 'outcome'],
          },
        },
      },
    ]

    let lastError = ''

    for (const model of candidateModels) {
      try {
        const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://chartrabbit.vercel.app',
            'X-Title': 'Chart Rabbit Trading Platform',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `You are Chart Rabbit AI, an autonomous agentic trading co-pilot and ICT strategy analyst. Active page context: [${String(active_page).toUpperCase()}]. When analyzing setups or logging trades, invoke the available tools to plot overlays and execute actions. Do NOT use markdown bold formatting like **text**. Keep responses clean and readable without any double asterisks (**).`,
              },
              ...promptMessages,
            ],
            tools,
            tool_choice: 'auto',
            stream: false,
          }),
        })

        if (!openRouterRes.ok) {
          const errText = await openRouterRes.text()
          lastError = `[Model ${model} HTTP ${openRouterRes.status}]: ${errText}`
          console.warn('[api/chat] OpenRouter call failed:', lastError)
          if (openRouterRes.status === 401) {
            res.status(401).json({ error: `OpenRouter 401 Unauthorized: Invalid API Key. Please verify your OpenRouter key in Vercel.` })
            return
          }
          continue
        }

        const data = await openRouterRes.json()
        const choice = data?.choices?.[0]
        const message = choice?.message

        if (message) {
          let content = (message.content || '').replace(/\*\*/g, '').trim()

          if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
            for (const tc of message.tool_calls) {
              try {
                const fnName = tc?.function?.name
                const args = typeof tc?.function?.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : tc?.function?.arguments || {}

                let actionPayload: any = null
                if (fnName === 'draw_chart_setup') {
                  actionPayload = {
                    type: 'draw_setup',
                    symbol: args.symbol || 'BTCUSDT',
                    timeframe: args.timeframe || '15m',
                    title: args.title || `${args.symbol || 'BTCUSDT'} Setup Plotted`,
                    description: args.description || 'AI Plotted Technical Analysis Setup',
                    drawings: args.drawings || [],
                  }
                } else if (fnName === 'activate_chart_tool') {
                  actionPayload = {
                    type: 'activate_tool',
                    toolName: args.toolName,
                    title: args.title || `${args.toolName} Activated`,
                  }
                } else if (fnName === 'switch_chart_symbol') {
                  actionPayload = {
                    type: 'switch_chart',
                    symbol: args.symbol,
                    timeframe: args.timeframe,
                  }
                } else if (fnName === 'start_bar_replay') {
                  actionPayload = {
                    type: 'start_replay',
                    symbol: args.symbol,
                  }
                } else if (fnName === 'log_trade_journal') {
                  actionPayload = {
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
                      notes: args.notes || 'Auto-logged by AI Tool Call',
                    },
                  }
                }

                if (actionPayload) {
                  content += `\n\n\`\`\`chart-action\n${JSON.stringify(actionPayload, null, 2)}\n\`\`\``
                }
              } catch {}
            }
          }

          if (content.length > 0) {
            res.status(200).json({
              id: `msg-${Date.now()}`,
              sender: 'ai',
              text: content,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })
            return
          }
        }
      } catch (err: any) {
        lastError = err?.message || String(err)
      }
    }

    res.status(502).json({
      error: `All OpenRouter models failed. Last error: ${lastError || 'Unknown error'}. Please check your OpenRouter account balance/key.`,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
}
