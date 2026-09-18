import React, { useState } from 'react'
import type { Transaction, Wallet, Category } from '../lib/types'
import { formatCurrency, formatDate } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  X,
  Pencil,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  User,
  Users2,
  Globe2,
  Calendar,
  Clock,
  Landmark,
  Folder,
  Tag,
  AlertTriangle,
  Utensils,
  Car,
  Home,
  Gamepad2,
  HeartPulse,
  ShoppingBag,
  Briefcase,
  PiggyBank,
} from 'lucide-react'

export interface TransactionDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: Transaction | null
  wallets: Wallet[]
  categories?: Category[]
  profilesMap?: Record<string, string>
  currentUserId?: string
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
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

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isOpen,
  onClose,
  transaction,
  wallets,
  categories = [],
  profilesMap = {},
  currentUserId,
  onEdit,
  onDelete,
}) => {
  const { t, language } = useTranslation()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  if (!isOpen || !transaction) return null

  const walletMap = new Map<string, Wallet>()
  for (const w of wallets) {
    walletMap.set(w.id, w)
  }

  const sourceWallet = walletMap.get(transaction.wallet_id)
  const destWallet = transaction.destination_wallet_id
    ? walletMap.get(transaction.destination_wallet_id)
    : null

  const isSharedTransaction =
    sourceWallet?.type === 'shared' || destWallet?.type === 'shared'

  const canManage = isSharedTransaction
    ? transaction.user_id === currentUserId
    : true

  const authorName =
    profilesMap[transaction.user_id] ||
    (language === 'es' ? 'Miembro de la Familia' : 'Membro da Família')

  const CategoryIcon =
    CATEGORY_ICON_MAP[transaction.category] ||
    (transaction.type === 'expense'
      ? ArrowDownCircle
      : transaction.type === 'income'
      ? ArrowUpCircle
      : ArrowRightLeft)

  const translatedCategory = t(`categories.${transaction.category}`, transaction.category)

  // Find macro-category
  const categoryItem = categories.find(
    (c) => c.name.trim().toLowerCase() === transaction.category.trim().toLowerCase()
  )
  const macroCategory = categoryItem?.macro_category?.trim() || null

  // Format time if created_at is available
  let timeStr = ''
  if (transaction.created_at) {
    try {
      const d = new Date(transaction.created_at)
      if (!isNaN(d.getTime())) {
        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    } catch {
      timeStr = ''
    }
  }

  const handleDelete = () => {
    onDelete(transaction)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('transactions.detailsTitle')}
            </h2>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                isSharedTransaction
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20'
              }`}
            >
              {isSharedTransaction
                ? t('transactions.scopeShared')
                : t('transactions.scopePersonal')}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('transactions.close')}
            className="cursor-pointer p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Amount & Category Banner */}
        <div className="flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 space-y-2">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              transaction.type === 'expense'
                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                : transaction.type === 'income'
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30'
            }`}
          >
            <CategoryIcon className="w-7 h-7" />
          </div>

          <div>
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                transaction.type === 'expense'
                  ? 'text-rose-600 dark:text-rose-400'
                  : transaction.type === 'income'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              {transaction.type === 'expense' && '- '}
              {transaction.type === 'income' && '+ '}
              {formatCurrency(Number(transaction.amount), sourceWallet?.currency || 'PYG')}
            </div>

            {/* Transfer destination converted amount if cross-currency */}
            {transaction.type === 'transfer' &&
              destWallet &&
              sourceWallet &&
              sourceWallet.currency !== destWallet.currency &&
              transaction.destination_amount && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  {language === 'es' ? 'Recibe: +' : 'Recebe: +'}
                  {formatCurrency(Number(transaction.destination_amount), destWallet.currency)}
                </div>
              )}

            {/* Bimonetary / Frontier expense */}
            {transaction.original_amount && transaction.original_currency && (
              <div className="flex items-center justify-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-mono mt-1">
                <Globe2 className="w-3.5 h-3.5" />
                <span>
                  {language === 'es' ? 'Monto original: ' : 'Valor original: '}
                  {formatCurrency(Number(transaction.original_amount), transaction.original_currency)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Information Grid */}
        <div className="space-y-3 text-xs sm:text-sm">
          {/* Description */}
          <div className="flex items-start justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              {t('transactions.description')}
            </span>
            <span className="font-semibold text-slate-900 dark:text-white text-right max-w-[60%] break-words">
              {transaction.description || translatedCategory}
            </span>
          </div>

          {/* Category & Macro-Category */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-slate-400" />
              {t('transactions.category')}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="font-semibold text-slate-900 dark:text-white">
                {translatedCategory}
              </span>
              {macroCategory && (
                <span className="text-xs px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 font-medium">
                  {macroCategory}
                </span>
              )}
            </div>
          </div>

          {/* Date and Time */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {t('transactions.dateAndTime')}
            </span>
            <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{formatDate(transaction.transaction_date, language)}</span>
              {timeStr && (
                <span className="text-slate-400 font-normal flex items-center gap-1">
                  <Clock className="w-3 h-3 inline" />
                  {timeStr}
                </span>
              )}
            </span>
          </div>

          {/* Account / Route */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-slate-400" />
              {transaction.type === 'transfer' ? t('transactions.transfer') : t('transactions.account')}
            </span>
            <div className="font-semibold text-slate-900 dark:text-white text-right">
              {transaction.type === 'transfer' ? (
                <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-300">
                  <span>{sourceWallet?.name || 'Origem'}</span>
                  <span>➔</span>
                  <span>{destWallet?.name || 'Destino'}</span>
                </div>
              ) : (
                <span>{sourceWallet?.name || '-'}</span>
              )}
            </div>
          </div>

          {/* Author / Registered by */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              {isSharedTransaction ? (
                <Users2 className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <User className="w-3.5 h-3.5 text-slate-400" />
              )}
              {t('transactions.registeredBy')}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {authorName}
            </span>
          </div>
        </div>

        {/* Delete Confirmation Alert if active */}
        {isConfirmingDelete ? (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{t('transactions.deleteConfirmTitle')}</span>
            </div>
            <p className="text-xs text-rose-600 dark:text-rose-400/90 leading-relaxed">
              {t('transactions.deleteConfirmDesc')}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                {t('transactions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="cursor-pointer px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                {t('transactions.confirm')}
              </button>
            </div>
          </div>
        ) : (
          /* Normal Footer Actions */
          <div className="flex items-center justify-between pt-2">
            {canManage ? (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                title={t('transactions.delete')}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl text-xs font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('transactions.delete')}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold transition-colors"
              >
                {t('transactions.close')}
              </button>

              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onEdit(transaction)
                  }}
                  className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/25 transition-all active:scale-95"
                >
                  <Pencil className="w-4 h-4" />
                  <span>{t('transactions.editTransaction')}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}