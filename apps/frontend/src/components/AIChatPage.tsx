import React, { useState, useEffect, useRef } from 'react'
import {
  SendIcon,
  PaperclipIcon,
  SparklesIcon,
  LineChartIcon,
  BookOpenIcon,
  BarChart3Icon,
  BotIcon,
} from './ShadcnIcons'
import {
  AI_MODEL_OPTIONS,
  getSelectedModel,
  setSelectedModel,
  getChatThreads,
  getActiveThreadId,
  addMessageToThread,
  subscribeChat,
  type ChatThread,
} from '../utils/chatStore'
import { getJournalEntries, addJournalEntry } from '../utils/tradeJournalStore'
import { sendChatMessageApi, createJournalEntryApi } from '../api/client'
import { generateClientAiResponse } from '../utils/aiService'
import { parseAiResponseActions } from '../utils/aiActionParser'
import { AIActionCard } from './AIActionCard'
import { setPendingChartNavigation, type ChartActionPayload } from '../utils/chartActionStore'
import type { NavPage } from './Sidebar'
import './AIChatPage.css'

interface AIChatPageProps {
  onNavigateToPage?: (page: NavPage, symbol?: string, timeframe?: string) => void
}

const PAGE_CONTEXT_OPTIONS = [
  { id: 'chart', title: 'Chart Co-Pilot', icon: LineChartIcon, placeholder: 'Ask about chart setups, technical levels & stop loss...' },
  { id: 'journal', title: 'Journal Auditor', icon: BookOpenIcon, placeholder: 'Ask to audit your logged trades and execution errors...' },
  { id: 'analytics', title: 'Analytics Evaluator', icon: BarChart3Icon, placeholder: 'Ask to analyze your Win Rate, Profit Factor & Expectancy...' },
  { id: 'aichat', title: 'General AI Agent', icon: BotIcon, placeholder: 'Ask Chart Rabbit AI anything about trading strategies...' },
]

const CONTEXT_QUICK_PROMPTS: Record<string, Array<{ title: string; prompt: string }>> = {
  chart: [
    {
      title: 'Plot ICT Order Block & Long Setup',
      prompt: 'Analyze BTCUSDT 15M, draw the key bullish Order Block zone and plot a Long Position setup with 1:2.5 R:R.',
    },
    {
      title: 'Draw Daily Support & Resistance',
      prompt: 'Plot key horizontal support and resistance levels on BTCUSDT.',
    },
    {
      title: 'Activate Fibonacci Tool',
      prompt: 'Select the Fibonacci Retracement drawing tool on the chart.',
    },
    {
      title: 'ETHUSDT Market Structure Shift',
      prompt: 'Analyze ETHUSDT for an ICT Market Structure Shift and draw the Fair Value Gap (FVG).',
    },
  ],
  journal: [
    {
      title: 'Audit Recent Executions',
      prompt: 'Audit my recent trade journal win rate and point out recurring mistakes.',
    },
    {
      title: 'Log WIN Trade Action',
      prompt: 'Log a WIN trade for +$350 on BTCUSDT LONG in my journal.',
    },
    {
      title: 'Journal Win Rate Review',
      prompt: 'Summarize my journal stats: Net PnL, Win Rate %, and total trades logged.',
    },
    {
      title: 'Emotion & Discipline Check',
      prompt: 'Check if revenge trading or fomo is hurting my logged trade outcomes.',
    },
  ],
  analytics: [
    {
      title: 'Profit Factor & Expectancy',
      prompt: 'Evaluate my current Profit Factor and trade expectancy from analytics.',
    },
    {
      title: 'Win Rate Optimization',
      prompt: 'How can I elevate my Win Rate to 70% based on my current analytics distribution?',
    },
    {
      title: 'Risk-to-Reward Ratio',
      prompt: 'Analyze if my average win size justifies my current stop loss distance.',
    },
    {
      title: 'Strategy Benchmarking',
      prompt: 'Benchmark my trading metrics against institutional prop firm standards.',
    },
  ],
  aichat: [
    {
      title: 'Plot BTCUSDT ICT Setup',
      prompt: 'Draw a bullish Order Block and Long Position setup on BTCUSDT.',
    },
    {
      title: 'Auto-Log Trade Action',
      prompt: 'Log a LONG trade for +$500 PnL on BTCUSDT into my live trade journal.',
    },
    {
      title: 'ICT Market Structure Shift',
      prompt: 'Explain the key rules of a high-probability ICT Market Structure Shift (MSS).',
    },
    {
      title: 'Journal Performance Review',
      prompt: 'Review my recent trade journal win rate and suggest improvements.',
    },
  ],
}

