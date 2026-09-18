import React, { useEffect, useMemo, useState } from 'react'
import type { Transaction, Wallet, ScopeFilterType, Category } from '../lib/types'
import { formatCurrency, formatDate } from '../lib/formatters'
import { fetchProfilesMap } from '../lib/profileService'
import { fetchCategories } from '../lib/categoryService'
import { deleteTransaction } from '../lib/accountingService'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { TransactionDetailsModal } from './TransactionDetailsModal'
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
  Search,
  X,
  SlidersHorizontal,
  Calendar,
  Tag,
  Sparkles,
  CreditCard,
} from 'lucide-react'
import { exportTransactionsToCSV } from '../lib/exportService'
import { fetchTransactionsByDateRange } from '../lib/accountingService'

interface TransactionListProps {
  transactions: Transaction[]
  wallets: Wallet[]
  currentScope: ScopeFilterType
  currentUserId: string
  selectedDate?: Date
  selectedCategory?: string | null
  onSelectCategory?: (cat: string | null) => void
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
  selectedCategory,
  onSelectCategory,
  onEditTransaction,
  onTransactionDeleted,
}) => {
  const { t, language } = useTranslation()
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [selectedTxForDetails, setSelectedTxForDetails] = useState<Transaction | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  // Search and client-side filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all')

  // Custom date range state
  const [isCustomRangeActive, setIsCustomRangeActive] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rangeTransactions, setRangeTransactions] = useState<Transaction[] | null>(null)
  const [loadingRange, setLoadingRange] = useState(false)

  // Fetch author profiles for all transaction user_ids
  useEffect(() => {
    const userIds = transactions.map((t) => t.user_id).filter(Boolean)
    if (userIds.length > 0) {
      fetchProfilesMap(userIds).then(setProfilesMap)
    }
  }, [transactions])

  // Fetch categories for macro-category resolution in details modal
  useEffect(() => {
    let isMounted = true
    fetchCategories(currentScope)
      .then((cats) => {
        if (isMounted) setCategories(cats)
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [currentScope])

  const walletMap = useMemo(() => {
    const map = new Map<string, Wallet>()
    for (const w of wallets) {
      map.set(w.id, w)
    }
    return map
  }, [wallets])

  // Wallets available for filtering in current scope
  const scopedWallets = useMemo(() => {
    return wallets.filter((w) => !w.is_archived && w.type === currentScope)
  }, [wallets, currentScope])

  // Derive effective wallet id (auto-resets if current selection doesn't belong to current scope)
  const effectiveWalletId = scopedWallets.some((w) => w.id === selectedWalletId)
    ? selectedWalletId
    : ''

  // Build macro category map for matching categories when filtered by a macro-category name
  const categoryMacroMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cat of categories) {
      if (cat.macro_category && cat.macro_category.trim()) {
        map.set(cat.name, cat.macro_category.trim())
      }
    }
    return map
  }, [categories])

  // Trigger server fetch if custom date range is defined
  useEffect(() => {
    let isMounted = true
    if (!isCustomRangeActive || (!startDate && !endDate)) {
      return
    }

    const walletIds = wallets.map((w) => w.id)
    if (walletIds.length === 0) return

    queueMicrotask(() => {
      if (isMounted) setLoadingRange(true)
    })

    fetchTransactionsByDateRange(walletIds, startDate, endDate)
      .then((data) => {
        if (isMounted) setRangeTransactions(data)
      })
      .catch((err) => {
        console.error('Erro ao buscar transações por intervalo:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingRange(false)
      })

    return () => {
      isMounted = false
    }
  }, [isCustomRangeActive, startDate, endDate, wallets])

  // Determine base transactions (from custom date range if active and loaded, or current monthly transactions)
  const baseTransactions = isCustomRangeActive && (startDate || endDate) && rangeTransactions !== null
    ? rangeTransactions
    : transactions

  // Filter transactions according to scope
  const scopedTransactions = useMemo(() => {
    return baseTransactions.filter((t) => {
      const sourceWallet = walletMap.get(t.wallet_id)
      const destWallet = t.destination_wallet_id ? walletMap.get(t.destination_wallet_id) : null

      if (currentScope === 'shared') {
        return sourceWallet?.type === 'shared' || destWallet?.type === 'shared'
      }

      return sourceWallet?.type === 'personal' || destWallet?.type === 'personal'
    })
  }, [baseTransactions, currentScope, walletMap])

  // Filter 100% client-side by search query, wallet, type, and selected category
  const visibleTransactions = useMemo(() => {
    return scopedTransactions.filter((tx) => {
      // Type filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false
      }

      // Wallet filter
      if (effectiveWalletId) {
        const matchesWallet =
          tx.wallet_id === effectiveWalletId || tx.destination_wallet_id === effectiveWalletId
        if (!matchesWallet) return false
      }

      // Selected category filter (direct match or match through macro_category)
      if (selectedCategory) {
        const cleanSelected = selectedCategory.trim().toLowerCase()
        const txCat = (tx.category || '').toLowerCase()
        const macro = (categoryMacroMap.get(tx.category) || '').toLowerCase()
        if (txCat !== cleanSelected && macro !== cleanSelected) {
          return false
        }
      }

      // Text search filter (description, category, author)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const desc = (tx.description || '').toLowerCase()
        const cat = (tx.category || '').toLowerCase()
        const translatedCat = t(`categories.${tx.category}`, tx.category).toLowerCase()
        const author = (profilesMap[tx.user_id] || '').toLowerCase()

        const matchesText =
          desc.includes(query) ||
          cat.includes(query) ||
          translatedCat.includes(query) ||
          author.includes(query)

        if (!matchesText) return false
      }

      return true
    })
  }, [scopedTransactions, selectedType, effectiveWalletId, selectedCategory, categoryMacroMap, searchQuery, profilesMap, t])

  const isFilterActive =
    searchQuery.trim() !== '' ||
    effectiveWalletId !== '' ||
    selectedType !== 'all' ||
    Boolean(selectedCategory) ||
    isCustomRangeActive

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedWalletId('')
    setSelectedType('all')
    onSelectCategory?.(null)
    setIsCustomRangeActive(false)
    setStartDate('')
    setEndDate('')
    setRangeTransactions(null)
  }

  // Dynamic sum calculation for filtered transactions
  const filteredTotalsByCurrency = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const tx of visibleTransactions) {
      const w = walletMap.get(tx.wallet_id)
      const curr = w?.currency || 'PYG'
      const amt = Number(tx.amount || 0)
      if (!totals[curr]) totals[curr] = 0
      if (tx.type === 'expense') {
        totals[curr] += amt
      } else if (tx.type === 'income') {
        totals[curr] -= amt
      }
    }
    return totals
  }, [visibleTransactions, walletMap])

  const handleExportCSV = () => {
    if (visibleTransactions.length === 0) return

    const targetDate = selectedDate || new Date()
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const filename = isCustomRangeActive && (startDate || endDate)
      ? `kofre_extrato_${startDate || 'inicio'}_a_${endDate || 'fim'}.csv`
      : `kofre_extrato_${year}_${month}.csv`

    exportTransactionsToCSV(visibleTransactions, wallets, filename, {
      language,
      profilesMap,
    })

    setDownloadSuccess(true)
    setTimeout(() => {
      setDownloadSuccess(false)
    }, 3500)
  }

  const handleConfirmDelete = async (deleteAllInstallments: boolean = false) => {
    if (!txToDelete) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteTransaction(
        txToDelete.id,
        deleteAllInstallments,
        txToDelete.installment_group_id
      )
      setTxToDelete(null)
      if (selectedTxForDetails?.id === txToDelete.id) {
        setSelectedTxForDetails(null)
      }
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
    <div
      id="transaction-list"
      className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm scroll-mt-6"
    >
      {/* Header & Export Action */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {t('transactions.title')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
            {visibleTransactions.length}
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
            disabled={visibleTransactions.length === 0}
            title={t('transactions.exportExcel')}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-medium transition-all shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('transactions.exportCsv')}</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Search input, Wallet dropdown, and Type chips */}
      <div className="space-y-2.5 pt-1">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Text Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('transactions.searchPlaceholder')}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Account / Wallet Dropdown */}
          <div className="sm:w-56 shrink-0">
            <select
              value={effectiveWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer truncate"
            >
              <option value="">{t('transactions.allAccounts')}</option>
              {scopedWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.currency})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Type Filter Chips and Custom Period Toggle */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="text-xs text-slate-400 dark:text-slate-500 mr-1 hidden sm:inline flex-shrink-0">
              <SlidersHorizontal className="w-3 h-3 inline mr-1" />
              {t('transactions.filterByType')}:
            </span>
            {[
              { id: 'all', label: t('transactions.allTypes') },
              { id: 'expense', label: t('transactions.expensesType') },
              { id: 'income', label: t('transactions.incomesType') },
              { id: 'transfer', label: t('transactions.transfersType') },
            ].map((tab) => {
              const active = selectedType === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedType(tab.id as 'all' | 'expense' | 'income' | 'transfer')}
                  className={`cursor-pointer px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                      : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Toggle Intervalo Personalizado */}
          <button
            type="button"
            onClick={() => {
              setIsCustomRangeActive((prev) => !prev)
              if (isCustomRangeActive) {
                setStartDate('')
                setEndDate('')
                setRangeTransactions(null)
              }
            }}
            className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-all ${
              isCustomRangeActive
                ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/80 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('transactions.customPeriod')}</span>
          </button>
        </div>

        {/* Custom Date Range Inputs (when enabled) */}
        {isCustomRangeActive && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-indigo-200 dark:border-indigo-900/40 flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-150">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              {t('transactions.customPeriod')}:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-slate-500 dark:text-slate-400">{t('transactions.from')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-500 dark:text-slate-400">{t('transactions.to')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {loadingRange && (
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </span>
            )}
          </div>
        )}

        {/* Active Filter Indicator & Clear Button with Dynamic Sum */}
        {isFilterActive && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category chip if filtered by category drill-down */}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-medium text-[11px] shadow-sm">
                  <Tag className="w-3 h-3" />
                  <span>
                    {t('transactions.filteringBy')}: {t(`categories.${selectedCategory}`, selectedCategory)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectCategory?.(null)}
                    className="cursor-pointer hover:opacity-80 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t('transactions.totalFiltered')}:
              </span>

              {/* Dynamic sum per currency */}
              <div className="flex items-center gap-2 font-mono font-bold text-slate-900 dark:text-white">
                {Object.entries(filteredTotalsByCurrency).length > 0 ? (
                  Object.entries(filteredTotalsByCurrency).map(([curr, amt]) => (
                    <span key={curr} className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800">
                      {formatCurrency(amt, curr as any)}
                    </span>
                  ))
                ) : (
                  <span>0</span>
                )}
                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                  ({visibleTransactions.length}{' '}
                  {visibleTransactions.length === 1
                    ? t('transactions.singleTransactionCount')
                    : t('transactions.transactionsCount')})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="cursor-pointer inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline ml-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t('transactions.clearFilter')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Transaction Feed or Empty State */}
      {scopedTransactions.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 mb-1">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{t('transactions.empty')}</p>
        </div>
      ) : visibleTransactions.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
            <Search className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t('transactions.noFilteredResults')}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t('transactions.clearFilters')}</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {visibleTransactions.map((tItem) => {
            const sourceWallet = walletMap.get(tItem.wallet_id)
            const destWallet = tItem.destination_wallet_id
              ? walletMap.get(tItem.destination_wallet_id)
              : null

            // Determine if this transaction touches a shared family account
            const isSharedTransaction =
              sourceWallet?.type === 'shared' || destWallet?.type === 'shared'

            // Permission rule: in Caixa da Família, edit/delete ONLY if transaction.user_id === currentUserId
            const canManage = isSharedTransaction
              ? tItem.user_id === currentUserId
              : true

            const authorName =
              profilesMap[tItem.user_id] ||
              (language === 'es' ? 'Miembro de la Familia' : 'Membro da Família')

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
                onClick={() => setSelectedTxForDetails(tItem)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedTxForDetails(tItem)
                  }
                }}
                className="py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 px-2.5 rounded-2xl transition-all group cursor-pointer"
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

                      {/* Parcelamento / Cuota Badge */}
                      {tItem.installment_number && tItem.total_installments && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 flex items-center gap-1 font-semibold">
                          <CreditCard className="w-3 h-3 text-purple-500" />
                          <span>
                            {t('transactions.installmentBadge')
                              .replace('{current}', String(tItem.installment_number))
                              .replace('{total}', String(tItem.total_installments))}
                          </span>
                        </span>
                      )}

                      {/* Reintegro Bancário Badge */}
                      {tItem.cashback_amount && Number(tItem.cashback_amount) > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1 font-semibold">
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                          <span>
                            {t('transactions.cashbackBadge').replace(
                              '{amount}',
                              formatCurrency(Number(tItem.cashback_amount), sourceWallet?.currency || 'PYG')
                            )}
                          </span>
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

                      {/* Author tag in shared family box */}
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
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditTransaction(tItem)
                        }}
                        className="cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                        title={t('transactions.edit')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setTxToDelete(tItem)
                        }}
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

      {/* Transaction Details Read-Only Modal */}
      <TransactionDetailsModal
        isOpen={Boolean(selectedTxForDetails)}
        onClose={() => setSelectedTxForDetails(null)}
        transaction={selectedTxForDetails}
        wallets={wallets}
        categories={categories}
        profilesMap={profilesMap}
        currentUserId={currentUserId}
        onEdit={(tx) => onEditTransaction(tx)}
        onDelete={(tx) => setTxToDelete(tx)}
      />

      {/* Confirmation Modal for Transaction Deletion */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {txToDelete.installment_group_id
                  ? t('transactions.deleteInstallmentGroupTitle')
                  : t('transactions.deleteConfirmTitle')}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {txToDelete.installment_group_id
                ? t('transactions.deleteInstallmentGroupDesc').replace(
                    '{total}',
                    String(txToDelete.total_installments || '')
                  )
                : t('transactions.deleteConfirmDesc')}
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

            {txToDelete.installment_group_id ? (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleConfirmDelete(false)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{t('transactions.deleteInstallmentOnly')}</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleConfirmDelete(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20 transition-all"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{t('transactions.deleteAllInstallments')}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTxToDelete(null)}
                  className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium cursor-pointer transition-colors"
                >
                  {t('transactions.cancel')}
                </button>
              </div>
            ) : (
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
                  onClick={() => handleConfirmDelete(false)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20 transition-all"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{t('transactions.confirm')}</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}