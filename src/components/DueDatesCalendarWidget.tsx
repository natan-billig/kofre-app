import React, { useState } from 'react'
import type {
  Wallet,
  Transaction,
  RecurringBill,
  DebtItem,
  ScopeFilterType,
  CurrencyCode,
  DueCommitmentItem,
  Profile,
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
  TrendingUp,
  ArrowDownLeft,
} from 'lucide-react'

interface DueDatesCalendarWidgetProps {
  wallets: Wallet[]
  transactions: Transaction[]
  recurringBills: RecurringBill[]
  debts: DebtItem[]
  currentScope?: ScopeFilterType
  preferredCurrency?: CurrencyCode
  selectedMonthDate?: Date
  userProfile?: Profile | null
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
  userProfile,
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

  // 3. Montar lista de movimentações previstas com data de vencimento/recebimento
  const commitments: DueCommitmentItem[] = []

  // A. Salário Base do Perfil (se configurado > 0 e moeda compatível)
  const profileBaseIncome =
    userProfile?.base_monthly_income != null && userProfile.base_monthly_income > 0
      ? Number(userProfile.base_monthly_income)
      : 0
  const profileCurrency = userProfile?.preferred_currency || preferredCurrency

  if (profileBaseIncome > 0 && currencyToUse === profileCurrency) {
    const salaryDay =
      userProfile?.budget_start_day &&
      userProfile.budget_start_day > 0 &&
      userProfile.budget_start_day <= 31
        ? userProfile.budget_start_day
        : 5

    commitments.push({
      id: 'profile-base-salary',
      title: t('calendar.baseSalary') || (language === 'es' ? 'Sueldo Base' : 'Salário Base'),
      amount: profileBaseIncome,
      currency: currencyToUse,
      type: 'base_salary',
      flowType: 'in',
      dueDay: salaryDay,
      entityName: t('calendar.baseSalary') || 'Salário Base',
      scope: currentScope,
    })
  }