export function AIChatPage({ onNavigateToPage }: AIChatPageProps) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [inputText, setInputText] = useState<string>('')
  const [selectedModel, setModel] = useState<string>(getSelectedModel())
  const [activePageContext, setActivePageContext] = useState<string>('aichat')
  const [isThinking, setIsThinking] = useState<boolean>(false)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const syncChatData = () => {
    setThreads(getChatThreads())
    setActiveId(getActiveThreadId())
    setModel(getSelectedModel())
  }

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    setModel(model)
  }

  useEffect(() => {
    syncChatData()
    const unsubscribe = subscribeChat(syncChatData)
    return () => unsubscribe()
  }, [])

  const currentThread = threads.find((t) => t.id === activeId) || threads[0]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentThread?.messages, isThinking])

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim()
    if (!text || !currentThread) return

    setInputText('')
    addMessageToThread(currentThread.id, 'user', text)
    setIsThinking(true)

    try {
      let reply: string | null = null

      // 1. Try backend chat API first
      try {
        const res = await sendChatMessageApi(currentThread.id, text, activePageContext)
        if (res && (res as any).text) {
          reply = (res as any).text
        }
      } catch (backendErr) {
        console.warn('Backend chat API failed, falling back to direct OpenRouter client:', backendErr)
      }

      // 2. If backend is unavailable (e.g. on Vercel), invoke direct OpenRouter client
      if (!reply) {
        try {
          const history = (currentThread.messages || []).map((m) => ({
            role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.text,
          }))
          reply = await generateClientAiResponse(history, activePageContext)
        } catch (clientAiErr) {
          console.warn('Direct OpenRouter call failed, using local assistant:', clientAiErr)
        }
      }

      if (reply) {
        addMessageToThread(currentThread.id, 'ai', reply)
      } else {
        // Fallback local heuristic execution
        addFallbackAiResponse(text, currentThread.id)
      }
    } catch (err) {
      addFallbackAiResponse(text, currentThread.id)
    } finally {
      setIsThinking(false)
    }
  }

  const addFallbackAiResponse = (text: string, threadId: string) => {
    const journalEntries = getJournalEntries()
    const totalTrades = journalEntries.length
    const totalPnL = journalEntries.reduce((acc, e) => acc + (e.pnlAmount || 0), 0)
    const winCount = journalEntries.filter((e) => e.outcome === 'WIN').length
    const winRate = totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(1) : '0'

    let aiResponse = ''
    const lower = text.toLowerCase()

    if (lower.includes('order block') || lower.includes('draw') || lower.includes('long') || lower.includes('setup') || lower.includes('chart')) {
      const isEth = lower.includes('eth')
      const isSol = lower.includes('sol')
      const symbol = isEth ? 'ETHUSDT' : isSol ? 'SOLUSDT' : 'BTCUSDT'
      const basePrice = isEth ? 2750 : isSol ? 192 : 84200
      const obLow = Math.round(basePrice * 0.99)
      const obHigh = Math.round(basePrice * 0.996)
      const entry = Math.round(basePrice * 0.995)
      const tp = Math.round(basePrice * 1.025)
      const sl = Math.round(basePrice * 0.985)

      aiResponse = `Technical Analysis & ICT Setup for ${symbol}:\n\n` +
        `- Market Structure: Bullish continuation from key demand zone.\n` +
        `- Order Block Zone: $${obLow.toLocaleString()} - $${obHigh.toLocaleString()}\n` +
        `- Trade Setup: LONG @ $${entry.toLocaleString()} | Target: $${tp.toLocaleString()} | Stop Loss: $${sl.toLocaleString()}\n` +
        `- Risk-to-Reward: 1:2.5 target with institutional liquidity sweep confirmation.\n\n` +
        `\`\`\`chart-action\n` +
        `{\n` +
        `  "type": "draw_setup",\n` +
        `  "symbol": "${symbol}",\n` +
        `  "timeframe": "15m",\n` +
        `  "title": "${symbol} ICT Order Block & Long Setup",\n` +
        `  "description": "Bullish Order Block ($${obLow} - $${obHigh}) with 1:2.5 R:R Long Setup",\n` +
        `  "drawings": [\n` +
        `    {\n` +
        `      "name": "rect",\n` +
        `      "label": "Bullish Order Block",\n` +
        `      "points": [{ "value": ${obLow} }, { "value": ${obHigh} }],\n` +
        `      "zoneType": "order_block"\n` +
        `    },\n` +
        `    {\n` +
        `      "name": "longPositionOverlay",\n` +
        `      "label": "Long Position Setup",\n` +
        `      "points": [{ "value": ${entry} }, { "value": ${tp} }, { "value": ${sl} }],\n` +
        `      "zoneType": "position"\n` +
        `    }\n` +
        `  ]\n` +
        `}\n` +
        `\`\`\``
    } else if (lower.includes('log') && (lower.includes('trade') || lower.includes('win') || lower.includes('loss') || lower.includes('pnl'))) {
      const isWin = lower.includes('win') || (!lower.includes('loss') && !text.includes('-'))
      const pnlMatch = text.match(/[\+\-]?\$?(\d+(\.\d+)?)/)
      const parsedPnL = pnlMatch ? parseFloat(pnlMatch[1]) : 350
      const pnlVal = isWin ? Math.abs(parsedPnL) : -Math.abs(parsedPnL)
      const symbol = lower.includes('eth') ? 'ETHUSDT' : lower.includes('sol') ? 'SOLUSDT' : 'BTCUSDT'

      aiResponse = `I have logged this execution to your live Trade Journal:\n\n` +
        `- Symbol: ${symbol}\n` +
        `- Direction: ${lower.includes('short') ? 'SHORT' : 'LONG'}\n` +
        `- Outcome: ${isWin ? 'WIN' : 'LOSS'}\n` +
        `- PnL: ${pnlVal >= 0 ? `+$${pnlVal}` : `-$${Math.abs(pnlVal)}`}\n\n` +
        `\`\`\`chart-action\n` +
        `{\n` +
        `  "type": "log_trade",\n` +
        `  "title": "Trade Logged to Journal",\n` +
        `  "tradeData": {\n` +
        `    "symbol": "${symbol}",\n` +
        `    "type": "${lower.includes('short') ? 'SHORT' : 'LONG'}",\n` +
        `    "entryPrice": 84200,\n` +
        `    "pnlAmount": ${pnlVal},\n` +
        `    "outcome": "${isWin ? 'WIN' : 'LOSS'}",\n` +
        `    "notes": "Logged via AI Chat"\n` +
        `  }\n` +
        `}\n` +
        `\`\`\``
    } else if (lower.includes('fib') || lower.includes('fibonacci') || lower.includes('tool')) {
      aiResponse = `Fibonacci Retracement tool selected. You can now drag on the chart canvas between key swing points.\n\n` +
        `\`\`\`chart-action\n` +
        `{\n` +
        `  "type": "activate_tool",\n` +
        `  "toolName": "fibonacciRetracement",\n` +
        `  "title": "Fibonacci Retracement Tool Selected"\n` +
        `}\n` +
        `\`\`\``
    } else {
      aiResponse = `Real-Time Journal Performance Summary:\n\n- Total Logged Trades: ${totalTrades}\n- Total Net PnL: ${totalPnL >= 0 ? `+$${totalPnL.toLocaleString()}` : `-$${Math.abs(totalPnL).toLocaleString()}`}\n- Overall Win Rate: ${winRate}% (${winCount} Wins / ${totalTrades - winCount} Losses)\n\nChart Rabbit AI is ready to operate your chart, draw technical levels, or manage trade executions.`
    }

    addMessageToThread(threadId, 'ai', aiResponse)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleCopyMessage = (msgId: string, text: string) => {
    const { cleanText } = parseAiResponseActions(text)
    navigator.clipboard.writeText(cleanText.replace(/\*\*/g, ''))
    setCopiedMsgId(msgId)
    setTimeout(() => setCopiedMsgId(null), 2000)
  }

  const handleCardNavigate = (page: 'chart' | 'journal' | 'analytics' | 'aichat', symbol?: string, timeframe?: string) => {
    if (page === 'chart' && (symbol || timeframe)) {
      setPendingChartNavigation({
        page: 'chart',
        symbol,
        timeframe,
        timestamp: Date.now(),
      })
    }
    if (onNavigateToPage) {
      onNavigateToPage(page, symbol, timeframe)
    }
  }

  const activeOption = PAGE_CONTEXT_OPTIONS.find((opt) => opt.id === activePageContext) || PAGE_CONTEXT_OPTIONS[3]
  const currentQuickPrompts = CONTEXT_QUICK_PROMPTS[activePageContext] || CONTEXT_QUICK_PROMPTS['aichat']

  return (
    <div className="ai-chat-page">
      {/* Agentic Page Context Selector Bar */}
      <div className="page-context-bar">
        <span className="context-bar-label">Agentic Co-Pilot Mode:</span>
        {PAGE_CONTEXT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`context-pill ${activePageContext === opt.id ? 'active' : ''}`}
            onClick={() => setActivePageContext(opt.id)}
          >
            <span>{opt.title}</span>
          </button>
        ))}
      </div>

      {/* Main Conversation Scroll View */}
      <div className="chat-messages-container">
        {currentThread?.messages.length === 0 ? (
          <div className="empty-chat-welcome">
            <div className="welcome-icon-box">
              <img src="/Logo.jpeg" alt="Chart Rabbit Logo" className="welcome-logo-img" />
            </div>
            <h2>How can Chart Rabbit AI help your trading today?</h2>
            <p>Select an Agentic Co-Pilot Mode above or choose a quick prompt below.</p>
          </div>
        ) : (
          <div className="messages-list">
            {currentThread?.messages.map((msg) => {
              const { cleanText, action } = msg.sender === 'ai' ? parseAiResponseActions(msg.text) : { cleanText: msg.text, action: null }

              return (
                <div key={msg.id} className={`message-row ${msg.sender === 'user' ? 'user-row' : 'ai-row'}`}>
                  {/* AI Response Logo Avatar */}
                  {msg.sender === 'ai' && (
                    <div className="ai-avatar-box">
                      <img src="/Logo.jpeg" alt="Chart Rabbit AI Logo" className="ai-logo-avatar-img" />
                    </div>
                  )}

                  <div className="message-bubble-wrapper">
                    <div className="message-sender-meta">
                      <span className="sender-name">
                        {msg.sender === 'ai' ? 'Chart Rabbit AI' : 'You'}
                      </span>
                      <span className="message-time">{msg.timestamp}</span>
                    </div>

                    <div className={`message-bubble ${msg.sender === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                      <div className="message-text">{cleanText.replace(/\*\*/g, '')}</div>

                      {/* Render Interactive Action Card if AI output an action */}
                      {action && (
                        <AIActionCard
                          action={action}
                          onNavigateToPage={handleCardNavigate}
                        />
                      )}

                      {msg.sender === 'ai' && (
                        <div className="ai-bubble-actions">
                          <button
                            className="action-icon-btn"
                            onClick={() => handleCopyMessage(msg.id, msg.text)}
                            title="Copy text"
                          >
                            {copiedMsgId === msg.id ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* AI Thinking Animation */}
            {isThinking && (
              <div className="message-row ai-row">
                <div className="ai-avatar-box">
                  <img src="/Logo.jpeg" alt="Chart Rabbit AI Logo" className="ai-logo-avatar-img spinning" />
                </div>
                <div className="message-bubble-wrapper">
                  <div className="message-sender-meta">
                    <span className="sender-name">Chart Rabbit AI Agent</span>
                    <span className="message-time">Thinking...</span>
                  </div>
                  <div className="message-bubble ai-bubble thinking-bubble">
                    <div className="typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="thinking-text">Processing with OpenRouter AI agent ({activeOption.title})...</span>
                  </div>
                </div>
              </div>
            )}
            <div className="messages-bottom-spacer" />
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Dynamic Quick Prompts Cards */}
        {currentThread?.messages.length! <= 2 && (
          <div className="quick-prompts-grid">
            {currentQuickPrompts.map((qp, idx) => (
              <div
                key={idx}
                className="prompt-card"
                onClick={() => handleSendMessage(qp.prompt)}
              >
                <div className="prompt-card-header">
                  <SparklesIcon className="prompt-sparkle-icon" />
                  <span className="prompt-card-title">{qp.title}</span>
                </div>
                <p className="prompt-card-desc">{qp.prompt}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="chat-input-wrapper">
        <div className="chat-input-container">
          <textarea
            className="chat-textarea"
            placeholder={activeOption.placeholder}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="chat-input-actions">
            <button
              className={`chat-send-btn ${inputText.trim() ? 'active' : ''}`}
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isThinking}
              title="Send message"
            >
              <SendIcon width="16" height="16" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
