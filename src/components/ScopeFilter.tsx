import React from 'react'
import type { ScopeFilterType } from '../lib/types'
import { User, Users2 } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'

interface ScopeFilterProps {
  currentScope: ScopeFilterType
  onSelectScope: (scope: ScopeFilterType) => void
  personalCount: number
  sharedCount: number
  onOpenFamilySettings?: () => void
}

export const ScopeFilter: React.FC<ScopeFilterProps> = ({
  currentScope,
  onSelectScope,
  personalCount,
  sharedCount,
  onOpenFamilySettings,
}) => {
  const { t } = useTranslation()

  return (
    <div className="w-full">
      <div className="flex rounded-2xl bg-white dark:bg-slate-900/90 p-1.5 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <button
          type="button"
          onClick={() => onSelectScope('personal')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            currentScope === 'personal'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>{t('scope.myAccounts')}</span>
          <span
            className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
              currentScope === 'personal'
                ? 'bg-indigo-700/80 text-indigo-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {personalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectScope('shared')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            currentScope === 'shared'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users2 className="w-3.5 h-3.5" />
          <span>{t('scope.familyBox')}</span>
          <span
            className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
              currentScope === 'shared'
                ? 'bg-emerald-700/80 text-emerald-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {sharedCount}
          </span>
        </button>
      </div>

      {currentScope === 'shared' && onOpenFamilySettings && (
        <div className="mt-2.5 flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Users2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{t('scope.sharedBanner')}</span>
          </div>
          <button
            type="button"
            onClick={onOpenFamilySettings}
            className="cursor-pointer font-semibold underline underline-offset-2 hover:text-emerald-900 dark:hover:text-white transition-colors"
          >
            {t('scope.manageInvite')}
          </button>
        </div>
      )}
    </div>
  )
}
