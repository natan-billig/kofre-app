import React from 'react'
import { supabase } from '../lib/supabase'
import { ShieldCheck, LogOut, PlusCircle, Users2, Sun, Moon } from 'lucide-react'
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
  onSignOut: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  userEmail,
  userName,
  userAvatar,
  onOpenCreateAccount,
  onOpenFamilySettings,
  onOpenProfile,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Kofre</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {t('nav.subtitle')}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Language Switcher PT | ES */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950/60 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setLanguage('pt')}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'pt'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Português"
            >
              PT
            </button>
            <button
              type="button"
              onClick={() => setLanguage('es')}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'es'
                  ? 'bg-indigo-600 text-white shadow-sm'
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
