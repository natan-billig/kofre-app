import React, { useState, useEffect, useCallback } from 'react'
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
  UserMinus,
  AlertTriangle,
} from 'lucide-react'
import type { JoinFamilyResult, FamilyMemberItem } from '../lib/types'
import {
  getFamilyCode,
  joinFamilyByCode,
  fetchFamilyMembers,
  removeFamilyMember,
} from '../lib/familyService'
import { useTranslation } from '../lib/i18n/LanguageContext'

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
  const { t, language } = useTranslation()
  const [currentCode, setCurrentCode] = useState<string | null>(null)
  const [loadingCode, setLoadingCode] = useState(true)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Members state
  const [members, setMembers] = useState<FamilyMemberItem[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<FamilyMemberItem | null>(null)
  const [removingMember, setRemovingMember] = useState(false)
  const [memberActionMsg, setMemberActionMsg] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Join block state
  const [inputCode, setInputCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [feedback, setFeedback] = useState<JoinFamilyResult | null>(null)

  const refreshMembers = useCallback(async () => {
    setLoadingMembers(true)
    setMembersError(null)
    try {
      const list = await fetchFamilyMembers()
      setMembers(list)
    } catch (err: unknown) {
      console.error('Erro ao carregar membros da família:', err)
      const errObj = err as Record<string, unknown> | null
      const msg =
        (typeof errObj?.message === 'string' && errObj.message) ||
        (err instanceof Error ? err.message : 'Erro ao carregar membros da família.')
      setMembersError(msg)
    } finally {
      setLoadingMembers(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    fetchFamilyMembers()
      .then((list) => {
        if (isMounted) {
          setMembers(list)
          setMembersError(null)
          setLoadingMembers(false)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          console.error('Erro ao carregar membros da família:', err)
          const errObj = err as Record<string, unknown> | null
          const msg =
            (typeof errObj?.message === 'string' && errObj.message) ||
            (err instanceof Error ? err.message : 'Erro ao carregar membros da família.')
          setMembersError(msg)
          setLoadingMembers(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const isCurrentUserAdmin = members.some(
    (m) => m.is_current_user && (m.role === 'admin' || m.role === 'owner')
  )

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return
    setRemovingMember(true)
    setMemberActionMsg(null)
    try {
      const res = await removeFamilyMember(memberToRemove.user_id)
      setMemberActionMsg({
        success: true,
        message: res.message || t('familyModal.memberRemovedSuccess'),
      })
      setMemberToRemove(null)
      await refreshMembers()
    } catch (err: unknown) {
      console.error('Erro ao remover membro:', err)
      const errObj = err as Record<string, unknown> | null
      const msg =
        (typeof errObj?.message === 'string' && errObj.message) ||
        (err instanceof Error ? err.message : 'Erro ao remover membro da família.')
      setMemberActionMsg({
        success: false,
        message: msg,
      })
    } finally {
      setRemovingMember(false)
    }
  }

  // Load family invite code when mounted
  useEffect(() => {
    let isMounted = true

    getFamilyCode(userId)
      .then((code) => {
        if (isMounted) {
          setCurrentCode(code)
          setCodeError(null)
          setLoadingCode(false)
        }
      })
      .catch((err: unknown) => {
        console.error('Erro ao carregar código da família:', err)
        if (isMounted) {
          const errObj = err as Record<string, unknown> | null
          const msg =
            (typeof errObj?.message === 'string' && errObj.message) ||
            (typeof errObj?.error_description === 'string' && errObj.error_description) ||
            (typeof errObj?.details === 'string' && errObj.details) ||
            (err instanceof Error ? err.message : 'Erro ao carregar código da família.')
          setCodeError(msg)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {t('familyModal.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('familyModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Bloco 1: Convidar para a Família */}
          <section className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <QrCode className="w-4 h-4" />
              <h3 className="text-sm font-semibold tracking-wide uppercase">
                {t('familyModal.inviteTitle')}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('familyModal.inviteDesc')}
            </p>

            {loadingCode ? (
              <div className="flex items-center justify-center py-6 bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl">
                <Loader2 className="w-6 h-6 text-emerald-500 dark:text-emerald-400 animate-spin" />
              </div>
            ) : codeError ? (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{t('familyModal.errorCode')}</span>
                </div>
                <p className="font-mono text-[11px] break-words text-rose-700 dark:text-rose-200">
                  {codeError}
                </p>
              </div>
            ) : currentCode ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-100/90 dark:bg-slate-900/90 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 uppercase font-medium">
                    {t('familyModal.code')}:
                  </span>
                  <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
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
                      <span>{t('familyModal.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('familyModal.copyCode')}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
                {t('familyModal.noCode')}
              </div>
            )}
          </section>

          {/* Bloco 2: Membros Conectados */}
          <section className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Users2 className="w-4 h-4" />
                <h3 className="text-sm font-semibold tracking-wide uppercase">
                  {t('familyModal.membersTitle')}
                </h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-mono">
                {members.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('familyModal.membersSubtitle')}
            </p>

            {/* Feedback de remoção */}
            {memberActionMsg && (
              <div
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                  memberActionMsg.success
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}
              >
                {memberActionMsg.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                )}
                <span>{memberActionMsg.message}</span>
              </div>
            )}

            {/* Confirmação inline de remoção */}
            {memberToRemove && (
              <div className="p-4 bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 rounded-xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-rose-800 dark:text-rose-200 uppercase tracking-wide">
                      {t('familyModal.removeConfirmTitle')}
                    </h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed">
                      {t('familyModal.removeConfirmDesc')}
                    </p>
                    <div className="pt-1 text-xs font-medium text-slate-900 dark:text-white">
                      {memberToRemove.full_name || (language === 'es' ? 'Miembro de la Familia' : 'Membro da Família')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={removingMember}
                    onClick={() => setMemberToRemove(null)}
                    className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {t('familyModal.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={removingMember}
                    onClick={handleConfirmRemoveMember}
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-sm shadow-rose-600/30 transition-all disabled:opacity-50"
                  >
                    {removingMember ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('familyModal.removing')}</span>
                      </>
                    ) : (
                      <>
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>{t('familyModal.removeMember')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {loadingMembers ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400 animate-spin" />
              </div>
            ) : membersError ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                {membersError}
              </div>
            ) : members.length === 0 ? (
              <div className="p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 text-xs text-center">
                {t('familyModal.noMembers')}
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const isAdmin = member.role === 'admin' || member.role === 'owner'
                  const initial = (member.full_name?.trim() || '?')[0].toUpperCase()

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isAdmin
                              ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {initial}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {member.full_name || (language === 'es' ? 'Miembro de la Familia' : 'Membro da Família')}
                            </span>
                            {member.is_current_user && (
                              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                ({t('familyModal.you')})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                isAdmin
                                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {isAdmin ? t('familyModal.adminBadge') : t('familyModal.memberBadge')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ação de remover: visível apenas se admin logado e não for a própria linha */}
                      {isCurrentUserAdmin && !member.is_current_user && (
                        <button
                          type="button"
                          onClick={() => setMemberToRemove(member)}
                          className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0"
                          title={t('familyModal.removeMember')}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Divisor */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('familyModal.or')}
            </span>
          </div>

          {/* Bloco 2: Entrar em Outra Família */}
          <section className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Link2 className="w-4 h-4" />
              <h3 className="text-sm font-semibold tracking-wide uppercase">
                {t('familyModal.joinTitle')}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('familyModal.joinDesc')}
            </p>

            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('familyModal.joinLabel')}
                </label>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder={t('familyModal.inputPlaceholder')}
                  maxLength={12}
                  disabled={joining}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono text-center sm:text-left text-sm tracking-widest uppercase placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                />
              </div>

              {/* Feedback messages */}
              {feedback && (
                <div
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                    feedback.success
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {feedback.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
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
                    <span>{t('familyModal.joining')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('familyModal.joinButton')}</span>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
          >
            {t('familyModal.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
