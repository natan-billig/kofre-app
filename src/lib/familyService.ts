import { supabase } from './supabase'
import type { JoinFamilyResult, FamilyMemberItem } from './types'

/**
 * Busca ou cria o invite_code da família ativa do usuário via RPC get_or_create_my_family.
 * Se a chamada falhar ou success for falso, propaga o erro com a mensagem técnica real.
 */
export async function getFamilyCode(_userId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_my_family')

  if (error) {
    console.error('Erro na RPC get_or_create_my_family:', error)
    throw new Error(error.message || 'Erro ao carregar código da família.')
  }

  if (data && typeof data === 'object') {
    const res = data as { success?: boolean; invite_code?: string; message?: string }
    if (res.success && res.invite_code) {
      return res.invite_code
    }
    throw new Error(res.message || 'Falha ao obter código da família.')
  }

  throw new Error('Resposta inválida do servidor ao obter família.')
}

/**
 * Obtém o family_id da família ativa do usuário chamando a RPC get_or_create_my_family.
 */
export async function getOrCreateMyFamilyId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_my_family')

  if (error) {
    console.error('Erro na RPC get_or_create_my_family (family_id):', error)
    throw new Error(error.message || 'Erro ao obter identificador da família.')
  }

  if (data && typeof data === 'object') {
    const res = data as { success?: boolean; family_id?: string; message?: string }
    if (res.success && res.family_id) {
      return res.family_id
    }
    throw new Error(res.message || 'Falha ao obter identificador da família.')
  }

  return null
}

/**
 * Vincula o usuário atual a uma família através de um código de convite via RPC.
 */
export async function joinFamilyByCode(code: string): Promise<JoinFamilyResult> {
  const cleanCode = code.trim().toUpperCase()

  if (!cleanCode) {
    return {
      success: false,
      message: 'Por favor, informe o código de convite da família.',
    }
  }

  try {
    const { data, error } = await supabase.rpc('join_family_by_code', {
      code_input: cleanCode,
    })

    if (error) {
      console.error('Erro na RPC join_family_by_code:', error)
      return {
        success: false,
        message: error.message || 'Falha ao vincular com a família informada.',
      }
    }

    // A RPC pode retornar boolean ou um objeto { success: boolean, message: string }
    if (typeof data === 'boolean') {
      return {
        success: data,
        message: data
          ? 'Família vinculada com sucesso!'
          : 'Código de convite inválido ou expirado.',
      }
    }

    if (data && typeof data === 'object') {
      const resp = data as { success?: boolean; message?: string }
      return {
        success: Boolean(resp.success),
        message:
          resp.message ||
          (resp.success
            ? 'Família vinculada com sucesso!'
            : 'Código de convite inválido ou expirado.'),
      }
    }

    return {
      success: true,
      message: 'Família vinculada com sucesso!',
    }
  } catch (err: unknown) {
    console.error('Exceção ao chamar joinFamilyByCode:', err)
    const errObj = err as { message?: string }
    return {
      success: false,
      message: errObj.message || 'Erro inesperado ao vincular família.',
    }
  }
}

/**
 * Busca a lista de membros conectados na família ativa do usuário via RPC get_family_members.
 */
export async function fetchFamilyMembers(): Promise<FamilyMemberItem[]> {
  const { data, error } = await supabase.rpc('get_family_members')

  if (error) {
    console.error('Erro na RPC get_family_members:', error)
    throw new Error(error.message || 'Erro ao carregar membros da família.')
  }

  return (data as FamilyMemberItem[]) || []
}

/**
 * Remove um membro da família ativa via RPC remove_family_member.
 */
export async function removeFamilyMember(
  targetUserId: string
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('remove_family_member', {
    p_target_user_id: targetUserId,
  })

  if (error) {
    console.error('Erro na RPC remove_family_member:', error)
    throw new Error(error.message || 'Erro ao remover membro da família.')
  }

  if (data && typeof data === 'object') {
    const res = data as { success?: boolean; message?: string }
    if (res.success === false) {
      throw new Error(res.message || 'Falha ao remover membro da família.')
    }
    return {
      success: true,
      message: res.message || 'Membro removido com sucesso.',
    }
  }

  return {
    success: true,
    message: 'Membro removido com sucesso.',
  }
}
