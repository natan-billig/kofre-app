import type { Wallet, Transaction, RecurringBill, CreditCardInvoiceDetails } from './types'
import { calculateAccountBalance, createTransaction } from './accountingService'
import { convertAmount } from './exchangeRateService'

export interface PayInvoiceParams {
  userId: string
  cardWallet: Wallet
  sourceWallet: Wallet
  amount: number
  sourceAmount?: number
  paymentDate?: string
  isPartial?: boolean
}

/**
 * Registra o pagamento e liquidação de fatura de cartão de crédito via transferência bancária,
 * garantindo estrita integridade contábil (sem duplicação de despesas por categoria).
 */
export async function payCreditCardInvoice(params: PayInvoiceParams): Promise<Transaction> {
  const { userId, cardWallet, sourceWallet, amount, paymentDate, isPartial } = params

  const effectiveCardAmount = Math.max(0, amount)
  let effectiveSourceAmount = params.sourceAmount

  if (effectiveSourceAmount == null || effectiveSourceAmount <= 0) {
    if (sourceWallet.currency === cardWallet.currency) {
      effectiveSourceAmount = effectiveCardAmount
    } else {
      effectiveSourceAmount = convertAmount(effectiveCardAmount, cardWallet.currency, sourceWallet.currency)
    }
  }

  const txDate = paymentDate || new Date().toISOString().substring(0, 10)
  const isRollover = Boolean(isPartial)

  const description = isRollover
    ? `Pagamento Parcial de Fatura - ${cardWallet.name} (Rotativo)`
    : `Pagamento de Fatura - ${cardWallet.name}`

  return await createTransaction({
    user_id: userId,
    wallet_id: sourceWallet.id,
    destination_wallet_id: cardWallet.id,
    type: 'transfer',
    amount: effectiveSourceAmount,
    destination_amount: effectiveCardAmount,
    category: 'Fatura Cartão',
    description,
    transaction_date: txDate,
    is_paid: true,
    status: 'completed',
  })
}

/**
 * Projeta os valores de contas fixas recorrentes vinculadas ao cartão que vencem/cobram
 * dentro da janela de compras do ciclo da fatura (entre prevClosingDate e currentClosingDate).
 */
