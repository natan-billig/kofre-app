import { supabase } from './supabase'
import type { Profile } from './types'

export async function fetchUserProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.warn('Error fetching user profile:', error.message)
      return null
    }

    return (data as Profile) || null
  } catch (err) {
    console.warn('Error in fetchUserProfile:', err)
    return null
  }
}

export async function updateUserProfile(
  userId: string,
  data: Partial<Profile>
): Promise<Profile> {
  // Update Supabase Auth user metadata if full_name is updated
  if (data.full_name !== undefined) {
    try {
      await supabase.auth.updateUser({
        data: { full_name: data.full_name },
      })
    } catch (err) {
      console.warn('Could not update auth user metadata:', err)
    }
  }

  // Garantir que a coluna correta 'id' seja enviada com o userId para satisfazer RLS
  const payload: Record<string, unknown> = {
    id: userId,
    full_name: data.full_name,
    avatar: data.avatar,
    preferred_currency: data.preferred_currency,
    updated_at: new Date().toISOString(),
  }

  let { data: result, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

  // Se a coluna updated_at não existir no schema cache, faz fallback sem updated_at
  if (error && (error.code === 'PGRST204' || error.message?.includes('updated_at'))) {
    delete payload.updated_at
    const retry = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()
    result = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Erro ao atualizar perfil no Supabase:', error)
    throw error
  }

  return result as Profile
}

export async function upsertProfile(userId: string, fullName: string, email: string) {
  try {
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        full_name: fullName,
        email: email,
      },
      { onConflict: 'id' }
    )
    if (error) {
      console.warn('Could not upsert profile:', error.message)
    }
  } catch (err) {
    console.warn('Error in upsertProfile:', err)
  }
}

export async function fetchProfilesMap(userIds: string[]): Promise<Record<string, string>> {
  if (!userIds || userIds.length === 0) return {}

  const uniqueIds = Array.from(new Set(userIds))
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', uniqueIds)

    if (error || !data) {
      return {}
    }

    const map: Record<string, string> = {}
    for (const p of data) {
      map[p.id] = p.full_name || p.email?.split('@')[0] || 'Membro'
    }
    return map
  } catch {
    return {}
  }
}
