import { supabase } from './supabase'
import { getCreditCardInvoiceDetails } from './creditCardService'
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

const OPTIONAL_COLUMNS = [
  'debt_id',
  'installment_number',
  'total_installments',
  'installment_group_id',
  'cashback_amount',
  'cashback_percent',
  'parent_transaction_id',
  'is_paid',
  'status',
]

export async function createTransaction(payload: CreateTransactionDTO): Promise<Transaction> {
  const insertPayload: Record<string, unknown> = { ...payload }

  let { data, error } = await supabase
    .from('transactions')
    .insert([insertPayload])
    .select()
    .single()

  // Fallback seguro caso colunas novas ainda não existam na tabela do Supabase
  if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('debt_id'))) {
    for (const col of OPTIONAL_COLUMNS) {
      delete insertPayload[col]
    }
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

export async function createTransactionsBatch(payloads: CreateTransactionDTO[]): Promise<Transaction[]> {
  if (payloads.length === 0) return []

  let { data, error } = await supabase
    .from('transactions')
    .insert(payloads)
    .select()

  if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
    const cleanPayloads = payloads.map((p) => {
      const copy: Record<string, unknown> = { ...p }
      for (const col of OPTIONAL_COLUMNS) {
        delete copy[col]
      }
      return copy
    })
    const retry = await supabase
      .from('transactions')
      .insert(cleanPayloads)
      .select()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Error creating transactions batch:', error)
    throw error
  }

  return (data as Transaction[]) || []
}

export async function updateTransaction(
  transactionId: string,
  payload: UpdateTransactionDTO
): Promise<Transaction> {
  const updatePayload: Record<string, unknown> = { ...payload }

  let { data, error } = await supabase
    .from('transactions')
    .update(updatePayload)
    .eq('id', transactionId)
    .select()
    .single()

  if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
    for (const col of OPTIONAL_COLUMNS) {
      delete updatePayload[col]
    }
    const retry = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', transactionId)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Error updating transaction:', error)
    throw error
  }

  return data as Transaction
}

export async function syncCashbackTransaction(
  parentTx: Transaction,
  cashbackAmount?: number | null,
  cashbackDate?: string | null,
  cashbackPercent?: number | null
): Promise<void> {
  const effectiveCashback = cashbackAmount != null && Number(cashbackAmount) > 0 ? Number(cashbackAmount) : 0

  try {
    const { data: existingChildren, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('parent_transaction_id', parentTx.id)

    if (fetchErr && fetchErr.code === 'PGRST204') {
      return
    }

    const child = existingChildren && existingChildren.length > 0 ? existingChildren[0] : null

    if (effectiveCashback > 0) {
      const dateToUse = cashbackDate || parentTx.transaction_date
      const descToUse = `Reintegro: ${parentTx.description || parentTx.category}`

      if (child) {
        await updateTransaction(child.id, {
          amount: effectiveCashback,
          transaction_date: dateToUse,
          description: descToUse,
          cashback_percent: cashbackPercent,
        })
      } else {
        await createTransaction({
          user_id: parentTx.user_id,
          wallet_id: parentTx.wallet_id,
          type: 'income',
          amount: effectiveCashback,
          category: 'Reintegro',
          description: descToUse,
          transaction_date: dateToUse,
          parent_transaction_id: parentTx.id,
          cashback_percent: cashbackPercent,
        })
      }
    } else {
      if (child) {
        await supabase.from('transactions').delete().eq('id', child.id)
      }
    }
  } catch (err) {
    console.warn('Erro ao sincronizar reintegro bancário:', err)
  }
}

export async function deleteTransaction(
  transactionId: string,
  deleteAllInstallments: boolean = false,
  installmentGroupId?: string | null
): Promise<void> {
  // 1. Remove qualquer reintegro filho vinculado a esta transação
  try {
    await supabase.from('transactions').delete().eq('parent_transaction_id', transactionId)
  } catch (err) {
    console.warn('Aviso ao excluir reintegro vinculado:', err)
  }

  // 2. Se for para excluir todas as parcelas deste grupo
  if (deleteAllInstallments && installmentGroupId) {
    try {
      const { data: groupTxs } = await supabase
        .from('transactions')
        .select('id')
        .eq('installment_group_id', installmentGroupId)

      if (groupTxs && groupTxs.length > 0) {
        const ids = groupTxs.map((t) => t.id)
        await supabase.from('transactions').delete().in('parent_transaction_id', ids)
      }
    } catch (e) {
      console.warn('Aviso ao remover reintegros do grupo:', e)
    }

    const { error: groupErr } = await supabase
      .from('transactions')
      .delete()
      .eq('installment_group_id', installmentGroupId)

    if (groupErr) {
      console.error('Error deleting installment group:', groupErr)
      throw groupErr
    }
    return
  }

  // 3. Exclui a transação individual
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
    // Ignora despesas agendadas / pendentes que ainda não foram pagas
    if (t.is_paid === false || t.status === 'pending') {
      continue
    }
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
    const details = getCreditCardInvoiceDetails(card, transactions)
    const invoiceAmount = details.currentInvoiceAmount
    const limit = card.credit_limit != null ? Number(card.credit_limit) : null
    const availableLimit = limit != null ? limit - details.totalDebt : null

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

    let amount = Number(tx.amount) || 0
    if (tx.is_shared && tx.my_share_amount != null && Number(tx.my_share_amount) > 0) {
      amount = Number(tx.my_share_amount)
    }
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

