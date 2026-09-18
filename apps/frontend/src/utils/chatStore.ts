export interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: string
}

export interface ChatThread {
  id: string
  title: string
  createdAt: string
  messages: ChatMessage[]
}

const STORAGE_KEY_THREADS = 'retro_chat_threads_v1'
const STORAGE_KEY_ACTIVE_ID = 'retro_chat_active_id_v1'
const STORAGE_KEY_MODEL = 'retro_chat_model_v1'

export const AI_MODEL_OPTIONS = [
  'Nex 2.5 Pro',
  'DeepSeek V4 Flash',
  'Qwen 2.5 72B',
  'Llama 3.3 70B',
]

export function getSelectedModel(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_MODEL) || AI_MODEL_OPTIONS[0]
  } catch {
    return AI_MODEL_OPTIONS[0]
  }
}

export function setSelectedModel(model: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_MODEL, model)
    listeners.forEach((fn) => fn())
  } catch (err) {
    console.error('Failed setting model:', err)
  }
}

const INITIAL_THREADS: ChatThread[] = [
  {
    id: 'thread-101',
    title: 'BTCUSDT Order Block Analysis',
    createdAt: '2026-03-15T14:30:00Z',
    messages: [
      {
        id: 'msg-1',
        sender: 'user',
        text: 'Can you analyze the recent 4H order block on BTCUSDT around $83,500?',
        timestamp: '14:30',
      },
      {
        id: 'msg-2',
        sender: 'ai',
        text: 'Based on the 4H chart structure, BTCUSDT executed a textbook liquidity sweep below the $83,500 swing low. This formed a bullish Order Block (OB) and created a Fair Value Gap (FVG) between $83,800 and $84,200. I recommend looking for a 15M Market Structure Shift (MSS) confirmation before opening a long position with Stop Loss placed below $82,500.',
        timestamp: '14:31',
      },
    ],
  },
  {
    id: 'thread-102',
    title: 'EURUSD Risk-to-Reward Calculator',
    createdAt: '2026-03-14T11:15:00Z',
    messages: [
      {
        id: 'msg-3',
        sender: 'user',
        text: 'What is the recommended R:R ratio for London session EURUSD breakouts?',
        timestamp: '11:15',
      },
      {
        id: 'msg-4',
        sender: 'ai',
        text: 'For London session breakouts on EURUSD, backtested data shows an optimal Risk-to-Reward ratio between 1:2.0 and 1:2.5. Set your Stop Loss just outside the Asian session high/low range, and aim for previous day highs or key liquidity pools.',
        timestamp: '11:16',
      },
    ],
  },
  {
    id: 'thread-103',
    title: 'ICT Liquidity Sweep & MSS Strategy',
    createdAt: '2026-03-13T09:45:00Z',
    messages: [
      {
        id: 'msg-5',
        sender: 'user',
        text: 'How do I distinguish a real Market Structure Shift from a fakeout wick break?',
        timestamp: '09:45',
      },
      {
        id: 'msg-6',
        sender: 'ai',
        text: 'A true Market Structure Shift (MSS) requires strong displacement where a full body candle closes beyond the key swing high/low. Wick breaks without body displacement are frequently fakeouts designed to engineer liquidity before market reversal.',
        timestamp: '09:46',
      },
    ],
  },
]

type ChatListener = () => void
const listeners: Set<ChatListener> = new Set()

export function getChatThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THREADS)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(INITIAL_THREADS))
      return INITIAL_THREADS
    }
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed loading chat threads:', err)
    return INITIAL_THREADS
  }
}

export function saveChatThreads(threads: ChatThread[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(threads))
    listeners.forEach((fn) => fn())
  } catch (err) {
    console.error('Failed saving chat threads:', err)
  }
}

export function getActiveThreadId(): string {
  try {
    const active = localStorage.getItem(STORAGE_KEY_ACTIVE_ID)
    const threads = getChatThreads()
    if (active && threads.some((t) => t.id === active)) {
      return active
    }
    return threads[0]?.id || ''
  } catch {
    return 'thread-101'
  }
}

export function setActiveThreadId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id)
    listeners.forEach((fn) => fn())
  } catch (err) {
    console.error('Failed setting active thread ID:', err)
  }
}

export function createNextChatThread(): ChatThread {
  const threads = getChatThreads()
  const newThread: ChatThread = {
    id: `thread-${Date.now()}`,
    title: 'New Strategy Chat',
    createdAt: new Date().toISOString(),
    messages: [
      {
        id: `msg-welcome-${Date.now()}`,
        sender: 'ai',
        text: 'Hello! I am Chart Rabbit AI. Ask me anything about market structure, ICT setups, risk-reward ratios, or your trading journal performance.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ],
  }
  const updated = [newThread, ...threads]
  saveChatThreads(updated)
  setActiveThreadId(newThread.id)
  return newThread
}

export function addMessageToThread(threadId: string, sender: 'user' | 'ai', text: string): void {
  const threads = getChatThreads()
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const updated = threads.map((t) => {
    if (t.id === threadId) {
      let title = t.title
      if (t.title === 'New Strategy Chat' && sender === 'user') {
        title = text.length > 28 ? text.slice(0, 28) + '...' : text
      }
      return {
        ...t,
        title,
        messages: [
          ...t.messages,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender,
            text,
            timestamp: nowStr,
          },
        ],
      }
    }
    return t
  })

  saveChatThreads(updated)
}

export function deleteChatThread(threadId: string): void {
  const threads = getChatThreads()
  const updated = threads.filter((t) => t.id !== threadId)
  saveChatThreads(updated)
  if (getActiveThreadId() === threadId && updated.length > 0) {
    setActiveThreadId(updated[0].id)
  }
}

export function subscribeChat(listener: ChatListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