  // B. Faturas de Cartão de Crédito
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
        flowType: 'out',
        dueDay: card.due_day,
        entityName: card.name,
        scope: currentScope,
      })
    }
  }

  // C. Contas Fixas Vigentes (Despesas e Receitas)
  for (const bill of recurringBills) {
    if (!bill.is_active) continue
    if (bill.scope !== currentScope) continue
    if (bill.currency !== currencyToUse) continue

    const isIncome = bill.type === 'income'
    // Na saída da fatura do cartão ou débito em conta, considerar o valor total bruto para refletir o débito integral real
    const grossAmount = (!isIncome && bill.total_amount != null && Number(bill.total_amount) > 0)
      ? Number(bill.total_amount)
      : Number(bill.amount)

    commitments.push({
      id: `bill-${bill.id}`,
      title: bill.name,
      amount: grossAmount,
      currency: currencyToUse,
      type: isIncome ? 'recurring_income' : 'recurring_bill',
      flowType: isIncome ? 'in' : 'out',
      dueDay: bill.due_day,
      entityName: bill.category,
      scope: currentScope,
    })
  }

  // D. Dívidas / Empréstimos a Pagar (i_owe)
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
      flowType: 'out',
      dueDay,
      dueDate: debt.due_date || undefined,
      entityName: debt.contact_name,
      scope: currentScope,
    })
  }

  // E. Transações Avulsas Agendadas (is_paid === false || status === 'pending')
  const scopedWalletMap = new Map<string, Wallet>()
  for (const w of scopedWallets) {
    scopedWalletMap.set(w.id, w)
  }

  for (const t of transactions) {
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

    if (t.type === 'expense') {
      commitments.push({
        id: `tx-${t.id}`,
        title:
          t.description ||
          t.category ||
          (language === 'es' ? 'Gasto Programado' : 'Despesa Agendada'),
        amount: Number(t.amount),
        currency: currencyToUse,
        type: 'scheduled_expense',
        flowType: 'out',
        dueDay,
        dueDate: t.transaction_date,
        entityName: t.category,
        scope: currentScope,
        transactionId: t.id,
        is_paid: false,
      })
    } else if (t.type === 'income') {
      commitments.push({
        id: `tx-${t.id}`,
        title:
          t.description ||
          t.category ||
          (language === 'es' ? 'Ingreso Programado' : 'Receita Agendada'),
        amount: Number(t.amount),
        currency: currencyToUse,
        type: 'scheduled_income',
        flowType: 'in',
        dueDay,
        dueDate: t.transaction_date,
        entityName: t.category,
        scope: currentScope,
        transactionId: t.id,
        is_paid: false,
      })
    }
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
      console.error('Error updating scheduled transaction status:', err)
    } finally {
      setPayingId(null)
    }
  }

  // Ordenar itens por dia de vencimento (1 a 31)
  commitments.sort((a, b) => (a.dueDay || 0) - (b.dueDay || 0))

  // Agrupar por dia
  const daysMap = new Map<
    number,
    {
      items: DueCommitmentItem[]
      dayInflow: number
      dayOutflow: number
      projectedBalance: number
      isAtRisk: boolean
    }
  >()

  for (const item of commitments) {
    const d = item.dueDay || 1
    if (!daysMap.has(d)) {
      daysMap.set(d, {
        items: [],
        dayInflow: 0,
        dayOutflow: 0,
        projectedBalance: 0,
        isAtRisk: false,
      })
    }
    const group = daysMap.get(d)!
    group.items.push(item)
    if (item.flowType === 'in') {
      group.dayInflow += item.amount
    } else {
      group.dayOutflow += item.amount
    }
  }

  const sortedDays = Array.from(daysMap.keys()).sort((a, b) => a - b)

  // Cálculo Cronológico Cumulativo do Saldo:
  // Inicializar o caixa no primeiro dia com a liquidez disponível atual
  let runningBalance = liquidCash
  let totalInflow = 0
  let totalOutflow = 0
  let hasOverdraftRisk = false

  for (const d of sortedDays) {
    const group = daysMap.get(d)!
    totalInflow += group.dayInflow
    totalOutflow += group.dayOutflow
    runningBalance = runningBalance + group.dayInflow - group.dayOutflow
    group.projectedBalance = runningBalance
    // Exibir etiqueta "Excede saldo" e o aviso ESTRITAMENTE se o saldoProjetado for menor que zero (< 0)
    group.isAtRisk = runningBalance < 0
    if (group.isAtRisk) {
      hasOverdraftRisk = true
    }
  }

  const finalProjectedBalance = runningBalance

  // Se não houver movimentações futuras neste escopo
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

      {/* Caixa Disponível vs Entradas vs Total de Saídas vs Saldo Projetado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs">
        <div>
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase">
            {t('calendar.liquidAvailable') || 'Liquidez Disponível'}
          </span>
          <span className="font-extrabold text-sm text-slate-900 dark:text-white font-mono">
            {formatCurrency(liquidCash, currencyToUse)}
          </span>
        </div>

        <div>
          <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] font-bold uppercase">
            {t('calendar.totalInflow') || 'Entradas Previstas'}
          </span>
          <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
            +{formatCurrency(totalInflow, currencyToUse)}
          </span>
        </div>

        <div>
          <span className="text-amber-600 dark:text-amber-400 block text-[10px] font-bold uppercase">
            {t('calendar.totalDue') || 'Total a Vencer'}
          </span>
          <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400 font-mono">
            -{formatCurrency(totalOutflow, currencyToUse)}
          </span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase">
            {t('calendar.projectedBalance') || 'Saldo Projetado'}
          </span>
          <span
            className={`font-extrabold text-sm font-mono ${
              finalProjectedBalance >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(finalProjectedBalance, currencyToUse)}
          </span>
        </div>
      </div>

      {/* Alerta de Risco de Sobregiro se Saldo Projetado < 0 */}
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

      {/* Linha do Tempo de Dias de Vencimento e Recebimento */}
      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {sortedDays.map((day) => {
          const group = daysMap.get(day)!

          return (
            <div
              key={day}
              className={`p-3 rounded-xl border transition-all ${
                group.isAtRisk
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

                <div className="text-right flex items-center gap-2">
                  {group.dayInflow > 0 && (
                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(group.dayInflow, currencyToUse)}
                    </span>
                  )}
                  {group.dayOutflow > 0 && (
                    <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                      -{formatCurrency(group.dayOutflow, currencyToUse)}
                    </span>
                  )}
                  {group.isAtRisk && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      {t('calendar.exceedsCash') || 'Excede saldo'}
                    </span>
                  )}
                </div>
              </div>

              {/* Itens do Dia */}
              <div className="space-y-1.5 pl-1">
                {group.items.map((item) => {
                  const isInflow = item.flowType === 'in'
                  let ItemIcon = CalendarCheck
                  let iconColor = 'text-amber-500'

                  if (item.type === 'base_salary') {
                    ItemIcon = TrendingUp
                    iconColor = 'text-emerald-500'
                  } else if (item.type === 'recurring_income') {
                    ItemIcon = ArrowDownLeft
                    iconColor = 'text-emerald-500'
                  } else if (item.type === 'scheduled_income') {
                    ItemIcon = CalendarClock
                    iconColor = 'text-emerald-500'
                  } else if (item.type === 'card_invoice') {
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
                        <span className="truncate font-medium">{item.title}</span>
                        {item.type === 'base_salary' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                            {language === 'es' ? 'Sueldo Base' : 'Salário Base'}
                          </span>
                        )}
                        {item.type === 'recurring_income' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                            {language === 'es' ? 'Ingreso Fijo' : 'Receita Prevista'}
                          </span>
                        )}
                        {item.type === 'scheduled_income' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                            {language === 'es' ? 'A Cobrar' : 'A Receber'}
                          </span>
                        )}
                        {item.type === 'scheduled_expense' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                            {language === 'es' ? 'Por Vencer' : 'A Vencer'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-semibold font-mono ${
                            isInflow
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {isInflow ? '+' : '-'} {formatCurrency(item.amount, item.currency)}
                        </span>
                        {(item.type === 'scheduled_expense' || item.type === 'scheduled_income') &&
                          item.transactionId && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsPaid(item.transactionId!)}
                              disabled={payingId === item.transactionId}
                              className="cursor-pointer px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                              title={
                                item.type === 'scheduled_income'
                                  ? (language === 'es' ? 'Marcar como cobrado' : 'Marcar como recebido')
                                  : (language === 'es' ? 'Marcar como pagado' : 'Marcar como pago')
                              }
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>
                                {payingId === item.transactionId
                                  ? '...'
                                  : item.type === 'scheduled_income'
                                  ? (language === 'es' ? 'Cobrar' : 'Receber')
                                  : (language === 'es' ? 'Pagar' : 'Pagar')}
                              </span>
                            </button>
                          )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Indicador de Fecho Diário com Saldo Projetado */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {t('calendar.projectedBalance') || 'Saldo Projetado'}:
                </span>
                <span
                  className={`font-mono font-bold ${
                    group.projectedBalance >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(group.projectedBalance, currencyToUse)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
