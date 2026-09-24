import { supabase } from './supabase'
import { getCreditCardInvoiceDetails } from './creditCardService'
import { convertAmount } from './exchangeRateService'
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
  RecurringBill,
  DebtItem,
  Profile,
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
  scopeFilter: ScopeFilterType | 'all' = 'personal',
  referenceDate: Date = new Date(),
  recurringBills: RecurringBill[] = []
): CardInvoiceSummary[] {
  const cards = wallets.filter((w) => {
    const matchesScope = scopeFilter === 'all' ? true : w.type === scopeFilter
    return matchesScope && w.account_type === 'credit_card'
  })

  const now = new Date()
  const isFutureMonth =
    referenceDate.getFullYear() > now.getFullYear() ||
    (referenceDate.getFullYear() === now.getFullYear() && referenceDate.getMonth() > now.getMonth())

  return cards.map((card) => {
    const details = getCreditCardInvoiceDetails(card, transactions, referenceDate, recurringBills)
    const limit = card.credit_limit != null ? Number(card.credit_limit) : null

    const invoiceAmount = details.currentInvoiceAmount
    const availableLimit = isFutureMonth
      ? (limit != null ? Math.max(0, limit - details.currentInvoiceAmount) : null)
      : (limit != null ? limit - details.totalDebt : null)

    return {
      wallet: card,
      invoiceAmount,
      availableLimit,
      totalDebt: details.totalDebt,
      nextInvoiceAmount: details.nextInvoiceAmount,
      isPaid: details.isPaid,
      isClosed: details.isClosed,
      isFutureMonth,
      projectedInvoiceAmount: details.currentInvoiceAmount,
      projectedAvailableLimit: limit != null ? Math.max(0, limit - details.currentInvoiceAmount) : null,
    }
  })
}

/**
 * Calcula a projeção contínua e encadeada de liquidez disponível para meses futuros.
 * 
 * Partindo da liquidez real em caixa na data atual (new Date()), percorre cada mês intermediário
 * até o mês selecionado (targetDate), apurando o fluxo de caixa líquido projetado daquele mês:
 *   Balanço Líquido = (Receitas previstas) - (Contas fixas não-cartão) - (Faturas de cartão projetadas) - (Dívidas)
 * O saldo final projetado de cada mês M torna-se a Liquidez Inicial / Disponível do mês M+1.
 */
