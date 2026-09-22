import React, { useState } from 'react'
import type { DebtItem, Wallet, ScopeFilterType } from '../lib/types'
import { settleDebt, deleteDebt } from '../lib/debtService'
import { formatCurrency, formatDate } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { useModalScrollLock } from '../hooks/useModalScrollLock'
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
  Check,
} from 'lucide-react'

interface DebtsWidgetProps {
  debts: DebtItem[]
  wallets: Wallet[]
  currentScope: ScopeFilterType
  currentUserId?: string
  onOpenCreateDebt: () => void
  onDebtChanged: () => void
}

interface DebtPerspective {
  isIOwe: boolean
  otherPartyName: string
}

function getDebtPerspective(debt: DebtItem, currentUserId?: string): DebtPerspective {
  const isCreator = debt.user_id === currentUserId
  const isTarget = Boolean(currentUserId && debt.target_user_id === currentUserId)

  // Perspectiva espelhada: se foi criado pela outra pessoa para mim
  if (isTarget && !isCreator) {
    const creatorName = debt.creator?.full_name || 'Membro da Família'
    if (debt.type === 'they_owe') {
      // No banco é "Eles me devem" -> para mim (alvo): "Eu devo para o criador" (Âmbar / A Pagar)
      return {
        isIOwe: true,
        otherPartyName: creatorName,
      }
    } else {
      // No banco é "Eu devo para eles" -> para mim (alvo): "O criador me deve" (Verde / A Receber)
      return {
        isIOwe: false,
        otherPartyName: creatorName,
      }
    }
  }

  // Perspectiva padrão: o usuário logado criou a dívida (ou fallback externo)
  const targetName = debt.target?.full_name || debt.contact_name || 'Alguém'
  return {
    isIOwe: debt.type === 'i_owe',
    otherPartyName: targetName,
  }
}

