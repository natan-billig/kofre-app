import { supabase } from './supabase'
import type { JoinFamilyResult, FamilyMemberItem } from './types'

/**
 * Obtém o family_id ativo do usuário verificando profiles, family_members e families por owner_id.
 */
export async function getActiveFamilyId(userId?: string): Promise<string | null> {
  let resolvedUserId = userId
  if (!resolvedUserId) {
    const { data: authData } = await supabase.auth.getUser()
    resolvedUserId = authData?.user?.id
  }
  if (!resolvedUserId) return null

  // 1. Tenta obter pelo profile
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', resolvedUserId)
      .maybeSingle()

    if (profile?.family_id) {
      return profile.family_id
    }
  } catch (err) {
    console.warn('Erro ao consultar profile.family_id:', err)
  }

  // 2. Tenta obter por family_members
  try {
    const { data: memberships } = await supabase
      .from('family_members')
      .select('family_id, created_at, role')
      .eq('user_id', resolvedUserId)
      .order('created_at', { ascending: false })

    if (memberships && memberships.length > 0) {
      const valid = memberships.find((m) => m.family_id)
      if (valid?.family_id) return valid.family_id
    }
  } catch (err) {
    console.warn('Erro ao consultar family_members em getActiveFamilyId:', err)
  }

  // 3. Tenta obter por families onde user é owner_id
  try {
    const { data: ownedFamily } = await supabase
      .from('families')
      .select('id')
      .eq('owner_id', resolvedUserId)
      .maybeSingle()

    if (ownedFamily?.id) return ownedFamily.id
  } catch (err) {
    console.warn('Erro ao consultar families por owner_id:', err)
  }

  return null
}

/**
 * Busca ou cria o invite_code da família ativa do usuário.
 * Consulta prioritariamente a família vinculada por family_id antes de recorrer à RPC.
 */
export async function getFamilyCode(userId?: string): Promise<string> {
  // 1. Busca primeiro se o usuário já possui família ativa vinculada
  const activeFamilyId = await getActiveFamilyId(userId)

  if (activeFamilyId) {
    try {
      const { data: family, error: famErr } = await supabase
        .from('families')
        .select('invite_code')
        .eq('id', activeFamilyId)
        .maybeSingle()

      if (!famErr && family?.invite_code) {
        return family.invite_code
      }
    } catch (err) {
      console.warn('Aviso ao buscar invite_code de families:', err)
    }
  }

  // 2. Fallback para RPC get_or_create_my_family
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
 * Busca a lista de membros conectados na família ativa do usuário.
 * Consulta por family_id ativo para mapear perfeitamente Administrador e Membros em ambos os dispositivos.
 */
export async function fetchFamilyMembers(currentUserId?: string): Promise<FamilyMemberItem[]> {
  let resolvedUserId = currentUserId
  if (!resolvedUserId) {
    const { data: authData } = await supabase.auth.getUser()
    resolvedUserId = authData?.user?.id
  }
  if (!resolvedUserId) return []

  const activeFamilyId = await getActiveFamilyId(resolvedUserId)

  // Se não encontrou family_id, tenta via RPC como tentativa secundária
  if (!activeFamilyId) {
    try {
      const { data, error } = await supabase.rpc('get_family_members')
      if (!error && data && Array.isArray(data) && data.length > 0) {
        return data as FamilyMemberItem[]
      }
    } catch (err) {
      console.warn('RPC get_family_members falhou:', err)
    }
    return []
  }

  try {
    // 1. Obter informações da família para saber quem é o dono/administrador
    const { data: familyData } = await supabase
      .from('families')
      .select('id, owner_id')
      .eq('id', activeFamilyId)
      .maybeSingle()
    const ownerId = familyData?.owner_id || null

    // 2. Buscar registros em family_members
    const { data: memberRows } = await supabase
      .from('family_members')
      .select('user_id, role, family_id')
      .eq('family_id', activeFamilyId)

    // 3. Buscar perfis com esse family_id diretamente
    const { data: profilesWithFamily } = await supabase
      .from('profiles')
      .select('id, full_name, avatar, family_id')
      .eq('family_id', activeFamilyId)

    // Coletar todos os user_ids únicos pertencentes a esta família
    const allUserIds = new Set<string>()
    if (ownerId) allUserIds.add(ownerId)
    if (memberRows) {
      memberRows.forEach((m) => {
        if (m.user_id) allUserIds.add(m.user_id)
      })
    }
    if (profilesWithFamily) {
      profilesWithFamily.forEach((p) => {
        if (p.id) allUserIds.add(p.id)
      })
    }

    if (allUserIds.size === 0) return []

    // Buscar os perfis que possam faltar
    const userIdsArray = Array.from(allUserIds)
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar')
      .in('id', userIdsArray)

    const profileMap = new Map<string, { full_name: string | null; avatar: string | null }>()
    allProfiles?.forEach((p) => {
      profileMap.set(p.id, { full_name: p.full_name, avatar: p.avatar })
    })

    const memberMap = new Map<string, { role?: string }>()
    memberRows?.forEach((m) => {
      memberMap.set(m.user_id, { role: m.role })
    })

    const result: FamilyMemberItem[] = userIdsArray.map((uid) => {
      const prof = profileMap.get(uid)
      const mData = memberMap.get(uid)
      const isOwner = uid === ownerId
      const isAdmin = isOwner || mData?.role === 'admin' || mData?.role === 'owner'

      return {
        user_id: uid,
        full_name: prof?.full_name || (uid === resolvedUserId ? 'Você' : 'Membro da Família'),
        role: isAdmin ? 'admin' : 'member',
        is_current_user: uid === resolvedUserId,
      }
    })

    // Ordenar para que admin/owner apareça primeiro, seguido do usuário logado e demais membros
    return result.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1
      if (b.role === 'admin' && a.role !== 'admin') return 1
      if (a.is_current_user && !b.is_current_user) return -1
      if (!a.is_current_user && b.is_current_user) return 1
      return (a.full_name || '').localeCompare(b.full_name || '')
    })
  } catch (err) {
    console.error('Erro ao buscar membros fieis da família:', err)
    return []
  }
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
