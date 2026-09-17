import { supabase } from './supabase'
import type { FamilyMember, JoinFamilyResult } from './types'

/**
 * Gera um código legível de convite no formato KFR-XXXX
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `KFR-${suffix}`
}

/**
 * Busca o invite_code da família ativa do usuário.
 * NUNCA utiliza .single() pois um usuário pode ter múltiplos registros em family_members.
 * Prioriza vínculos onde role = 'member' (ingressou por convite) ou ordenação decrescente por data.
 */
export async function getFamilyCode(userId: string): Promise<string | null> {
  if (!userId) return null

  try {
    // 1. Busca todos os vínculos do usuário sem .single()
    const { data: members, error: membersErr } = await supabase
      .from('family_members')
      .select('id, created_at, user_id, family_id, role, families(id, name, invite_code)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (membersErr) {
      console.warn('Erro ao consultar family_members:', membersErr.message)
    }

    const membershipList = (members as unknown as FamilyMember[]) || []

    if (membershipList.length > 0) {
      // Prioriza 'member' (família na qual ingressou por código) ou o registro mais recente
      const sorted = [...membershipList].sort((a, b) => {
        if (a.role === 'member' && b.role !== 'member') return -1
        if (b.role === 'member' && a.role !== 'member') return 1
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA
      })

      const chosen = sorted[0]
      if (chosen.families?.invite_code) {
        return chosen.families.invite_code
      }

      // Se o join não veio populado, busca direto na tabela families
      if (chosen.family_id) {
        const { data: famData } = await supabase
          .from('families')
          .select('invite_code')
          .eq('id', chosen.family_id)
          .maybeSingle()

        if (famData?.invite_code) {
          return famData.invite_code
        }
      }
    }

    // 2. Fallback: verificar se alguma carteira compartilhada do usuário já tem family_id
    const { data: walletWithFamily } = await supabase
      .from('wallets')
      .select('family_id')
      .eq('owner_id', userId)
      .not('family_id', 'is', null)
      .order('created_at', { ascending: false })

    if (walletWithFamily && walletWithFamily.length > 0 && walletWithFamily[0].family_id) {
      const { data: famData } = await supabase
        .from('families')
        .select('invite_code')
        .eq('id', walletWithFamily[0].family_id)
        .maybeSingle()

      if (famData?.invite_code) {
        return famData.invite_code
      }
    }

    // 3. Se ainda não possuir família criada, cria automaticamente uma família para o usuário
    const newCode = generateInviteCode()
    const { data: newFam, error: newFamErr } = await supabase
      .from('families')
      .insert([{ name: 'Caixa da Família', invite_code: newCode }])
      .select('id, invite_code')
      .maybeSingle()

    if (!newFamErr && newFam?.id) {
      // Registra como owner na family_members
      await supabase.from('family_members').insert([
        {
          user_id: userId,
          family_id: newFam.id,
          role: 'owner',
        },
      ])

      // Vincula ao Caixa da Família existente do usuário, se houver
      await supabase
        .from('wallets')
        .update({ family_id: newFam.id })
        .eq('owner_id', userId)
        .eq('type', 'shared')

      return newFam.invite_code || newCode
    }

    return null
  } catch (err) {
    console.error('Erro inesperado em getFamilyCode:', err)
    return null
  }
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
