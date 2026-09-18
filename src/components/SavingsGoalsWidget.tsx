import React, { useState } from 'react'
import type { Wallet, Transaction, ScopeFilterType } from '../lib/types'
import { calculateAccountBalance } from '../lib/accountingService'
import { formatCurrency } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { PiggyBank, ArrowRightLeft, Sparkles, ChevronDown, ChevronUp, Settings } from 'lucide-react'

interface SavingsGoalsWidgetProps {
  wallets: Wallet[]
  transactions: Transaction[]
  currentScope: ScopeFilterType
  onSaveMoney: (savingsWallet: Wallet) => void
  onManageAccount?: (savingsWallet: Wallet) => void
}

export const SavingsGoalsWidget: React.FC<SavingsGoalsWidgetProps> = ({
  wallets,
  transactions,
  currentScope,
  onSaveMoney,
  onManageAccount,
}) => {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  const savingsWallets = wallets.filter(
    (w) => w.type === currentScope && w.account_type === 'savings' && !w.is_archived
  )

  // Condição de Exibição: Montar no layout apenas se houver pelo menos uma conta poupança ativa no escopo
  if (savingsWallets.length === 0) {
    return null
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-500/20 p-4 sm:p-5 space-y-4 shadow-sm transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <PiggyBank className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('savings.title')}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {savingsWallets.length} {savingsWallets.length === 1 ? 'meta ativa' : 'metas ativas'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="cursor-pointer p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title={collapsed ? 'Expandir metas' : 'Recolher metas'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 gap-3">
          {savingsWallets.map((w) => {
            const bal = calculateAccountBalance(w, transactions)
            const target = w.target_amount != null && Number(w.target_amount) > 0 ? Number(w.target_amount) : 0
            const hasTarget = target > 0
            const pct = hasTarget ? Math.min(100, Math.max(0, (bal / target) * 100)) : 0
            const isGoalReached = hasTarget && bal >= target

            return (
              <div
                key={w.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-amber-100/30 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20 border border-amber-200/80 dark:border-amber-500/20 shadow-sm space-y-3"
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                        {w.name}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-mono">
                        {w.currency}
                      </span>
                      {w.type === 'shared' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 font-medium">
                          {t('nav.family')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações: Configurações */}
                  {onManageAccount && (
                    <button
                      type="button"
                      onClick={() => onManageAccount(w)}
                      className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-amber-100/60 dark:hover:bg-slate-800 transition-colors"
                      title={t('accounts.settings')}
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Valores: Saldo vs Meta */}
                <div className="flex items-baseline justify-between flex-wrap gap-1">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Saldo Acumulado
                    </span>
                    <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-mono">
                      {formatCurrency(bal, w.currency)}
                    </div>
                  </div>

                  {hasTarget ? (
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                        {t('savings.targetAmountShort')}
                      </span>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 font-mono">
                        {formatCurrency(target, w.currency)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      {t('savings.noGoal')}
                    </span>
                  )}
                </div>

                {/* Barra de Progresso e Badge de Meta Atingida */}
                {hasTarget && (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700/60">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500 shadow-sm"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-400 font-mono">
                        {pct.toFixed(0)}% concluído
                      </span>
                      {isGoalReached && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold text-[11px]">
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                          <span>{t('savings.goalReached')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Botão de Atalho "Guardar Dinheiro" */}
                <div className="pt-2 border-t border-amber-200/50 dark:border-slate-800/80 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onSaveMoney(w)}
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>{t('savings.saveMoney')}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
