import { supabase } from './supabase'
import type { Wallet, WalletScope, AccountType, CurrencyCode } from './types'

export async function fetchWallets(userId: string): Promise<Wallet[]> {
  // 1. Busca todos os vínculos de família do usuário sem usar .single()
  let activeFamilyId: string | null = null
  let allFamilyIds: string[] = []

  try {
    const { data: members, error: membersErr } = await supabase
      .from('family_members')
      .select('id, created_at, user_id, family_id, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (membersErr) {
      console.warn('Aviso ao consultar family_members em fetchWallets:', membersErr.message)
    }

    const memberList = members || []
    if (memberList.length > 0) {
      // Prioriza role = 'member' (ingressou via código) ou ordenação decrescente
      const sorted = [...memberList].sort((a, b) => {
        if (a.role === 'member' && b.role !== 'member') return -1
        if (b.role === 'member' && a.role !== 'member') return 1
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA
      })

      activeFamilyId = sorted[0].family_id
      allFamilyIds = Array.from(new Set(memberList.map((m) => m.family_id).filter(Boolean)))
    }
  } catch (err) {
    console.warn('Erro ao checar famílias do usuário em fetchWallets:', err)
  }

  // 2. Consulta as carteiras pessoais e compartilhadas
  let query = supabase.from('wallets').select('*')

  if (allFamilyIds.length > 0) {
    const familyFilter = allFamilyIds.map((id) => `family_id.eq.${id}`).join(',')
    query = query.or(`owner_id.eq.${userId},${familyFilter},type.eq.shared`)
  } else {
    query = query.or(`owner_id.eq.${userId},type.eq.shared`)
  }

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching wallets:', error)
    throw error
  }

  const loadedWallets = (data as Wallet[]) || []

  // 3. Tratamento de múltiplos caixas compartilhados:
  // Se houver mais de um "Caixa da Família", desconsidera o antigo se tiver 0 transações
  const personal = loadedWallets.filter((w) => w.type === 'personal')
  const shared = loadedWallets.filter((w) => w.type === 'shared')

  if (shared.length <= 1) {
    return loadedWallets
  }

  const filteredShared: Wallet[] = []

  for (const sharedWallet of shared) {
    const isFromActiveFamily = activeFamilyId && sharedWallet.family_id === activeFamilyId

    if (isFromActiveFamily) {
      filteredShared.push(sharedWallet)
    } else {
      // Verifica se a carteira compartilhada secundária possui movimentações
      try {
        const { count, error: countErr } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .or(`wallet_id.eq.${sharedWallet.id},destination_wallet_id.eq.${sharedWallet.id}`)

        if (!countErr && (count ?? 0) > 0) {
          filteredShared.push(sharedWallet)
        } else {
          // 0 transações: oculta para não duplicar caixas na interface
          console.info(
            `Ocultando caixa compartilhado antigo/vazio (${sharedWallet.id} - ${sharedWallet.name})`
          )
        }
      } catch {
        filteredShared.push(sharedWallet)
      }
    }
  }

  // Se por alguma razão todos foram filtrados, mantém pelo menos o mais recente
  const finalShared = filteredShared.length > 0 ? filteredShared : [shared[shared.length - 1]]

  return [...personal, ...finalShared]
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

export async function deleteWallet(walletId: string): Promise<void> {
  const { error } = await supabase.from('wallets').delete().eq('id', walletId)
  if (error) {
    console.error('Error deleting wallet:', error)
    throw error
  }
}

export async function archiveWallet(walletId: string, isArchived: boolean): Promise<void> {
  const { error } = await supabase
    .from('wallets')
    .update({ is_archived: isArchived })
    .eq('id', walletId)

  if (error) {
    console.error('Error updating archive status for wallet:', error)
    throw error
  }
}

