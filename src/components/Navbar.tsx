import React from 'react'
import { supabase } from '../lib/supabase'
import { ShieldCheck, LogOut, PlusCircle, Users2, Sun, Moon, Sparkles } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { useTheme } from '../lib/theme'
import { AvatarRenderer, getAvatarColor } from '../lib/avatarHelper'

interface NavbarProps {
  userEmail?: string | null
  userName?: string | null
  userAvatar?: string | null
  onOpenCreateAccount: () => void
  onOpenFamilySettings: () => void
  onOpenProfile: () => void
  onOpenWhatsNew?: () => void
  hasUnreadWhatsNew?: boolean
  unseenCount?: number
  onSignOut: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  userEmail,
  userName,
  userAvatar,
  onOpenCreateAccount,
  onOpenFamilySettings,
  onOpenProfile,
  onOpenWhatsNew,
  hasUnreadWhatsNew,
  unseenCount,
  onSignOut,
}) => {
  const { t, language, setLanguage } = useTranslation()
  const { isDark, toggleTheme } = useTheme()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onSignOut()
  }

  const displayName = userName || userEmail?.split('@')[0] || t('nav.user')
  const avatarColor = getAvatarColor(userAvatar)

  return (
    <header className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors duration-200">
      <div className="max-w-[1680px] mx-auto px-4 lg:px-8 xl:px-12 py-3 flex items-center justify-between">
        {/* Brand */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="cursor-pointer flex items-center gap-2.5 group text-left focus:outline-none"
          title="Kofre"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            Kofre
          </span>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Language Switcher PT | ES */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLanguage('pt')}
              className={`cursor-pointer px-2 py-0.5 rounded-lg transition-all ${
                language === 'pt'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Português"
            >
              PT
            </button>
            <button
              type="button"
              onClick={() => setLanguage('es')}
              className={`cursor-pointer px-2 py-0.5 rounded-lg transition-all ${
                language === 'es'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Español"
            >
              ES
            </button>
          </div>

          {/* Theme Quick Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="cursor-pointer p-1.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 transition-all active:scale-95 flex items-center justify-center"
            title={isDark ? t('theme.light') : t('theme.dark')}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* What's New / Changelog Button */}
          {onOpenWhatsNew && (
            <button
              type="button"
              onClick={onOpenWhatsNew}
              className="relative cursor-pointer p-1.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-800 transition-all active:scale-95 flex items-center justify-center"
              title={language === 'es' ? 'Novedades de Kofre' : 'Novidades do Kofre'}
              aria-label="Novidades"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              {unseenCount !== undefined ? (
                unseenCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
                    {unseenCount}
                  </span>
                )
              ) : hasUnreadWhatsNew ? (
                <>
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900" />
                </>
              ) : null}
            </button>
          )}

          {/* Family Sharing Modal Button */}
          <button
            onClick={onOpenFamilySettings}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-200 transition-all"
            title={t('nav.familyTitle')}
          >
            <Users2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span className="hidden xs:inline sm:inline">{t('nav.family')}</span>
          </button>

          <button
            onClick={onOpenCreateAccount}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all"
            title={t('nav.newAccountTitle')}
          >
            <PlusCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span className="hidden sm:inline">{t('nav.newAccount')}</span>
          </button>

          {/* User Profile Button */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="cursor-pointer flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-950/40 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs transition-all active:scale-95"
            title={t('profile.title')}
          >
            <div className={`w-5 h-5 rounded-lg flex items-center justify-center border ${avatarColor}`}>
              <AvatarRenderer avatarId={userAvatar} className="w-3.5 h-3.5" />
            </div>
            <span className="hidden sm:inline-block font-medium max-w-[130px] truncate" title={displayName}>
              {displayName}
            </span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="cursor-pointer p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 transition-all"
            title={t('nav.signOut')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
