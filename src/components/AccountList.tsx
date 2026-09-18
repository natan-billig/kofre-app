import React, { useState } from 'react'
import type { Wallet, Transaction, ScopeFilterType } from '../lib/types'
import { calculateAccountBalance } from '../lib/accountingService'
import { getCreditCardInvoiceDetails } from '../lib/creditCardService'
import { formatCurrency } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  Banknote,
  Landmark,
  CreditCard,
  PiggyBank,
  Plus,
  ChevronDown,
  ChevronUp,
  Settings,
  Archive,
} from 'lucide-react'

interface AccountListProps {
  wallets: Wallet[]
  transactions: Transaction[]
  currentScope: ScopeFilterType
  onOpenCreateAccount: () => void
  onManageAccount?: (wallet: Wallet) => void
}

export const AccountList: React.FC<AccountListProps> = ({
  wallets,
  transactions,
  currentScope,
  onOpenCreateAccount,
  onManageAccount,
}) => {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const filteredWallets = wallets.filter((w) => w.type === currentScope)

  const activeWallets = filteredWallets.filter((w) => !w.is_archived)
  const archivedWallets = filteredWallets.filter((w) => Boolean(w.is_archived))

  const cashWallets = activeWallets.filter((w) => w.account_type === 'cash')
  const checkingWallets = activeWallets.filter((w) => w.account_type === 'checking')
  const creditWallets = activeWallets.filter((w) => w.account_type === 'credit_card')
  const savingsWallets = activeWallets.filter((w) => w.account_type === 'savings')

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {t('accounts.title')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {activeWallets.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenCreateAccount}
            className="cursor-pointer inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-600/10 hover:bg-indigo-100 dark:hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 transition-all font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('accounts.newAccountButton')}</span>
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="cursor-pointer p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title={collapsed ? 'Expandir lista' : 'Recolher lista'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-4">
          {/* Efetivo */}
          {cashWallets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <Banknote className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>{t('accounts.cash')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {cashWallets.map((w) => {
                  const bal = calculateAccountBalance(w, transactions)
                  return (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {w.name}
                          </span>
                          {w.type === 'shared' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium">
                              {t('nav.family')}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono block">
                          {w.currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(bal, w.currency)}
                        </div>
                        {onManageAccount && (
                          <button
                            type="button"
                            onClick={() => onManageAccount(w)}
                            className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                            title={t('accounts.settings')}
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contas Bancárias */}
          {checkingWallets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 font-medium">
                <Landmark className="w-3.5 h-3.5" />
                <span>{t('accounts.checking')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {checkingWallets.map((w) => {
                  const bal = calculateAccountBalance(w, transactions)
                  const hasOverdraft = w.credit_limit != null && Number(w.credit_limit) > 0
                  const overdraft = hasOverdraft ? Number(w.credit_limit) : 0
                  const isNegative = bal < 0

                  return (
                    <div
                      key={w.id}
                      className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border ${
                        isNegative
                          ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/20 dark:bg-rose-950/10'
                          : 'border-slate-200 dark:border-slate-800/80'
                      } flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all group`}
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {w.name}
                          </span>
                          {w.type === 'shared' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium">
                              {t('nav.family')}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono block">
                          {w.currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right space-y-0.5">
                          <div
                            className={`text-sm font-bold font-mono ${
                              isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {formatCurrency(bal, w.currency)}
                          </div>
                          {hasOverdraft && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>
                                {t('checking.availableWithOverdraft')}:{' '}
                                <strong className="font-semibold text-slate-700 dark:text-slate-300">
                                  {formatCurrency(bal + overdraft, w.currency)}
                                </strong>
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                ({t('checking.overdraftLimitShort')}: {formatCurrency(overdraft, w.currency)})
                              </span>
                            </div>
                          )}
                        </div>
                        {onManageAccount && (
                          <button
                            type="button"
                            onClick={() => onManageAccount(w)}
                            className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                            title={t('accounts.settings')}
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contas Poupança / Reserva de Metas */}
          {savingsWallets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <PiggyBank className="w-3.5 h-3.5" />
                <span>{t('accounts.savings')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {savingsWallets.map((w) => {
                  const bal = calculateAccountBalance(w, transactions)
                  const hasTarget = w.target_amount != null && Number(w.target_amount) > 0
                  const target = hasTarget ? Number(w.target_amount) : 0

                  return (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-500/20 flex items-center justify-between hover:border-amber-300 dark:hover:border-amber-500/40 transition-all group"
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {w.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-semibold">
                            {t('accounts.savingsBadge')}
                          </span>
                          {w.type === 'shared' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium">
                              {t('nav.family')}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-amber-700/70 dark:text-amber-300/70 uppercase font-mono block">
                          {w.currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right space-y-0.5">
                          <div className="text-sm font-bold text-amber-700 dark:text-amber-300 font-mono">
                            {formatCurrency(bal, w.currency)}
                          </div>
                          {hasTarget && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>
                                {t('accounts.targetAmount')}: {formatCurrency(target, w.currency)}
                              </span>
                            </div>
                          )}
                        </div>
                        {onManageAccount && (
                          <button
                            type="button"
                            onClick={() => onManageAccount(w)}
                            className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                            title={t('accounts.settings')}
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cartões de Crédito */}
          {creditWallets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                <span>{t('accounts.credit_card')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {creditWallets.map((w) => {
                  const details = getCreditCardInvoiceDetails(w, transactions)
                  const hasCycleDates = details.closingDay != null || details.dueDay != null

                  return (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-purple-200 dark:border-purple-500/20 flex items-center justify-between hover:border-purple-300 dark:hover:border-purple-500/40 transition-all group"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {w.name}
                          </span>
                          {w.type === 'shared' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium">
                              {t('nav.family')}
                            </span>
                          )}
                        </div>

                        {/* Badge discreto com as datas: "Fecha dia X • Vence dia Y" */}
                        {hasCycleDates && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-medium">
                              {details.closingDay != null && `${t('creditCard.closesDay')} ${details.closingDay}`}
                              {details.closingDay != null && details.dueDay != null && ' • '}
                              {details.dueDay != null && `${t('creditCard.dueOnDay')} ${details.dueDay}`}
                            </span>
                          </div>
                        )}

                        <span className="text-xs text-purple-600 dark:text-purple-300/80 uppercase font-mono block">
                          {t('creditCard.currentInvoice')}: {w.currency}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right space-y-0.5">
                          {/* Fatura Atual destacada */}
                          <div className="text-sm font-bold text-purple-700 dark:text-purple-300 font-mono">
                            {formatCurrency(details.currentInvoiceAmount, w.currency)}
                          </div>

                          {/* Próxima Fatura se houver compras pós-fechamento */}
                          {details.nextInvoiceAmount > 0 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium font-mono">
                              <span className="text-slate-400 dark:text-slate-500">{t('creditCard.nextInvoice')}:</span>{' '}
                              <span className="text-slate-700 dark:text-slate-300">
                                {formatCurrency(details.nextInvoiceAmount, w.currency)}
                              </span>
                            </div>
                          )}

                          {w.credit_limit && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              {t('dashboard.availableLimit')}:{' '}
                              {formatCurrency(Math.max(0, Number(w.credit_limit) - details.totalDebt), w.currency)}
                            </div>
                          )}
                        </div>

                        {onManageAccount && (
                          <button
                            type="button"
                            onClick={() => onManageAccount(w)}
                            className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                            title={t('accounts.settings')}
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeWallets.length === 0 && (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
              {t('accounts.empty')}
            </div>
          )}

          {/* Seção Contas Arquivadas */}
          {archivedWallets.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors"
              >
                <Archive className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>{t('accounts.archived')} ({archivedWallets.length})</span>
                {showArchived ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showArchived && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 mt-2">
                  {archivedWallets.map((w) => {
                    const bal = calculateAccountBalance(w, transactions)
                    return (
                      <div
                        key={w.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between opacity-75 hover:opacity-100 transition-all"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-300 line-through">
                              {w.name}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-medium">
                              {t('manageAccount.archivedBadge')}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 dark:text-slate-500 uppercase font-mono">
                            {w.currency}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {formatCurrency(bal, w.currency)}
                          </div>
                          {onManageAccount && (
                            <button
                              type="button"
                              onClick={() => onManageAccount(w)}
                              className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                              title={t('accounts.settings')}
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
