import { supabase } from './supabase'
import type { DebtItem, WalletScope } from './types'
import { createTransaction } from './accountingService'

/**
 * Busca dívidas e empréstimos cadastrados no Supabase, filtrando por escopo e família.
 * Suporta sincronização bidirecional (user_id.eq.${currentUserId} OU target_user_id.eq.${currentUserId})
 * e inclui dados de perfil do criador e destinatário.
 */
export async function fetchDebts(
  scope: WalletScope | 'all' = 'all',
  familyId?: string | null,
  currentUserId?: string
): Promise<DebtItem[]> {
  let userId = currentUserId
  if (!userId) {
    const { data: authData } = await supabase.auth.getUser()
    userId = authData?.user?.id || ''
  }

  // 1. Tenta a query com join direto conforme solicitado:
  // .select('*, creator:user_id(full_name), target:target_user_id(full_name)')
  let joinedSuccess = false
  let data: any[] | null = null

  try {
    let joinQuery = supabase
      .from('debts')
      .select('*, creator:user_id(full_name), target:target_user_id(full_name)')

    if (userId) {
      joinQuery = joinQuery.or(`user_id.eq.${userId},target_user_id.eq.${userId}`)
    }

    if (scope === 'personal') {
      joinQuery = joinQuery.eq('scope', 'personal')
    } else if (scope === 'shared') {
      joinQuery = joinQuery.eq('scope', 'shared')
      if (familyId) {
        joinQuery = joinQuery.eq('family_id', familyId)
      }
    }

    const { data: joinedData, error: joinError } = await joinQuery.order('created_at', {
      ascending: false,
    })

    if (!joinError && joinedData) {
      data = joinedData
      joinedSuccess = true
    }
  } catch {
    // Foreign key pode não estar registrada no schema cache do PostgREST; fallback seguro logo abaixo
  }

  // 2. Fallback resiliente: busca dívidas e preenche creator / target via profiles
  if (!joinedSuccess) {
    let query = supabase.from('debts').select('*')

    if (userId) {
      query = query.or(`user_id.eq.${userId},target_user_id.eq.${userId}`)
    }

    if (scope === 'personal') {
      query = query.eq('scope', 'personal')
    } else if (scope === 'shared') {
      query = query.eq('scope', 'shared')
      if (familyId) {
        query = query.eq('family_id', familyId)
      }
    }

    const { data: rawDebts, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar dívidas:', error)
      throw error
    }

    const debtsList = rawDebts || []

    // Coleta IDs únicos de criadores e destinatários para buscar dados de perfil
    const userIdsToFetch = Array.from(
      new Set(
        debtsList
          .flatMap((d) => [d.user_id, d.target_user_id])
          .filter(Boolean) as string[]
      )
    )

    const profileMap: Record<string, { full_name: string | null }> = {}
    if (userIdsToFetch.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIdsToFetch)

      if (profilesData) {
        for (const p of profilesData) {
          profileMap[p.id] = { full_name: p.full_name }
        }
      }
    }

    data = debtsList.map((d) => ({
      ...d,
      creator: d.user_id ? profileMap[d.user_id] || null : null,
      target: d.target_user_id ? profileMap[d.target_user_id] || null : null,
    }))
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
 * Se walletId for informado, gera automaticamente a transação de despesa ou receita correspondente
 * com base na perspectiva do usuário que está realizando a liquidação.
 */
export async function settleDebt(
  debtId: string,
  walletId?: string,
  currentUserId?: string
): Promise<DebtItem> {
  // 1. Se informada a carteira, busca os dados da dívida para gerar a transação contábil
  if (walletId) {
    const { data: debt, error: fetchErr } = await supabase
      .from('debts')
      .select('*')
      .eq('id', debtId)
      .single()

    if (!fetchErr && debt) {
      let activeUserId = currentUserId
      if (!activeUserId) {
        const { data: authData } = await supabase.auth.getUser()
        activeUserId = authData?.user?.id || debt.user_id
      }

      // Determinar a perspectiva do usuário que está liquidando:
      // - Se activeUserId for o criador (debt.user_id):
      //     type === 'i_owe' => pagador (despesa)
      //     type === 'they_owe' => recebedor (receita)
      // - Se activeUserId for o destinatário (debt.target_user_id):
      //     type === 'they_owe' => pagador (despesa)
      //     type === 'i_owe' => recebedor (receita)
      let isPayer = false
      let otherPartyName = debt.contact_name

      if (debt.target_user_id && activeUserId === debt.target_user_id) {
        isPayer = debt.type === 'they_owe'
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', debt.user_id)
          .single()
        otherPartyName = creatorProfile?.full_name || 'Membro da Família'
      } else {
        isPayer = debt.type === 'i_owe'
        otherPartyName = debt.contact_name
      }

      const resolvedUserId = activeUserId || debt.user_id || ''

      await createTransaction({
        user_id: resolvedUserId,
        wallet_id: walletId,
        type: isPayer ? 'expense' : 'income',
        amount: Number(debt.amount),
        category: 'Empréstimo',
        description: isPayer
          ? `Quitação de empréstimo: ${otherPartyName}${debt.description ? ` - ${debt.description}` : ''}`
          : `Recebimento de empréstimo: ${otherPartyName}${debt.description ? ` - ${debt.description}` : ''}`,
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
