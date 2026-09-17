import React, { useState, useEffect } from 'react'
import {
  Users2,
  X,
  Copy,
  Check,
  Link2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  QrCode,
  ShieldCheck,
} from 'lucide-react'
import type { JoinFamilyResult } from '../lib/types'
import { getFamilyCode, joinFamilyByCode } from '../lib/familyService'

interface FamilySettingsModalProps {
  isOpen: boolean
  userId: string
  onClose: () => void
  onFamilyLinked: () => void
}

export const FamilySettingsModal: React.FC<FamilySettingsModalProps> = (props) => {
  if (!props.isOpen) return null
  return <FamilySettingsModalContent {...props} />
}

const FamilySettingsModalContent: React.FC<FamilySettingsModalProps> = ({
  userId,
  onClose,
  onFamilyLinked,
}) => {
  const [currentCode, setCurrentCode] = useState<string | null>(null)
  const [loadingCode, setLoadingCode] = useState(true)
  const [copied, setCopied] = useState(false)

  // Join block state
  const [inputCode, setInputCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [feedback, setFeedback] = useState<JoinFamilyResult | null>(null)

  // Load family invite code when mounted
  useEffect(() => {
    let isMounted = true

    getFamilyCode(userId)
      .then((code) => {
        if (isMounted) {
          setCurrentCode(code)
          setLoadingCode(false)
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar código da família:', err)
        if (isMounted) {
          setLoadingCode(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [userId])

  const handleCopyCode = async () => {
    if (!currentCode) return
    try {
      await navigator.clipboard.writeText(currentCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Falha ao copiar código:', err)
    }
  }

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = inputCode.trim().toUpperCase()
    if (!cleanCode) {
      setFeedback({
        success: false,
        message: 'Por favor, digite o código de convite.',
      })
      return
    }

    setJoining(true)
    setFeedback(null)

    try {
      const res = await joinFamilyByCode(cleanCode)
      setFeedback(res)

      if (res.success) {
        // Atualiza reativamente após breve confirmação visual
        setTimeout(() => {
          onFamilyLinked()
          onClose()
        }, 1200)
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setFeedback({
        success: false,
        message: errObj.message || 'Erro inesperado ao vincular à família.',
      })
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Gestão da Família
              </h2>
              <p className="text-xs text-slate-400">
                Caixa Compartilhado e Acesso Familiar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Bloco 1: Convidar para a Família */}
          <section className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <QrCode className="w-4 h-4" />
              <h3 className="text-sm font-semibold tracking-wide uppercase">
                Convidar para a Família
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Passe este código para quem você deseja adicionar ao seu Caixa da Família. As movimentações desse caixa serão sincronizadas em tempo real.
            </p>

            {loadingCode ? (
              <div className="flex items-center justify-center py-6 bg-slate-900/70 border border-slate-800 rounded-xl">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
            ) : currentCode ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-900/90 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 uppercase font-medium">
                    Código:
                  </span>
                  <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-emerald-400">
                    {currentCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                Nenhum código de convite ativo encontrado no momento.
              </div>
            )}
          </section>

          {/* Divisor */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Ou
            </span>
          </div>

          {/* Bloco 2: Entrar em Outra Família */}
          <section className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <Link2 className="w-4 h-4" />
              <h3 className="text-sm font-semibold tracking-wide uppercase">
                Entrar em Outra Família
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recebeu um código de um familiar? Digite abaixo para vincular sua conta e compartilhar o mesmo Caixa da Família.
            </p>

            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Código de Convite Recebido
                </label>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="ex: KFR-8A2F"
                  maxLength={12}
                  disabled={joining}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-center sm:text-left text-sm tracking-widest uppercase placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                />
              </div>

              {/* Feedback messages */}
              {feedback && (
                <div
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                    feedback.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {feedback.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={joining || !inputCode.trim()}
                className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all"
              >
                {joining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Vinculando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Vincular por Código</span>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
