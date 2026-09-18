import type { Wallet, Transaction, CreditCardInvoiceDetails } from './types'
import { calculateAccountBalance } from './accountingService'

/**
 * Calcula os detalhes e segmentação do ciclo de fatura de um cartão de crédito.
 * Segrega o saldo devedor entre "Fatura Atual" e "Próxima Fatura" com base no dia de fechamento.
 */
export function getCreditCardInvoiceDetails(
  wallet: Wallet,
  transactions: Transaction[],
  referenceDate: Date = new Date()
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
    return {
      wallet,
      currentInvoiceAmount: Math.max(0, totalDebt),
      nextInvoiceAmount: 0,
      totalDebt,
      closingDay: null,
      dueDay,
      currentClosingDate: null,
      dueDate: null,
      isClosed: false,
    }
  }

  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const todayDay = referenceDate.getDate()

  // Se hoje <= closingDay: a fatura deste mês ainda está aberta e fecha no closingDay deste mês
  // Se hoje > closingDay: a fatura deste mês já fechou no closingDay deste mês
  const maxDayThisMonth = new Date(year, month + 1, 0).getDate()
  const effClosingDay = Math.min(closingDay, maxDayThisMonth)
  const currentClosingDate = new Date(year, month, effClosingDay, 23, 59, 59, 999)

  // Formato YYYY-MM-DD para comparação precisa com t.transaction_date
  const closingDateStr = `${currentClosingDate.getFullYear()}-${String(
    currentClosingDate.getMonth() + 1
  ).padStart(2, '0')}-${String(currentClosingDate.getDate()).padStart(2, '0')}`

  // Determina a data exata de vencimento correspondente à fatura do ciclo atual
  let dueDate: Date | null = null
  if (dueDay) {
    if (dueDay >= closingDay) {
      // Vencimento ocorre no mesmo mês do fechamento
      const maxDue = new Date(currentClosingDate.getFullYear(), currentClosingDate.getMonth() + 1, 0).getDate()
      dueDate = new Date(currentClosingDate.getFullYear(), currentClosingDate.getMonth(), Math.min(dueDay, maxDue))
    } else {
      // Vencimento ocorre no mês seguinte ao fechamento (ex: fecha dia 25, vence dia 5)
      const maxDue = new Date(currentClosingDate.getFullYear(), currentClosingDate.getMonth() + 2, 0).getDate()
      dueDate = new Date(currentClosingDate.getFullYear(), currentClosingDate.getMonth() + 1, Math.min(dueDay, maxDue))
    }
  }

  // Segregação das movimentações vinculadas ao cartão
  let currentInvoiceDebt = Number(wallet.initial_balance || 0)
  let nextInvoiceDebt = 0

  for (const t of transactions) {
    const isExpense = t.type === 'expense' && t.wallet_id === wallet.id
    const isIncome = t.type === 'income' && t.wallet_id === wallet.id
    const isTransferPayment = t.type === 'transfer' && t.destination_wallet_id === wallet.id

    if (!isExpense && !isIncome && !isTransferPayment) continue

    const txDate = t.transaction_date || ''
    const amount = Number(t.amount) || 0
    const creditedAmount = Number(t.destination_amount ?? t.amount) || 0

    if (isExpense) {
      if (txDate <= closingDateStr) {
        currentInvoiceDebt += amount
      } else {
        nextInvoiceDebt += amount
      }
    } else if (isIncome) {
      // Receitas/estornos abatem primeiro a fatura atual
      currentInvoiceDebt -= amount
    } else if (isTransferPayment) {
      // Pagamentos de fatura abatem a fatura atual
      currentInvoiceDebt -= creditedAmount
    }
  }

  // Se houver crédito excedente (pagamento maior que as compras fechadas), abate da próxima fatura
  if (currentInvoiceDebt < 0) {
    nextInvoiceDebt += currentInvoiceDebt
    currentInvoiceDebt = 0
  }
  if (nextInvoiceDebt < 0) {
    nextInvoiceDebt = 0
  }

  return {
    wallet,
    currentInvoiceAmount: currentInvoiceDebt,
    nextInvoiceAmount: nextInvoiceDebt,
    totalDebt,
    closingDay,
    dueDay,
    currentClosingDate,
    dueDate,
    isClosed: todayDay > effClosingDay,
  }
}
