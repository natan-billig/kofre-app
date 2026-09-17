import { supabase } from './supabase'
import type { UserIdentity } from '@supabase/supabase-js'

/**
 * Inicia o fluxo de autenticação com o Google via OAuth.
 * Redireciona o usuário para o consentimento do Google e retorna para a origem da aplicação.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

/**
 * Vincula a conta Google a um usuário já autenticado.
 */
export async function linkGoogleAccount() {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

/**
 * Desvincula uma identidade (ex: Google) da conta do usuário.
 */
export async function unlinkGoogleAccount(identity: UserIdentity) {
  const { error } = await supabase.auth.unlinkIdentity(identity)
  if (error) throw error
}

/**
 * Retorna as identidades ativas vinculadas ao usuário autenticado.
 */
export async function getUserIdentities(): Promise<UserIdentity[]> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return []
  return user.identities || []
}
