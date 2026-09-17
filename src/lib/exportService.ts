import type { Transaction, Wallet } from './types'

interface ExportCSVOptions {
  language?: 'pt' | 'es' | string
  profilesMap?: Record<string, string>
}

/**
 * Sanitiza valores para o formato CSV.
 * - Converte aspas duplas em duas aspas duplas (" -> "")
 * - Remove quebras de linha indesejadas
 * - Envolve sempre o campo em aspas duplas
 */
function sanitizeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""'
  }
  const stringValue = String(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, '""')
  return `"${stringValue.trim()}"`
}

/**
 * Formata valores numéricos para o padrão compatível com Excel
 * usando delimitador ponto e vírgula (;), onde decimais utilizam vírgula (,).
 */
function formatNumberForCSV(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return '0'

  if (currency === 'PYG') {
    return Math.round(amount).toString()
  }

  return amount.toFixed(2).replace('.', ',')
}

/**
 * Exporta uma lista de transações para arquivo CSV compatível com Excel.
 * Utiliza delimitador ';', codificação UTF-8 com BOM (\uFEFF) para garantir
 * exibição correta de símbolos como '₲', acentos e cedilhas.
 */
export function exportTransactionsToCSV(
  transactions: Transaction[],
  wallets: Wallet[],
  filename: string,
  options: ExportCSVOptions = {}
): void {
  const isEs = options.language?.toLowerCase().startsWith('es')
  const profilesMap = options.profilesMap || {}

  // Mapear carteiras por ID para busca O(1)
  const walletMap = new Map<string, Wallet>()
  for (const w of wallets) {
    walletMap.set(w.id, w)
  }

  // Cabeçalhos traduzidos
  const headers = isEs
    ? [
        'Fecha',
        'Tipo',
        'Descripción',
        'Categoría',
        'Cuenta / Billetera',
        'Cuenta Destino',
        'Moneda',
        'Monto',
        'Ámbito',
        'Creado Por',
      ]
    : [
        'Data',
        'Tipo',
        'Descrição',
        'Categoria',
        'Conta / Carteira',
        'Conta Destino',
        'Moeda',
        'Valor',
        'Escopo',
        'Criado Por',
      ]

  // Linhas de dados
  const rows = transactions.map((t) => {
    // Data (YYYY-MM-DD)
    const dateFormatted = t.transaction_date ? t.transaction_date.substring(0, 10) : ''

    // Tipo
    let typeLabel: string = t.type
    if (t.type === 'expense') {
      typeLabel = isEs ? 'Gasto' : 'Despesa'
    } else if (t.type === 'income') {
      typeLabel = isEs ? 'Ingreso' : 'Receita'
    } else if (t.type === 'transfer') {
      typeLabel = isEs ? 'Transferencia' : 'Transferência'
    }

    // Descrição e Categoria
    const desc = t.description || ''
    const cat = t.category || ''

    // Contas
    const sourceWallet = walletMap.get(t.wallet_id)
    const sourceWalletName = sourceWallet ? sourceWallet.name : ''

    const destWallet = t.destination_wallet_id ? walletMap.get(t.destination_wallet_id) : null
    const destWalletName = destWallet ? destWallet.name : ''

    // Moeda e Valor
    const currency = sourceWallet?.currency || t.original_currency || 'PYG'
    const amountVal = formatNumberForCSV(Number(t.amount) || 0, currency)

    // Escopo
    const txScope = sourceWallet?.type || (destWallet?.type ?? 'personal')
    const scopeLabel =
      txScope === 'shared'
        ? isEs
          ? 'Compartido'
          : 'Compartilhado'
        : isEs
        ? 'Personal'
        : 'Pessoal'

    // Criado por (Nome do usuário)
    const authorName = profilesMap[t.user_id] || ''

    return [
      sanitizeCSVField(dateFormatted),
      sanitizeCSVField(typeLabel),
      sanitizeCSVField(desc),
      sanitizeCSVField(cat),
      sanitizeCSVField(sourceWalletName),
      sanitizeCSVField(destWalletName),
      sanitizeCSVField(currency),
      sanitizeCSVField(amountVal),
      sanitizeCSVField(scopeLabel),
      sanitizeCSVField(authorName),
    ].join(';')
  })

  // Montar conteúdo do CSV com delimitador ';'
  const headerLine = headers.map(sanitizeCSVField).join(';')
  const csvContent = [headerLine, ...rows].join('\r\n')

  // Adicionar Byte Order Mark (BOM) UTF-8 (\uFEFF) para garantir abertura direta no Excel
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })

  // Disparar download no navegador
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
