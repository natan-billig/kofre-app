import { supabase } from './supabase'

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
