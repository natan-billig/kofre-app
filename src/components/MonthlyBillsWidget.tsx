import React from 'react'
import type { RecurringBill, Transaction, Wallet, WalletScope } from '../lib/types'
import { checkBillPaidInMonth } from '../lib/recurringService'
import { formatCurrency } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  CalendarClock,
  Settings,
  Check,
  Clock,
  ArrowUpRight,
  Plus,
} from 'lucide-react'

interface MonthlyBillsWidgetProps {
  recurringBills: RecurringBill[]
  monthlyTransactions: Transaction[]
  wallets: Wallet[]
  currentScope: WalletScope | 'all'
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

  // Filter bills based on current scope, active status, and temporal validity (start_date)
  const targetDate = selectedDate || new Date()
  const selectedMonthPrefix = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`

  const filteredBills = recurringBills.filter((bill) => {
    if (!bill.is_active) return false
    if (bill.start_date && bill.start_date.substring(0, 7) > selectedMonthPrefix) {
      return false
    }
    if (currentScope === 'all') return true
    return bill.scope === currentScope
  })

  // Check paid status for each bill
  const billsWithStatus = filteredBills.map((bill) => ({
    bill,
    isPaid: checkBillPaidInMonth(bill, monthlyTransactions),
  }))

  const paidCount = billsWithStatus.filter((b) => b.isPaid).length
  const totalCount = billsWithStatus.length
  const progressPercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0

  // Sort: pending first, then by due_day ascending
  const sortedBills = [...billsWithStatus].sort((a, b) => {
    if (a.isPaid !== b.isPaid) {
      return a.isPaid ? 1 : -1
    }
    return a.bill.due_day - b.bill.due_day
  })

  const dayLabel = language.startsWith('es') ? 'Día' : 'Dia'

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <CalendarClock className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            {t('recurringBills.monthlyWidgetTitle')}
          </h2>
          {totalCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
              {paidCount}/{totalCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenManage}
          title={t('recurringBills.manageTitle')}
          className="text-xs flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('categories.manage')}</span>
        </button>
      </div>

      {/* Progress Bar when there are bills */}
      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {paidCount} {t('recurringBills.statusPaid').toLowerCase()} ({progressPercent}%)
            </span>
            <span>
              {totalCount - paidCount} {t('recurringBills.statusPending').toLowerCase()}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Bills List or Empty State */}
      {totalCount === 0 ? (
        <div className="text-center py-6 px-4 border border-dashed border-slate-800/70 rounded-2xl">
          <CalendarClock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-xs font-medium">
            {t('recurringBills.emptyMonth')}
          </p>
          <button
            type="button"
            onClick={onOpenManage}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('recurringBills.newBill')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedBills.map(({ bill, isPaid }) => {
            const debitWallet = wallets.find((w) => w.id === bill.wallet_id)

            return (
              <div
                key={bill.id}
                className="bg-slate-950/40 hover:bg-slate-950/70 border border-slate-800/70 rounded-2xl p-3 transition-colors flex items-center justify-between gap-3"
              >
                {/* Left */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700/60 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[8px] uppercase tracking-wider text-slate-400 font-semibold leading-none">
                      {dayLabel}
                    </span>
                    <span className="text-xs font-bold text-white leading-tight mt-0.5">
                      {bill.due_day}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">
                      {bill.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                      <span>{bill.category}</span>
                      {debitWallet && (
                        <>
                          <span>•</span>
                          <span className="truncate">{debitWallet.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-white tracking-tight">
                      {formatCurrency(bill.amount, bill.currency)}
                    </div>
                    <div className="mt-0.5">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                          <Check className="w-2.5 h-2.5" />
                          {t('recurringBills.statusPaid')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                          <Clock className="w-2.5 h-2.5" />
                          {t('recurringBills.statusPending')}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => onPayBill(bill)}
                      title={t('recurringBills.payBill')}
                      className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-medium rounded-xl shadow-sm shadow-emerald-950/40 transition-all"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span className="font-semibold">{t('recurringBills.pay')}</span>
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
