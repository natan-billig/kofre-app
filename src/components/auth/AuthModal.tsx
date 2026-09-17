import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { upsertProfile } from '../../lib/profileService'
import { Lock, Mail, User, ShieldCheck, Loader2, ArrowRight } from 'lucide-react'

interface AuthModalProps {
  onSuccess: () => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    if (isRegister && !fullName.trim()) {
      setErrorMsg('Por favor, informe seu nome completo.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('A senha deve conter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        })

        if (error) {
          throw error
        }

        if (data.user) {
          await upsertProfile(data.user.id, fullName.trim(), email)
          if (data.session) {
            onSuccess()
          } else {
            setSuccessMsg('Conta criada com sucesso! Verifique seu e-mail para confirmar seu cadastro se necessário.')
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('E-mail ou senha incorretos.')
          }
          throw error
        }

        if (data.user) {
          const nameFromMetadata = data.user.user_metadata?.full_name
          if (nameFromMetadata) {
            await upsertProfile(data.user.id, nameFromMetadata, email)
          }
          onSuccess()
        }
      }
    } catch (err: unknown) {
      console.error('Auth error:', err)
      const message = err instanceof Error ? err.message : 'Erro ao processar autenticação.'
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Kofre</h1>
          <p className="text-sm text-slate-400">
            {isRegister
              ? 'Crie sua conta para gerenciar finanças e carteira familiar'
              : 'Acesse suas contas e transações da fronteira'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700/50">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false)
              setErrorMsg(null)
              setSuccessMsg(null)
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              !isRegister ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true)
              setErrorMsg(null)
              setSuccessMsg(null)
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              isRegister ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
            {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Nome Completo
              </label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 text-sm outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              E-mail
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 text-sm outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 text-sm outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer transition-all active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isRegister ? 'Criar Minha Conta' : 'Entrar no Kofre'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
