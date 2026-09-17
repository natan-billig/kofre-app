import React from 'react'
import type { Transaction, Wallet, CurrencyCode, WalletScope } from '../lib/types'
import { formatCurrency } from '../lib/formatters'
import { getActiveCurrencies } from '../lib/accountingService'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'

interface MonthlySummaryProps {
  transactions: Transaction[]
  wallets: Wallet[]
  currentScope?: WalletScope | 'all'
  preferredCurrency?: CurrencyCode
}

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({
  transactions,
  wallets,
  currentScope = 'all',
  preferredCurrency = 'PYG',
}) => {
  const { t } = useTranslation()

  const walletMap = new Map<string, Wallet>()
  for (const w of wallets) {
    walletMap.set(w.id, w)
  }

  const totals: Record<CurrencyCode, { income: number; expense: number }> = {
    PYG: { income: 0, expense: 0 },
    USD: { income: 0, expense: 0 },
    BRL: { income: 0, expense: 0 },
  }

  for (const tx of transactions) {
    // REGRA OBRIGATÓRIA: Ignorar transferências para não inflar despesas fictícias
    if (tx.type === 'transfer') continue

    const wallet = walletMap.get(tx.wallet_id)
    if (currentScope !== 'all' && wallet?.type !== currentScope) {
      continue
    }

    const currency = (wallet?.currency || 'PYG') as CurrencyCode

    if (!totals[currency]) {
      totals[currency] = { income: 0, expense: 0 }
    }

    const amount = Number(tx.amount) || 0
    if (tx.type === 'income') {
      totals[currency].income += amount
    } else if (tx.type === 'expense') {
      totals[currency].expense += amount
    }
  }

  // Moedas ativas baseadas nas carteiras configuradas e na moeda preferida
  const candidateCurrencies = getActiveCurrencies(wallets, preferredCurrency)
  const activeCurrencies = candidateCurrencies.filter((c) => {
    const hasActivity = totals[c] && (totals[c].income > 0 || totals[c].expense > 0)
    const hasConfiguredWallet = wallets.some(
      (w) => w.currency === c && !w.is_archived && (currentScope === 'all' || w.type === currentScope)
    )
    return hasActivity || hasConfiguredWallet
  })

  if (activeCurrencies.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-center shadow-sm">
        <p className="text-xs sm:text-sm font-medium text-slate-400">
          {t('monthlySummary.empty')}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 sm:p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {t('monthlySummary.title')}
        </span>
      </div>

      <div className="space-y-2.5">
        {activeCurrencies.map((curr) => {
          const { income, expense } = totals[curr]
          const balance = income - expense
          const isPositive = balance >= 0

          return (
            <div
              key={curr}
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {curr}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Entradas */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <ArrowDownLeft className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{t('monthlySummary.incomes')}</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-emerald-400 truncate">
                    +{formatCurrency(income, curr)}
                  </div>
                </div>

                {/* Saídas */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <ArrowUpRight className="w-3 h-3 text-rose-400 flex-shrink-0" />
                    <span className="truncate">{t('monthlySummary.expenses')}</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-rose-400 truncate">
                    -{formatCurrency(expense, curr)}
                  </div>
                </div>

                {/* Balanço */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <Scale className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{t('monthlySummary.balance')}</span>
                  </div>
                  <div
                    className={`text-xs sm:text-sm font-bold truncate ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive
                      ? `+${formatCurrency(balance, curr)}`
                      : `-${formatCurrency(Math.abs(balance), curr)}`}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
