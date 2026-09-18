import React, { useState } from 'react'
import type { RecurringBill, Transaction, Wallet, ScopeFilterType } from '../lib/types'
import { checkBillPaidInMonth } from '../lib/recurringService'
import { formatCurrency } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  CalendarClock,
  Settings,
  Check,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
} from 'lucide-react'

interface MonthlyBillsWidgetProps {
  recurringBills: RecurringBill[]
  monthlyTransactions: Transaction[]
  wallets: Wallet[]
  currentScope: ScopeFilterType
  selectedDate?: Date
  onOpenManage: () => void
  onPayBill: (bill: RecurringBill) => void
}

export const MonthlyBillsWidget: React.FC<MonthlyBillsWidgetProps> = ({
  recurringBills,
  monthlyTransactions,
  wallets,
  currentScope,
  selectedDate,
  onOpenManage,
  onPayBill,
}) => {
  const { t, language } = useTranslation()
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')

  // Filter bills based on current scope, active status, and temporal validity (start_date)
  const targetDate = selectedDate || new Date()
  const selectedMonthPrefix = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`

  const filteredBills = recurringBills.filter((bill) => {
    if (!bill.is_active) return false
    if (bill.start_date && bill.start_date.substring(0, 7) > selectedMonthPrefix) {
      return false
    }
    return bill.scope === currentScope
  })

  // Ocultação Condicional: Renderizar no painel apenas se houver pelo menos 1 conta fixa no escopo ativo
  if (filteredBills.length === 0) {
    return null
  }

  // Check paid status for each bill
  const billsWithStatus = filteredBills.map((bill) => ({
    bill,
    isPaid: checkBillPaidInMonth(bill, monthlyTransactions),
  }))

  const expenseCount = billsWithStatus.filter((b) => b.bill.type !== 'income').length
  const incomeCount = billsWithStatus.filter((b) => b.bill.type === 'income').length

  // Filter according to active tab
  const displayedBillsWithStatus = billsWithStatus.filter((b) => {
    if (typeFilter === 'expense') return b.bill.type !== 'income'
    if (typeFilter === 'income') return b.bill.type === 'income'
    return true
  })

  const paidCount = displayedBillsWithStatus.filter((b) => b.isPaid).length
  const totalCount = displayedBillsWithStatus.length
  const progressPercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0

  // Sort: pending first, then by due_day ascending
  const sortedBills = [...displayedBillsWithStatus].sort((a, b) => {
    if (a.isPaid !== b.isPaid) {
      return a.isPaid ? 1 : -1
    }
    return a.bill.due_day - b.bill.due_day
  })

  const dayLabel = language.startsWith('es') ? 'Día' : 'Dia'

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
            <CalendarClock className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {t('recurringBills.monthlyWidgetTitle')}
          </h2>
          {totalCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
              {paidCount}/{totalCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenManage}
          title={t('categories.manage') || t('recurringBills.manageTitle')}
          aria-label={t('categories.manage') || t('recurringBills.manageTitle')}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs: Todas | Despesas Previstas | Rendas Previstas (apenas se houver itens ou rendas cadastradas) */}
      {(billsWithStatus.length > 0 || incomeCount > 0) && (
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/70 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              typeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
            }`}
          >
            {t('recurringBills.allTypes')} ({billsWithStatus.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('expense')}
            className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              typeFilter === 'expense'
                ? 'bg-rose-500/10 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
            }`}
          >
            {t('recurringBills.expectedExpenses')} ({expenseCount})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('income')}
            className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              typeFilter === 'income'
                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
            }`}
          >
            {t('recurringBills.expectedIncomes')} ({incomeCount})
          </button>
        </div>
      )}

      {/* Progress Bar when there are bills in current view */}
      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {paidCount}{' '}
              {typeFilter === 'income'
                ? t('recurringBills.statusReceived').toLowerCase()
                : t('recurringBills.statusPaid').toLowerCase()}{' '}
              ({progressPercent}%)
            </span>
            <span>
              {totalCount - paidCount}{' '}
              {typeFilter === 'income'
                ? t('recurringBills.statusToReceive').toLowerCase()
                : t('recurringBills.statusPending').toLowerCase()}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                typeFilter === 'income' ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Bills List or Empty State */}
      {totalCount === 0 ? (
        <div className="text-center py-6 px-4 border border-dashed border-slate-200 dark:border-slate-800/70 rounded-2xl">
          <CalendarClock className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            {typeFilter === 'income'
              ? t('recurringBills.emptyIncomes')
              : typeFilter === 'expense'
              ? t('recurringBills.emptyExpenses')
              : t('recurringBills.emptyMonth')}
          </p>
          <button
            type="button"
            onClick={onOpenManage}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-medium rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('recurringBills.newBill')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedBills.map(({ bill, isPaid }) => {
            const wallet = wallets.find((w) => w.id === bill.wallet_id)
            const isIncome = bill.type === 'income'

            return (
              <div
                key={bill.id}
                className="bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-950/40 dark:hover:bg-slate-950/70 border border-slate-200 dark:border-slate-800/70 rounded-2xl p-3 transition-colors flex items-center justify-between gap-3"
              >
                {/* Left */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl border flex flex-col items-center justify-center shrink-0 ${
                      isIncome
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-500/30'
                        : 'bg-slate-100 border-slate-200 dark:bg-slate-800/90 dark:border-slate-700/60'
                    }`}
                  >
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold leading-none">
                      {dayLabel}
                    </span>
                    <span
                      className={`text-xs font-bold leading-tight mt-0.5 ${
                        isIncome ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {bill.due_day}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {bill.name}
                      </span>
                      {isIncome && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 font-medium shrink-0">
                          {t('recurringBills.typeIncome')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                      <span>{bill.category}</span>
                      {wallet && (
                        <>
                          <span>•</span>
                          <span className="truncate">{wallet.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <div
                      className={`text-xs font-bold tracking-tight font-mono ${
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {isIncome ? '+' : ''}
                      {formatCurrency(bill.amount, bill.currency)}
                    </div>
                    <div className="mt-0.5">
                      {isIncome ? (
                        isPaid ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-md">
                            <Check className="w-3 h-3" />
                            {t('recurringBills.statusReceived')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3" />
                            {t('recurringBills.statusToReceive')}
                          </span>
                        )
                      ) : isPaid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-md">
                          <Check className="w-3 h-3" />
                          {t('recurringBills.statusPaid')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3" />
                          {t('recurringBills.statusPending')}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => onPayBill(bill)}
                      title={
                        isIncome
                          ? t('recurringBills.confirmReceive')
                          : t('recurringBills.payBill')
                      }
                      className={`cursor-pointer flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-medium rounded-xl shadow-sm active:scale-95 transition-all ${
                        isIncome
                          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                          : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/40'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                      <span className="font-semibold">
                        {isIncome ? t('recurringBills.receive') : t('recurringBills.pay')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
