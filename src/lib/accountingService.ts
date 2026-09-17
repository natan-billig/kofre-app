import { supabase } from './supabase'
import type {
  Wallet,
  Transaction,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  CurrencyBalances,
  CardInvoiceSummary,
  WalletScope,
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

export async function createTransaction(payload: CreateTransactionDTO): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert([payload])
    .select()
    .single()

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
  if (wallet.account_type === 'credit_card') {
    // Para cartões de crédito: fatura = despesas - receitas - pagamentos recebidos
    let debt = 0
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
  let balance = 0
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
  scopeFilter: WalletScope | 'all' = 'all'
): CurrencyBalances {
  const balances: CurrencyBalances = {
    PYG: 0,
    USD: 0,
    BRL: 0,
  }

  // Filtra apenas contas de liquidez (cash e checking), excluindo cartões de crédito
  const liquidWallets = wallets.filter((w) => {
    const matchesScope = scopeFilter === 'all' || w.type === scopeFilter
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
  scopeFilter: WalletScope | 'all' = 'all'
): CardInvoiceSummary[] {
  const cards = wallets.filter((w) => {
    const matchesScope = scopeFilter === 'all' || w.type === scopeFilter
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
