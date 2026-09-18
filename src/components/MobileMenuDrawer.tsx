import React, { useEffect } from 'react'
import {
  X,
  PlusCircle,
  CalendarCheck,
  HandCoins,
  Users2,
  Sun,
  Moon,
  Calendar,
  Sparkles,
  Compass,
  LogOut,
  User,
  MessageCircle,
} from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { useTheme } from '../lib/theme'
import { AvatarRenderer, getAvatarColor } from '../lib/avatarHelper'
import { CURRENT_APP_VERSION } from '../data/changelog'

interface MobileMenuDrawerProps {
  isOpen: boolean
  onClose: () => void
  userEmail?: string | null
  userName?: string | null
  userAvatar?: string | null
  unseenCount?: number
  onOpenProfile: () => void
  onOpenCreateAccount: () => void
  onOpenRecurringBills: () => void
  onOpenDebts: () => void
  onOpenFamilySettings: () => void
  onOpenWhatsNew: () => void
  onOpenOnboardingTour: () => void
  onSignOut: () => void
}

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  userEmail,
  userName,
  userAvatar,
  unseenCount = 0,
  onOpenProfile,
  onOpenCreateAccount,
  onOpenRecurringBills,
  onOpenDebts,
  onOpenFamilySettings,
  onOpenWhatsNew,
  onOpenOnboardingTour,
  onSignOut,
}) => {
  const { t, language, setLanguage } = useTranslation()
  const { theme, setTheme } = useTheme()

  // Prevenir scroll do body enquanto a gaveta estiver aberta
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const displayName = userName || userEmail?.split('@')[0] || t('nav.user')
  const avatarColor = getAvatarColor(userAvatar)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside className="relative w-full max-w-xs sm:max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full z-10 overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header do Utilizador */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm flex-shrink-0 ${avatarColor}`}
            >
              <AvatarRenderer avatarId={userAvatar} className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {t('mobileMenu.freePlan')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {userEmail || 'usuario@kofre.app'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title={t('common.close') || 'Fechar'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Seção 1: Atalhos Financeiros */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              {t('mobileMenu.financialShortcuts')}
            </span>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenCreateAccount()
                }}
                className="w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <span>{t('nav.newAccountTitle')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenRecurringBills()
                }}
                className="w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <span>{t('mobileMenu.fixedBills')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenDebts()
                }}
                className="w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                  <HandCoins className="w-4 h-4" />
                </div>
                <span>{t('mobileMenu.debtsAndLoans')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenFamilySettings()
                }}
                className="w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Users2 className="w-4 h-4" />
                </div>
                <span>{t('nav.familyTitle')}</span>
              </button>
            </div>
          </div>

          {/* Seção 2: Preferências Rápidas */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              {t('mobileMenu.quickPreferences')}
            </span>

            {/* Alternador de Idioma */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 px-1">
                {language === 'es' ? 'Idioma' : 'Idioma'}
              </span>
              <div className="flex bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setLanguage('pt')}
                  className={`cursor-pointer px-3 py-1 rounded-md transition-all ${
                    language === 'pt'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  PT
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('es')}
                  className={`cursor-pointer px-3 py-1 rounded-md transition-all ${
                    language === 'es'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  ES
                </button>
              </div>
            </div>

            {/* Alternador de Tema */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 px-1">
                {t('theme.title')}
              </span>
              <div className="flex bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                    theme === 'light'
                      ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>{t('theme.light')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                    theme === 'dark'
                      ? 'bg-white dark:bg-slate-800 text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>{t('theme.dark')}</span>
                </button>
              </div>
            </div>

            {/* Início do Mês Orçamental */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenProfile()
              }}
              className="w-full cursor-pointer flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span>{t('profile.budgetStartDay')}</span>
              </div>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                {t('profile.editTitle')} ➔
              </span>
            </button>
          </div>

          {/* Seção 3: Apoio & Histórico */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              {t('mobileMenu.supportAndHistory')}
            </span>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenWhatsNew()
                }}
                className="w-full cursor-pointer flex items-center justify-between px-3 py-2 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span>{t('nav.whatsNew')}</span>
                </div>
                {unseenCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold animate-pulse">
                    {unseenCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenOnboardingTour()
                }}
                className="w-full cursor-pointer flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <span>{t('profile.quickGuideTitle')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenProfile()
                }}
                className="w-full cursor-pointer flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <span>{t('profile.title')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé da Gaveta */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-semibold">Kofre v{CURRENT_APP_VERSION}</span>
            <a
              href="https://wa.me/595994195695"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
              title="WhatsApp: +595 994 195695"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Natan Billig</span>
            </a>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose()
              onSignOut()
            }}
            className="w-full cursor-pointer py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('nav.signOut')}</span>
          </button>
        </div>
      </aside>
    </div>
  )
}
