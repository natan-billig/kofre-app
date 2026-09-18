import React, { useState } from 'react'
import type {
  Wallet,
  Transaction,
  RecurringBill,
  DebtItem,
  ScopeFilterType,
  CurrencyCode,
  DueCommitmentItem,
} from '../lib/types'
import { getCreditCardInvoiceDetails } from '../lib/creditCardService'
import { calculateBalances, getActiveCurrencies, updateTransaction } from '../lib/accountingService'
import { formatCurrency } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  Calendar,
  CreditCard,
  CalendarCheck,
  HandCoins,
  ShieldAlert,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react'

interface DueDatesCalendarWidgetProps {
  wallets: Wallet[]
  transactions: Transaction[]
  recurringBills: RecurringBill[]
  debts: DebtItem[]
  currentScope?: ScopeFilterType
  preferredCurrency?: CurrencyCode
  selectedMonthDate?: Date
  onTransactionPaid?: (transactionId: string) => Promise<void> | void
}

export const DueDatesCalendarWidget: React.FC<DueDatesCalendarWidgetProps> = ({
  wallets,
  transactions,
  recurringBills,
  debts,
  currentScope = 'personal',
  preferredCurrency = 'PYG',
  selectedMonthDate = new Date(),
  onTransactionPaid,
}) => {
  const { t, language } = useTranslation()

  // Moedas disponíveis
  const activeCurrencies = getActiveCurrencies(wallets, preferredCurrency)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(preferredCurrency)

  const currencyToUse = activeCurrencies.includes(selectedCurrency)
    ? selectedCurrency
    : preferredCurrency

  // 1. Filtrar carteiras pelo escopo
  const scopedWallets = wallets.filter(
    (w) => !w.is_archived && w.type === currentScope
  )

  // 2. Calcular liquidez disponível no escopo para a moeda selecionada (dinheiro em espécie e contas correntes)
  const balances = calculateBalances(scopedWallets, transactions)
  const liquidCash = balances[currencyToUse] || 0

  // 3. Montar lista de compromissos com data de vencimento
  const commitments: DueCommitmentItem[] = []

  // A. Faturas de Cartão de Crédito
  const creditCards = scopedWallets.filter(
    (w) => w.account_type === 'credit_card' && w.currency === currencyToUse
  )

  for (const card of creditCards) {
    const details = getCreditCardInvoiceDetails(card, transactions, selectedMonthDate)
    if (details.currentInvoiceAmount > 0 && card.due_day) {
      commitments.push({
        id: `card-${card.id}`,
        title: `${t('calendar.cardInvoice') || 'Fatura'}: ${card.name}`,
        amount: details.currentInvoiceAmount,
        currency: currencyToUse,
        type: 'card_invoice',
        dueDay: card.due_day,
        entityName: card.name,
        scope: currentScope,
      })
    }
  }

  // B. Contas Fixas Vigentes
  for (const bill of recurringBills) {
    if (!bill.is_active) continue
    if (bill.scope !== currentScope) continue
    if (bill.currency !== currencyToUse) continue
    if (bill.type === 'income') continue

    commitments.push({
      id: `bill-${bill.id}`,
      title: bill.name,
      amount: bill.amount,
      currency: currencyToUse,
      type: 'recurring_bill',
      dueDay: bill.due_day,
      entityName: bill.category,
      scope: currentScope,
    })
  }

  // C. Dívidas / Empréstimos a Pagar (i_owe)
  for (const debt of debts) {
    if (debt.status !== 'pending') continue
    if (debt.scope !== currentScope) continue
    if (debt.currency !== currencyToUse) continue
    if (debt.type !== 'i_owe') continue

    let dueDay = 28 // fallback
    if (debt.due_date) {
      const parts = debt.due_date.split('-')
      if (parts.length === 3) {
        dueDay = parseInt(parts[2], 10) || 28
      }
    }

    commitments.push({
      id: `debt-${debt.id}`,
      title: `${t('calendar.debtPayment') || 'Pagamento'}: ${debt.contact_name}`,
      amount: debt.amount,
      currency: currencyToUse,
      type: 'debt',
      dueDay,
      dueDate: debt.due_date || undefined,
      entityName: debt.contact_name,
      scope: currentScope,
    })
  }

  // D. Despesas Avulsas Agendadas / Não Pagas (is_paid === false || status === 'pending')
  const scopedWalletMap = new Map<string, Wallet>()
  for (const w of scopedWallets) {
    scopedWalletMap.set(w.id, w)
  }

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (t.is_paid !== false && t.status !== 'pending') continue

    const wallet = scopedWalletMap.get(t.wallet_id)
    if (!wallet || wallet.currency !== currencyToUse) continue

    let dueDay = 1
    if (t.transaction_date) {
      const parts = t.transaction_date.split('-')
      if (parts.length === 3) {
        dueDay = parseInt(parts[2], 10) || 1
      }
    }

    commitments.push({
      id: `tx-${t.id}`,
      title: t.description || t.category || (language === 'es' ? 'Gasto Programado' : 'Despesa Agendada'),
      amount: Number(t.amount),
      currency: currencyToUse,
      type: 'scheduled_expense',
      dueDay,
      dueDate: t.transaction_date,
      entityName: t.category,
      scope: currentScope,
      transactionId: t.id,
      is_paid: false,
    })
  }

  const [payingId, setPayingId] = useState<string | null>(null)

  const handleMarkAsPaid = async (transactionId: string) => {
    setPayingId(transactionId)
    try {
      if (onTransactionPaid) {
        await onTransactionPaid(transactionId)
      } else {
        await updateTransaction(transactionId, { is_paid: true, status: 'completed' })
      }
    } catch (err) {
      console.error('Error marking scheduled expense as paid:', err)
    } finally {
      setPayingId(null)
    }
  }

  // Ordenar compromissos por dia de vencimento (1 a 31)
  commitments.sort((a, b) => (a.dueDay || 0) - (b.dueDay || 0))

  // Agrupar por dia e calcular saídas acumuladas
  let cumulativeOutflow = 0
  const daysMap = new Map<number, { items: DueCommitmentItem[]; dayTotal: number; cumulative: number }>()

  for (const item of commitments) {
    const d = item.dueDay || 1
    cumulativeOutflow += item.amount
    if (!daysMap.has(d)) {
      daysMap.set(d, { items: [], dayTotal: 0, cumulative: 0 })
    }
    const group = daysMap.get(d)!
    group.items.push(item)
    group.dayTotal += item.amount
    group.cumulative = cumulativeOutflow
  }

  const sortedDays = Array.from(daysMap.keys()).sort((a, b) => a - b)
  const totalCommitmentsAmount = cumulativeOutflow
  const hasOverdraftRisk = totalCommitmentsAmount > liquidCash && liquidCash >= 0

  // Se não houver compromissos futuros neste escopo
  if (commitments.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm transition-colors">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {t('calendar.title') || 'Calendário de Vencimentos & Caixa'}
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('calendar.subtitle') || 'Projeção cronológica de compromissos do mês'}
            </span>
          </div>
        </div>

        {/* Currency Switcher */}
        {activeCurrencies.length > 1 && (
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-bold">
            {activeCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCurrency(c)}
                className={`cursor-pointer px-2 py-0.5 rounded-md transition-all ${
                  currencyToUse === c
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Caixa Disponível vs Total de Saídas */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs">
        <div>
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase">
            {t('calendar.liquidAvailable') || 'Liquidez Disponível'}
          </span>
          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
            {formatCurrency(liquidCash, currencyToUse)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase">
            {t('calendar.totalDue') || 'Total a Vencer'}
          </span>
          <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400">
            {formatCurrency(totalCommitmentsAmount, currencyToUse)}
          </span>
        </div>
      </div>

      {/* Alerta de Risco de Sobregiro se Saídas > Liquidez */}
      {hasOverdraftRisk && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <span className="font-bold text-rose-900 dark:text-rose-200 block">
              {t('calendar.overdraftRiskTitle') || 'Atenção: Risco de Sobregiro'}
            </span>
            <p className="text-rose-700 dark:text-rose-300">
              {t('calendar.overdraftRiskDesc') ||
                'Os compromissos agendados ultrapassam o saldo líquido imediato. Garanta novas receitas ou organize o caixa antes das datas.'}
            </p>
          </div>
        </div>
      )}

      {/* Linha do Tempo de Dias de Vencimento */}
      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {sortedDays.map((day) => {
          const group = daysMap.get(day)!
          const isAtRisk = group.cumulative > liquidCash

          return (
            <div
              key={day}
              className={`p-3 rounded-xl border transition-all ${
                isAtRisk
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                  : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
                    {day}
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('calendar.dayOfMonth') || 'Dia'} {day}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatCurrency(group.dayTotal, currencyToUse)}
                  </span>
                  {isAtRisk && (
                    <span className="text-[10px] block font-semibold text-rose-600 dark:text-rose-400">
                      {t('calendar.exceedsCash') || 'Excede saldo'}
                    </span>
                  )}
                </div>
              </div>

              {/* Itens do Dia */}
              <div className="space-y-1.5 pl-1">
                {group.items.map((item) => {
                  let ItemIcon = CalendarCheck
                  let iconColor = 'text-amber-500'
                  if (item.type === 'card_invoice') {
                    ItemIcon = CreditCard
                    iconColor = 'text-indigo-500'
                  } else if (item.type === 'debt') {
                    ItemIcon = HandCoins
                    iconColor = 'text-rose-500'
                  } else if (item.type === 'scheduled_expense') {
                    ItemIcon = CalendarClock
                    iconColor = 'text-amber-500'
                  }

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 py-0.5"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <ItemIcon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
                        <span className="truncate">{item.title}</span>
                        {item.type === 'scheduled_expense' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                            {language === 'es' ? 'Por Vencer' : 'A Vencer'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold">
                          {formatCurrency(item.amount, item.currency)}
                        </span>
                        {item.type === 'scheduled_expense' && item.transactionId && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(item.transactionId!)}
                            disabled={payingId === item.transactionId}
                            className="cursor-pointer px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                            title={language === 'es' ? 'Marcar como pagado' : 'Marcar como pago'}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{payingId === item.transactionId ? '...' : (language === 'es' ? 'Pagar' : 'Pagar')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
