import React, { useState } from 'react'
import type { DebtItem, Wallet, WalletScope } from '../lib/types'
import { settleDebt, deleteDebt } from '../lib/debtService'
import { formatCurrency, formatDate } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  HandCoins,
  TrendingDown,
  TrendingUp,
  Plus,
  CheckCircle2,
  Trash2,
  Calendar,
  Loader2,
  X,
  CreditCard,
  Users,
} from 'lucide-react'

interface DebtsWidgetProps {
  debts: DebtItem[]
  wallets: Wallet[]
  currentScope: WalletScope | 'all'
  onOpenCreateDebt: () => void
  onDebtChanged: () => void
}

export const DebtsWidget: React.FC<DebtsWidgetProps> = ({
  debts,
  wallets,
  currentScope,
  onOpenCreateDebt,
  onDebtChanged,
}) => {
  const { t, language } = useTranslation()

  const [activeTab, setActiveTab] = useState<'pending' | 'settled'>('pending')
  const [settlingDebt, setSettlingDebt] = useState<DebtItem | null>(null)
  const [selectedWalletId, setSelectedWalletId] = useState<string>('')
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter debts by current scope
  const scopedDebts = debts.filter((debt) => {
    if (currentScope === 'all') return true
    return debt.scope === currentScope
  })

  const pendingDebts = scopedDebts.filter((d) => d.status === 'pending')
  const settledDebts = scopedDebts.filter((d) => d.status === 'settled')

  const displayedDebts = activeTab === 'pending' ? pendingDebts : settledDebts

  const activeWallets = wallets.filter((w) => !w.is_archived)

  const handleOpenSettle = (debt: DebtItem) => {
    setSettlingDebt(debt)
    // Find matching wallet with same currency if any
    const matchingWallet = activeWallets.find((w) => w.currency === debt.currency)
    setSelectedWalletId(matchingWallet?.id || '')
  }

  const handleConfirmSettle = async () => {
    if (!settlingDebt) return
    setIsSubmittingSettle(true)
    try {
      await settleDebt(
        settlingDebt.id,
        selectedWalletId ? selectedWalletId : undefined
      )
      setSettlingDebt(null)
      onDebtChanged()
    } catch (err) {
      console.error('Erro ao liquidar dívida:', err)
    } finally {
      setIsSubmittingSettle(false)
    }
  }

  const handleDelete = async (debtId: string) => {
    setIsDeleting(true)
    try {
      await deleteDebt(debtId)
      setDeletingId(null)
      onDebtChanged()
    } catch (err) {
      console.error('Erro ao excluir dívida:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-500 dark:text-violet-400">
            <HandCoins className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {t('debts.title')}
          </h2>
          {pendingDebts.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25 font-semibold">
              {pendingDebts.length}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenCreateDebt}
          className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-medium rounded-xl shadow-sm shadow-violet-950/40 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('debts.newDebt')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <span>{t('debts.pending')}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-medium">
            {pendingDebts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settled')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'settled'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <span>{t('debts.settled')}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-medium">
            {settledDebts.length}
          </span>
        </button>
      </div>

      {/* Debts List */}
      {displayedDebts.length === 0 ? (
        <div className="text-center py-6 px-4 border border-dashed border-slate-200 dark:border-slate-800/70 rounded-2xl">
          <HandCoins className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            {activeTab === 'pending' ? t('debts.emptyPending') : t('debts.emptySettled')}
          </p>
          {activeTab === 'pending' && (
            <button
              type="button"
              onClick={onOpenCreateDebt}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 dark:bg-violet-600/20 dark:hover:bg-violet-600/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('debts.newDebt')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayedDebts.map((debt) => {
            const isIOwe = debt.type === 'i_owe'
            const formattedVal = formatCurrency(debt.amount, debt.currency)
            const isConfirmingDelete = deletingId === debt.id

            return (
              <div
                key={debt.id}
                className={`group border rounded-2xl p-3 transition-all ${
                  isIOwe
                    ? 'bg-amber-50/70 hover:bg-amber-100/50 dark:bg-amber-950/10 dark:hover:bg-amber-950/20 border-amber-200 dark:border-amber-500/20'
                    : 'bg-emerald-50/70 hover:bg-emerald-100/50 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  {/* Left: Direction & Main Info */}
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isIOwe
                          ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                          : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                      }`}
                    >
                      {isIOwe ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : (
                        <TrendingUp className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                        {isIOwe ? (
                          <span>
                            {t('debts.youOwe')
                              .replace('{amount}', formattedVal)
                              .replace('{name}', debt.contact_name)}
                          </span>
                        ) : (
                          <span>
                            {t('debts.owesYou')
                              .replace('{amount}', formattedVal)
                              .replace('{name}', debt.contact_name)}
                          </span>
                        )}
                      </div>

                      {debt.description && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                          {debt.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                        {debt.due_date && (
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {t('debts.dueDate')}: {formatDate(debt.due_date, language)}
                            </span>
                          </span>
                        )}

                        {debt.scope === 'shared' && (
                          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                            <Users className="w-3 h-3" />
                            <span>{t('scope.shared')}</span>
                          </span>
                        )}

                        {debt.settled_at && (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            {t('debts.settled')} (
                            {formatDate(debt.settled_at, language)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {debt.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleOpenSettle(debt)}
                        title={t('debts.settleDebt')}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-medium rounded-xl shadow-sm shadow-emerald-950/40 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('debts.settleDebt')}</span>
                      </button>
                    )}

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => handleDelete(debt.id)}
                          disabled={isDeleting}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {isDeleting ? '...' : t('transactions.confirm')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="px-1.5 py-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white text-[10px] rounded-lg transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(debt.id)}
                        title={t('transactions.delete')}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Settle Debt Dialog / Modal */}
      {settlingDebt && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('debts.settleDebt')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettlingDebt(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {settlingDebt.type === 'i_owe'
                ? t('debts.youOwe')
                    .replace('{amount}', formatCurrency(settlingDebt.amount, settlingDebt.currency))
                    .replace('{name}', settlingDebt.contact_name)
                : t('debts.owesYou')
                    .replace('{amount}', formatCurrency(settlingDebt.amount, settlingDebt.currency))
                    .replace('{name}', settlingDebt.contact_name)}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400">
                {t('debts.debitAccountOptional')}
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/60"
                >
                  <option value="">{t('debts.justMarkAsSettled')}</option>
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency})
                    </option>
                  ))}
                </select>
              </div>
              {selectedWalletId && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400/90 italic">
                  {settlingDebt.type === 'i_owe'
                    ? t('debts.willRecordExpense')
                    : t('debts.willRecordIncome')}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettlingDebt(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                {t('transactions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmSettle}
                disabled={isSubmittingSettle}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
              >
                {isSubmittingSettle && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>
                  {isSubmittingSettle ? t('recurringBills.saving') : t('debts.confirmSettle')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
