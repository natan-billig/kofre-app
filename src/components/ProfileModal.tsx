import React, { useState } from 'react'
import type { Profile, CurrencyCode } from '../lib/types'
import { updateUserProfile } from '../lib/profileService'
import { AVATAR_OPTIONS, AvatarRenderer } from '../lib/avatarHelper'
import { useTranslation } from '../lib/i18n/LanguageContext'
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

  const [fullName, setFullName] = useState(currentProfile?.full_name || '')
  const [avatar, setAvatar] = useState(currentProfile?.avatar || 'user')
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>(
    currentProfile?.preferred_currency || 'PYG'
  )

  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

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
      const updated = await updateUserProfile(userId, {
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
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('profile.error')
      setErrorMsg(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-slate-900/95 border border-slate-800/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <AvatarRenderer avatarId={avatar} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {t('profile.title')}
              </h2>
              <p className="text-xs text-slate-400">{t('profile.editTitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/50 transition-colors"
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
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-400/70 hover:text-rose-300 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* E-mail (Read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('profile.email')}</span>
            </label>
            <input
              type="email"
              value={userEmail || ''}
              disabled
              readOnly
              className="w-full bg-slate-950/40 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed select-none"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('profile.fullName')}</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('profile.fullNamePlaceholder')}
              required
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-colors"
            />
          </div>

          {/* Avatar Selector Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
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
                        ? 'bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/40 text-indigo-300 shadow-md shadow-indigo-950/40 scale-105'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                    title={opt.label}
                  >
                    <IconComp className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-medium truncate w-full text-center">
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
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
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
                        ? 'bg-emerald-600/20 border-emerald-500 ring-2 ring-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-950/40'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="text-sm font-bold">{cur}</span>
                    <span className="text-[10px] opacity-75 font-normal">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {/* Sign Out secondary button */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onSignOut()
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('profile.signOut')}</span>
            </button>

            {/* Save button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                {t('transactions.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
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
