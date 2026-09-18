import { supabase } from './supabase'
import type { Profile } from './types'

export async function fetchUserProfile(userId: string): Promise<Profile | null> {
  try {
    // 1. Ler dados salvos localmente
    let localExtra: Record<string, unknown> = {}
    try {
      const stored = localStorage.getItem(`kofre_profile_extra_${userId}`)
      if (stored) {
        localExtra = JSON.parse(stored)
      }
    } catch {
      // Ignora erro de localStorage
    }

    // 2. Buscar perfil no Supabase
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.warn('Error fetching user profile:', error.message)
    }

    let profile = (data as Profile) || null

    if (!profile && Object.keys(localExtra).length === 0) {
      return null
    }

    if (!profile) {
      profile = {
        id: userId,
        full_name: null,
      } as Profile
    }

    // 3. Merge inteligente: se o Supabase devolver base_monthly_income ou alias_py como null, undefined ou vazio, preservar do local
    const mergedIncome =
      profile.base_monthly_income != null && profile.base_monthly_income !== 0
        ? profile.base_monthly_income
        : localExtra.base_monthly_income != null && localExtra.base_monthly_income !== 0
        ? Number(localExtra.base_monthly_income)
        : (profile.base_monthly_income ?? (localExtra.base_monthly_income != null ? Number(localExtra.base_monthly_income) : null))

    const pickString = (dbVal: string | null | undefined, localVal: unknown): string | null => {
      if (typeof dbVal === 'string' && dbVal.trim() !== '') return dbVal.trim()
      if (typeof localVal === 'string' && localVal.trim() !== '') return localVal.trim()
      return null
    }

    const mergedBudgetStartDay =
      profile.budget_start_day != null && profile.budget_start_day > 0
        ? profile.budget_start_day
        : typeof localExtra.budget_start_day === 'number' && localExtra.budget_start_day > 0
        ? localExtra.budget_start_day
        : 1

    profile = {
      ...profile,
      budget_start_day: mergedBudgetStartDay,
      base_monthly_income: mergedIncome,
      pix_key: pickString(profile.pix_key, localExtra.pix_key),
      alias_py: pickString(profile.alias_py, localExtra.alias_py),
      bank_details: pickString(profile.bank_details, localExtra.bank_details),
    }

    // 4. Salvar estado consolidado no localStorage
    try {
      localStorage.setItem(
        `kofre_profile_extra_${userId}`,
        JSON.stringify({
          budget_start_day: profile.budget_start_day,
          base_monthly_income: profile.base_monthly_income,
          pix_key: profile.pix_key,
          alias_py: profile.alias_py,
          bank_details: profile.bank_details,
        })
      )
    } catch {
      // Ignora erro
    }

    return profile
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

  // Persistência local garantida SEMPRE antes de chamar Supabase (fallback e integridade)
  let localExtra: Record<string, unknown> = {}
  try {
    const existing = localStorage.getItem(`kofre_profile_extra_${userId}`)
    const parsed = existing ? JSON.parse(existing) : {}
    localExtra = {
      ...parsed,
      budget_start_day: data.budget_start_day !== undefined ? data.budget_start_day : parsed.budget_start_day,
      base_monthly_income: data.base_monthly_income !== undefined ? data.base_monthly_income : parsed.base_monthly_income,
      pix_key: data.pix_key !== undefined ? data.pix_key : parsed.pix_key,
      alias_py: data.alias_py !== undefined ? data.alias_py : parsed.alias_py,
      bank_details: data.bank_details !== undefined ? data.bank_details : parsed.bank_details,
    }
    localStorage.setItem(`kofre_profile_extra_${userId}`, JSON.stringify(localExtra))
  } catch {
    // Ignora erro de localStorage
  }

  // Garantir que a coluna correta 'id' seja enviada com o userId para satisfazer RLS
  const payload: Record<string, unknown> = {
    id: userId,
    full_name: data.full_name,
    avatar: data.avatar,
    preferred_currency: data.preferred_currency,
    updated_at: new Date().toISOString(),
  }

  if (data.budget_start_day !== undefined) {
    payload.budget_start_day = data.budget_start_day
  }
  if (data.base_monthly_income !== undefined) {
    payload.base_monthly_income = data.base_monthly_income
  }
  if (data.pix_key !== undefined) {
    payload.pix_key = data.pix_key
  }
  if (data.alias_py !== undefined) {
    payload.alias_py = data.alias_py
  }
  if (data.bank_details !== undefined) {
    payload.bank_details = data.bank_details
  }

  let { data: result, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

  // Se alguma coluna opcional não existir no schema do banco, remove e tenta novamente
  if (error) {
    const optionalCols = [
      'updated_at',
      'budget_start_day',
      'base_monthly_income',
      'pix_key',
      'alias_py',
      'bank_details',
    ]
    let hasStripped = false
    for (const col of optionalCols) {
      if (error.message?.includes(col) || error.code === 'PGRST204') {
        delete payload[col]
        hasStripped = true
      }
    }

    if (hasStripped) {
      const retry = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single()
      result = retry.data
      error = retry.error
    }
  }

  if (error) {
    console.warn('Aviso ao sincronizar perfil no Supabase (usando fallback local):', error.message)
  }

  const finalProfile = (result as Profile) || (payload as unknown as Profile)
  return {
    ...finalProfile,
    budget_start_day: data.budget_start_day !== undefined ? data.budget_start_day : (finalProfile.budget_start_day ?? (localExtra.budget_start_day as number) ?? 1),
    base_monthly_income: data.base_monthly_income !== undefined ? data.base_monthly_income : (finalProfile.base_monthly_income ?? (localExtra.base_monthly_income as number | null) ?? null),
    pix_key: data.pix_key !== undefined ? data.pix_key : (finalProfile.pix_key ?? (localExtra.pix_key as string | null) ?? null),
    alias_py: data.alias_py !== undefined ? data.alias_py : (finalProfile.alias_py ?? (localExtra.alias_py as string | null) ?? null),
    bank_details: data.bank_details !== undefined ? data.bank_details : (finalProfile.bank_details ?? (localExtra.bank_details as string | null) ?? null),
  }
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
