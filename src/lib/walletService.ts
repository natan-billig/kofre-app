import { supabase } from './supabase'
import type { Wallet, WalletScope, AccountType, CurrencyCode } from './types'

export async function fetchWallets(userId: string): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .or(`owner_id.eq.${userId},type.eq.shared`)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching wallets:', error)
    throw error
  }

  return (data as Wallet[]) || []
}

export async function ensureInitialWallets(userId: string): Promise<Wallet[]> {
  const existing = await fetchWallets(userId)

  const hasPersonalCash = existing.some(
    (w) => w.type === 'personal' && w.account_type === 'cash' && w.owner_id === userId
  )
  const hasSharedCash = existing.some(
    (w) => w.type === 'shared'
  )

  const toCreate = []

  if (!hasPersonalCash) {
    toCreate.push({
      owner_id: userId,
      name: 'Efetivo PYG',
      type: 'personal' as WalletScope,
      account_type: 'cash' as AccountType,
      currency: 'PYG' as CurrencyCode,
    })
  }

  if (!hasSharedCash) {
    toCreate.push({
      owner_id: userId,
      name: 'Caixa da Família',
      type: 'shared' as WalletScope,
      account_type: 'cash' as AccountType,
      currency: 'PYG' as CurrencyCode,
    })
  }

  if (toCreate.length > 0) {
    const { error: insertErr } = await supabase.from('wallets').insert(toCreate)
    if (insertErr) {
      console.warn('Error creating default initial wallets:', insertErr.message)
    }
    return await fetchWallets(userId)
  }

  return existing
}

export async function createWallet(payload: {
  owner_id: string
  name: string
  type: WalletScope
  account_type: AccountType
  currency: CurrencyCode
  credit_limit?: number | null
  closing_day?: number | null
  due_day?: number | null
}): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .insert([payload])
    .select()
    .single()

  if (error) {
    console.error('Error creating wallet:', error)
    throw error
  }

  return data as Wallet
}
