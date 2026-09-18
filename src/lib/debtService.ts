import { supabase } from './supabase'
import type { DebtItem, WalletScope } from './types'
import { createTransaction } from './accountingService'

/**
 * Busca dívidas e empréstimos cadastrados no Supabase, filtrando por escopo e família.
 */
export async function fetchDebts(
  scope: WalletScope | 'all' = 'all',
  familyId?: string | null
): Promise<DebtItem[]> {
  let query = supabase.from('debts').select('*')

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

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar dívidas:', error)
    throw error
  }

  return (data as DebtItem[]) || []
}

/**
 * Cadastra uma nova dívida ou empréstimo.
 * Se creditWallet for true e wallet_id for informado, cria automaticamente a transação vinculada.
 */
export async function createDebt(
  debt: Omit<DebtItem, 'id' | 'created_at' | 'settled_at'>,
  creditWallet: boolean = false
): Promise<DebtItem> {
  let userId = debt.user_id
  if (!userId) {
    const { data: authData } = await supabase.auth.getUser()
    userId = authData?.user?.id || ''
  }

  const payload = {
    ...debt,
    user_id: userId,
    status: debt.status || 'pending',
  }

  const { data, error } = await supabase
    .from('debts')
    .insert([payload])
    .select()
    .single()

  if (error) {
    console.error('Erro ao cadastrar dívida:', error)
    throw error
  }

  const createdDebt = data as DebtItem

  // Se creditWallet === true e debt.wallet_id existir, cria a movimentação de caixa correspondente
  if (creditWallet && debt.wallet_id) {
    const isIOwe = debt.type === 'i_owe'
    // Se "i_owe" (eu peguei emprestado): entra dinheiro na conta -> income
    // Se "they_owe" (eu emprestei): sai dinheiro da conta -> expense
    await createTransaction({
      user_id: userId,
      wallet_id: debt.wallet_id,
      type: isIOwe ? 'income' : 'expense',
      amount: Number(debt.amount),
      category: 'Empréstimo',
      description: isIOwe
        ? `Empréstimo recebido: ${debt.contact_name}${debt.description ? ` - ${debt.description}` : ''}`
        : `Empréstimo concedido: ${debt.contact_name}${debt.description ? ` - ${debt.description}` : ''}`,
      transaction_date: new Date().toISOString(),
    })
  }

  return createdDebt
}

/**
 * Marca uma dívida como liquidada.
 * Se debitWalletId for informado, gera automaticamente a transação de despesa ou receita correspondente.
 */
export async function settleDebt(
  debtId: string,
  debitWalletId?: string
): Promise<DebtItem> {
  // 1. Se informada a carteira, busca os dados da dívida para gerar a transação contábil
  if (debitWalletId) {
    const { data: debt, error: fetchErr } = await supabase
      .from('debts')
      .select('*')
      .eq('id', debtId)
      .single()

    if (!fetchErr && debt) {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id || debt.user_id

      const isIOwe = debt.type === 'i_owe'
      // Se eu devo (i_owe), liquidar significa pagar -> despesa na carteira
      // Se me devem (they_owe), liquidar significa receber o valor -> receita na carteira
      await createTransaction({
        user_id: userId,
        wallet_id: debitWalletId,
        type: isIOwe ? 'expense' : 'income',
        amount: Number(debt.amount),
        category: 'Empréstimo',
        description: isIOwe
          ? `Quitação de empréstimo: ${debt.contact_name}${debt.description ? ` - ${debt.description}` : ''}`
          : `Recebimento de empréstimo: ${debt.contact_name}${debt.description ? ` - ${debt.description}` : ''}`,
        transaction_date: new Date().toISOString(),
      })
    }
  }

  // 2. Atualiza o status para settled
  const { data, error } = await supabase
    .from('debts')
    .update({
      status: 'settled',
      settled_at: new Date().toISOString(),
    })
    .eq('id', debtId)
    .select()
    .single()

  if (error) {
    console.error('Erro ao liquidar dívida:', error)
    throw error
  }

  return data as DebtItem
}

/**
 * Exclui uma dívida ou empréstimo.
 */
export async function deleteDebt(debtId: string): Promise<void> {
  const { error } = await supabase.from('debts').delete().eq('id', debtId)

  if (error) {
    console.error('Erro ao excluir dívida:', error)
    throw error
  }
}