export function getProjectedRecurringBillsAmount(
  wallet: Wallet,
  recurringBills: RecurringBill[] = [],
  transactions: Transaction[] = [],
  prevClosingDate: Date,
  currentClosingDate: Date,
  isFutureMonth: boolean = false
): number {
  if (!recurringBills || recurringBills.length === 0) return 0

  const now = new Date()
  const isFuture =
    isFutureMonth ||
    currentClosingDate.getTime() > now.getTime() ||
    currentClosingDate.getFullYear() > now.getFullYear() ||
    (currentClosingDate.getFullYear() === now.getFullYear() && currentClosingDate.getMonth() > now.getMonth())

  const prevClosingDateStr = `${prevClosingDate.getFullYear()}-${String(
    prevClosingDate.getMonth() + 1
  ).padStart(2, '0')}-${String(prevClosingDate.getDate()).padStart(2, '0')}`

  const closingDateStr = `${currentClosingDate.getFullYear()}-${String(
    currentClosingDate.getMonth() + 1
  ).padStart(2, '0')}-${String(currentClosingDate.getDate()).padStart(2, '0')}`

  let totalProjected = 0

  for (const bill of recurringBills) {
    if (!bill.is_active) continue
    if (bill.type === 'income') continue

    // Identifica vínculo com o cartão de crédito
    const isLinked =
      bill.wallet_id === wallet.id ||
      (bill as unknown as { destination_wallet_id?: string; account_id?: string }).destination_wallet_id === wallet.id ||
      (bill as unknown as { destination_wallet_id?: string; account_id?: string }).account_id === wallet.id ||
      (bill as unknown as { payment_method?: string }).payment_method === 'credit_card'

    if (!isLinked) continue

    // Se for mês futuro / ciclo projetado:
    // Todas as assinaturas ativas vinculadas ao cartão incidem no ciclo mensal integralmente,
    // sem bloqueios indevidos de datas em meses futuros (isFuture = true).
    if (isFuture) {
      const effectiveAmount =
        bill.is_shared && bill.my_share_amount != null && Number(bill.my_share_amount) > 0
          ? Number(bill.my_share_amount)
          : Number(bill.total_amount) || Number(bill.amount) || 0

      if (effectiveAmount <= 0) continue

      const convertedAmount =
        bill.currency === wallet.currency
          ? effectiveAmount
          : convertAmount(effectiveAmount, bill.currency, wallet.currency)

      totalProjected += convertedAmount
      continue
    }

    // Ciclo Corrente ou Passado (validação estrita de janela de compras)
    const closingYear = currentClosingDate.getFullYear()
    const closingMonth = currentClosingDate.getMonth()
    const maxDayClosingMonth = new Date(closingYear, closingMonth + 1, 0).getDate()
    const effClosingDay = currentClosingDate.getDate()

    const prevClosingYear = prevClosingDate.getFullYear()
    const prevClosingMonth = prevClosingDate.getMonth()
    const maxDayPrevClosing = new Date(prevClosingYear, prevClosingMonth + 1, 0).getDate()

    const billDueDay = bill.due_day || 1
    let chargeYear = closingYear
    let chargeMonth = closingMonth
    let chargeDay = Math.min(billDueDay, maxDayClosingMonth)

    if (billDueDay > effClosingDay) {
      // Despesas com dia > closing_day cobram no mês anterior ao fechamento
      chargeYear = prevClosingYear
      chargeMonth = prevClosingMonth
      chargeDay = Math.min(billDueDay, maxDayPrevClosing)
    }

    const chargeDateStr = `${chargeYear}-${String(chargeMonth + 1).padStart(2, '0')}-${String(chargeDay).padStart(2, '0')}`

    // Checa se a data da cobrança cai estritamente dentro da janela de compras do ciclo
    if (chargeDateStr <= prevClosingDateStr || chargeDateStr > closingDateStr) {
      continue
    }

    // Validação temporal de vigência da assinatura
    if (bill.start_date) {
      const startStr = bill.start_date.substring(0, 10)
      if (startStr > chargeDateStr) continue
    }
    if (bill.end_date) {
      const endStr = bill.end_date.substring(0, 10)
      if (endStr < chargeDateStr) continue
    }

    // Checagem se a assinatura já foi efetivada como transação real neste ciclo
    const alreadyRecorded = transactions.some((t) => {
      if (t.wallet_id !== wallet.id) return false
      if (t.type !== 'expense') return false
      const txDate = t.transaction_date || ''
      if (txDate <= prevClosingDateStr || txDate > closingDateStr) return false
      if ((t as unknown as { recurring_bill_id?: string }).recurring_bill_id === bill.id) return true
      if (t.description && bill.name && t.description.trim().toLowerCase() === bill.name.trim().toLowerCase()) return true
      return false
    })

    if (alreadyRecorded) {
      continue
    }

    const effectiveAmount =
      bill.is_shared && bill.my_share_amount != null && Number(bill.my_share_amount) > 0
        ? Number(bill.my_share_amount)
        : Number(bill.total_amount) || Number(bill.amount) || 0

    if (effectiveAmount <= 0) continue

    const convertedAmount =
      bill.currency === wallet.currency
        ? effectiveAmount
        : convertAmount(effectiveAmount, bill.currency, wallet.currency)

    totalProjected += convertedAmount
  }

  return totalProjected
}

/**
 * Calcula os detalhes e segmentação do ciclo de fatura de um cartão de crédito.
 * Segrega o saldo devedor entre "Fatura Atual" e "Próxima Fatura" com base no dia de fechamento,
 * com suporte a liquidação em 1 clique, detecção de fatura paga e rolagem de saldo rotativo.
 */
