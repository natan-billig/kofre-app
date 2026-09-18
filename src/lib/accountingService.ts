import { supabase } from './supabase'
import type {
  Wallet,
  Transaction,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  CurrencyBalances,
  CardInvoiceSummary,
  ScopeFilterType,
  CurrencyCode,
  CategoryExpenseItem,
  CurrencyCategoryBreakdown,
} from './types'

export async function fetchTransactions(walletIds: string[]): Promise<Transaction[]> {
  if (!walletIds || walletIds.length === 0) return []

  // Supabase syntax for OR condition across columns
  const filter = `wallet_id.in.(${walletIds.join(',')}),destination_wallet_id.in.(${walletIds.join(',')})`

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(filter)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching transactions:', error)
    throw error
  }

  return (data as Transaction[]) || []
}

export async function fetchTransactionsByDateRange(
  walletIds: string[],
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  if (!walletIds || walletIds.length === 0) return []

  const filter = `wallet_id.in.(${walletIds.join(',')}),destination_wallet_id.in.(${walletIds.join(',')})`

  let query = supabase
    .from('transactions')
    .select('*')
    .or(filter)

  if (startDate) {
    query = query.gte('transaction_date', startDate)
  }
  if (endDate) {
    query = query.lte('transaction_date', endDate)
  }

  const { data, error } = await query
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching transactions by date range:', error)
    throw error
  }

  return (data as Transaction[]) || []
}

export async function createTransaction(payload: CreateTransactionDTO): Promise<Transaction> {
  const insertPayload: Record<string, unknown> = { ...payload }

  let { data, error } = await supabase
    .from('transactions')
    .insert([insertPayload])
    .select()
    .single()

  // Fallback seguro caso a coluna debt_id ainda não exista na tabela do Supabase
  if (error && (error.code === 'PGRST204' || error.message?.includes('debt_id'))) {
    delete insertPayload.debt_id
    const retry = await supabase
      .from('transactions')
      .insert([insertPayload])
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Error inserting transaction:', error)
    throw error
  }

  return data as Transaction
}

export async function updateTransaction(
  transactionId: string,
  payload: UpdateTransactionDTO
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', transactionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating transaction:', error)
    throw error
  }

  return data as Transaction
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)

  if (error) {
    console.error('Error deleting transaction:', error)
    throw error
  }
}

export function calculateAccountBalance(wallet: Wallet, transactions: Transaction[]): number {
  const initialBalance = Number(wallet.initial_balance || 0)

  if (wallet.account_type === 'credit_card') {
    // Para cartões de crédito: fatura = (initial_balance || 0) + despesas - receitas - pagamentos recebidos
    let debt = initialBalance
    for (const t of transactions) {
      if (t.type === 'expense' && t.wallet_id === wallet.id) {
        debt += Number(t.amount)
      }
      if (t.type === 'income' && t.wallet_id === wallet.id) {
        debt -= Number(t.amount)
      }
      if (t.type === 'transfer' && t.destination_wallet_id === wallet.id) {
        debt -= Number(t.destination_amount ?? t.amount)
      }
    }
    return debt
  }

  // Para Efetivo e Bancos (contas de liquidez)
  // saldo_atual = initial_balance + receitas - despesas + transferencias_recebidas - transferencias_enviadas
  let balance = initialBalance
  for (const t of transactions) {
    if (t.type === 'income' && t.wallet_id === wallet.id) {
      balance += Number(t.amount)
    }
    if (t.type === 'expense' && t.wallet_id === wallet.id) {
      balance -= Number(t.amount)
    }
    if (t.type === 'transfer' && t.wallet_id === wallet.id) {
      balance -= Number(t.amount)
    }
    if (t.type === 'transfer' && t.destination_wallet_id === wallet.id) {
      balance += Number(t.destination_amount ?? t.amount)
    }
  }

  return balance
}

