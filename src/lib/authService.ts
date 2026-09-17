import { supabase } from './supabase'

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