export function getCreditCardInvoiceDetails(
  wallet: Wallet,
  transactions: Transaction[],
  referenceDate: Date = new Date(),
  recurringBills: RecurringBill[] = []
): CreditCardInvoiceDetails {
  const closingDay = wallet.closing_day != null && wallet.closing_day >= 1 && wallet.closing_day <= 31
    ? wallet.closing_day
    : null
  const dueDay = wallet.due_day != null && wallet.due_day >= 1 && wallet.due_day <= 31
    ? wallet.due_day
    : null

  const totalDebt = calculateAccountBalance(wallet, transactions)

  // Caso o cartão não possua dia de fechamento configurado, considera todo o saldo devedor na fatura atual
  if (!closingDay) {
    let grossDebt = Number(wallet.initial_balance || 0)
    let totalPayments = 0

    for (const t of transactions) {
      if (t.type === 'expense' && t.wallet_id === wallet.id) {
        grossDebt += Number(t.amount) || 0
      } else if (t.type === 'income' && t.wallet_id === wallet.id) {
        grossDebt -= Number(t.amount) || 0
      } else if (t.type === 'transfer' && t.destination_wallet_id === wallet.id) {
        totalPayments += Number(t.destination_amount ?? t.amount) || 0
      }
    }

    const grossInvoiceAmount = Math.max(0, grossDebt)
    const isPaid = grossInvoiceAmount > 0 && totalPayments >= grossInvoiceAmount
    const isPartiallyPaid = grossInvoiceAmount > 0 && totalPayments > 0 && totalPayments < grossInvoiceAmount
    const revolvingAmount = isPartiallyPaid ? grossInvoiceAmount - totalPayments : 0
    const currentInvoiceAmount = isPaid || isPartiallyPaid ? 0 : Math.max(0, totalDebt)
    const nextInvoiceAmount = revolvingAmount

    return {
      wallet,
      currentInvoiceAmount,
      nextInvoiceAmount,
      totalDebt,
      closingDay: null,
      dueDay,
      currentClosingDate: null,
      dueDate: null,
      isClosed: false,
      isPaid: isPaid || isPartiallyPaid,
      isPartiallyPaid,
      paidAmount: totalPayments > 0 ? Math.min(totalPayments, grossInvoiceAmount) : 0,
      revolvingAmount,
      grossInvoiceAmount,
    }
  }

  const now = new Date()
  const currentRealYear = now.getFullYear()
  const currentRealMonth = now.getMonth()

  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth()

  const isFutureMonth =
    refYear > currentRealYear ||
    (refYear === currentRealYear && refMonth > currentRealMonth)

  // Determina o ciclo da fatura com vencimento no mês de referência (ou ciclo corrente do mês de referência)
  let closingYear = refYear
  let closingMonth = refMonth

  if (dueDay && dueDay < closingDay) {
    // Vencimento ocorre no mês seguinte ao fechamento (ex: fecha dia 25, vence dia 5).
    // Logo, a fatura que VENCE no mês de referência fechou no mês anterior.
    if (refMonth === 0) {
      closingYear = refYear - 1
      closingMonth = 11
    } else {
      closingMonth = refMonth - 1
    }
  }

  const maxDayClosingMonth = new Date(closingYear, closingMonth + 1, 0).getDate()
  const effClosingDay = Math.min(closingDay, maxDayClosingMonth)
  const currentClosingDate = new Date(closingYear, closingMonth, effClosingDay, 23, 59, 59, 999)

  // Formato YYYY-MM-DD para comparação precisa com t.transaction_date
  const closingDateStr = `${currentClosingDate.getFullYear()}-${String(
    currentClosingDate.getMonth() + 1
  ).padStart(2, '0')}-${String(currentClosingDate.getDate()).padStart(2, '0')}`

  // Determina a data de fechamento do ciclo anterior para isolar pagamentos pertinentes
  let prevClosingYear = closingYear
  let prevClosingMonth = closingMonth - 1
  if (prevClosingMonth < 0) {
    prevClosingYear--
    prevClosingMonth = 11
  }
  const maxDayPrevClosing = new Date(prevClosingYear, prevClosingMonth + 1, 0).getDate()
  const effPrevClosingDay = Math.min(closingDay, maxDayPrevClosing)
  const prevClosingDate = new Date(prevClosingYear, prevClosingMonth, effPrevClosingDay, 23, 59, 59, 999)
  const prevClosingDateStr = `${prevClosingDate.getFullYear()}-${String(
    prevClosingDate.getMonth() + 1
  ).padStart(2, '0')}-${String(prevClosingDate.getDate()).padStart(2, '0')}`

  // Determina a data de fechamento do próximo ciclo para delimitar a janela de liquidação deste ciclo
  let nextClosingYear = closingYear
  let nextClosingMonth = closingMonth + 1
  if (nextClosingMonth > 11) {
    nextClosingYear++
    nextClosingMonth = 0
  }
  const maxDayNextClosing = new Date(nextClosingYear, nextClosingMonth + 1, 0).getDate()
  const effNextClosingDay = Math.min(closingDay, maxDayNextClosing)
  const nextClosingDate = new Date(nextClosingYear, nextClosingMonth, effNextClosingDay, 23, 59, 59, 999)
  const nextClosingDateStr = `${nextClosingDate.getFullYear()}-${String(
    nextClosingDate.getMonth() + 1
  ).padStart(2, '0')}-${String(nextClosingDate.getDate()).padStart(2, '0')}`

  // Determina a data exata de vencimento correspondente à fatura deste ciclo
  let dueDate: Date | null = null
  if (dueDay) {
    const maxDue = new Date(refYear, refMonth + 1, 0).getDate()
    dueDate = new Date(refYear, refMonth, Math.min(dueDay, maxDue))
  }

  // Segregação das movimentações vinculadas ao cartão
  let grossCurrentDebt = 0
  let nextInvoiceDebt = 0
  let cyclePayments = 0
  let pastDebt = Number(wallet.initial_balance || 0)
  let pastPayments = 0

  for (const t of transactions) {
    const isExpense = t.type === 'expense' && t.wallet_id === wallet.id
    const isIncome = t.type === 'income' && t.wallet_id === wallet.id
    const isTransferPayment = t.type === 'transfer' && t.destination_wallet_id === wallet.id

    if (!isExpense && !isIncome && !isTransferPayment) continue
    if (t.is_paid === false || t.status === 'pending') continue

    const txDate = t.transaction_date || ''
    const amount = Number(t.amount) || 0
    const creditedAmount = Number(t.destination_amount ?? t.amount) || 0

    if (isExpense) {
      if (txDate <= prevClosingDateStr) {
        pastDebt += amount
      } else if (txDate <= closingDateStr) {
        grossCurrentDebt += amount
      } else {
        nextInvoiceDebt += amount
      }
    } else if (isIncome) {
      if (txDate <= prevClosingDateStr) {
        pastDebt -= amount
      } else if (txDate <= closingDateStr) {
        grossCurrentDebt -= amount
      } else {
        nextInvoiceDebt -= amount
      }
    } else if (isTransferPayment) {
      // Regra de Vinculação de Pagamentos por Ciclo:
      // A fatura que fecha em closingDateStr (com vencimento em dueDate) é liquidada
      // ESTRITAMENTE após o seu fechamento e até o fechamento seguinte (closingDateStr <= txDate <= nextClosingDateStr).
      // Pagamentos efetuados antes de closingDateStr pertencem aos ciclos anteriores (vencimentos passados).
      if (txDate < closingDateStr) {
        pastPayments += creditedAmount
      } else if (txDate <= nextClosingDateStr) {
        cyclePayments += creditedAmount
      }
    }
  }

  // Projeta contas fixas recorrentes vinculadas ao cartão dentro deste ciclo
  const projectedBillsAmount = getProjectedRecurringBillsAmount(
    wallet,
    recurringBills,
    transactions,
    prevClosingDate,
    currentClosingDate,
    isFutureMonth
  )
  grossCurrentDebt += projectedBillsAmount

  // Premissa de Adimplência para Projeções Futuras:
  // Em meses futuros, assume-se que as faturas dos meses anteriores foram pagas
  // pontualmente em seus vencimentos e NÃO rolam como dívida rotativa acumulada,
  // a menos que já estivessem formalmente vencidas e não pagas no mundo real antes de hoje.
  let pastUnpaid = 0
  if (!isFutureMonth) {
    pastUnpaid = Math.max(0, pastDebt - pastPayments)
  } else {
    // Checa se a fatura anterior já estaria formalmente vencida no mundo real
    const prevDueDate = dueDay
      ? new Date(closingYear, closingMonth, Math.min(dueDay, maxDayClosingMonth))
      : null
    if (prevDueDate && prevDueDate.getTime() < now.getTime()) {
      pastUnpaid = Math.max(0, pastDebt - pastPayments)
    } else {
      pastUnpaid = 0
    }
  }
  grossCurrentDebt += pastUnpaid

  // Excedente de pagamentos passados abate pagamentos do ciclo atual apenas se não for projeção futura
  const pastExcess = isFutureMonth ? 0 : Math.max(0, pastPayments - pastDebt)
  cyclePayments += pastExcess

  const grossInvoiceAmount = Math.max(0, grossCurrentDebt)

  let currentInvoiceDebt = 0
  let revolvingAmount = 0
  let isPaid = false
  let isPartiallyPaid = false
  let paidAmount = 0

  if (totalDebt <= 0 && !isFutureMonth && grossInvoiceAmount <= 0) {
    // Cartão sem saldo devedor geral e sem despesas: liquidado
    isPaid = true
    isPartiallyPaid = false
    paidAmount = grossInvoiceAmount
    currentInvoiceDebt = 0
    revolvingAmount = 0
    nextInvoiceDebt = 0
  } else if (grossInvoiceAmount > 0) {
    if (cyclePayments >= grossInvoiceAmount) {
      // Pagamento total ou superior: fatura liquidada
      isPaid = true
      isPartiallyPaid = false
      paidAmount = grossInvoiceAmount
      currentInvoiceDebt = 0
      revolvingAmount = 0
      // Crédito excedente abate da próxima fatura
      const excessCredit = cyclePayments - grossInvoiceAmount
      if (excessCredit > 0) {
        nextInvoiceDebt = Math.max(0, nextInvoiceDebt - excessCredit)
      }
    } else if (cyclePayments > 0) {
      // Pagamento parcial: fatura liquidada para este ciclo com rolagem de saldo rotativo
      isPaid = true
      isPartiallyPaid = true
      paidAmount = cyclePayments
      currentInvoiceDebt = 0
      revolvingAmount = grossInvoiceAmount - cyclePayments
      nextInvoiceDebt += revolvingAmount
    } else {
      // Sem pagamento: fatura pendente de quitação
      isPaid = false
      isPartiallyPaid = false
      paidAmount = 0
      currentInvoiceDebt = grossInvoiceAmount
      revolvingAmount = 0
    }
  } else {
    // Não houve despesas no ciclo fechado da fatura
    if (cyclePayments > 0) {
      nextInvoiceDebt = Math.max(0, nextInvoiceDebt - cyclePayments)
    }
    isPaid = totalDebt <= 0 || isFutureMonth
    currentInvoiceDebt = 0
    paidAmount = 0
  }

  if (totalDebt > 0 && currentInvoiceDebt === 0 && nextInvoiceDebt === 0 && !isFutureMonth) {
    nextInvoiceDebt = totalDebt
  }

  return {
    wallet,
    currentInvoiceAmount: currentInvoiceDebt,
    nextInvoiceAmount: Math.max(0, nextInvoiceDebt),
    totalDebt,
    closingDay,
    dueDay,
    currentClosingDate,
    dueDate,
    isClosed: new Date().getTime() >= currentClosingDate.getTime(),
    isPaid,
    isPartiallyPaid,
    paidAmount,
    revolvingAmount,
    grossInvoiceAmount,
  }
}
