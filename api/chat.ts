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
    const apiKey = process.env.openrouter || ''

    if (!apiKey) {
      res.status(500).json({ error: 'Missing OpenRouter API key on server' })
      return
    }

    const promptMessages =
      Array.isArray(messages) && messages.length > 0
        ? messages
        : [{ role: 'user', content: userText }]

    const candidateModels = [
      'deepseek/deepseek-v4-flash-0731:free',
      'inclusionai/ling-3.0-flash-fin:free',
      'qwen/qwen3.8-27b:free',
      'nex-agi/nex-n2.5-mini:free',
    ]

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
                content: `You are Chart Rabbit AI, an autonomous agentic trading co-pilot and ICT strategy analyst. Active page context: [${String(active_page).toUpperCase()}]. Be direct, highly analytical, actionable, and agentic. Do NOT use markdown bold formatting like **text**. Keep responses clean and readable without any double asterisks (**).`,
              },
              ...promptMessages,
            ],
            stream: false,
          }),
        })

        if (!openRouterRes.ok) continue
        const data = await openRouterRes.json()
        const content = data?.choices?.[0]?.message?.content
        if (content && typeof content === 'string') {
          res.status(200).json({
            id: `msg-${Date.now()}`,
            sender: 'ai',
            text: content.replace(/\*\*/g, '').trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          })
          return
        }
      } catch {}
    }

    res.status(200).json({
      id: `msg-${Date.now()}`,
      sender: 'ai',
      text: `Chart Rabbit AI Co-Pilot: Active and evaluating setups for ${String(active_page).toUpperCase()}. Maintain strict risk management with a minimum 1:2.0 Risk-to-Reward ratio.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal Server Error' })
  }
}
