import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, CurrencyCode } from '../lib/types'
import type { UserIdentity } from '@supabase/supabase-js'
import { updateUserProfile } from '../lib/profileService'
import {
  getUserIdentities,
  linkGoogleAccount,
  unlinkGoogleAccount,
} from '../lib/authService'
import { AVATAR_OPTIONS, AvatarRenderer } from '../lib/avatarHelper'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { useTheme } from '../lib/theme'
import {
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  User,
  Coins,
  LogOut,
  Save,
  Link2,
  Unlink,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react'

interface ProfileModalProps {
  isOpen: boolean
  userId: string
  userEmail?: string | null
  currentProfile: Profile | null
  onClose: () => void
  onProfileUpdated: (updatedProfile: Profile) => void
  onSignOut: () => void
}

const ProfileModalForm: React.FC<ProfileModalProps> = ({
  userId,
  userEmail,
  currentProfile,
  onClose,
  onProfileUpdated,
  onSignOut,
}) => {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  const [fullName, setFullName] = useState(currentProfile?.full_name || '')
  const [avatar, setAvatar] = useState(currentProfile?.avatar || 'user')
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>(
    currentProfile?.preferred_currency || 'PYG'
  )

  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [loadingIdentities, setLoadingIdentities] = useState(true)
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false)
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false)

  const refreshIdentities = async () => {
    setLoadingIdentities(true)
    try {
      const list = await getUserIdentities()
      setIdentities(list)
    } catch (e) {
      console.error('Error fetching user identities:', e)
    } finally {
      setLoadingIdentities(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    getUserIdentities()
      .then((list) => {
        if (isMounted) {
          setIdentities(list)
          setLoadingIdentities(false)
        }
      })
      .catch((e) => {
        console.error('Error fetching user identities:', e)
        if (isMounted) setLoadingIdentities(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const googleIdentity = identities.find((id) => id.provider === 'google')
  const hasGoogle = !!googleIdentity

  const handleLinkGoogle = async () => {
    setErrorMsg(null)
    setIsLinkingGoogle(true)
    try {
      await linkGoogleAccount()
    } catch (err: unknown) {
      console.error('Erro ao vincular Google:', err)
      const errObj = err as Record<string, unknown> | null
      const msg =
        (typeof errObj?.message === 'string' && errObj.message) ||
        (typeof errObj?.error_description === 'string' && errObj.error_description) ||
        t('profile.linkGoogleError')
      setErrorMsg(msg)
      setIsLinkingGoogle(false)
    }
  }

  const handleUnlinkGoogle = async () => {
    if (!googleIdentity) return
    if (identities.length <= 1) return
    if (!window.confirm(t('profile.unlinkConfirm'))) return

    setErrorMsg(null)
    setIsUnlinkingGoogle(true)
    try {
      await unlinkGoogleAccount(googleIdentity)
      setSuccessMsg(t('profile.unlinkSuccess'))
      await refreshIdentities()
      setTimeout(() => {
        setSuccessMsg(null)
      }, 3000)
    } catch (err: unknown) {
      console.error('Erro ao desvincular Google:', err)
      const errObj = err as Record<string, unknown> | null
      const msg =
        (typeof errObj?.message === 'string' && errObj.message) ||
        (typeof errObj?.error_description === 'string' && errObj.error_description) ||
        t('profile.error')
      setErrorMsg(msg)
    } finally {
      setIsUnlinkingGoogle(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const trimmedName = fullName.trim()
    if (!trimmedName) {
      setErrorMsg(t('auth.fillName'))
      return
    }

    setIsSaving(true)
    try {
      // Obter o userId diretamente da sessão ativa do Supabase para garantir compatibilidade estrita com RLS (auth.uid() = id)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const activeUserId = user?.id || userId

      if (!activeUserId) {
        throw new Error('Sessão expirada ou usuário não autenticado.')
      }

      const updated = await updateUserProfile(activeUserId, {
        full_name: trimmedName,
        avatar,
        preferred_currency: preferredCurrency,
      })

      onProfileUpdated(updated)
      setSuccessMsg(t('profile.success'))
      setTimeout(() => {
        setSuccessMsg(null)
      }, 3000)
    } catch (err: unknown) {
      console.error('Erro ao atualizar perfil:', err)
      const errObj = err as Record<string, unknown> | null
      const msg =
        (typeof errObj?.message === 'string' && errObj.message) ||
        (typeof errObj?.error_description === 'string' && errObj.error_description) ||
        (err instanceof Error ? err.message : t('profile.error'))
      setErrorMsg(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-colors">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <AvatarRenderer avatarId={avatar} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {t('profile.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('profile.editTitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Messages */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start justify-between gap-2 text-rose-400 text-xs font-medium">
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed break-words">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-400/70 hover:text-rose-300 p-0.5 rounded cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* E-mail (Read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>{t('profile.email')}</span>
            </label>
            <input
              type="email"
              value={userEmail || ''}
              disabled
              readOnly
              className="w-full bg-slate-100/80 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/60 rounded-xl px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>{t('profile.fullName')}</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('profile.fullNamePlaceholder')}
              required
              className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Avatar Selector Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>{t('profile.avatar')}</span>
            </label>
            <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
              {AVATAR_OPTIONS.map((opt) => {
                const IconComp = opt.icon
                const isSelected = avatar === opt.id

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAvatar(opt.id)}
                    className={`cursor-pointer relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-indigo-600/15 dark:bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/40 text-indigo-600 dark:text-indigo-300 shadow-md shadow-indigo-950/20 scale-105'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                    title={opt.label}
                  >
                    <IconComp className="w-5 h-5 mb-1" />
                    <span className="text-xs font-medium truncate w-full text-center">
                      {opt.label}
                    </span>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preferred Currency Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>{t('profile.preferredCurrency')}</span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {(['PYG', 'USD', 'BRL'] as CurrencyCode[]).map((cur) => {
                const isSelected = preferredCurrency === cur
                const label =
                  cur === 'PYG' ? '₲ Guaraní' : cur === 'USD' ? '$ Dólar' : 'R$ Real'

                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setPreferredCurrency(cur)}
                    className={`cursor-pointer py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-emerald-600/15 dark:bg-emerald-600/20 border-emerald-500 ring-2 ring-emerald-500/40 text-emerald-600 dark:text-emerald-300 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="text-sm font-bold">{cur}</span>
                    <span className="text-xs opacity-75 font-medium">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Theme Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('theme.title')}</span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                {
                  mode: 'light' as const,
                  label: t('theme.light'),
                  icon: Sun,
                  activeClass:
                    'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40 text-amber-600 dark:text-amber-400 shadow-md',
                },
                {
                  mode: 'dark' as const,
                  label: t('theme.dark'),
                  icon: Moon,
                  activeClass:
                    'bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/40 text-indigo-600 dark:text-indigo-300 shadow-md',
                },
                {
                  mode: 'system' as const,
                  label: t('theme.system'),
                  icon: Laptop,
                  activeClass:
                    'bg-emerald-600/20 border-emerald-500 ring-2 ring-emerald-500/40 text-emerald-600 dark:text-emerald-300 shadow-md',
                },
              ].map((item) => {
                const isSelected = theme === item.mode
                const IconComp = item.icon

                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => setTheme(item.mode)}
                    className={`cursor-pointer py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? item.activeClass
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <IconComp className="w-4 h-4 mb-0.5" />
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Connected Accounts / Contas Conectadas */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>{t('profile.connectedAccounts')}</span>
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <div>
                  <p className="text-xs font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    Google
                    {hasGoogle && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('profile.googleConnected')}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {hasGoogle
                      ? (googleIdentity?.identity_data?.email as string) ||
                        userEmail ||
                        t('profile.googleConnected')
                      : t('profile.linkGoogleDesc')}
                  </p>
                </div>
              </div>

              {loadingIdentities ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500 shrink-0" />
              ) : hasGoogle ? (
                identities.length > 1 && (
                  <button
                    type="button"
                    disabled={isUnlinkingGoogle}
                    onClick={handleUnlinkGoogle}
                    className="cursor-pointer text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 shrink-0"
                  >
                    {isUnlinkingGoogle ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Unlink className="w-3.5 h-3.5" />
                    )}
                    <span>{t('profile.unlink')}</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  disabled={isLinkingGoogle}
                  onClick={handleLinkGoogle}
                  className="cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {isLinkingGoogle ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  <span>{t('profile.connectGoogle')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            {/* Sign Out secondary button */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onSignOut()
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('profile.signOut')}</span>
            </button>

            {/* Save button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors"
              >
                {t('transactions.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/20 transition-all active:scale-95"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSaving ? t('profile.saving') : t('profile.saveChanges')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export const ProfileModal: React.FC<ProfileModalProps> = (props) => {
  if (!props.isOpen) return null

  const formKey = `${props.userId}-${props.currentProfile?.full_name || ''}-${props.currentProfile?.avatar || ''}-${props.currentProfile?.preferred_currency || ''}`

  return <ProfileModalForm key={formKey} {...props} />
}
