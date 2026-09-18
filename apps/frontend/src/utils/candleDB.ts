const DB_NAME = 'ChartRabbitDB'
const STORE_NAME = 'candles'
const DB_VERSION = 1

export interface DBCandleData {
  id: string // symbol_interval
  symbol: string
  interval: string
  candles: any[]
  fetchedAt: number
  count: number
  complete: boolean
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveCandles(
  symbol: string,
  interval: string,
  candles: any[],
  complete: boolean
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const id = `${symbol}_${interval}`
    
    const data: DBCandleData = {
      id,
      symbol,
      interval,
      candles,
      fetchedAt: Date.now(),
      count: candles.length,
      complete
    }

    const request = store.put(data)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function loadCandles(symbol: string, interval: string): Promise<DBCandleData | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const id = `${symbol}_${interval}`
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function clearCache(symbol: string, interval: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const id = `${symbol}_${interval}`
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getCacheInfo(symbol: string, interval: string): Promise<{ count: number; fetchedAt: number; complete: boolean } | null> {
  const data = await loadCandles(symbol, interval)
  if (!data) return null
  return {
    count: data.count,
    fetchedAt: data.fetchedAt,
    complete: data.complete
  }
}
