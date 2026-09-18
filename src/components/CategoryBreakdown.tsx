import React, { useState, useEffect, useMemo } from 'react'
import type {
  Transaction,
  Wallet,
  CurrencyCode,
  WalletScope,
  Category,
  MacroCategoryExpenseItem,
  CategoryExpenseItem,
} from '../lib/types'
import { calculateCategoryExpenses, getActiveCurrencies } from '../lib/accountingService'
import { fetchCategories, DEFAULT_MACRO_MAP } from '../lib/categoryService'
import { formatCurrency } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  PieChart,
  Utensils,
  Car,
  Home,
  Gamepad2,
  HeartPulse,
  ShoppingBag,
  Briefcase,
  PiggyBank,
  ShoppingCart,
  GraduationCap,
  Wrench,
  MoreHorizontal,
  ChevronDown,
  Folder,
  Tag,
} from 'lucide-react'

interface CategoryBreakdownProps {
  transactions: Transaction[]
  wallets: Wallet[]
  currentScope?: WalletScope | 'all'
  preferredCurrency?: CurrencyCode
  categories?: Category[]
}

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Alimentação: Utensils,
  Supermercado: ShoppingCart,
  Moradia: Home,
  Transporte: Car,
  Lazer: Gamepad2,
  Saúde: HeartPulse,
  Compras: ShoppingBag,
  Salário: Briefcase,
  Investimentos: PiggyBank,
  Educação: GraduationCap,
  Serviços: Wrench,
  Outros: MoreHorizontal,
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  transactions,
  wallets,
  currentScope = 'all',
  preferredCurrency = 'PYG',
  categories: propCategories,
}) => {
  const { t } = useTranslation()

  // View Mode: 'group' (englobado por macro-categoria) ou 'detailed' (detalhado)
  const [viewMode, setViewMode] = useState<'group' | 'detailed'>('group')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [loadedCategories, setLoadedCategories] = useState<Category[]>([])

  useEffect(() => {
    let isMounted = true
    if (!propCategories) {
      fetchCategories(currentScope === 'all' ? 'personal' : currentScope)
        .then((data) => {
          if (isMounted) setLoadedCategories(data)
        })
        .catch(() => {})
    }
    return () => {
      isMounted = false
    }
  }, [currentScope, propCategories])

  const activeCategoryList = propCategories || loadedCategories

  const categoryMacroMap = useMemo(() => {
    const map: Record<string, string> = { ...DEFAULT_MACRO_MAP }
    for (const cat of activeCategoryList) {
      if (cat.macro_category && cat.macro_category.trim()) {
        map[cat.name] = cat.macro_category.trim()
      }
    }
    return map
  }, [activeCategoryList])

  const breakdown = useMemo(() => {
    return calculateCategoryExpenses(transactions, wallets, currentScope)
  }, [transactions, wallets, currentScope])

  const activeCurrencies = useMemo(() => {
    const candidateCurrencies = getActiveCurrencies(wallets, preferredCurrency)
    const currenciesWithExpenses = candidateCurrencies.filter(
      (curr) => breakdown[curr]?.items.length > 0
    )

    // Se nenhuma moeda teve despesa, retorna vazio para renderizar o estado vazio
    if (currenciesWithExpenses.length === 0) return []

    // Caso contrário, lista as moedas ativas que tiveram despesa ou a moeda preferida
    return candidateCurrencies.filter(
      (curr) =>
        breakdown[curr]?.items.length > 0 ||
        (curr === preferredCurrency &&
          wallets.some(
            (w) => w.currency === curr && !w.is_archived && (currentScope === 'all' || w.type === currentScope)
          ))
    )
  }, [breakdown, wallets, currentScope, preferredCurrency])

  const [userSelectedCurrency, setUserSelectedCurrency] = useState<CurrencyCode | null>(null)

  const selectedCurrency: CurrencyCode =
    userSelectedCurrency && activeCurrencies.includes(userSelectedCurrency)
      ? userSelectedCurrency
      : activeCurrencies.includes(preferredCurrency)
      ? preferredCurrency
      : activeCurrencies[0] || preferredCurrency

  const currentData = breakdown[selectedCurrency] || {
    currency: selectedCurrency,
    total: 0,
    items: [],
  }

  // Agrupamento por Macro-categoria para a visão "Por Grupo"
  const macroGroups: MacroCategoryExpenseItem[] = useMemo(() => {
    const groupMap = new Map<string, { amount: number; subcategories: Map<string, number> }>()

    for (const item of currentData.items) {
      const macro = categoryMacroMap[item.category] || item.category || 'Outros'
      if (!groupMap.has(macro)) {
        groupMap.set(macro, { amount: 0, subcategories: new Map() })
      }
      const g = groupMap.get(macro)!
      g.amount += item.amount
      g.subcategories.set(
        item.category,
        (g.subcategories.get(item.category) || 0) + item.amount
      )
    }

    const total = currentData.total
    const result: MacroCategoryExpenseItem[] = []

    for (const [macroCategory, data] of groupMap.entries()) {
      const percentage = total > 0 ? (data.amount / total) * 100 : 0
      const subcategories: CategoryExpenseItem[] = []

      for (const [subName, subAmount] of data.subcategories.entries()) {
        const subPercentage = total > 0 ? (subAmount / total) * 100 : 0
        subcategories.push({
          category: subName,
          amount: subAmount,
          percentage: subPercentage,
        })
      }

      subcategories.sort((a, b) => b.amount - a.amount)

      result.push({
        macroCategory,
        amount: data.amount,
        percentage,
        subcategories,
      })
    }

    result.sort((a, b) => b.amount - a.amount)
    return result
  }, [currentData.items, currentData.total, categoryMacroMap])

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  if (activeCurrencies.length === 0) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-center shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto mb-2">
          <PieChart className="w-4 h-4" />
        </div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('categoryBreakdown.title')}
        </div>
        <p className="text-xs sm:text-sm font-medium text-slate-400">
          {t('categoryBreakdown.empty')}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-5 space-y-3.5 shadow-sm transition-colors">
      {/* Header: Title, View Switcher, and Currency Selector Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
            <PieChart className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {t('categoryBreakdown.title')}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle: Por Grupo | Detalhado */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/70 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setViewMode('group')}
              className={`cursor-pointer px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === 'group'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              {t('categoryBreakdown.byGroup')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`cursor-pointer px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === 'detailed'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              {t('categoryBreakdown.detailed')}
            </button>
          </div>

          {/* Currency Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/70 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
            {activeCurrencies.map((curr) => {
              const isSelected = curr === selectedCurrency
              return (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setUserSelectedCurrency(curr)}
                  className={`cursor-pointer px-2.5 py-1 text-[11px] font-bold font-mono rounded-lg transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {curr}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Period Total Summary */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">
          {t('categoryBreakdown.periodTotal')}
        </span>
        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm">
          {formatCurrency(currentData.total, selectedCurrency)}
        </span>
      </div>

      {/* Content Section: Por Grupo vs Detalhado */}
      {viewMode === 'group' ? (
        /* VISÃO POR GRUPO (ENGLOBADO COM ACCORDION) */
        <div className="space-y-3 pt-1">
          {macroGroups.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              {t('categoryBreakdown.empty')}
            </p>
          ) : (
            macroGroups.map((group) => {
              const MacroIcon = CATEGORY_ICON_MAP[group.macroCategory] || Folder
              const isExpanded = expandedGroups.has(group.macroCategory)
              const translatedMacro = t(`categories.${group.macroCategory}`, group.macroCategory)
              const formattedPercentage =
                group.percentage > 0 && group.percentage < 0.5
                  ? '< 1%'
                  : `${Math.round(group.percentage)}%`

              return (
                <div
                  key={group.macroCategory}
                  className="rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/70 p-2.5 space-y-2 transition-all hover:border-slate-300 dark:hover:border-slate-700/80"
                >
                  {/* Top row: Toggle Button / Group Info */}
                  <div
                    onClick={() => toggleGroup(group.macroCategory)}
                    className="flex items-center justify-between cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                        <MacroIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm truncate">
                        {translatedMacro}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono flex-shrink-0">
                        {group.subcategories.length}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
                      <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono text-xs sm:text-sm">
                        {formatCurrency(group.amount, selectedCurrency)}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600 font-normal">&bull;</span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-xs font-medium">
                        {formattedPercentage}
                      </span>
                    </div>
                  </div>

                  {/* Proportional horizontal progress bar with gradient */}
                  <div className="h-2 w-full bg-slate-200/80 dark:bg-slate-950/80 rounded-full overflow-hidden p-[1px] border border-slate-300/60 dark:border-slate-800/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-violet-500 transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(Math.max(group.percentage, 2), 100)}%` }}
                    />
                  </div>

                  {/* Subcategories Accordion Content */}
                  {isExpanded && (
                    <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-800/80 space-y-2 pl-2 sm:pl-3">
                      {group.subcategories.map((sub) => {
                        const SubIcon = CATEGORY_ICON_MAP[sub.category] || Tag
                        const translatedSub = t(`categories.${sub.category}`, sub.category)
                        const subFormattedPct =
                          sub.percentage > 0 && sub.percentage < 0.5
                            ? '< 1%'
                            : `${Math.round(sub.percentage)}%`

                        return (
                          <div key={sub.category} className="space-y-1 group/sub">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                <SubIcon className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover/sub:text-indigo-500 dark:group-hover/sub:text-indigo-400 transition-colors flex-shrink-0" />
                                <span className="text-slate-700 dark:text-slate-300 truncate">
                                  {translatedSub}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
                                <span className="font-mono text-slate-700 dark:text-slate-300 text-xs">
                                  {formatCurrency(sub.amount, selectedCurrency)}
                                </span>
                                <span className="text-slate-400 dark:text-slate-600 font-normal">&bull;</span>
                                <span className="text-slate-500 font-mono text-[11px]">
                                  {subFormattedPct}
                                </span>
                              </div>
                            </div>

                            {/* Subcategory proportional bar */}
                            <div className="h-1 w-full bg-slate-200 dark:bg-slate-900/90 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500/60 rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(Math.max(sub.percentage, 1), 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* VISÃO DETALHADA (LISTAGEM CLÁSSICA POR CATEGORIA INDIVIDUAL) */
        <div className="space-y-3 pt-1">
          {currentData.items.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              {t('categoryBreakdown.empty')}
            </p>
          ) : (
            currentData.items.map((item) => {
              const CategoryIcon = CATEGORY_ICON_MAP[item.category] || MoreHorizontal
              const translatedCategory = t(`categories.${item.category}`, item.category)
              const formattedPercentage =
                item.percentage > 0 && item.percentage < 0.5
                  ? '< 1%'
                  : `${Math.round(item.percentage)}%`

              return (
                <div key={item.category} className="space-y-1.5 group">
                  {/* Top row: Name with Icon (Left) & Formatted Amount and Percentage (Right) */}
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center flex-shrink-0 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                        <CategoryIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {translatedCategory}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
                      <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">
                        {formatCurrency(item.amount, selectedCurrency)}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600 font-normal">&bull;</span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-xs font-medium">
                        {formattedPercentage}
                      </span>
                    </div>
                  </div>

                  {/* Proportional horizontal progress bar with subtle gradient (emerald/indigo/violet) */}
                  <div className="h-2 w-full bg-slate-200/80 dark:bg-slate-950/80 rounded-full overflow-hidden p-[1px] border border-slate-300/60 dark:border-slate-800/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-violet-500 transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(Math.max(item.percentage, 2), 100)}%` }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