export function calculateBalances(
  wallets: Wallet[],
  transactions: Transaction[],
  scopeFilter: ScopeFilterType | 'all' = 'personal'
): CurrencyBalances {
  const balances: CurrencyBalances = {
    PYG: 0,
    USD: 0,
    BRL: 0,
  }

  // Filtra apenas contas de liquidez (cash e checking), excluindo cartões de crédito
  const liquidWallets = wallets.filter((w) => {
    const matchesScope = scopeFilter === 'all' ? true : w.type === scopeFilter
    return matchesScope && (w.account_type === 'cash' || w.account_type === 'checking')
  })

  for (const w of liquidWallets) {
    const bal = calculateAccountBalance(w, transactions)
    if (w.currency in balances) {
      balances[w.currency] += bal
    }
  }

  return balances
}

export function calculateCardInvoices(
  wallets: Wallet[],
  transactions: Transaction[],
  scopeFilter: ScopeFilterType | 'all' = 'personal'
): CardInvoiceSummary[] {
  const cards = wallets.filter((w) => {
    const matchesScope = scopeFilter === 'all' ? true : w.type === scopeFilter
    return matchesScope && w.account_type === 'credit_card'
  })

  return cards.map((card) => {
    const invoiceAmount = calculateAccountBalance(card, transactions)
    const limit = card.credit_limit != null ? Number(card.credit_limit) : null
    const availableLimit = limit != null ? limit - invoiceAmount : null

    return {
      wallet: card,
      invoiceAmount,
      availableLimit,
    }
  })
}

export function calculateCategoryExpenses(
  transactions: Transaction[],
  wallets: Wallet[] = [],
  scopeFilter: ScopeFilterType | 'all' = 'personal'
): Record<CurrencyCode, CurrencyCategoryBreakdown> {
  const walletMap = new Map<string, Wallet>()
  for (const w of wallets) {
    walletMap.set(w.id, w)
  }

  const result: Record<CurrencyCode, CurrencyCategoryBreakdown> = {
    PYG: { currency: 'PYG', total: 0, items: [] },
    USD: { currency: 'USD', total: 0, items: [] },
    BRL: { currency: 'BRL', total: 0, items: [] },
  }

  const categoryTotals: Record<CurrencyCode, Record<string, number>> = {
    PYG: {},
    USD: {},
    BRL: {},
  }

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue

    const wallet = walletMap.get(tx.wallet_id)
    if (scopeFilter !== 'all' && wallet && wallet.type !== scopeFilter) {
      continue
    }

    const currency = (wallet?.currency || tx.original_currency || 'PYG') as CurrencyCode
    if (!result[currency]) {
      result[currency] = { currency, total: 0, items: [] }
      categoryTotals[currency] = {}
    }

    const amount = Number(tx.amount) || 0
    if (amount <= 0) continue

    const category = tx.category?.trim() || 'Outros'
    categoryTotals[currency][category] = (categoryTotals[currency][category] || 0) + amount
    result[currency].total += amount
  }

  for (const curr of Object.keys(result) as CurrencyCode[]) {
    const total = result[curr].total
    const catObj = categoryTotals[curr] || {}
    const items: CategoryExpenseItem[] = Object.entries(catObj).map(([category, amount]) => {
      const percentage = total > 0 ? (amount / total) * 100 : 0
      return {
        category,
        amount,
        percentage,
      }
    })

    // Sort from highest expense to lowest
    items.sort((a, b) => b.amount - a.amount)
    result[curr].items = items
  }

  return result
}

export const calculateExpensesByCategory = calculateCategoryExpenses

export { getCreditCardInvoiceDetails } from './creditCardService'

/**
 * Retorna a lista estável de moedas ativas que devem ser exibidas no dashboard:
 * - Começa com a preferredCurrency do perfil do usuário logado.
 * - Adiciona qualquer moeda que possua ao menos uma carteira cadastrada (mesmo que com saldo zerado).
 * - Remove duplicatas mantendo a moeda preferida na primeira posição.
 */
export function getActiveCurrencies(
  wallets: Wallet[],
  preferredCurrency: CurrencyCode = 'PYG'
): CurrencyCode[] {
  const result: CurrencyCode[] = [preferredCurrency]

  for (const w of wallets) {
    if (w.currency && !result.includes(w.currency)) {
      result.push(w.currency)
    }
  }

  return result
}

