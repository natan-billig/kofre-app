import type { CurrencyCode, TransactionType, ParsedNotification } from './types'
import { predictCategory } from './categoryPredictor'

/**
 * Normaliza montantes em formato brasileiro (1.500,50) ou paraguaio (150.000 ou 150.000,00)
 */
function parseRawAmount(raw: string, currency: CurrencyCode): number {
  const cleaned = raw.trim().replace(/\s/g, '')

  if (currency === 'PYG') {
    // Guaranis são números inteiros; remove pontos de milhar
    const noPoints = cleaned.replace(/\./g, '').replace(/,/g, '.')
    return Math.round(parseFloat(noPoints)) || 0
  }

  // Para USD e BRL:
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Ex: 1.250,50 -> 1250.50
    const normalized = cleaned.replace(/\./g, '').replace(',', '.')
    return parseFloat(normalized) || 0
  }

  if (cleaned.includes(',')) {
    // Ex: 120,50 -> 120.50
    return parseFloat(cleaned.replace(',', '.')) || 0
  }

  return parseFloat(cleaned) || 0
}

/**
 * Extrai data no formato YYYY-MM-DD
 */
function parseRawDate(text: string): string {
  const today = new Date().toISOString().split('T')[0]

  // Procura padrão DD/MM/YYYY ou DD/MM
  const ddmmyyyy = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0')
    const month = ddmmyyyy[2].padStart(2, '0')
    let year = ddmmyyyy[3]
    if (year.length === 2) year = `20${year}`
    return `${year}-${month}-${day}`
  }

  const ddmm = text.match(/(\d{1,2})\/(\d{1,2})/)
  if (ddmm) {
    const currentYear = new Date().getFullYear()
    const day = ddmm[1].padStart(2, '0')
    const month = ddmm[2].padStart(2, '0')
    return `${currentYear}-${month}-${day}`
  }

  return today
}

/**
 * Parser regex puramente local para notificações bancárias (SMS, push e alertas)
 * Bancos suportados: Itaú PY, Continental, Ueno, Familiar, Sudameris, Nubank, Itaú BR, Bradesco, Inter, PIX e SIPAP.
 */
export function parseBankNotification(text: string): ParsedNotification | null {
  if (!text || text.trim().length < 5) return null

  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  // 1. Deteção de Moeda
  let currency: CurrencyCode = 'PYG'
  if (/(r\$|brl|reais)/i.test(trimmed)) {
    currency = 'BRL'
  } else if (/(us\$|usd|dolares|dólares)/i.test(trimmed)) {
    currency = 'USD'
  } else if (/(gs\.?|₲|guaranies|guaraníes)/i.test(trimmed)) {
    currency = 'PYG'
  } else if (lower.includes('pix') || lower.includes('nubank')) {
    currency = 'BRL'
  }

  // 2. Deteção de Tipo (Despesa vs Receita)
  let type: TransactionType = 'expense'
  const isIncome =
    lower.includes('recebid') ||
    lower.includes('creditad') ||
    lower.includes('depositad') ||
    lower.includes('transferencia recebida') ||
    lower.includes('transferência recebida') ||
    lower.includes('recibiste') ||
    lower.includes('te transfirio') ||
    lower.includes('te transfirió') ||
    lower.includes('acreditado') ||
    lower.includes('cobro exitoso')

  if (isIncome) {
    type = 'income'
  }

  // 3. Deteção do Banco Emissor
  let bankSource = 'Banco'
  if (lower.includes('ueno')) bankSource = 'Ueno Bank'
  else if (lower.includes('continental')) bankSource = 'Banco Continental'
  else if (lower.includes('familiar')) bankSource = 'Banco Familiar'
  else if (lower.includes('sudameris')) bankSource = 'Sudameris'
  else if (lower.includes('itau') || lower.includes('itaú')) {
    bankSource = currency === 'BRL' ? 'Itaú Brasil' : 'Itaú Paraguay'
  } else if (lower.includes('nubank')) bankSource = 'Nubank'
  else if (lower.includes('bradesco')) bankSource = 'Bradesco'
  else if (lower.includes('inter')) bankSource = 'Banco Inter'
  else if (lower.includes('sipap')) bankSource = 'SIPAP'
  else if (lower.includes('pix')) bankSource = 'PIX'

  // 4. Extração do Montante
  let amount = 0

  // Regex para capturar valor precedido ou sucedido por símbolo monetário
  const amountPatterns = [
    // R$ 120,50 ou Gs. 150.000 ou USD 25.00
    /(?:r\$|gs\.?|₲|usd|us\$)\s*([\d.,]+)/i,
    // por R$ 120,00 ou valor de R$ ...
    /(?:por|valor|monto|monto de|valor de)\s*(?:de\s*)?(?:r\$|gs\.?|₲|usd|us\$)?\s*([\d.,]+)/i,
    // Pagaste 45.000
    /(?:pagaste|compra de|compra aprobada por|transferiu|transferencia enviada a .* por)\s*(?:r\$|gs\.?|₲|usd|us\$)?\s*([\d.,]+)/i,
  ]

  for (const pattern of amountPatterns) {
    const match = trimmed.match(pattern)
    if (match && match[1]) {
      const parsed = parseRawAmount(match[1], currency)
      if (parsed > 0) {
        amount = parsed
        break
      }
    }
  }

  // 5. Extração do Estabelecimento ou Destinatário/Remetente
  let merchant = ''

  // Padrão: en/em [ESTABELECIMENTO]
  const merchantInMatch = trimmed.match(/(?:en|em)\s+([A-Z0-9\s._-]{3,30})(?:\s+(?:por|el|a las|con|via|no valor|$))/i)
  if (merchantInMatch && merchantInMatch[1]) {
    merchant = merchantInMatch[1].trim()
  }

  // Padrão: para/de [NOME]
  if (!merchant) {
    const personMatch = trimmed.match(/(?:para|de)\s+([A-ZÀ-ÿ\s]{3,30})(?:\s+(?:por|no valor|el|a las|$))/i)
    if (personMatch && personMatch[1]) {
      merchant = personMatch[1].trim()
    }
  }

  // Se não localizou estabelecimento limpo, usa um resumo do tipo
  if (!merchant) {
    if (lower.includes('sipap')) merchant = 'Transferência SIPAP'
    else if (lower.includes('pix')) merchant = 'Transferência Pix'
    else if (type === 'income') merchant = 'Depósito / Recebimento'
    else merchant = 'Compra no Débito/Crédito'
  }

  // Limpeza de palavras parasitas comuns
  merchant = merchant
    .replace(/(?:tarjeta|cartao|cartão|terminada|final|el|a las|con|via|valor)\b.*/i, '')
    .trim()

  // 6. Data
  const date = parseRawDate(trimmed)

  // 7. Categoria Sugerida
  const predicted = predictCategory(merchant)
  const suggestedCategory = predicted || (type === 'income' ? 'Salário' : 'Outros')

  return {
    amount: amount > 0 ? amount : undefined,
    currency,
    type,
    description: merchant,
    merchant,
    date,
    suggestedCategory,
    bankSource,
    rawSnippet: trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed,
  }
}
