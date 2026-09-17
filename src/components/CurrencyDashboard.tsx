import React, { useState } from 'react'
import type { CurrencyBalances, CardInvoiceSummary, Wallet } from '../lib/types'
import { formatCurrency } from '../lib/formatters'
import { CreditCard, Eye, EyeOff, Calendar, ArrowUpRight, Sparkles } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'

interface CurrencyDashboardProps {
  balances: CurrencyBalances
  cardInvoices: CardInvoiceSummary[]
  onPayCardInvoice: (cardWallet: Wallet, invoiceAmount: number) => void
}

export const CurrencyDashboard: React.FC<CurrencyDashboardProps> = ({
  balances,
  cardInvoices,
  onPayCardInvoice,
}) => {
  const { t } = useTranslation()
  const [showValues, setShowValues] = useState(true)

  return (
    <div className="space-y-4">
      {/* Header with Privacy Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('dashboard.liquidBalances')}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {t('accounts.cash')} + {t('accounts.checking')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowValues(!showValues)}
          className="cursor-pointer flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          title={showValues ? 'Ocultar' : 'Exibir'}
        >
          {showValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{showValues ? '••••' : '👁'}</span>
        </button>
      </div>

      {/* 3 Currency Balance Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* PYG */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-indigo-300">Total PYG (Guaranis)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              PYG
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {showValues ? formatCurrency(balances.PYG, 'PYG') : '₲ •••••••'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Disponível em caixa e contas</p>
        </div>

        {/* USD */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-emerald-300">Total USD (Dólares)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              USD
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {showValues ? formatCurrency(balances.USD, 'USD') : '$ ••••'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Disponível em caixa e contas</p>
        </div>

        {/* BRL */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-amber-300">Total BRL (Reais)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              BRL
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {showValues ? formatCurrency(balances.BRL, 'BRL') : 'R$ ••••'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Disponível em caixa e contas</p>
        </div>
      </div>

      {/* Credit Card Invoices Block */}
      {cardInvoices.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('dashboard.cardInvoices')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cardInvoices.map(({ wallet, invoiceAmount, availableLimit }) => {
              const hasLimit = wallet.credit_limit != null && Number(wallet.credit_limit) > 0
              const limit = hasLimit ? Number(wallet.credit_limit) : 0
              const pctUsed = limit > 0 ? Math.min(100, Math.max(0, (invoiceAmount / limit) * 100)) : 0

              return (
                <div
                  key={wallet.id}
                  className="rounded-2xl p-4 bg-slate-900 border border-purple-500/20 shadow-md space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-white text-sm">{wallet.name}</h2>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          {wallet.currency}
                        </span>
                        {wallet.type === 'shared' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {t('nav.family')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.currentInvoice')}</p>
                    </div>

                    {/* Pay Invoice Action */}
                    <button
                      type="button"
                      onClick={() => onPayCardInvoice(wallet, invoiceAmount)}
                      className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-xs font-medium text-purple-200 transition-all"
                    >
                      <span>{t('dashboard.payInvoice')}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Invoice Amount */}
                  <div className="flex items-baseline justify-between">
                    <div className="text-lg sm:text-xl font-bold text-purple-200">
                      {showValues ? formatCurrency(invoiceAmount, wallet.currency) : '••••••'}
                    </div>
                    {hasLimit && availableLimit !== null && (
                      <span className="text-xs text-slate-400">
                        {t('dashboard.availableLimit')}: {showValues ? formatCurrency(availableLimit, wallet.currency) : '••••'}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar if Limit exists */}
                  {hasLimit && (
                    <div className="space-y-1">
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pctUsed > 80 ? 'bg-rose-500' : pctUsed > 50 ? 'bg-amber-500' : 'bg-purple-500'
                          }`}
                          style={{ width: `${pctUsed}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{t('createAccount.creditLimit')}: {formatCurrency(limit, wallet.currency)}</span>
                        <span>{pctUsed.toFixed(0)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Closing & Due Dates */}
                  {(wallet.closing_day || wallet.due_day) && (
                    <div className="flex items-center gap-3 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                      {wallet.closing_day && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{t('dashboard.closesOn')} {wallet.closing_day}</span>
                        </div>
                      )}
                      {wallet.due_day && (
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-slate-400" />
                          <span>{t('dashboard.dueOn')} {wallet.due_day}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
