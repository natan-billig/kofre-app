import React from 'react'
import { supabase } from '../lib/supabase'
import { ShieldCheck, LogOut, PlusCircle, Users2, Sun, Moon, Sparkles, Coins, ClipboardPaste, Calendar } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { useTheme } from '../lib/theme'
import { AvatarRenderer, getAvatarColor } from '../lib/avatarHelper'
import type { ScopeFilterType } from '../lib/types'

interface NavbarProps {
  userEmail?: string | null
  userName?: string | null
  userAvatar?: string | null
  currentScope?: ScopeFilterType
  onScopeChange?: (scope: ScopeFilterType) => void
  onOpenCreateAccount: () => void
  onOpenFamilySettings: () => void
  onOpenProfile: () => void
  onOpenRecurringBills?: () => void
  onOpenWhatsNew?: () => void
  hasUnreadWhatsNew?: boolean
  unseenCount?: number
  onOpenMobileMenu?: () => void
  onOpenCurrencyExchange?: () => void
  onOpenSplitBill?: () => void
  onOpenNotificationParser?: () => void
  onSignOut: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  userEmail,
  userName,
  userAvatar,
  currentScope = 'personal',
  onScopeChange,
  onOpenCreateAccount,
  onOpenFamilySettings,
  onOpenProfile,
  onOpenRecurringBills,
  onOpenWhatsNew,
  hasUnreadWhatsNew,
  unseenCount,
  onOpenMobileMenu,
  onOpenCurrencyExchange,
  onOpenSplitBill,
  onOpenNotificationParser,
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
    <header className="sticky top-0 z-40 w-full transition-all duration-200 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm">
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

        {/* Mobile Center: Compact Scope Switcher [ 👤 Pessoal | 👥 Família ] */}
        {onScopeChange && (
          <div className="flex md:hidden items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold shadow-xs">
            <button
              type="button"
              onClick={() => onScopeChange('personal')}
              className={`cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                currentScope === 'personal'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>👤</span>
              <span>{language === 'es' ? 'Personal' : 'Pessoal'}</span>
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('shared')}
              className={`cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                currentScope === 'shared'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>👥</span>
              <span>{language === 'es' ? 'Familia' : 'Família'}</span>
            </button>
          </div>
        )}

        {/* Mobile-Only Avatar Button (Opens MobileMenuDrawer) */}
        <div className="flex md:hidden items-center">
          <button
            type="button"
            onClick={onOpenMobileMenu || onOpenProfile}
            className="relative cursor-pointer p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 active:scale-95 transition-transform"
            aria-label="Abrir Menu"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${avatarColor}`}>
              <AvatarRenderer avatarId={userAvatar} className="w-5 h-5" />
            </div>
            {unseenCount !== undefined && unseenCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
                {unseenCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop-Only Actions (>= md) */}
        <div className="hidden md:flex items-center gap-2 sm:gap-2.5">
          {/* Language Switcher PT | ES */}
          <div className="flex items-center h-10 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLanguage('pt')}
              className={`cursor-pointer h-full px-2 py-0.5 rounded-lg transition-all ${
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
              className={`cursor-pointer h-full px-2 py-0.5 rounded-lg transition-all ${
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
            className="cursor-pointer h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-950/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 transition-all active:scale-95 flex items-center justify-center"
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
              className="relative cursor-pointer h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-950/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-800 transition-all active:scale-95 flex items-center justify-center"
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

          {/* Quick Tools in Desktop Navbar (Ergonomic h-10 buttons with legible text & icons) */}
          {onOpenNotificationParser && (
            <button
              type="button"
              onClick={onOpenNotificationParser}
              className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-all active:scale-95 shadow-xs"
              title={language === 'es' ? 'Leer Notificación Bancaria' : 'Ler Notificação Bancária'}
            >
              <ClipboardPaste className="w-4 h-4 text-indigo-500" />
              <span>{language === 'es' ? 'Notificación' : 'Notificação'}</span>
            </button>
          )}

          {onOpenCurrencyExchange && (
            <button
              type="button"
              onClick={onOpenCurrencyExchange}
              className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-all active:scale-95 shadow-xs"
              title={language === 'es' ? 'Simulador de Cambio' : 'Simulador de Câmbio'}
            >
              <Coins className="w-4 h-4 text-amber-500" />
              <span>{language === 'es' ? 'Cambio' : 'Câmbio'}</span>
            </button>
          )}

          {onOpenSplitBill && (
            <button
              type="button"
              onClick={onOpenSplitBill}
              className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-all active:scale-95 shadow-xs"
              title={language === 'es' ? 'Dividir Cuenta (Vaca)' : 'Dividir Conta (Racha)'}
            >
              <span className="text-sm leading-none">🍕</span>
              <span>{language === 'es' ? 'Dividir Cuenta' : 'Dividir Conta'}</span>
            </button>
          )}

          {onOpenRecurringBills && (
            <button
              type="button"
              onClick={onOpenRecurringBills}
              className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-all active:scale-95 shadow-xs"
              title={language === 'es' ? 'Gastos Fijos Recurrentes' : 'Gastos Fixos Recorrentes'}
            >
              <Calendar className="w-4 h-4 text-purple-500" />
              <span>{language === 'es' ? 'Gastos Fijos' : 'Gastos Fixos'}</span>
            </button>
          )}

          {/* Family Sharing Modal Button */}
          <button
            onClick={onOpenFamilySettings}
            className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-200 transition-all shadow-xs"
            title={t('nav.familyTitle')}
          >
            <Users2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span className="hidden xs:inline sm:inline">{t('nav.family')}</span>
          </button>

          <button
            onClick={onOpenCreateAccount}
            className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs"
            title={t('nav.newAccountTitle')}
          >
            <PlusCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span className="hidden sm:inline">{t('nav.newAccount')}</span>
          </button>

          {/* User Profile Button */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="cursor-pointer flex items-center gap-2 h-10 px-3 rounded-xl bg-slate-100/80 dark:bg-slate-950/40 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs transition-all active:scale-95 shadow-xs"
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
            className="cursor-pointer h-10 w-10 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 transition-all flex items-center justify-center"
            title={t('nav.signOut')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
