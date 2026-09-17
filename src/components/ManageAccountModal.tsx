import React, { useState } from 'react'
import type { Wallet, Transaction } from '../lib/types'
import { deleteWallet, archiveWallet } from '../lib/walletService'
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
} from 'lucide-react'

interface ManageAccountModalProps {
  wallet: Wallet | null
  isOpen: boolean
  transactions: Transaction[]
  onClose: () => void
  onAccountUpdated: () => void
}

export const ManageAccountModal: React.FC<ManageAccountModalProps> = ({
  wallet,
  isOpen,
  transactions,
  onClose,
  onAccountUpdated,
}) => {
  const { t, language } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!isOpen || !wallet) return null

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
              <h2 className="text-base font-bold text-white leading-tight">{wallet.name}</h2>
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
