import React, { useState, useMemo } from 'react'
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
import { checkBillPaidInMonth } from '../lib/recurringService'
import { convertAmount } from '../lib/exchangeRateService'
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
  currentDate?: Date
  userProfile?: Profile | null
  onTransactionPaid?: (transactionId: string) => Promise<void> | void
  onPayCardInvoice?: (card: Wallet, invoiceAmount: number) => void
}

export const DueDatesCalendarWidget: React.FC<DueDatesCalendarWidgetProps> = ({
  wallets,
  transactions,
  recurringBills,
  debts,
  currentScope = 'personal',
  preferredCurrency = 'PYG',
  selectedMonthDate,
  currentDate,
  userProfile,
  onTransactionPaid,
  onPayCardInvoice,
}) => {
  const { t, language } = useTranslation()
  const activeDate = currentDate || selectedMonthDate || new Date()

  // 1. Filtrar carteiras pelo escopo
  const scopedWallets = wallets.filter(
    (w) => !w.is_archived && w.type === currentScope
  )

  // Segregação Bimonetária Inteligente: só habilitar BRL se houver dados ativos em BRL
  const hasBrlData = useMemo(() => {
    if (preferredCurrency === 'BRL') return true
    if (currentScope === 'personal' && userProfile?.preferred_currency === 'BRL' && (userProfile?.base_monthly_income ?? 0) > 0) return true
    if (scopedWallets.some((w) => w.currency === 'BRL')) return true
    if (recurringBills.some((b) => b.is_active && b.scope === currentScope && b.currency === 'BRL')) return true
    if (debts.some((d) => d.status === 'pending' && d.scope === currentScope && d.currency === 'BRL')) return true
    return transactions.some((t) => {
      if (t.is_paid !== false && t.status !== 'pending') return false
      const w = scopedWallets.find((sw) => sw.id === t.wallet_id)
      if (!w) return false
      return (t.original_currency || w.currency) === 'BRL'
    })
  }, [preferredCurrency, currentScope, userProfile, scopedWallets, recurringBills, debts, transactions])

  const activeCurrencies = useMemo(() => {
    const list = getActiveCurrencies(scopedWallets, preferredCurrency)
    if (hasBrlData && !list.includes('BRL')) {
      list.push('BRL')
    }
    if (!hasBrlData) {
      return list.filter((c) => c !== 'BRL')
    }
    return list
  }, [scopedWallets, preferredCurrency, hasBrlData])

  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(preferredCurrency)

  const currencyToUse = activeCurrencies.includes(selectedCurrency)
    ? selectedCurrency
    : preferredCurrency

  // 2. Calcular liquidez disponível no escopo para a moeda selecionada (dinheiro em espécie e contas correntes)
  const balances = calculateBalances(scopedWallets, transactions)
  const liquidCash = balances[currencyToUse] || 0

  // 3. Montar lista de movimentações previstas com data de vencimento/recebimento
  const commitments: DueCommitmentItem[] = []

  // Checagem de desduplicação de receitas na moeda ativa:
  // Se existirem receitas fixas recorrentes cadastradas para o escopo atual na moeda ativa,
  // ou receitas agendadas no mês selecionado na moeda ativa, NÃO injetar o Salário Base do perfil
  // de forma redundante no fluxo de caixa.
  const activeRecurringIncomes = recurringBills.filter(
    (b) => b.is_active && b.type === 'income' && b.scope === currentScope && b.currency === currencyToUse
  )

  const selectedYear = activeDate.getFullYear()
  const selectedMonth = activeDate.getMonth() + 1
  const selectedMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

  const monthlyTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.transaction_date) return false
      const parts = t.transaction_date.split('-')
      if (parts.length < 2) return false
      return parseInt(parts[0], 10) === selectedYear && parseInt(parts[1], 10) === selectedMonth
    })
  }, [transactions, selectedYear, selectedMonth])

  const hasScheduledIncomes = transactions.some((t) => {
    if (t.is_paid !== false && t.status !== 'pending') return false
    if (t.type !== 'income') return false
    if (!t.transaction_date) return false
    const w = scopedWallets.find((wallet) => wallet.id === t.wallet_id)
    const txCurr = (t.original_currency || w?.currency || 'PYG') as CurrencyCode
    if (txCurr !== currencyToUse) return false
    const parts = t.transaction_date.split('-')
    if (parts.length < 2) return false
    const tYear = parseInt(parts[0], 10)
    const tMonth = parseInt(parts[1], 10)
    return tYear === selectedYear && tMonth === selectedMonth
  })

  const hasExplicitIncomes = activeRecurringIncomes.length > 0 || hasScheduledIncomes

  // A. Salário Base do Perfil (Segregação Bimonetária: só injeta se escopo for pessoal e a moeda do perfil for a mesma da visualização)
  const profileBaseIncome =
    userProfile?.base_monthly_income != null && userProfile.base_monthly_income > 0
      ? Number(userProfile.base_monthly_income)
      : 0
  const profileCurrency = userProfile?.preferred_currency || preferredCurrency

  if (currentScope === 'personal' && !hasExplicitIncomes && profileBaseIncome > 0 && profileCurrency === currencyToUse) {
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

  // B. Faturas de Cartão de Crédito (estritamente na moeda ativa)
  const creditCards = scopedWallets.filter(
    (w) => w.account_type === 'credit_card' && w.currency === currencyToUse
  )

  const now = new Date()
  const isFutureMonthCalendar =
    selectedYear > now.getFullYear() ||
    (selectedYear === now.getFullYear() && selectedMonth > (now.getMonth() + 1))

  for (const card of creditCards) {
    const details = getCreditCardInvoiceDetails(card, transactions, activeDate, recurringBills)

    // Regra v1.9.4 & v1.9.5: Apenas injetar a fatura de um cartão no calendário se houver movimentação
    const hasCardActivity =
      (details.grossInvoiceAmount ?? 0) > 0 ||
      details.currentInvoiceAmount > 0 ||
      (!isFutureMonthCalendar && details.totalDebt > 0)
    if (!hasCardActivity) {
      continue
    }

    const openDebt = isFutureMonthCalendar
      ? details.currentInvoiceAmount
      : (details.nextInvoiceAmount > 0 ? details.nextInvoiceAmount : details.totalDebt)
    const hasPendingInvoice = details.currentInvoiceAmount > 0 || (!details.isPaid && openDebt > 0)
    const paidAmt = (details.paidAmount ?? 0) > 0 ? details.paidAmount! : (details.grossInvoiceAmount ?? 0)
    const hasPaidInvoice = details.isPaid && paidAmt > 0 && !isFutureMonthCalendar

    if ((hasPendingInvoice || hasPaidInvoice) && card.due_day) {
      const isPaid = !hasPendingInvoice && hasPaidInvoice
      const amount = hasPendingInvoice
        ? (details.currentInvoiceAmount > 0 ? details.currentInvoiceAmount : openDebt)
        : paidAmt

      if (amount > 0) {
        commitments.push({
          id: `card-${card.id}`,
          title: `${t('calendar.cardInvoice') || 'Fatura'}: ${card.name}`,
          amount,
          currency: currencyToUse,
          type: 'card_invoice',
          flowType: 'out',
          dueDay: card.due_day,
          entityName: card.name,
          scope: currentScope,
          is_paid: isPaid,
          status: isPaid ? 'paid' : 'pending',
          cardWallet: card,
          revolvingAmount: details.revolvingAmount,
        })
      }
    }
  }

  // C. Contas Fixas Vigentes (Visibilidade Total com Segregação de Caixa)
  for (const bill of recurringBills) {
    if (!bill.is_active) continue
    if (bill.scope !== currentScope) continue

    // 1. Identificação de contas debitadas em cartão de crédito
    const linkedWallet = bill.wallet_id
      ? scopedWallets.find((w) => w.id === bill.wallet_id) || wallets.find((w) => w.id === bill.wallet_id)
      : null
    const isCreditCardBill =
      bill.type !== 'income' &&
      ((bill as unknown as { payment_method?: string }).payment_method === 'credit_card' ||
        linkedWallet?.account_type === 'credit_card')
    const creditCardName = isCreditCardBill ? (linkedWallet?.name || 'Cartão') : undefined

    // 2. Filtro temporal de vigência (start_date e end_date)
    if (bill.start_date) {
      const startMonthStr = bill.start_date.substring(0, 7)
      if (startMonthStr > selectedMonthStr) continue
    }
    if (bill.end_date) {
      const endMonthStr = bill.end_date.substring(0, 7)
      if (endMonthStr < selectedMonthStr) continue
    }

    const isIncome = bill.type === 'income'
    const grossAmount = (!isIncome && bill.total_amount != null && Number(bill.total_amount) > 0)
      ? Number(bill.total_amount)
      : Number(bill.amount)

    if (grossAmount <= 0) continue

    let finalAmount: number | null = null

    if (currencyToUse === 'BRL') {
      if (bill.currency === 'BRL') {
        finalAmount = grossAmount
      } else if (linkedWallet && linkedWallet.currency === 'BRL') {
        finalAmount = convertAmount(grossAmount, bill.currency, 'BRL')
      }
    } else if (currencyToUse === 'PYG') {
      if (bill.currency === 'PYG') {
        finalAmount = grossAmount
      } else if (linkedWallet && linkedWallet.currency === 'PYG') {
        finalAmount = convertAmount(grossAmount, bill.currency, 'PYG')
      } else if (bill.currency === 'USD' && (!linkedWallet || linkedWallet.currency === 'PYG')) {
        finalAmount = convertAmount(grossAmount, 'USD', 'PYG')
      }
    } else {
      if (bill.currency === currencyToUse) {
        finalAmount = grossAmount
      } else if (linkedWallet && linkedWallet.currency === currencyToUse) {
        finalAmount = convertAmount(grossAmount, bill.currency, currencyToUse)
      }
    }

    if (finalAmount === null || finalAmount <= 0) continue

    const titleSuffix = bill.currency !== currencyToUse ? ` (${formatCurrency(grossAmount, bill.currency)})` : ''

    // 3. Checagem se a conta já foi liquidada neste mês específico
    const isBillPaid = checkBillPaidInMonth(bill, monthlyTransactions)

    commitments.push({
      id: `bill-${bill.id}`,
      title: `${bill.name}${titleSuffix}`,
      amount: finalAmount,
      currency: currencyToUse,
      type: isIncome ? 'recurring_income' : 'recurring_bill',
      flowType: isIncome ? 'in' : 'out',
      dueDay: bill.due_day,
      entityName: bill.category,
      scope: currentScope,
      is_paid: isBillPaid,
      status: isBillPaid ? 'paid' : 'pending',
      impactsCash: !isCreditCardBill,
      creditCardName,
    })
  }

  // D. Dívidas / Empréstimos a Pagar (estritamente na moeda ativa)
  for (const debt of debts) {
    if (debt.status !== 'pending') continue
    if (debt.scope !== currentScope) continue
    if (debt.type !== 'i_owe') continue
    if (debt.currency !== currencyToUse) continue

    const debtAmt = Number(debt.amount) || 0
    if (debtAmt <= 0) continue

    let dueDay = 28 // fallback
    if (debt.due_date) {
      const parts = debt.due_date.split('-')
      if (parts.length >= 2) {
        const dYear = parseInt(parts[0], 10)
        const dMonth = parseInt(parts[1], 10)
        if (dYear !== selectedYear || dMonth !== selectedMonth) {
          continue
        }
      }
      if (parts.length === 3) {
        dueDay = parseInt(parts[2], 10) || 28
      }
    } else {
      // Dívidas sem data de vencimento específica: só projetar no mês corrente atual
      const now = new Date()
      if (selectedYear !== now.getFullYear() || selectedMonth !== now.getMonth() + 1) {
        continue
      }
    }

    commitments.push({
      id: `debt-${debt.id}`,
      title: `${t('calendar.debtPayment') || 'Pagamento'}: ${debt.contact_name}`,
      amount: debtAmt,
      currency: currencyToUse,
      type: 'debt',
      flowType: 'out',
      dueDay,
      dueDate: debt.due_date || undefined,
      entityName: debt.contact_name,
      scope: currentScope,
      is_paid: false,
      status: 'pending',
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
    if (!wallet) continue

    if (!t.transaction_date) continue

    const parts = t.transaction_date.split('-')
    if (parts.length < 2) continue
    const tYear = parseInt(parts[0], 10)
    const tMonth = parseInt(parts[1], 10)
    if (tYear !== selectedYear || tMonth !== selectedMonth) continue

    const txCurrency = (t.original_currency || wallet.currency || 'PYG') as CurrencyCode
    const rawTxAmount = Number(t.amount) || 0
    if (rawTxAmount <= 0) continue

    // Segregação bimonetária estrita em agendadas:
    let includeTx = false
    if (currencyToUse === 'BRL') {
      includeTx = txCurrency === 'BRL' || wallet.currency === 'BRL'
    } else if (currencyToUse === 'PYG') {
      includeTx = txCurrency === 'PYG' || (txCurrency === 'USD' && wallet.currency === 'PYG')
    } else {
      includeTx = txCurrency === currencyToUse || wallet.currency === currencyToUse
    }
    if (!includeTx) continue

    const convertedTxAmount = convertAmount(rawTxAmount, txCurrency, currencyToUse)
    const titleSuffix = txCurrency !== currencyToUse ? ` (${formatCurrency(rawTxAmount, txCurrency)})` : ''

    let dueDay = 1
    if (t.transaction_date) {
      const parts = t.transaction_date.split('-')
      if (parts.length === 3) {
        dueDay = parseInt(parts[2], 10) || 1
      }
    }

    if (t.type === 'expense') {
      const isCardTx = wallet?.account_type === 'credit_card'
      commitments.push({
        id: `tx-${t.id}`,
        title: `${t.description || t.category || (language === 'es' ? 'Gasto Programado' : 'Despesa Agendada')}${titleSuffix}`,
        amount: convertedTxAmount,
        currency: currencyToUse,
        type: 'scheduled_expense',
        flowType: 'out',
        dueDay,
        dueDate: t.transaction_date,
        entityName: t.category,
        scope: currentScope,
        transactionId: t.id,
        is_paid: false,
        impactsCash: !isCardTx,
        creditCardName: isCardTx ? (wallet?.name || 'Cartão') : undefined,
      })
    } else if (t.type === 'income') {
      commitments.push({
        id: `tx-${t.id}`,
        title: `${t.description || t.category || (language === 'es' ? 'Ingreso Programado' : 'Receita Agendada')}${titleSuffix}`,
        amount: convertedTxAmount,
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
      if (item.is_paid !== true && item.status !== 'paid' && item.impactsCash !== false) {
        group.dayOutflow += item.amount
      }
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
    // Regra Condicional v1.9.4:
    // Renderizar "Excede saldo" ESTRITAMENTE quando houver saídas de caixa no dia (dayOutflow > 0)
    // E o saldo projetado ao final do dia for negativo (runningBalance < 0).
    // Se o dia tiver apenas entradas ou saídas de cartão (impactsCash === false), NUNCA exibir alerta.
    group.isAtRisk = group.dayOutflow > 0 && runningBalance < 0
    if (runningBalance < 0) {
      hasOverdraftRisk = true
    }
  }

  const finalProjectedBalance = runningBalance

  // Se não houver movimentações futuras neste escopo, o container é renderizado com empty state informativo

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

      {/* Linha do Tempo de Dias de Vencimento e Recebimento ou Estado Vazio */}
      {commitments.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
          <CalendarCheck className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('calendar.emptyStateTitle') ||
              (language === 'es'
                ? 'Ningún vencimiento previsto en esta moneda para el mes.'
                : 'Nenhum vencimento previsto nesta moeda para o mês.')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('calendar.emptyStateDesc') ||
              (language === 'es'
                ? 'Las cuentas fijas, facturas e ingresos en esta moneda se proyectarán aquí.'
                : 'Contas fixas, faturas e entradas nesta moeda serão projetadas aqui.')}
          </p>
        </div>
      ) : (
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
                    } else if (item.impactsCash === false) {
                      ItemIcon = CreditCard
                      iconColor = 'text-purple-500'
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
                          {item.type === 'scheduled_expense' && item.impactsCash !== false && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              {language === 'es' ? 'Por Vencer' : 'A Vencer'}
                            </span>
                          )}
                          {item.creditCardName && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20 shrink-0 flex items-center gap-1">
                              <CreditCard className="w-3 h-3 text-purple-500" />
                              <span>{item.creditCardName}</span>
                            </span>
                          )}
                          {item.type === 'recurring_bill' && !item.creditCardName && item.is_paid && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>{language === 'es' ? 'Pagada' : 'Paga'}</span>
                            </span>
                          )}
                          {item.type === 'recurring_bill' && !item.creditCardName && !item.is_paid && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              {language === 'es' ? 'Por Vencer' : 'A Vencer'}
                            </span>
                          )}
                          {item.type === 'card_invoice' && item.is_paid && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>
                                {language === 'es'
                                  ? item.revolvingAmount && item.revolvingAmount > 0
                                    ? 'Pagada (Parcial)'
                                    : 'Pagada'
                                  : item.revolvingAmount && item.revolvingAmount > 0
                                  ? 'Paga (Parcial)'
                                  : 'Paga'}
                              </span>
                            </span>
                          )}
                          {item.type === 'card_invoice' && !item.is_paid && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20 shrink-0">
                              {language === 'es' ? 'Por Vencer' : 'A Vencer'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.impactsCash === false ? (
                            <div className="flex flex-col items-end shrink-0">
                              <span className="font-semibold font-mono text-slate-500 dark:text-slate-400">
                                - {formatCurrency(item.amount, item.currency)}
                              </span>
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium leading-none">
                                {language === 'es' ? '(En extracto)' : '(Na fatura)'}
                              </span>
                            </div>
                          ) : (
                            <span
                              className={`font-semibold font-mono ${
                                isInflow || item.is_paid
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {isInflow ? '+' : item.is_paid ? '✓ ' : '- '}
                              {formatCurrency(item.amount, item.currency)}
                            </span>
                          )}
                          {item.type === 'card_invoice' && !item.is_paid && item.cardWallet && onPayCardInvoice && (
                            <button
                              type="button"
                              onClick={() => onPayCardInvoice(item.cardWallet!, item.amount)}
                              className="cursor-pointer px-2 py-0.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95"
                              title={language === 'es' ? 'Pagar extracto de tarjeta' : 'Pagar fatura do cartão'}
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>{language === 'es' ? 'Pagar Extracto' : 'Pagar Fatura'}</span>
                            </button>
                          )}
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
      )}
    </div>
  )
}
