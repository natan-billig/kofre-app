import { supabase } from './supabase'
import type { Wallet, WalletScope, AccountType, CurrencyCode } from './types'

const YIELD_META_STORAGE_KEY = 'kofre_wallet_yield_meta'

export interface WalletYieldMeta {
  annual_yield_rate?: number | null
  yield_benchmark?: 'cdi' | 'fixed_annual' | 'fixed_monthly' | null
  yield_percentage?: number | null
}

export function getLocalYieldMap(): Record<string, WalletYieldMeta> {
  try {
    const raw = localStorage.getItem(YIELD_META_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveLocalYieldMeta(walletId: string, meta: WalletYieldMeta): void {
  try {
    const map = getLocalYieldMap()
    map[walletId] = { ...(map[walletId] || {}), ...meta }
    localStorage.setItem(YIELD_META_STORAGE_KEY, JSON.stringify(map))
  } catch (e) {
    console.warn('Erro ao salvar meta de rendimento local:', e)
  }
}

export function deleteLocalYieldMeta(walletId: string): void {
  try {
    const map = getLocalYieldMap()
    delete map[walletId]
    localStorage.setItem(YIELD_META_STORAGE_KEY, JSON.stringify(map))
  } catch (e) {
    console.warn('Erro ao remover meta de rendimento local:', e)
  }
}

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

  let targetWallets = loadedWallets
  if (shared.length > 1) {
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
    targetWallets = [...personal, ...finalShared]
  }

  const yieldMap = getLocalYieldMap()
  return targetWallets.map((w) => {
    const meta = yieldMap[w.id]
    if (meta) {
      return {
        ...w,
        annual_yield_rate: w.annual_yield_rate ?? meta.annual_yield_rate,
        yield_benchmark: w.yield_benchmark ?? meta.yield_benchmark,
        yield_percentage: w.yield_percentage ?? meta.yield_percentage,
      }
    }
    return w
  })
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
      initial_balance: 0,
    })
  }

  if (!hasSharedCash) {
    toCreate.push({
      owner_id: userId,
      name: 'Caixa da Família',
      type: 'shared' as WalletScope,
      account_type: 'cash' as AccountType,
      currency: 'PYG' as CurrencyCode,
      initial_balance: 0,
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
  family_id?: string | null
  initial_balance?: number | null
  credit_limit?: number | null
  closing_day?: number | null
  due_day?: number | null
  target_amount?: number | null
  annual_yield_rate?: number | null
  yield_benchmark?: 'cdi' | 'fixed_annual' | 'fixed_monthly' | null
  yield_percentage?: number | null
}): Promise<Wallet> {
  const insertPayload: Record<string, unknown> = {
    ...payload,
    initial_balance: payload.initial_balance != null ? payload.initial_balance : 0,
  }

  let { data, error } = await supabase
    .from('wallets')
    .insert([insertPayload])
    .select()
    .single()

  // Fallback seguro caso as colunas target_amount ou de rendimento não existam ainda no Supabase
  const YIELD_COLUMNS = ['target_amount', 'annual_yield_rate', 'yield_benchmark', 'yield_percentage']
  if (error && (error.code === 'PGRST204' || YIELD_COLUMNS.some((col) => error?.message?.includes(col)))) {
    for (const col of YIELD_COLUMNS) {
      delete insertPayload[col]
    }
    const retry = await supabase
      .from('wallets')
      .insert([insertPayload])
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Error creating wallet:', error)
    throw error
  }

  const createdWallet = data as Wallet
  if (payload.yield_benchmark || payload.annual_yield_rate || payload.yield_percentage) {
    saveLocalYieldMeta(createdWallet.id, {
      annual_yield_rate: payload.annual_yield_rate,
      yield_benchmark: payload.yield_benchmark,
      yield_percentage: payload.yield_percentage,
    })
    createdWallet.annual_yield_rate = payload.annual_yield_rate
    createdWallet.yield_benchmark = payload.yield_benchmark
    createdWallet.yield_percentage = payload.yield_percentage
  }

  return createdWallet
}

export async function deleteWallet(walletId: string): Promise<void> {
  deleteLocalYieldMeta(walletId)
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

export async function updateWalletName(walletId: string, name: string): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .update({ name: name.trim() })
    .eq('id', walletId)
    .select()
    .single()

  if (error) {
    console.error('Error updating wallet name:', error)
    throw error
  }

  return data as Wallet
}

export async function updateWallet(
  walletId: string,
  payload: {
    name?: string
    initial_balance?: number | null
    credit_limit?: number | null
    closing_day?: number | null
    due_day?: number | null
    target_amount?: number | null
    annual_yield_rate?: number | null
    yield_benchmark?: 'cdi' | 'fixed_annual' | 'fixed_monthly' | null
    yield_percentage?: number | null
  }
): Promise<Wallet> {
  const updateData: Record<string, unknown> = {}
  if (payload.name !== undefined) updateData.name = payload.name.trim()
  if (payload.initial_balance !== undefined) updateData.initial_balance = payload.initial_balance
  if (payload.credit_limit !== undefined) updateData.credit_limit = payload.credit_limit
  if (payload.closing_day !== undefined) updateData.closing_day = payload.closing_day
  if (payload.due_day !== undefined) updateData.due_day = payload.due_day
  if (payload.target_amount !== undefined) updateData.target_amount = payload.target_amount
  if (payload.annual_yield_rate !== undefined) updateData.annual_yield_rate = payload.annual_yield_rate
  if (payload.yield_benchmark !== undefined) updateData.yield_benchmark = payload.yield_benchmark
  if (payload.yield_percentage !== undefined) updateData.yield_percentage = payload.yield_percentage

  // Salva no cache local para resiliência imediata
  if (
    payload.yield_benchmark !== undefined ||
    payload.annual_yield_rate !== undefined ||
    payload.yield_percentage !== undefined
  ) {
    saveLocalYieldMeta(walletId, {
      annual_yield_rate: payload.annual_yield_rate,
      yield_benchmark: payload.yield_benchmark,
      yield_percentage: payload.yield_percentage,
    })
  }

  let { data, error } = await supabase
    .from('wallets')
    .update(updateData)
    .eq('id', walletId)
    .select()
    .single()

  // Fallback se target_amount ou colunas de rendimento não existirem no Supabase
  const YIELD_COLUMNS = ['target_amount', 'annual_yield_rate', 'yield_benchmark', 'yield_percentage']
  if (error && (error.code === 'PGRST204' || YIELD_COLUMNS.some((col) => error?.message?.includes(col)))) {
    for (const col of YIELD_COLUMNS) {
      delete updateData[col]
    }
    const retry = await supabase
      .from('wallets')
      .update(updateData)
      .eq('id', walletId)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Error updating wallet:', error)
    throw error
  }

  const updatedWallet = data as Wallet
  if (payload.yield_benchmark !== undefined) updatedWallet.yield_benchmark = payload.yield_benchmark
  if (payload.annual_yield_rate !== undefined) updatedWallet.annual_yield_rate = payload.annual_yield_rate
  if (payload.yield_percentage !== undefined) updatedWallet.yield_percentage = payload.yield_percentage

  return updatedWallet
}

export interface YieldProjectionResult {
  monthlyYield: number
  dailyBusinessYield: number
  annualRatePercent: number
  benchmarkLabel: string
}

export const DEFAULT_REFERENCE_CDI = 10.5 // 10.5% a.a. padrão de mercado

/**
 * Calcula a projeção estimada de rendimento mensal e diário por dia útil
 * para contas de poupança, caixinhas ou investimentos.
 */
export function calculateYieldProjection(
  wallet: Wallet,
  currentBalance: number,
  cdiRate: number = DEFAULT_REFERENCE_CDI
): YieldProjectionResult | null {
  if (wallet.account_type !== 'savings' || currentBalance <= 0) return null
  if (!wallet.yield_benchmark) return null

  let annualRate = 0
  let benchmarkLabel = ''

  if (wallet.yield_benchmark === 'cdi') {
    const percentage =
      wallet.yield_percentage != null && wallet.yield_percentage > 0
        ? wallet.yield_percentage
        : 100
    annualRate = (percentage / 100) * (cdiRate / 100)
    benchmarkLabel = `${percentage}% do CDI`
  } else if (wallet.yield_benchmark === 'fixed_annual') {
    const rate = wallet.annual_yield_rate != null ? Number(wallet.annual_yield_rate) : 0
    annualRate = rate / 100
    benchmarkLabel = `${rate}% a.a.`
  } else if (wallet.yield_benchmark === 'fixed_monthly') {
    const monthlyRate = (wallet.annual_yield_rate != null ? Number(wallet.annual_yield_rate) : 0) / 100
    annualRate = Math.pow(1 + monthlyRate, 12) - 1
    benchmarkLabel = `${wallet.annual_yield_rate}% a.m.`
  }

  if (annualRate <= 0) return null

  // Taxa mensal efetiva: (1 + i_ano)^(1/12) - 1
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1
  const monthlyYield = currentBalance * monthlyRate
  // Rendimento por dia útil (convenção financeira de 21 dias úteis/mês)
  const dailyBusinessYield = monthlyYield / 21

  return {
    monthlyYield:
      wallet.currency === 'PYG' ? Math.round(monthlyYield) : parseFloat(monthlyYield.toFixed(2)),
    dailyBusinessYield:
      wallet.currency === 'PYG'
        ? Math.round(dailyBusinessYield)
        : parseFloat(dailyBusinessYield.toFixed(2)),
    annualRatePercent: parseFloat((annualRate * 100).toFixed(2)),
    benchmarkLabel,
  }
}

