import React, { useEffect, useState } from 'react'
import type { Transaction, Wallet, WalletScope } from '../lib/types'
import { formatCurrency, formatDate } from '../lib/formatters'
import { fetchProfilesMap } from '../lib/profileService'
import { deleteTransaction } from '../lib/accountingService'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Utensils,
  Car,
  Home,
  Gamepad2,
  HeartPulse,
  ShoppingBag,
  Briefcase,
  PiggyBank,
  MoreHorizontal,
  User,
  Globe2,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Download,
  CheckCircle2,
} from 'lucide-react'
import { exportTransactionsToCSV } from '../lib/exportService'

interface TransactionListProps {
  transactions: Transaction[]
  wallets: Wallet[]
  currentScope: WalletScope | 'all'
  currentUserId: string
  selectedDate?: Date
  onEditTransaction: (transaction: Transaction) => void
  onTransactionDeleted: () => void
}

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Alimentação: Utensils,
  Transporte: Car,
  Moradia: Home,
  Lazer: Gamepad2,
  Saúde: HeartPulse,
  Compras: ShoppingBag,
  Salário: Briefcase,
  Investimentos: PiggyBank,
  Transferência: ArrowRightLeft,
  'Fatura Cartão': ArrowRightLeft,
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  wallets,
  currentScope,
  currentUserId,
  selectedDate,
  onEditTransaction,
  onTransactionDeleted,
}) => {
  const { t, language } = useTranslation()
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({})
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  // Fetch author profiles for all transaction user_ids
  useEffect(() => {
    const userIds = transactions.map((t) => t.user_id).filter(Boolean)
    if (userIds.length > 0) {
      fetchProfilesMap(userIds).then(setProfilesMap)
    }
  }, [transactions])

  const walletMap = new Map<string, Wallet>()
  for (const w of wallets) {
    walletMap.set(w.id, w)
  }

  // Filter transactions according to scope
  const filteredTransactions = transactions.filter((t) => {
    if (currentScope === 'all') return true

    const sourceWallet = walletMap.get(t.wallet_id)
    const destWallet = t.destination_wallet_id ? walletMap.get(t.destination_wallet_id) : null

    // Se for 'shared' (Caixa da Família), deve envolver carteira shared
    if (currentScope === 'shared') {
      return sourceWallet?.type === 'shared' || destWallet?.type === 'shared'
    }

    // Se for 'personal' (Minhas Contas), deve envolver carteira personal
    if (currentScope === 'personal') {
      return sourceWallet?.type === 'personal' || destWallet?.type === 'personal'
    }

    return true
  })

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return

    const targetDate = selectedDate || new Date()
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const filename = `kofre_extrato_${year}_${month}.csv`

    exportTransactionsToCSV(filteredTransactions, wallets, filename, {
      language,
      profilesMap,
    })

    setDownloadSuccess(true)
    setTimeout(() => {
      setDownloadSuccess(false)
    }, 3500)
  }

  const handleConfirmDelete = async () => {
    if (!txToDelete) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteTransaction(txToDelete.id)
      setTxToDelete(null)
      onTransactionDeleted()
    } catch (err: unknown) {
      console.error('Error deleting transaction:', err)
      const msg = err instanceof Error ? err.message : 'Erro ao excluir lançamento.'
      setDeleteError(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {t('transactions.title')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
            {filteredTransactions.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {downloadSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{t('transactions.exportSuccess')}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            title={t('transactions.exportExcel')}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-medium transition-all shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('transactions.exportCsv')}</span>
          </button>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 mb-1">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{t('transactions.empty')}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredTransactions.map((tItem) => {
            const sourceWallet = walletMap.get(tItem.wallet_id)
            const destWallet = tItem.destination_wallet_id
              ? walletMap.get(tItem.destination_wallet_id)
              : null

            // Determine if this transaction touches a shared family account
            const isSharedTransaction =
              sourceWallet?.type === 'shared' || destWallet?.type === 'shared'

            // Regra de Permissão: no Caixa da Família, editar/excluir APENAS se transaction.user_id === currentUserId
            const canManage = isSharedTransaction
              ? tItem.user_id === currentUserId
              : true

            const authorName = profilesMap[tItem.user_id] || (language === 'es' ? 'Miembro de la Familia' : 'Membro da Família')

            const CategoryIcon =
              CATEGORY_ICON_MAP[tItem.category] ||
              (tItem.type === 'expense'
                ? ArrowDownCircle
                : tItem.type === 'income'
                ? ArrowUpCircle
                : ArrowRightLeft)

            const translatedCategory = t(`categories.${tItem.category}`, tItem.category)

            return (
              <div
                key={tItem.id}
                className="py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/20 px-2 rounded-2xl transition-all group"
              >
                {/* Left side: Icon and description */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      tItem.type === 'expense'
                        ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                        : tItem.type === 'income'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                        : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20'
                    }`}
                  >
                    <CategoryIcon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    {/* Title / Description */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {tItem.description || translatedCategory}
                      </span>

                      {/* Transferred From/To route */}
                      {tItem.type === 'transfer' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 flex items-center gap-1 font-medium">
                          <span>{sourceWallet?.name || (language === 'es' ? 'Origen' : 'Origem')}</span>
                          <span>➔</span>
                          <span>{destWallet?.name || (language === 'es' ? 'Destino' : 'Destino')}</span>
                        </span>
                      )}
                    </div>

                    {/* Metadata line: Category, Date, Account, and Author for shared */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                      <span>{translatedCategory}</span>
                      <span>&bull;</span>
                      <span>{formatDate(tItem.transaction_date, language)}</span>

                      {/* Account indicator if not transfer */}
                      {tItem.type !== 'transfer' && sourceWallet && (
                        <>
                          <span>&bull;</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {sourceWallet.name}
                          </span>
                        </>
                      )}

                      {/* Etiqueta Obrigatória: Por: [Nome do Usuário] em transações do Caixa da Família */}
                      {isSharedTransaction && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-semibold">
                          <User className="w-3 h-3" />
                          <span>{t('transactions.by')}: {authorName}</span>
                        </span>
                      )}
                    </div>

                    {/* Bimonetary display for frontier expenses */}
                    {tItem.original_amount && tItem.original_currency && (
                      <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                        <Globe2 className="w-3 h-3" />
                        <span>
                          {language === 'es' ? 'Monto original: ' : 'Valor original: '}
                          {formatCurrency(Number(tItem.original_amount), tItem.original_currency)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Formatted Amount and Action Buttons */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right space-y-0.5">
                    <div
                      className={`text-sm sm:text-base font-bold tracking-tight ${
                        tItem.type === 'expense'
                          ? 'text-rose-600 dark:text-rose-400'
                          : tItem.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-indigo-600 dark:text-indigo-300'
                      }`}
                    >
                      {tItem.type === 'expense' && '- '}
                      {tItem.type === 'income' && '+ '}
                      {formatCurrency(Number(tItem.amount), sourceWallet?.currency || 'PYG')}
                    </div>

                    {/* If cross-currency transfer, show credited amount */}
                    {tItem.type === 'transfer' &&
                      destWallet &&
                      sourceWallet &&
                      sourceWallet.currency !== destWallet.currency &&
                      tItem.destination_amount && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400/90 font-mono">
                          {language === 'es' ? 'Recibe: +' : 'Recebe: +'}
                          {formatCurrency(Number(tItem.destination_amount), destWallet.currency)}
                        </div>
                      )}
                  </div>

                  {/* Contextual Action Menu / Buttons (Only if permitted) */}
                  {canManage && (
                    <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tItem)}
                        className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                        title={t('transactions.edit')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxToDelete(tItem)}
                        className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        title={t('transactions.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation Modal for Transaction Deletion */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{t('transactions.deleteConfirmTitle')}</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('transactions.deleteConfirmDesc')}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="font-medium text-slate-900 dark:text-white">
                {txToDelete.description || t(`categories.${txToDelete.category}`, txToDelete.category)}
              </div>
              <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>
                  {t(`categories.${txToDelete.category}`, txToDelete.category)} &bull; {formatDate(txToDelete.transaction_date, language)}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {formatCurrency(Number(txToDelete.amount), walletMap.get(txToDelete.wallet_id)?.currency || 'PYG')}
                </span>
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
              >
                {t('transactions.cancel')}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20 transition-all"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>{t('transactions.confirm')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
