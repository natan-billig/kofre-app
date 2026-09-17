import React, { useState } from 'react'
import type { Wallet, Transaction } from '../lib/types'
import { deleteWallet, archiveWallet, updateWalletName, updateWallet } from '../lib/walletService'
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
  Check,
} from 'lucide-react'

interface ManageAccountModalProps {
  wallet: Wallet | null
  isOpen: boolean
  transactions: Transaction[]
  onClose: () => void
  onAccountUpdated: () => void
}

interface ManageAccountModalFormProps {
  wallet: Wallet
  transactions: Transaction[]
  onClose: () => void
  onAccountUpdated: () => void
}

const ManageAccountModalForm: React.FC<ManageAccountModalFormProps> = ({
  wallet,
  transactions,
  onClose,
  onAccountUpdated,
}) => {
  const { t, language } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [currentName, setCurrentName] = useState(wallet.name || '')
  const [accountName, setAccountName] = useState(wallet.name || '')
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSuccess, setNameSuccess] = useState(false)

  // Initial balance state
  const initBalStr = wallet.initial_balance != null ? wallet.initial_balance.toString() : '0'
  const [initialBalance, setInitialBalance] = useState(initBalStr)
  const [currentInitialBalance, setCurrentInitialBalance] = useState(initBalStr)
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [balanceSuccess, setBalanceSuccess] = useState(false)

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
    const parsed = trimmed ? Number(trimmed) : 0
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
      parsedLimit = Number(creditLimit.trim())
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

  const AccountIcon =
    wallet.account_type === 'credit_card'
      ? CreditCard
      : wallet.account_type === 'cash'
      ? Banknote
      : Building2

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center">
              <AccountIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">{currentName}</h2>
              <span className="text-xs text-slate-400">
                {wallet.account_type === 'credit_card'
                  ? t('accounts.credit_card')
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
            className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Edit Account Name Form */}
        <form onSubmit={handleSaveName} className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
          <label className="block text-xs font-semibold text-slate-300">
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
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
            <p className="text-[11px] text-rose-400 font-medium">{nameError}</p>
          )}
          {nameSuccess && (
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{t('manageAccount.nameUpdated')}</span>
            </p>
          )}
        </form>

        {/* Edit Initial Balance Form for Liquid Accounts */}
        {wallet.account_type !== 'credit_card' && (
          <form
            onSubmit={handleSaveInitialBalance}
            className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800"
          >
            <label className="block text-xs font-semibold text-slate-300">
              {t('manageAccount.initialBalanceLabel')} ({wallet.currency})
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                value={initialBalance}
                onChange={(e) => {
                  setInitialBalance(e.target.value)
                  setBalanceSuccess(false)
                  setBalanceError(null)
                }}
                placeholder="0"
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
              <button
                type="submit"
                disabled={
                  isUpdatingBalance ||
                  initialBalance.trim() === currentInitialBalance ||
                  isNaN(Number(initialBalance))
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
            <p className="text-[11px] text-slate-400">
              {t('manageAccount.initialBalanceDesc')}
            </p>
            {balanceError && (
              <p className="text-[11px] text-rose-400 font-medium">{balanceError}</p>
            )}
            {balanceSuccess && (
              <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>{t('manageAccount.balanceUpdated')}</span>
              </p>
            )}
          </form>
        )}

        {/* Credit Card Cycle and Limit Settings */}
        {wallet.account_type === 'credit_card' && (
          <form
            onSubmit={handleSaveCardSettings}
            className="space-y-3 p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 uppercase tracking-wider">
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span>{t('creditCard.cardSettingsTitle')}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
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
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
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
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                {t('createAccount.creditLimit')} ({wallet.currency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={creditLimit}
                onChange={(e) => {
                  setCreditLimit(e.target.value)
                  setCardSuccess(false)
                  setCardError(null)
                }}
                placeholder="Ex: 5000000"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex-1 pr-2">
                {cardError && (
                  <p className="text-[11px] text-rose-400 font-medium">{cardError}</p>
                )}
                {cardSuccess && (
                  <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
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
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                {language === 'es' ? 'Cuenta con Historial' : 'Conta com Histórico'} ({linkedTransactions.length} {language === 'es' ? 'movimientos' : 'lançamentos'})
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t('manageAccount.archiveDesc')}
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{language === 'es' ? 'Sin movimientos vinculados' : 'Sem movimentações vinculadas'}</span>
            </div>
            <p className="text-xs text-slate-400">
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
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white'
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
                  <Archive className="w-4 h-4 text-amber-400" />
                  <span>{t('manageAccount.archive')}</span>
                </>
              )}
            </button>
          ) : (
            /* Conta sem transações: Opção de Excluir Definitivamente */
            <div>
              {confirmDelete ? (
                <div className="space-y-2 p-3 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-center">
                  <p className="text-xs text-rose-200 font-medium">
                    {t('manageAccount.deleteConfirm')}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
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
                  className="w-full py-3 px-4 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
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
      onClose={props.onClose}
      onAccountUpdated={props.onAccountUpdated}
    />
  )
}
