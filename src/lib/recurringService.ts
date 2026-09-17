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

  return (data as RecurringBill[]) || []
}

/**
 * Cria uma nova regra de conta fixa recorrente.
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
    user_id: userId,
  }

  const { data, error } = await supabase
    .from('recurring_bills')
    .insert([payload])
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar conta fixa:', error)
    throw error
  }

  return data as RecurringBill
}

/**
 * Atualiza os dados ou status (is_active) de uma conta fixa.
 */
export async function updateRecurringBill(
  id: string,
  partialBill: Partial<RecurringBill>
): Promise<RecurringBill> {
  const { data, error } = await supabase
    .from('recurring_bills')
    .update(partialBill)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar conta fixa:', error)
    throw error
  }

  return data as RecurringBill
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
 * Verifica de forma inteligente se uma conta fixa já foi liquidada nas transações do mês.
 */
export function checkBillPaidInMonth(
  bill: RecurringBill,
  monthlyTransactions: Transaction[]
): boolean {
  const billNameLower = bill.name.trim().toLowerCase()
  const billCatLower = bill.category.trim().toLowerCase()

  return monthlyTransactions.some((t) => {
    if (t.type !== 'expense') return false

    const descLower = (t.description || '').trim().toLowerCase()
    const catLower = (t.category || '').trim().toLowerCase()
    const tAmt = Number(t.amount) || 0
    const bAmt = Number(bill.amount) || 0

    // Critério 1: Descrição contém o nome da conta ou vice-versa
    if (descLower && (descLower.includes(billNameLower) || billNameLower.includes(descLower))) {
      return true
    }

    // Critério 2: Mesma categoria E (mesma conta de débito OU mesmo valor exato)
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
