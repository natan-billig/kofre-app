import type { CurrencyCode } from './types'


export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0

  if (currency === 'PYG') {
    // PYG: sempre número inteiro com separador de milhar (ex: ₲ 150.000)
    const rounded = Math.round(safeAmount)
    const formatted = rounded.toLocaleString('es-PY')
    return `₲ ${formatted}`
  }

  if (currency === 'USD') {
    // USD: 2 casas decimais (ex: $ 25.50)
    return `$ ${safeAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  if (currency === 'BRL') {
    // BRL: 2 casas decimais (ex: R$ 120,00)
    return `R$ ${safeAmount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return `${currency} ${safeAmount.toFixed(2)}`
}

export function formatDate(dateString: string): string {
  if (!dateString) return ''

  try {
    // Handle both YYYY-MM-DD and full ISO strings
    const [year, month, day] = dateString.substring(0, 10).split('-').map(Number)
    const date = new Date(year, month - 1, day)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const dateZero = new Date(date)
    dateZero.setHours(0, 0, 0, 0)

    if (dateZero.getTime() === today.getTime()) {
      return 'Hoje'
    }
    if (dateZero.getTime() === yesterday.getTime()) {
      return 'Ontem'
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return dateString
  }
}

export function formatExchangeRate(
  fromAmount: number,
  fromCurrency: CurrencyCode,
  toAmount: number,
  toCurrency: CurrencyCode
): string {
  if (!fromAmount || !toAmount || fromAmount <= 0 || toAmount <= 0) return ''

  const rate = toAmount / fromAmount
  const inverse = fromAmount / toAmount

  if (rate >= 1) {
    return `1 ${fromCurrency} = ${rate < 100 ? rate.toFixed(2) : Math.round(rate).toLocaleString('es-PY')} ${toCurrency}`
  } else {
    return `1 ${toCurrency} = ${inverse < 100 ? inverse.toFixed(2) : Math.round(inverse).toLocaleString('es-PY')} ${fromCurrency}`
  }
}