export function calculateProjectedLiquidityCarryOver(
  targetDate: Date,
  wallets: Wallet[],
  transactions: Transaction[],
  recurringBills: RecurringBill[] = [],
  debts: DebtItem[] = [],
  currency: CurrencyCode = 'PYG',
  scope: ScopeFilterType = 'personal',
  userProfile?: Profile | null
): number {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const targetYear = targetDate.getFullYear()
  const targetMonth = targetDate.getMonth()

  const monthDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth)

  // Liquidez imediata no mundo real (contas correntes e dinheiro em espécie na moeda e escopo)
  const balances = calculateBalances(wallets, transactions, scope)
  const baseLiquidity = balances[currency] || 0

  if (monthDiff <= 0) {
    return baseLiquidity
  }

  let runningLiquidity = baseLiquidity

  // Itera pelos meses intermediários: do mês atual até o mês anterior a targetDate
  for (let m = 0; m < monthDiff; m++) {
    const iterYear = currentYear + Math.floor((currentMonth + m) / 12)
    const iterMonth = (currentMonth + m) % 12
    const iterDate = new Date(iterYear, iterMonth, 1)
    const iterMonthStr = `${iterYear}-${String(iterMonth + 1).padStart(2, '0')}`
    const isCurrentIterMonth = m === 0

    let monthInflow = 0
    let monthOutflow = 0

    if (isCurrentIterMonth) {
      // Para o mês atual: apurar compromissos pendentes entre hoje e o final do mês
      const todayDay = now.getDate()

      // Receitas agendadas ainda não pagas no mês atual
      const pendingIncomes = recurringBills.filter(
        (b) =>
          b.is_active &&
          b.type === 'income' &&
          b.scope === scope &&
          b.currency === currency &&
          (b.due_day || 1) >= todayDay
      )
      for (const inc of pendingIncomes) {
        monthInflow += Number(inc.amount) || 0
      }

      // Contas fixas não-cartão pendentes no restante do mês
      for (const bill of recurringBills) {
        if (!bill.is_active || bill.type === 'income' || bill.scope !== scope) continue
        if ((bill.due_day || 1) < todayDay) continue

        const linkedWallet = bill.wallet_id ? wallets.find((w) => w.id === bill.wallet_id) : null
        const isCreditCard =
          bill.payment_method === 'credit_card' || linkedWallet?.account_type === 'credit_card'
        if (isCreditCard) continue

        if (bill.start_date && bill.start_date.substring(0, 7) > iterMonthStr) continue
        if (bill.end_date && bill.end_date.substring(0, 7) < iterMonthStr) continue

        const amt =
          bill.is_shared && bill.my_share_amount != null && Number(bill.my_share_amount) > 0
            ? Number(bill.my_share_amount)
            : Number(bill.total_amount) || Number(bill.amount) || 0
        if (amt <= 0) continue

        const converted = bill.currency === currency ? amt : convertAmount(amt, bill.currency, currency)
        monthOutflow += converted
      }

      // Faturas de cartão com vencimento ainda pendente no mês atual
      const creditCards = wallets.filter(
        (w) => w.type === scope && w.account_type === 'credit_card' && w.currency === currency
      )
      for (const card of creditCards) {
        if (card.due_day && card.due_day >= todayDay) {
          const details = getCreditCardInvoiceDetails(card, transactions, iterDate, recurringBills)
          if (!details.isPaid && details.currentInvoiceAmount > 0) {
            monthOutflow += details.currentInvoiceAmount
          }
        }
      }
    } else {
      // Mês futuro completo (ex: Outubro quando olhando Novembro):
      // 1. Receitas previstas:
      const activeRecurringIncomes = recurringBills.filter(
        (b) => b.is_active && b.type === 'income' && b.scope === scope && b.currency === currency
      )
      if (activeRecurringIncomes.length > 0) {
        for (const inc of activeRecurringIncomes) {
          monthInflow += Number(inc.amount) || 0
        }
      } else if (scope === 'personal') {
        const profileIncome = Number(userProfile?.base_monthly_income) || 0
        const profileCurr = userProfile?.preferred_currency || currency
        if (profileIncome > 0 && profileCurr === currency) {
          monthInflow += profileIncome
        }
      }

      // 2. Contas fixas não-cartão previstas:
      for (const bill of recurringBills) {
        if (!bill.is_active || bill.type === 'income' || bill.scope !== scope) continue

        const linkedWallet = bill.wallet_id ? wallets.find((w) => w.id === bill.wallet_id) : null
        const isCreditCard =
          bill.payment_method === 'credit_card' || linkedWallet?.account_type === 'credit_card'
        if (isCreditCard) continue

        if (bill.start_date && bill.start_date.substring(0, 7) > iterMonthStr) continue
        if (bill.end_date && bill.end_date.substring(0, 7) < iterMonthStr) continue

        const amt =
          bill.is_shared && bill.my_share_amount != null && Number(bill.my_share_amount) > 0
            ? Number(bill.my_share_amount)
            : Number(bill.total_amount) || Number(bill.amount) || 0
        if (amt <= 0) continue

        const converted = bill.currency === currency ? amt : convertAmount(amt, bill.currency, currency)
        monthOutflow += converted
      }

      // 3. Faturas de cartão projetadas daquele ciclo:
      const creditCards = wallets.filter(
        (w) => w.type === scope && w.account_type === 'credit_card' && w.currency === currency
      )
      for (const card of creditCards) {
        const details = getCreditCardInvoiceDetails(card, transactions, iterDate, recurringBills)
        const invoiceAmt =
          details.currentInvoiceAmount > 0
            ? details.currentInvoiceAmount
            : (!details.isPaid && details.nextInvoiceAmount > 0 ? details.nextInvoiceAmount : 0)
        if (invoiceAmt > 0) {
          monthOutflow += invoiceAmt
        }
      }

      // 4. Dívidas / Empréstimos a pagar:
      for (const debt of debts) {
        if (
          debt.status !== 'pending' ||
          debt.scope !== scope ||
          debt.type !== 'i_owe' ||
          debt.currency !== currency
        ) {
          continue
        }
        if (debt.due_date) {
          const parts = debt.due_date.split('-')
          if (
            parts.length >= 2 &&
            parseInt(parts[0], 10) === iterYear &&
            parseInt(parts[1], 10) === iterMonth + 1
          ) {
            monthOutflow += Number(debt.amount) || 0
          }
        }
      }
    }

    runningLiquidity = runningLiquidity + monthInflow - monthOutflow
  }

  return runningLiquidity
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

export { getCreditCardInvoiceDetails, payCreditCardInvoice } from './creditCardService'
export { convertAmount } from './exchangeRateService'

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

