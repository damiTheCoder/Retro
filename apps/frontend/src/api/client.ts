const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isLocalhost ? 'http://localhost:8000/api/v1' : '/api')

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    })
    if (!res.ok) {
      console.warn(`API call ${endpoint} returned ${res.status}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn(`API call ${endpoint} failed (backend may be offline):`, err)
    return null
  }
}

// Replay Sessions API
export async function createReplaySessionApi(data: any) {
  return fetchApi('/replay/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateReplaySessionApi(id: string, patch: any) {
  return fetchApi(`/replay/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

// Journal API
export async function getJournalEntriesApi() {
  return fetchApi<any[]>('/journal/entries')
}

export async function createJournalEntryApi(entry: any) {
  return fetchApi('/journal/entries', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
}

// Analytics API
export async function getAnalyticsSummaryApi() {
  return fetchApi('/analytics/summary')
}

// Chat API
export async function sendChatMessageApi(threadId: string, text: string, activePage: string = 'aichat') {
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  const baseUrl = import.meta.env.VITE_API_BASE_URL || (isLocal ? 'http://localhost:8000/api/v1' : '/api')

  const res = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ thread_id: threadId, text, active_page: activePage }),
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error || `API returned HTTP ${res.status}`)
  }
  return json
}
