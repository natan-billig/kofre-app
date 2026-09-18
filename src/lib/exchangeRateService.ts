/**
 * Serviço de Cotações de Câmbio em Tempo Real
 * Endpoint público sem necessidade de chave de API: https://open.er-api.com/v6/latest/USD
 * Armazenamento em cache por 12 horas em localStorage (kofre_cached_rates)
 */

export interface CachedExchangeRates {
  usdToPyg: number
  usdToBrl: number
  timestamp: number
  lastUpdatedText: string
}

export interface LiveExchangeRatesResult {
  usdToPyg: number
  usdToBrl: number
  lastUpdated: string
  timestamp: number
  isFromCache: boolean
  error?: string
}

export const DEFAULT_EXCHANGE_RATES = {
  usdToPyg: 7850,
  usdToBrl: 5.75,
}

const CACHE_KEY = 'kofre_cached_rates'
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000 // 12 horas

export function getCachedExchangeRates(): CachedExchangeRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed: CachedExchangeRates = JSON.parse(raw)
    if (parsed && typeof parsed.usdToPyg === 'number' && typeof parsed.usdToBrl === 'number') {
      return parsed
    }
  } catch (e) {
    console.warn('Erro ao ler taxas em cache:', e)
  }
  return null
}

export function saveCachedExchangeRates(usdToPyg: number, usdToBrl: number): CachedExchangeRates {
  const now = Date.now()
  const dateStr = new Date(now).toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const entry: CachedExchangeRates = {
    usdToPyg,
    usdToBrl,
    timestamp: now,
    lastUpdatedText: dateStr,
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch (e) {
    console.warn('Erro ao gravar taxas em cache:', e)
  }

  return entry
}

export async function fetchLiveRates(forceRefresh = false): Promise<LiveExchangeRatesResult> {
  const cached = getCachedExchangeRates()
  const now = Date.now()

  // Se o cache existir, não expirou (< 12 horas) e não for forçada a atualização
  if (!forceRefresh && cached && now - cached.timestamp < CACHE_DURATION_MS) {
    return {
      usdToPyg: cached.usdToPyg,
      usdToBrl: cached.usdToBrl,
      lastUpdated: cached.lastUpdatedText,
      timestamp: cached.timestamp,
      isFromCache: true,
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (data?.result === 'success' && data?.rates) {
      const rawPyg = Number(data.rates.PYG)
      const rawBrl = Number(data.rates.BRL)

      const usdToPyg = rawPyg > 0 ? Math.round(rawPyg) : (cached?.usdToPyg ?? DEFAULT_EXCHANGE_RATES.usdToPyg)
      const usdToBrl = rawBrl > 0 ? parseFloat(rawBrl.toFixed(2)) : (cached?.usdToBrl ?? DEFAULT_EXCHANGE_RATES.usdToBrl)

      const saved = saveCachedExchangeRates(usdToPyg, usdToBrl)

      return {
        usdToPyg,
        usdToBrl,
        lastUpdated: saved.lastUpdatedText,
        timestamp: saved.timestamp,
        isFromCache: false,
      }
    } else {
      throw new Error('Formato de resposta inesperado da API de câmbio')
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Falha na conexão'
    console.warn('Falha ao obter cotações ao vivo:', errorMessage)

    // Fallback para cache existente ou valores padrão
    if (cached) {
      return {
        usdToPyg: cached.usdToPyg,
        usdToBrl: cached.usdToBrl,
        lastUpdated: `${cached.lastUpdatedText} (offline)`,
        timestamp: cached.timestamp,
        isFromCache: true,
        error: errorMessage,
      }
    }

    const fallbackDateStr = new Date().toLocaleString([], {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

    return {
      usdToPyg: DEFAULT_EXCHANGE_RATES.usdToPyg,
      usdToBrl: DEFAULT_EXCHANGE_RATES.usdToBrl,
      lastUpdated: `${fallbackDateStr} (padrão)`,
      timestamp: now,
      isFromCache: false,
      error: errorMessage,
    }
  }
}
