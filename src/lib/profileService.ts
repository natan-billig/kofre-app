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
  const payload: Record<string, unknown> = {
    id: userId,
  }
  if (data.full_name !== undefined) payload.full_name = data.full_name
  if (data.avatar !== undefined) payload.avatar = data.avatar
  if (data.preferred_currency !== undefined) payload.preferred_currency = data.preferred_currency

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

  const { data: updated, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    console.error('Error updating user profile:', error)
    throw error
  }

  return updated as Profile
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
