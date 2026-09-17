import { supabase } from './supabase'
import type { RecurringBill, Transaction, WalletScope } from './types'

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
  return rawList.map((item) => ({
    ...item,
    type: item.type || 'expense',
  }))
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

  const payload = {
    ...bill,
    type: bill.type || 'expense',
    user_id: userId,
  }

  let { data, error } = await supabase
    .from('recurring_bills')
    .insert([payload])
    .select()
    .single()

  // Fallback resiliente caso a coluna type ainda não exista no schema do banco
  if (error && (error.code === 'PGRST204' || error.message?.includes('type'))) {
    const fallbackPayload = {
      name: payload.name,
      amount: payload.amount,
      currency: payload.currency,
      category: payload.category,
      wallet_id: payload.wallet_id,
      due_day: payload.due_day,
      start_date: payload.start_date,
      is_active: payload.is_active,
      scope: payload.scope,
      family_id: payload.family_id,
      user_id: payload.user_id,
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

  return {
    ...(data as RecurringBill),
    type: (data as RecurringBill)?.type || bill.type || 'expense',
  }
}

/**
 * Atualiza os dados ou status (is_active) de uma conta fixa.
 */
export async function updateRecurringBill(
  id: string,
  partialBill: Partial<RecurringBill>
): Promise<RecurringBill> {
  let { data, error } = await supabase
    .from('recurring_bills')
    .update(partialBill)
    .eq('id', id)
    .select()
    .single()

  // Fallback resiliente se a coluna type não existir no schema
  if (error && (error.code === 'PGRST204' || error.message?.includes('type'))) {
    const { type: _unused, ...fallbackPartial } = partialBill
    void _unused
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

  return {
    ...(data as RecurringBill),
    type: (data as RecurringBill)?.type || partialBill.type || 'expense',
  }
}

/**
 * Remove uma conta fixa recorrente.
 */
export async function deleteRecurringBill(id: string): Promise<void> {
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
