import React, { useState, useMemo } from 'react'
import type { Transaction, Wallet, CurrencyCode, WalletScope } from '../lib/types'
import { calculateCategoryExpenses } from '../lib/accountingService'
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
} from 'lucide-react'

interface CategoryBreakdownProps {
  transactions: Transaction[]
  wallets: Wallet[]
  currentScope?: WalletScope | 'all'
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

const ALL_CURRENCIES: CurrencyCode[] = ['PYG', 'USD', 'BRL']

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  transactions,
  wallets,
  currentScope = 'all',
}) => {
  const { t } = useTranslation()

  const breakdown = useMemo(() => {
    return calculateCategoryExpenses(transactions, wallets, currentScope)
  }, [transactions, wallets, currentScope])

  const activeCurrencies = useMemo(() => {
    return ALL_CURRENCIES.filter((curr) => breakdown[curr]?.items.length > 0)
  }, [breakdown])

  const [userSelectedCurrency, setUserSelectedCurrency] = useState<CurrencyCode | null>(null)

  const selectedCurrency: CurrencyCode =
    userSelectedCurrency && activeCurrencies.includes(userSelectedCurrency)
      ? userSelectedCurrency
      : activeCurrencies[0] || 'PYG'

  if (activeCurrencies.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 text-center shadow-sm space-y-2">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-800/80 text-slate-400">
          <PieChart className="w-4 h-4" />
        </div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {t('categoryBreakdown.title')}
        </div>
        <p className="text-xs sm:text-sm font-medium text-slate-400">
          {t('categoryBreakdown.empty')}
        </p>
      </div>
    )
  }

  const currentData = breakdown[selectedCurrency] || {
    currency: selectedCurrency,
    total: 0,
    items: [],
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 sm:p-5 space-y-3.5 shadow-sm">
      {/* Header: Title and Currency Selector Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <PieChart className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {t('categoryBreakdown.title')}
          </span>
        </div>

        {/* Currency Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80">
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
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {curr}
              </button>
            )
          })}
        </div>
      </div>

      {/* Period Total Summary */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs">
        <span className="text-slate-400 font-medium">
          {t('categoryBreakdown.periodTotal')}
        </span>
        <span className="font-bold text-slate-100 font-mono text-sm">
          {formatCurrency(currentData.total, selectedCurrency)}
        </span>
      </div>

      {/* Ranked Category Items */}
      <div className="space-y-3 pt-1">
        {currentData.items.map((item) => {
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
                  <div className="w-6 h-6 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-indigo-400 transition-colors">
                    <CategoryIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-200 truncate">
                    {translatedCategory}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
                  <span className="font-semibold text-rose-400 font-mono">
                    {formatCurrency(item.amount, selectedCurrency)}
                  </span>
                  <span className="text-slate-600 font-normal">&bull;</span>
                  <span className="text-slate-400 font-mono text-xs font-medium">
                    {formattedPercentage}
                  </span>
                </div>
              </div>

              {/* Proportional horizontal progress bar with subtle gradient (emerald/indigo/violet) */}
              <div className="h-2 w-full bg-slate-950/80 rounded-full overflow-hidden p-[1px] border border-slate-800/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-violet-500 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(Math.max(item.percentage, 2), 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