export const DebtsWidget: React.FC<DebtsWidgetProps> = ({
  debts,
  wallets,
  currentScope,
  currentUserId,
  onOpenCreateDebt,
  onDebtChanged,
}) => {
  const { t, language } = useTranslation()

  const [activeTab, setActiveTab] = useState<'pending' | 'settled'>('pending')
  const [settlingDebt, setSettlingDebt] = useState<DebtItem | null>(null)
  useModalScrollLock(!!settlingDebt)
  const [selectedWalletId, setSelectedWalletId] = useState<string>('')
  const [settlementDate, setSettlementDate] = useState<string>('')
  const [recordMovement, setRecordMovement] = useState(false)
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter debts by current scope
  const scopedDebts = debts.filter((debt) => debt.scope === currentScope)

  // Ocultação Condicional: Renderizar no painel apenas se houver pelo menos 1 dívida no escopo ativo
  if (scopedDebts.length === 0) {
    return null
  }

  const pendingDebts = scopedDebts.filter((d) => d.status === 'pending')
  const settledDebts = scopedDebts.filter((d) => d.status === 'settled')

  const displayedDebts = activeTab === 'pending' ? pendingDebts : settledDebts

  const activeWallets = wallets.filter((w) => !w.is_archived)

  const matchingWalletsForSettle = settlingDebt
    ? activeWallets.filter((w) => w.currency === settlingDebt.currency)
    : []

  const handleOpenSettle = (debt: DebtItem) => {
    setSettlingDebt(debt)
    setRecordMovement(false)
    setSettlementDate(new Date().toISOString().split('T')[0])
    const matching = activeWallets.filter((w) => w.currency === debt.currency)
    setSelectedWalletId(matching[0]?.id || '')
  }

  const handleToggleRecordMovement = () => {
    const nextVal = !recordMovement
    setRecordMovement(nextVal)
    if (nextVal && !selectedWalletId && matchingWalletsForSettle.length > 0) {
      setSelectedWalletId(matchingWalletsForSettle[0].id)
    }
  }

  const handleConfirmSettle = async () => {
    if (!settlingDebt) return
    setIsSubmittingSettle(true)
    try {
      await settleDebt(
        settlingDebt.id,
        recordMovement && selectedWalletId ? selectedWalletId : undefined,
        currentUserId,
        settlementDate
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
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-medium">
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
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-medium">
            {settledDebts.length}
          </span>
        </button>
      </div>

      {/* Debts List */}
      {displayedDebts.length === 0 ? (
        <div className="text-center py-6 px-4 border border-dashed border-slate-200 dark:border-slate-800/70 rounded-2xl">
          <HandCoins className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            {scopedDebts.length === 0
              ? t('debts.noDebtsRegistered')
              : activeTab === 'pending'
              ? t('debts.emptyPending')
              : t('debts.emptySettled')}
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
            const perspective = getDebtPerspective(debt, currentUserId)
            const isIOwe = perspective.isIOwe
            const formattedVal = formatCurrency(debt.amount, debt.currency)
            const otherName = perspective.otherPartyName
            const isConfirmingDelete = deletingId === debt.id
            const canDelete = !currentUserId || debt.user_id === currentUserId

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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isIOwe
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                          }`}
                        >
                          {isIOwe ? t('debts.iOwe') : t('debts.theyOwe')}
                        </span>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                          {isIOwe ? (
                            <span>
                              {t('debts.youOwe')
                                .replace('{amount}', formattedVal)
                                .replace('{name}', otherName)}
                            </span>
                          ) : (
                            <span>
                              {t('debts.owesYou')
                                .replace('{amount}', formattedVal)
                                .replace('{name}', otherName)}
                            </span>
                          )}
                        </div>
                      </div>

                      {debt.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                          {debt.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 font-medium">
                        {(debt.issue_date || debt.created_at) && (
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-violet-500/70" />
                            <span>
                              {t('debts.issueDate')}: {formatDate(debt.issue_date || debt.created_at!, language)}
                            </span>
                          </span>
                        )}

                        {debt.due_date && (
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {t('debts.dueDate')}: {formatDate(debt.due_date, language)}
                            </span>
                          </span>
                        )}

                        {debt.scope === 'shared' && (
                          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                            <Users className="w-3.5 h-3.5" />
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

                    {canDelete &&
                      (isConfirmingDelete ? (
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleDelete(debt.id)}
                            disabled={isDeleting}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            {isDeleting ? '...' : t('transactions.confirm')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            className="px-1.5 py-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs rounded-lg transition-colors cursor-pointer"
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
                      ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Settle Debt Dialog / Modal */}
      {settlingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all">
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

            {(() => {
              const settlePerspective = getDebtPerspective(settlingDebt, currentUserId)
              const isSettleIOwe = settlePerspective.isIOwe
              const settleOtherName = settlePerspective.otherPartyName

              return (
                <>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {isSettleIOwe
                      ? t('debts.youOwe')
                          .replace(
                            '{amount}',
                            formatCurrency(settlingDebt.amount, settlingDebt.currency)
                          )
                          .replace('{name}', settleOtherName)
                      : t('debts.owesYou')
                          .replace(
                            '{amount}',
                            formatCurrency(settlingDebt.amount, settlingDebt.currency)
                          )
                          .replace('{name}', settleOtherName)}
                  </p>

                  <div className="space-y-3 pt-1">
                    {/* Data da Liquidação */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-400">
                        {t('debts.settlementDate')}
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="date"
                          value={settlementDate}
                          onChange={(e) => setSettlementDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/60 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Checkbox: Registrar movimentação na minha conta? */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={handleToggleRecordMovement}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault()
                          handleToggleRecordMovement()
                        }
                      }}
                      className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition-colors"
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                          recordMovement
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                        }`}
                      >
                        {recordMovement && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="leading-snug">
                        {t('debts.recordMovementInAccount')}
                      </span>
                    </div>

                    {/* Seleção de Carteira se o checkbox estiver marcado */}
                    {recordMovement && (
                      <div className="space-y-1.5 pl-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400">
                          {isSettleIOwe
                            ? t('debts.originWallet')
                            : t('debts.destinationWallet')}
                        </label>
                        <div className="relative">
                          <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <select
                            value={selectedWalletId}
                            onChange={(e) => setSelectedWalletId(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/60"
                          >
                            <option value="">{t('debts.selectWallet')}</option>
                            {matchingWalletsForSettle.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.currency})
                              </option>
                            ))}
                          </select>
                        </div>
                        {matchingWalletsForSettle.length === 0 ? (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            {t('debts.noWalletAvailable')}
                          </p>
                        ) : (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400/90 italic">
                            {isSettleIOwe
                              ? t('debts.willRecordExpense')
                              : t('debts.willRecordIncome')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}

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
                disabled={
                  isSubmittingSettle ||
                  (recordMovement && (!selectedWalletId || matchingWalletsForSettle.length === 0))
                }
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
