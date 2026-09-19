import { supabase } from './supabase'
import type { RecurringBill, Transaction, WalletScope } from './types'

const RECURRING_TYPES_STORAGE_KEY = 'kofre_recurring_types'
const RECURRING_SHARED_META_STORAGE_KEY = 'kofre_recurring_shared_meta'

export interface RecurringSharedMeta {
  is_shared?: boolean
  total_amount?: number
  my_share_amount?: number
  split_participants?: number
}

function getLocalRecurringSharedMeta(): Record<string, RecurringSharedMeta> {
  try {
    const raw = localStorage.getItem(RECURRING_SHARED_META_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveLocalRecurringSharedMeta(id: string, meta: RecurringSharedMeta): void {
  try {
    const current = getLocalRecurringSharedMeta()
    current[id] = { ...current[id], ...meta }
    localStorage.setItem(RECURRING_SHARED_META_STORAGE_KEY, JSON.stringify(current))
  } catch {
    // ignore
  }
}

function removeLocalRecurringSharedMeta(id: string): void {
  try {
    const current = getLocalRecurringSharedMeta()
    delete current[id]
    localStorage.setItem(RECURRING_SHARED_META_STORAGE_KEY, JSON.stringify(current))
  } catch {
    // ignore
  }
}

function getLocalRecurringTypes(): Record<string, 'expense' | 'income'> {
  try {
    const raw = localStorage.getItem(RECURRING_TYPES_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalRecurringType(id: string, type: 'expense' | 'income') {
  try {
    const current = getLocalRecurringTypes()
    current[id] = type
    localStorage.setItem(RECURRING_TYPES_STORAGE_KEY, JSON.stringify(current))
  } catch {
    // ignore localStorage errors
  }
}

function removeLocalRecurringType(id: string) {
  try {
    const current = getLocalRecurringTypes()
    delete current[id]
    localStorage.setItem(RECURRING_TYPES_STORAGE_KEY, JSON.stringify(current))
  } catch {
    // ignore
  }
}

/**
 * Busca as contas fixas cadastradas no Supabase, filtrando por escopo e família.
 */
export async function fetchRecurringBills(
  scope: WalletScope | 'all' = 'all',
  familyId?: string | null
): Promise<RecurringBill[]> {
  let query = supabase.from('recurring_bills').select('*')

  if (scope === 'personal') {
    query = query.eq('scope', 'personal')
  } else if (scope === 'shared') {
    query = query.eq('scope', 'shared')
    if (familyId) {
      query = query.eq('family_id', familyId)
    }
  } else if (scope === 'all') {
    if (familyId) {
      query = query.or(`scope.eq.personal,family_id.eq.${familyId}`)
    } else {
      query = query.eq('scope', 'personal')
    }
  }

  const { data, error } = await query.order('due_day', { ascending: true })

  if (error) {
    console.error('Erro ao buscar contas fixas:', error)
    throw error
  }

  const rawList = (data as RecurringBill[]) || []
  const localTypes = getLocalRecurringTypes()
  const localShared = getLocalRecurringSharedMeta()
  return rawList.map((item) => {
    const meta = localShared[item.id] || {}
    return {
      ...item,
      type: item.type || localTypes[item.id] || 'expense',
      is_shared: item.is_shared !== undefined ? item.is_shared : meta.is_shared,
      total_amount: item.total_amount !== undefined ? item.total_amount : meta.total_amount,
      my_share_amount: item.my_share_amount !== undefined ? item.my_share_amount : meta.my_share_amount,
      split_participants: item.split_participants !== undefined ? item.split_participants : meta.split_participants,
    }
  })
}

/**
 * Cria uma nova regra de conta fixa recorrente (despesa ou receita/salário).
 */
export async function createRecurringBill(
  bill: Omit<RecurringBill, 'id' | 'created_at'>
): Promise<RecurringBill> {
  let userId = bill.user_id
  if (!userId) {
    const { data: authData } = await supabase.auth.getUser()
    userId = authData?.user?.id
  }

  const payload: Record<string, unknown> = {
    ...bill,
    type: bill.type || 'expense',
    user_id: userId,
  }

  let { data, error } = await supabase
    .from('recurring_bills')
    .insert([payload])
    .select()
    .single()

  // Fallback resiliente caso colunas novas ainda não existam no schema do banco
  if (
    error &&
    (error.code === 'PGRST204' ||
      error.message?.includes('type') ||
      error.message?.includes('is_shared') ||
      error.message?.includes('total_amount') ||
      error.message?.includes('my_share_amount') ||
      error.message?.includes('split_participants'))
  ) {
    const fallbackPayload = {
      name: bill.name,
      amount: bill.amount,
      currency: bill.currency,
      category: bill.category,
      wallet_id: bill.wallet_id,
      due_day: bill.due_day,
      start_date: bill.start_date,
      is_active: bill.is_active,
      scope: bill.scope,
      family_id: bill.family_id,
      user_id: userId,
    }
    const retry = await supabase
      .from('recurring_bills')
      .insert([fallbackPayload])
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Erro ao criar conta fixa:', error)
    throw error
  }

  const finalType = (data as RecurringBill)?.type || bill.type || 'expense'
  const finalId = data?.id

  if (finalId) {
    saveLocalRecurringType(finalId, finalType)
    if (bill.is_shared !== undefined || bill.my_share_amount !== undefined) {
      saveLocalRecurringSharedMeta(finalId, {
        is_shared: bill.is_shared,
        total_amount: bill.total_amount,
        my_share_amount: bill.my_share_amount,
        split_participants: bill.split_participants,
      })
    }
  }

  return {
    ...(data as RecurringBill),
    type: finalType,
    is_shared: bill.is_shared,
    total_amount: bill.total_amount,
    my_share_amount: bill.my_share_amount,
    split_participants: bill.split_participants,
  }
}

/**
 * Atualiza os dados ou status (is_active) de uma conta fixa.
 */
export async function updateRecurringBill(
  id: string,
  partialBill: Partial<RecurringBill>
): Promise<RecurringBill> {
  const updatePayload: Record<string, unknown> = { ...partialBill }

  let { data, error } = await supabase
    .from('recurring_bills')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  // Fallback resiliente se colunas novas não existirem no schema do banco
  if (
    error &&
    (error.code === 'PGRST204' ||
      error.message?.includes('type') ||
      error.message?.includes('is_shared') ||
      error.message?.includes('total_amount') ||
      error.message?.includes('my_share_amount') ||
      error.message?.includes('split_participants'))
  ) {
    const fallbackPartial = { ...updatePayload }
    delete fallbackPartial.type
    delete fallbackPartial.is_shared
    delete fallbackPartial.total_amount
    delete fallbackPartial.my_share_amount
    delete fallbackPartial.split_participants

    const retry = await supabase
      .from('recurring_bills')
      .update(fallbackPartial)
      .eq('id', id)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Erro ao atualizar conta fixa:', error)
    throw error
  }

  const finalType = (data as RecurringBill)?.type || partialBill.type || 'expense'
  if (id && partialBill.type) {
    saveLocalRecurringType(id, partialBill.type)
  }

  if (id && (partialBill.is_shared !== undefined || partialBill.my_share_amount !== undefined)) {
    saveLocalRecurringSharedMeta(id, {
      is_shared: partialBill.is_shared,
      total_amount: partialBill.total_amount,
      my_share_amount: partialBill.my_share_amount,
      split_participants: partialBill.split_participants,
    })
  }

  const localShared = getLocalRecurringSharedMeta()[id] || {}

  return {
    ...(data as RecurringBill),
    type: finalType,
    is_shared: partialBill.is_shared !== undefined ? partialBill.is_shared : localShared.is_shared,
    total_amount: partialBill.total_amount !== undefined ? partialBill.total_amount : localShared.total_amount,
    my_share_amount: partialBill.my_share_amount !== undefined ? partialBill.my_share_amount : localShared.my_share_amount,
    split_participants: partialBill.split_participants !== undefined ? partialBill.split_participants : localShared.split_participants,
  }
}

/**
 * Remove uma conta fixa recorrente.
 */
export async function deleteRecurringBill(id: string): Promise<void> {
  removeLocalRecurringType(id)
  removeLocalRecurringSharedMeta(id)
  const { error } = await supabase
    .from('recurring_bills')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao excluir conta fixa:', error)
    throw error
  }
}

/**
 * Verifica de forma inteligente se uma conta fixa (despesa ou receita) já foi liquidada nas transações do mês.
 */
export function checkBillPaidInMonth(
  bill: RecurringBill,
  monthlyTransactions: Transaction[]
): boolean {
  const expectedType = bill.type || 'expense'
  const billNameLower = bill.name.trim().toLowerCase()
  const billCatLower = bill.category.trim().toLowerCase()

  return monthlyTransactions.some((t) => {
    if (t.type !== expectedType) return false

    const descLower = (t.description || '').trim().toLowerCase()
    const catLower = (t.category || '').trim().toLowerCase()
    const tAmt = Number(t.amount) || 0
    const bAmt = Number(bill.amount) || 0

    // Critério 1: Descrição contém o nome da conta ou vice-versa
    if (descLower && (descLower.includes(billNameLower) || billNameLower.includes(descLower))) {
      return true
    }

    // Critério 2: Mesma categoria E (mesma conta bancária OU mesmo valor exato)
    if (catLower === billCatLower) {
      if (t.wallet_id === bill.wallet_id && Math.abs(tAmt - bAmt) < 0.01) {
        return true
      }
      if (Math.abs(tAmt - bAmt) < 0.01) {
        return true
      }
    }

    return false
  })
}
