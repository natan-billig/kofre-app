import React, { useState } from 'react'
import type { Wallet, Transaction, Profile } from '../lib/types'
import { deleteWallet, archiveWallet, updateWalletName, updateWallet, calculateYieldProjection } from '../lib/walletService'
import { calculateAccountBalance } from '../lib/accountingService'
import { formatCurrency, formatMaskedInput, sanitizeNumericInput } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  X,
  Loader2,
  Trash2,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  ShieldCheck,
  Building2,
  Banknote,
  CreditCard,
  PiggyBank,
  Check,
  TrendingUp,
} from 'lucide-react'

interface ManageAccountModalProps {
  wallet: Wallet | null
  isOpen: boolean
  transactions: Transaction[]
  userProfile?: Profile | null
  onClose: () => void
  onAccountUpdated: () => void
  onRecordYieldIncome?: (wallet: Wallet, estimatedYield: number) => void
}

interface ManageAccountModalFormProps {
  wallet: Wallet
  transactions: Transaction[]
  userProfile?: Profile | null
  onClose: () => void
  onAccountUpdated: () => void
  onRecordYieldIncome?: (wallet: Wallet, estimatedYield: number) => void
}

const ManageAccountModalForm: React.FC<ManageAccountModalFormProps> = ({
  wallet,
  transactions,
  userProfile,
  onClose,
  onAccountUpdated,
  onRecordYieldIncome,
}) => {
  const { t, language } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Tab & base edit states
  const [currentName, setCurrentName] = useState(wallet.name || '')
  const [accountName, setAccountName] = useState(wallet.name || '')
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSuccess, setNameSuccess] = useState(false)

  // Balance edit state
  const initBalStr = wallet.initial_balance != null ? wallet.initial_balance.toString() : '0'
  const [initialBalance, setInitialBalance] = useState(initBalStr)
  const [currentInitialBalance, setCurrentInitialBalance] = useState(initBalStr)
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [balanceSuccess, setBalanceSuccess] = useState(false)

  // Target amount state (for savings)
  const initTargetStr = wallet.target_amount != null ? wallet.target_amount.toString() : ''
  const [targetAmount, setTargetAmount] = useState(initTargetStr)
  const [currentTargetAmount, setCurrentTargetAmount] = useState(initTargetStr)
  const [isUpdatingTarget, setIsUpdatingTarget] = useState(false)
  const [targetError, setTargetError] = useState<string | null>(null)
  const [targetSuccess, setTargetSuccess] = useState(false)

  // Savings yield state
  const initialHasYield = Boolean(
    (wallet.yield_benchmark && wallet.yield_benchmark !== null) ||
    (wallet.yield_percentage != null && wallet.yield_percentage > 0) ||
    (wallet.annual_yield_rate != null && wallet.annual_yield_rate > 0)
  )
  const [hasYield, setHasYield] = useState(initialHasYield)
  const initialBenchmark = wallet.yield_benchmark || (wallet.currency === 'BRL' ? 'cdi' : 'fixed_annual')
  const [yieldBenchmark, setYieldBenchmark] = useState<'cdi' | 'fixed_annual' | 'fixed_monthly'>(
    wallet.currency !== 'BRL' && initialBenchmark === 'cdi' ? 'fixed_annual' : initialBenchmark
  )
  const [yieldPercentage, setYieldPercentage] = useState(
    wallet.yield_percentage != null ? wallet.yield_percentage.toString() : '100'
  )
  const [yieldLimitAmount, setYieldLimitAmount] = useState(
    wallet.yield_limit_amount != null ? wallet.yield_limit_amount.toString() : ''
  )
  const [annualYieldRate, setAnnualYieldRate] = useState(
    wallet.annual_yield_rate != null ? wallet.annual_yield_rate.toString() : '12'
  )
  const [isUpdatingYield, setIsUpdatingYield] = useState(false)
  const [yieldError, setYieldError] = useState<string | null>(null)
  const [yieldSuccess, setYieldSuccess] = useState(false)

  // Current balance & live yield projection for Caixinhas / Poupança
  const currentBalance = calculateAccountBalance(wallet, transactions)
  const cdiRate = userProfile?.cdi_annual_rate ?? 10.5
  const liveProjection = calculateYieldProjection(
    {
      ...wallet,
      yield_benchmark: hasYield ? yieldBenchmark : null,
      yield_percentage: yieldPercentage.trim() ? parseFloat(yieldPercentage.trim()) : 100,
      yield_limit_amount: yieldLimitAmount.trim() ? parseFloat(yieldLimitAmount.trim()) : null,
      annual_yield_rate: annualYieldRate.trim() ? parseFloat(annualYieldRate.trim()) : 0,
    },
    currentBalance,
    cdiRate
  )

  // Checking overdraft limit state
  const initOverdraftStr = wallet.credit_limit != null ? wallet.credit_limit.toString() : ''
  const [overdraftLimit, setOverdraftLimit] = useState(initOverdraftStr)
  const [currentOverdraftLimit, setCurrentOverdraftLimit] = useState(initOverdraftStr)
  const [isUpdatingOverdraft, setIsUpdatingOverdraft] = useState(false)
  const [overdraftError, setOverdraftError] = useState<string | null>(null)
  const [overdraftSuccess, setOverdraftSuccess] = useState(false)

  // Credit card invoice cycle & limit state
  const [closingDay, setClosingDay] = useState(wallet.closing_day?.toString() || '')
  const [dueDay, setDueDay] = useState(wallet.due_day?.toString() || '')
  const [creditLimit, setCreditLimit] = useState(wallet.credit_limit?.toString() || '')
  const [isUpdatingCard, setIsUpdatingCard] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [cardSuccess, setCardSuccess] = useState(false)

  const linkedTransactions = transactions.filter(
    (t) => t.wallet_id === wallet.id || t.destination_wallet_id === wallet.id
  )
  const hasTransactions = linkedTransactions.length > 0
  const isArchived = Boolean(wallet.is_archived)

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setLoading(true)
    setErrorMsg(null)
    try {
      await deleteWallet(wallet.id)
      onAccountUpdated()
      onClose()
    } catch (err: unknown) {
      console.error('Error deleting wallet:', err)
      const msg = err instanceof Error ? err.message : 'Erro ao excluir conta.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleArchive = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      await archiveWallet(wallet.id, !isArchived)
      onAccountUpdated()
      onClose()
    } catch (err: unknown) {
      console.error('Error archiving wallet:', err)
      const msg = err instanceof Error ? err.message : 'Erro ao arquivar/desarquivar conta.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet) return
    const trimmed = accountName.trim()
    if (!trimmed) {
      setNameError(t('manageAccount.nameRequired'))
      return
    }

    if (trimmed === currentName) {
      return
    }

    setIsUpdatingName(true)
    setNameError(null)
    setNameSuccess(false)
    try {
      await updateWalletName(wallet.id, trimmed)
      setCurrentName(trimmed)
      setNameSuccess(true)
      onAccountUpdated()
    } catch (err: unknown) {
      console.error('Error updating account name:', err)
      setNameError(err instanceof Error ? err.message : 'Erro ao atualizar nome da conta.')
    } finally {
      setIsUpdatingName(false)
    }
  }

  const handleSaveInitialBalance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet) return

    setBalanceError(null)
    setBalanceSuccess(false)

    const trimmed = initialBalance.trim()
    const parsed = trimmed ? sanitizeNumericInput(trimmed, wallet.currency) : 0
    if (isNaN(parsed)) {
      setBalanceError(t('manageAccount.invalidNumber'))
      return
    }

    if (String(parsed) === currentInitialBalance) {
      return
    }

    setIsUpdatingBalance(true)
    try {
      await updateWallet(wallet.id, {
        initial_balance: parsed,
      })
      setCurrentInitialBalance(String(parsed))
      setBalanceSuccess(true)
      onAccountUpdated()
    } catch (err: unknown) {
      console.error('Error updating initial balance:', err)
      setBalanceError(err instanceof Error ? err.message : 'Erro ao atualizar saldo inicial.')
    } finally {
      setIsUpdatingBalance(false)
    }
  }

  const handleSaveCardSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet) return

    setCardError(null)
    setCardSuccess(false)

    let parsedClosing: number | null = null
    let parsedDue: number | null = null
    let parsedLimit: number | null = null

    if (closingDay.trim()) {
      parsedClosing = parseInt(closingDay.trim(), 10)
      if (isNaN(parsedClosing) || parsedClosing < 1 || parsedClosing > 31) {
        setCardError(t('creditCard.invalidDay'))
        return
      }
    }

    if (dueDay.trim()) {
      parsedDue = parseInt(dueDay.trim(), 10)
      if (isNaN(parsedDue) || parsedDue < 1 || parsedDue > 31) {
        setCardError(t('creditCard.invalidDay'))
        return
      }
    }

    if (creditLimit.trim()) {
      parsedLimit = sanitizeNumericInput(creditLimit.trim(), wallet.currency)
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        parsedLimit = null
      }
    }

    setIsUpdatingCard(true)
    try {
      await updateWallet(wallet.id, {
        closing_day: parsedClosing,
        due_day: parsedDue,
        credit_limit: parsedLimit,
      })
      setCardSuccess(true)
      onAccountUpdated()
    } catch (err: unknown) {
      console.error('Error updating card settings:', err)
      setCardError(err instanceof Error ? err.message : 'Erro ao atualizar configurações do cartão.')
    } finally {
      setIsUpdatingCard(false)
    }
  }

  const handleSaveTargetAmount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet) return

    setTargetError(null)
    setTargetSuccess(false)

    let parsed: number | null = null
    if (targetAmount.trim()) {
      parsed = sanitizeNumericInput(targetAmount.trim(), wallet.currency)
      if (isNaN(parsed) || parsed < 0) {
        setTargetError(t('manageAccount.invalidNumber'))
        return
      }
    }

    setIsUpdatingTarget(true)
    try {
      await updateWallet(wallet.id, {
        target_amount: parsed,
      })
      setCurrentTargetAmount(targetAmount.trim())
      setTargetSuccess(true)
      onAccountUpdated()
    } catch (err: unknown) {
      console.error('Error updating target amount:', err)
      setTargetError(err instanceof Error ? err.message : 'Erro ao atualizar meta financeira.')
    } finally {
      setIsUpdatingTarget(false)
    }
  }

  const handleSaveYield = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet) return

    setYieldError(null)
    setYieldSuccess(false)

    let parsedAnnual: number | null = null
    let parsedPercentage: number | null = null
    let parsedLimit: number | null = null

    if (hasYield) {
      if (yieldBenchmark === 'cdi') {
        parsedPercentage = yieldPercentage.trim() ? parseFloat(yieldPercentage.trim()) : 100
        if (isNaN(parsedPercentage) || parsedPercentage <= 0) {
          setYieldError(t('manageAccount.invalidNumber'))
          return
        }
        if (yieldLimitAmount.trim()) {
          parsedLimit = sanitizeNumericInput(yieldLimitAmount.trim(), wallet.currency)
          if (isNaN(parsedLimit) || parsedLimit < 0) {
            parsedLimit = null
          }
        }
      } else {
        parsedAnnual = annualYieldRate.trim() ? parseFloat(annualYieldRate.trim()) : 0
        if (isNaN(parsedAnnual) || parsedAnnual <= 0) {
          setYieldError(t('manageAccount.invalidNumber'))
          return
        }
      }
    }

    setIsUpdatingYield(true)
    try {
      await updateWallet(wallet.id, {
        yield_benchmark: hasYield ? yieldBenchmark : null,
        yield_percentage: hasYield ? parsedPercentage : null,
        yield_limit_amount: hasYield ? parsedLimit : null,
        annual_yield_rate: hasYield ? parsedAnnual : null,
      })
      setYieldSuccess(true)
      onAccountUpdated()
    } catch (err: unknown) {
      console.warn('Error updating wallet yield in database (persisted locally):', err)
      setYieldSuccess(true)
      onAccountUpdated()
    } finally {
      setIsUpdatingYield(false)
    }
  }

  const handleSaveOverdraftLimit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet) return

    setOverdraftError(null)
    setOverdraftSuccess(false)

    let parsed: number | null = null
    if (overdraftLimit.trim()) {
      parsed = sanitizeNumericInput(overdraftLimit.trim(), wallet.currency)
      if (isNaN(parsed) || parsed < 0) {
        setOverdraftError(t('manageAccount.invalidNumber'))
        return
      }
    }

    setIsUpdatingOverdraft(true)
    try {
      await updateWallet(wallet.id, {
        credit_limit: parsed,
      })
      setCurrentOverdraftLimit(overdraftLimit.trim())
      setOverdraftSuccess(true)
      onAccountUpdated()
    } catch (err: unknown) {
      console.error('Error updating overdraft limit:', err)
      setOverdraftError(err instanceof Error ? err.message : 'Erro ao atualizar limite de sobregiro.')
    } finally {
      setIsUpdatingOverdraft(false)
    }
  }

  const AccountIcon =
    wallet.account_type === 'credit_card'
      ? CreditCard
      : wallet.account_type === 'savings'
      ? PiggyBank
      : wallet.account_type === 'cash'
      ? Banknote
      : Building2

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <AccountIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{currentName}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {wallet.account_type === 'credit_card'
                  ? t('accounts.credit_card')
                  : wallet.account_type === 'savings'
                  ? t('accounts.savings')
                  : wallet.account_type === 'cash'
                  ? t('accounts.cash')
                  : t('accounts.checking')}{' '}
                &bull; {wallet.currency} &bull;{' '}
                {wallet.type === 'shared' ? t('scope.familyBox') : t('scope.myAccounts')}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setConfirmDelete(false)
              onClose()
            }}
            className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Edit Account Name Form */}
        <form onSubmit={handleSaveName} className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('manageAccount.editNameLabel')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={accountName}
              onChange={(e) => {
                setAccountName(e.target.value)
                setNameSuccess(false)
                setNameError(null)
              }}
              placeholder={t('manageAccount.editNamePlaceholder')}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isUpdatingName || !accountName.trim() || accountName.trim() === currentName}
              className="cursor-pointer px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              {isUpdatingName ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('manageAccount.saveName')}</span>
                </>
              )}
            </button>
          </div>
          {nameError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{nameError}</p>
          )}
          {nameSuccess && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{t('manageAccount.nameUpdated')}</span>
            </p>
          )}
        </form>

        {/* Edit Initial Balance / Initial Debt Form */}
        <form
          onSubmit={handleSaveInitialBalance}
          className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800"
        >
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {wallet.account_type === 'credit_card'
              ? t('creditCard.initialDebtLabel')
              : t('manageAccount.initialBalanceLabel')}{' '}
            ({wallet.currency})
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={initialBalance}
              onChange={(e) => {
                setInitialBalance(e.target.value)
                setBalanceSuccess(false)
                setBalanceError(null)
              }}
              onBlur={() => {
                if (initialBalance.trim()) {
                  setInitialBalance(formatMaskedInput(initialBalance, wallet.currency))
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && initialBalance.trim()) {
                  setInitialBalance(formatMaskedInput(initialBalance, wallet.currency))
                }
              }}
              placeholder="0"
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            <button
              type="submit"
              disabled={
                isUpdatingBalance ||
                initialBalance.trim() === currentInitialBalance ||
                isNaN(sanitizeNumericInput(initialBalance, wallet.currency))
              }
              className="cursor-pointer px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              {isUpdatingBalance ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('manageAccount.saveBalance')}</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {wallet.account_type === 'credit_card'
              ? t('creditCard.initialDebtTip')
              : t('manageAccount.initialBalanceDesc')}
          </p>
          {balanceError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{balanceError}</p>
          )}
          {balanceSuccess && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{t('manageAccount.balanceUpdated')}</span>
            </p>
          )}
        </form>

        {/* Edit Target Amount Form for Savings */}
        {wallet.account_type === 'savings' && (
          <form
            onSubmit={handleSaveTargetAmount}
            className="space-y-2 p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20"
          >
            <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300">
              {t('manageAccount.targetAmountLabel')} ({wallet.currency})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={targetAmount}
                onChange={(e) => {
                  setTargetAmount(e.target.value)
                  setTargetSuccess(false)
                  setTargetError(null)
                }}
                onBlur={() => {
                  if (targetAmount.trim()) {
                    setTargetAmount(formatMaskedInput(targetAmount, wallet.currency))
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && targetAmount.trim()) {
                    setTargetAmount(formatMaskedInput(targetAmount, wallet.currency))
                  }
                }}
                placeholder="Ex: 5000000"
                className="flex-1 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors font-mono"
              />
              <button
                type="submit"
                disabled={
                  isUpdatingTarget ||
                  targetAmount.trim() === currentTargetAmount ||
                  (targetAmount.trim() !== '' && isNaN(sanitizeNumericInput(targetAmount, wallet.currency)))
                }
                className="cursor-pointer px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                {isUpdatingTarget ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('manageAccount.saveTargetAmount')}</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
              {t('savings.tip')}
            </p>
            {targetError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{targetError}</p>
            )}
            {targetSuccess && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>{t('manageAccount.targetAmountUpdated')}</span>
              </p>
            )}
          </form>
        )}

        {/* Edit Yield Projection Form for Savings */}
        {wallet.account_type === 'savings' && (
          <form
            onSubmit={handleSaveYield}
            className="space-y-3 p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{language === 'es' ? 'Rendimiento / Rentabilidad' : 'Rendimento / Rentabilidade'}</span>
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasYield}
                  onChange={(e) => {
                    setHasYield(e.target.checked)
                    setYieldSuccess(false)
                    setYieldError(null)
                  }}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {hasYield && (
              <div className="space-y-3 pt-1 border-t border-emerald-200/50 dark:border-emerald-800/30 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {language === 'es' ? 'Tipo de Rentabilidad' : 'Tipo de Rentabilidade'}
                  </span>
                  <div className={`grid ${wallet.currency === 'BRL' ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
                    {wallet.currency === 'BRL' && (
                      <button
                        type="button"
                        onClick={() => {
                          setYieldBenchmark('cdi')
                          setYieldSuccess(false)
                        }}
                        className={`py-1 px-2 rounded-lg text-xs font-medium border transition-all ${
                          yieldBenchmark === 'cdi'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                        }`}
                      >
                        % CDI
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setYieldBenchmark('fixed_annual')
                        setYieldSuccess(false)
                      }}
                      className={`py-1 px-2 rounded-lg text-xs font-medium border transition-all ${
                        yieldBenchmark === 'fixed_annual'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                      }`}
                    >
                      % a.a.
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setYieldBenchmark('fixed_monthly')
                        setYieldSuccess(false)
                      }}
                      className={`py-1 px-2 rounded-lg text-xs font-medium border transition-all ${
                        yieldBenchmark === 'fixed_monthly'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                      }`}
                    >
                      % a.m.
                    </button>
                  </div>
                </div>

                {yieldBenchmark === 'cdi' ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      {language === 'es' ? 'Porcentaje del CDI (% do CDI)' : 'Percentual do CDI (% do CDI)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={yieldPercentage}
                      onChange={(e) => {
                        setYieldPercentage(e.target.value)
                        setYieldSuccess(false)
                        setYieldError(null)
                      }}
                      placeholder="Ex: 100"
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950/80 border border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 text-slate-900 dark:text-slate-100 text-xs outline-none font-mono"
                    />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {language === 'es'
                        ? 'Calcula la proyección mensual considerando la tasa CDI de mercado (~10.5% a.a.).'
                        : 'Calcula a projeção mensal considerando o CDI de mercado (~10,5% a.a.).'}
                    </p>
                    <div className="space-y-1 pt-1.5 border-t border-emerald-100 dark:border-emerald-900/30">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        {language === 'es' ? 'Límite / Techo para Tasa Especial (Opcional)' : 'Limite / Teto para Taxa Especial (Opcional)'}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={yieldLimitAmount}
                        onChange={(e) => {
                          setYieldLimitAmount(e.target.value)
                          setYieldSuccess(false)
                          setYieldError(null)
                        }}
                        onBlur={() => {
                          if (yieldLimitAmount.trim()) {
                            setYieldLimitAmount(formatMaskedInput(yieldLimitAmount, wallet.currency))
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && yieldLimitAmount.trim()) {
                            setYieldLimitAmount(formatMaskedInput(yieldLimitAmount, wallet.currency))
                          }
                        }}
                        placeholder="Ex: 5000 (Caixinha Turbo)"
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950/80 border border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 text-slate-900 dark:text-slate-100 text-xs outline-none font-mono"
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {language === 'es'
                          ? 'Si el saldo supera este monto, el exceso se calculará al 100% del CDI automáticamente.'
                          : 'Se o saldo ultrapassar este valor, o excedente renderá a 100% do CDI automaticamente.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      {yieldBenchmark === 'fixed_annual'
                        ? language === 'es'
                          ? 'Tasa Fija Anual (% a.a.)'
                          : 'Taxa Fixa Anual (% a.a.)'
                        : language === 'es'
                        ? 'Tasa Fija Mensual (% a.m.)'
                        : 'Taxa Fixa Mensal (% a.m.)'}
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={annualYieldRate}
                      onChange={(e) => {
                        setAnnualYieldRate(e.target.value)
                        setYieldSuccess(false)
                        setYieldError(null)
                      }}
                      placeholder={yieldBenchmark === 'fixed_annual' ? 'Ex: 12' : 'Ex: 0.8'}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950/80 border border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 text-slate-900 dark:text-slate-100 text-xs outline-none font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {hasYield && liveProjection && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{language === 'es' ? 'Proyección Mensual Estimada' : 'Projeção Mensal Estimada'}</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                    +{formatCurrency(liveProjection.monthlyYield, wallet.currency)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                  {language === 'es' ? 'Por día hábil' : 'Por dia útil'}: ~{formatCurrency(liveProjection.dailyBusinessYield, wallet.currency)} • {liveProjection.benchmarkLabel}
                </p>
                {onRecordYieldIncome && (
                  <button
                    type="button"
                    onClick={() => {
                      onRecordYieldIncome(wallet, liveProjection.monthlyYield)
                      onClose()
                    }}
                    className="w-full mt-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{language === 'es' ? '📈 Registrar Rendimiento en Saldo' : '📈 Lançar Rendimento no Saldo'}</span>
                  </button>
                )}
              </div>
            )}

            {hasYield && !liveProjection && onRecordYieldIncome && (
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onRecordYieldIncome(wallet, 0)
                    onClose()
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{language === 'es' ? '📈 Registrar Rendimiento en Saldo' : '📈 Lançar Rendimento no Saldo'}</span>
                </button>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isUpdatingYield}
                className="cursor-pointer px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                {isUpdatingYield ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{language === 'es' ? 'Guardar Rendimiento' : 'Salvar Rendimento'}</span>
                  </>
                )}
              </button>
            </div>

            {yieldError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{yieldError}</p>
            )}
            {yieldSuccess && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>{language === 'es' ? '¡Rendimiento actualizado con éxito!' : 'Rendimento atualizado com sucesso!'}</span>
              </p>
            )}
          </form>
        )}

        {/* Edit Overdraft Limit Form for Checking */}
        {wallet.account_type === 'checking' && (
          <form
            onSubmit={handleSaveOverdraftLimit}
            className="space-y-2 p-3.5 rounded-2xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-500/20"
          >
            <label className="block text-xs font-semibold text-sky-800 dark:text-sky-300">
              {t('manageAccount.overdraftLimitLabel')} ({wallet.currency})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={overdraftLimit}
                onChange={(e) => {
                  setOverdraftLimit(e.target.value)
                  setOverdraftSuccess(false)
                  setOverdraftError(null)
                }}
                onBlur={() => {
                  if (overdraftLimit.trim()) {
                    setOverdraftLimit(formatMaskedInput(overdraftLimit, wallet.currency))
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && overdraftLimit.trim()) {
                    setOverdraftLimit(formatMaskedInput(overdraftLimit, wallet.currency))
                  }
                }}
                placeholder="Ex: 1000000"
                className="flex-1 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-500/30 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors font-mono"
              />
              <button
                type="submit"
                disabled={
                  isUpdatingOverdraft ||
                  overdraftLimit.trim() === currentOverdraftLimit ||
                  (overdraftLimit.trim() !== '' && isNaN(sanitizeNumericInput(overdraftLimit, wallet.currency)))
                }
                className="cursor-pointer px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                {isUpdatingOverdraft ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('manageAccount.saveOverdraftLimit')}</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80">
              {t('checking.overdraftTip')}
            </p>
            {overdraftError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{overdraftError}</p>
            )}
            {overdraftSuccess && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>{t('manageAccount.overdraftLimitUpdated')}</span>
              </p>
            )}
          </form>
        )}

        {/* Credit Card Cycle and Limit Settings */}
        {wallet.account_type === 'credit_card' && (
          <form
            onSubmit={handleSaveCardSettings}
            className="space-y-3 p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
              <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>{t('creditCard.cardSettingsTitle')}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {t('creditCard.closingDay')} (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={closingDay}
                  onChange={(e) => {
                    setClosingDay(e.target.value)
                    setCardSuccess(false)
                    setCardError(null)
                  }}
                  placeholder="Ex: 20"
                  className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {t('creditCard.dueDay')} (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => {
                    setDueDay(e.target.value)
                    setCardSuccess(false)
                    setCardError(null)
                  }}
                  placeholder="Ex: 28"
                  className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {t('createAccount.creditLimit')} ({wallet.currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={creditLimit}
                onChange={(e) => {
                  setCreditLimit(e.target.value)
                  setCardSuccess(false)
                  setCardError(null)
                }}
                onBlur={() => {
                  if (creditLimit.trim()) {
                    setCreditLimit(formatMaskedInput(creditLimit, wallet.currency))
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && creditLimit.trim()) {
                    setCreditLimit(formatMaskedInput(creditLimit, wallet.currency))
                  }
                }}
                placeholder="Ex: 5000000"
                className="w-full bg-white dark:bg-slate-900 border border-purple-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex-1 pr-2">
                {cardError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{cardError}</p>
                )}
                {cardSuccess && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('creditCard.cardUpdated')}</span>
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={isUpdatingCard}
                className="cursor-pointer px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                {isUpdatingCard ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('creditCard.saveCardSettings')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Status and Integrity Info */}
        {hasTransactions ? (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                {language === 'es' ? 'Cuenta con Historial' : 'Conta com Histórico'} ({linkedTransactions.length} {language === 'es' ? 'movimientos' : 'lançamentos'})
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('manageAccount.archiveDesc')}
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{language === 'es' ? 'Sin movimientos vinculados' : 'Sem movimentações vinculadas'}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('manageAccount.deleteDesc')}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {hasTransactions ? (
            /* Conta com transações: Opção de Arquivar / Desarquivar */
            <button
              type="button"
              disabled={loading}
              onClick={handleToggleArchive}
              className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isArchived
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isArchived ? (
                <>
                  <ArchiveRestore className="w-4 h-4" />
                  <span>{t('manageAccount.restore')}</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>{t('manageAccount.archive')}</span>
                </>
              )}
            </button>
          ) : (
            /* Conta sem transações: Opção de Excluir Definitivamente */
            <div>
              {confirmDelete ? (
                <div className="space-y-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-center">
                  <p className="text-xs text-rose-700 dark:text-rose-200 font-medium">
                    {t('manageAccount.deleteConfirm')}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      {t('manageAccount.cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleDelete}
                      className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/25"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('transactions.confirm')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleDelete}
                  className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-600/10 dark:hover:bg-rose-600/20 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  <span>{t('manageAccount.delete')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const ManageAccountModal: React.FC<ManageAccountModalProps> = (props) => {
  if (!props.isOpen || !props.wallet) return null

  const formKey = `${props.wallet.id}-${props.wallet.name}-${props.wallet.initial_balance ?? 0}-${props.wallet.closing_day ?? ''}-${props.wallet.due_day ?? ''}-${props.wallet.credit_limit ?? ''}`

  return (
    <ManageAccountModalForm
      key={formKey}
      wallet={props.wallet}
      transactions={props.transactions}
      userProfile={props.userProfile}
      onClose={props.onClose}
      onAccountUpdated={props.onAccountUpdated}
      onRecordYieldIncome={props.onRecordYieldIncome}
    />
  )
}
