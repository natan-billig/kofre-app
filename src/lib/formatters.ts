import type { CurrencyCode } from './types'
import { evaluateMathExpression, hasMathExpression } from './mathParser'

/**
 * Converte qualquer entrada de usuário (com máscara de milhares com ponto, vírgulas ou expressão matemática)
 * para um número puro limpo (number), pronto para validações e envio ao Supabase.
 */
export function sanitizeNumericInput(
  input: string | number | null | undefined,
  currency: CurrencyCode = 'PYG'
): number {
  if (input === null || input === undefined || input === '') return 0
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0

  let str = input.trim()
  if (!str) return 0

  // Se for uma expressão matemática ativa (ex: '1.480.000 + 50.000' ou '37146+1')
  if (hasMathExpression(str)) {
    // Normalizar separadores de milhar com ponto antes de avaliar
    let normalized = str.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
    if (currency === 'PYG') {
      normalized = normalized.replace(/\./g, '')
    }
    const evaluated = evaluateMathExpression(normalized)
    if (evaluated !== null && !isNaN(evaluated)) {
      return currency === 'PYG' ? Math.round(evaluated) : evaluated
    }
  }

  if (currency === 'PYG') {
    // PYG: inteiro absoluto agrupado por pontos. Remove tudo que não for dígito ou sinal
    const clean = str.replace(/[^\d-]/g, '')
    const parsed = parseInt(clean, 10)
    return isNaN(parsed) ? 0 : parsed
  }

  // BRL / USD:
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',')
    const lastDot = str.lastIndexOf('.')
    if (lastComma > lastDot) {
      // Padrão brasileiro: 5.000,50 -> 5000.50
      str = str.replace(/\./g, '').replace(',', '.')
    } else {
      // Padrão americano: 5,000.50 -> 5000.50
      str = str.replace(/,/g, '')
    }
  } else if (str.includes(',')) {
    // Apenas vírgula: 17,99 -> 17.99
    str = str.replace(',', '.')
  } else if (str.includes('.')) {
    // Ponto único ou múltiplos:
    const dotCount = (str.match(/\./g) || []).length
    if (dotCount > 1) {
      str = str.replace(/\./g, '')
    } else {
      const parts = str.split('.')
      if (parts[1] && parts[1].length === 3 && parseInt(parts[0], 10) > 0) {
        // Ex: 5.000 (milhar)
        str = str.replace('.', '')
      }
    }
  }

  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

/**
 * Normaliza e formata um valor numérico para exibição com máscara de milhares e decimais:
 * - Se houver expressão matemática ativa (ex: '37146+1' ou '17.99/3'), mantém o texto original
 *   para permitir digitação fluida na calculadora.
 * - PYG: agrupamento estritamente inteiro por pontos (ex: 1.480.000, 60.000), bloqueando decimais.
 * - BRL / USD: agrupamento de milhares por pontos e decimais com vírgula (ex: 5.000,00 ou 17,99).
 */
export function formatMaskedInput(
  value: string | number | null | undefined,
  currency: CurrencyCode = 'PYG'
): string {
  if (value === null || value === undefined || value === '') return ''
  const str = String(value).trim()
  if (!str) return ''

  // Mantém expressão matemática crua enquanto o usuário digita
  if (hasMathExpression(str)) {
    return str
  }

  const num = sanitizeNumericInput(str, currency)
  if (isNaN(num)) return str

  if (currency === 'PYG') {
    const rounded = Math.round(num)
    return rounded.toLocaleString('es-PY')
  }

  // BRL / USD:
  // Decimais se houver vírgula, fração não inteira ou fração decimal explícita
  const hasExplicitDecimal =
    str.includes(',') ||
    (str.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(str)) ||
    num % 1 !== 0
  const minDecimals = hasExplicitDecimal ? 2 : 0

  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: 2,
  })
}

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

export function formatDate(
  dateString: string,
  locale: 'pt' | 'es' | string = 'pt'
): string {
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

    const isEs = locale === 'es' || locale.toLowerCase().startsWith('es')

    if (dateZero.getTime() === today.getTime()) {
      return isEs ? 'Hoy' : 'Hoje'
    }
    if (dateZero.getTime() === yesterday.getTime()) {
      return isEs ? 'Ayer' : 'Ontem'
    }

    const intlLocale = isEs ? 'es-PY' : 'pt-BR'

    return date.toLocaleDateString(intlLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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
