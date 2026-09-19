import type {
  Wallet,
  Transaction,
  RecurringBill,
  DebtItem,
  ScopeFilterType,
  CurrencyCode,
  Profile,
  FinancialHealthMetrics,
} from './types'
import { getCreditCardInvoiceDetails } from './creditCardService'

export interface CalculateDTIParams {
  wallets: Wallet[]
  transactions: Transaction[]
  recurringBills: RecurringBill[]
  debts: DebtItem[]
  currentScope: ScopeFilterType
  preferredCurrency: CurrencyCode
  userProfile?: Profile | null
  targetCurrency?: CurrencyCode
  referenceDate?: Date
}

/**
 * Calcula os indicadores de saúde financeira e índice DTI (Debt-to-Income)
 * com isolamento estrito de escopo (Minhas Contas vs Caixa da Família).
 */
export function calculateFinancialHealth({
  wallets,
  transactions,
  recurringBills,
  debts,
  currentScope,
  preferredCurrency,
  userProfile,
  targetCurrency,
  referenceDate = new Date(),
}: CalculateDTIParams): FinancialHealthMetrics {
  const currency: CurrencyCode = targetCurrency || preferredCurrency || 'PYG'

  // 1. Filtrar carteiras pelo escopo ativo
  const scopedWallets = wallets.filter(
    (w) => !w.is_archived && w.type === currentScope
  )
  const scopedWalletIds = new Set(scopedWallets.map((w) => w.id))

  // 2. Receita Base no Ciclo Ativo
  // Considera transações confirmadas de entrada (income), ignorando transferências e empréstimos
  let confirmedIncome = 0
  for (const tx of transactions) {
    if (tx.type !== 'income') continue
    if (!scopedWalletIds.has(tx.wallet_id)) continue

    const wallet = scopedWallets.find((w) => w.id === tx.wallet_id)
    const txCurrency = wallet?.currency || tx.original_currency || 'PYG'
    if (txCurrency !== currency) continue

    const catLower = tx.category?.trim().toLowerCase() || ''
    const isLoan =
      catLower === 'empréstimo' ||
      catLower === 'emprestimo' ||
      catLower === 'empréstimos' ||
      catLower === 'emprestimos' ||
      catLower === 'préstamo' ||
      catLower === 'prestamo' ||
      catLower === 'préstamos' ||
      catLower === 'prestamos'

    if (!isLoan) {
      confirmedIncome += Number(tx.amount) || 0
    }
  }

  // Se a receita confirmada for 0 ou se o utilizador tiver configurado uma renda mensal base
  const profileBaseIncome =
    userProfile?.base_monthly_income != null && userProfile.base_monthly_income > 0
      ? Number(userProfile.base_monthly_income)
      : 0

  // Se o utilizador configurou a renda base no perfil, usamos a maior entre a confirmada e a base (ou a base se confirmada for 0)
  const baseIncome = confirmedIncome > 0
    ? (profileBaseIncome > confirmedIncome ? profileBaseIncome : confirmedIncome)
    : profileBaseIncome

  const isIncomeConfigured = baseIncome > 0

  // 3. Faturas abertas de cartões de crédito no escopo
  const creditCards = scopedWallets.filter(
    (w) => w.account_type === 'credit_card' && w.currency === currency
  )

  let cardInvoicesAmount = 0
  for (const card of creditCards) {
    const details = getCreditCardInvoiceDetails(card, transactions, referenceDate)
    cardInvoicesAmount += Math.max(0, details.currentInvoiceAmount)
  }

  // 4. Contas Fixas Vigentes no escopo
  let recurringBillsAmount = 0
  for (const bill of recurringBills) {
    if (!bill.is_active) continue
    if (bill.scope !== currentScope) continue
    if (bill.currency !== currency) continue
    if (bill.type === 'income') continue

    const effectiveAmount =
      bill.is_shared && bill.my_share_amount != null && Number(bill.my_share_amount) > 0
        ? Number(bill.my_share_amount)
        : Number(bill.amount) || 0
    recurringBillsAmount += effectiveAmount
  }

  // 5. Dívidas a pagar no período (i_owe e status pending)
  let debtsToPayAmount = 0
  for (const debt of debts) {
    if (debt.status !== 'pending') continue
    if (debt.scope !== currentScope) continue
    if (debt.currency !== currency) continue
    if (debt.type !== 'i_owe') continue

    debtsToPayAmount += Number(debt.amount) || 0
  }

  // 6. Total Comprometido e DTI (%)
  const totalCommitment = cardInvoicesAmount + recurringBillsAmount + debtsToPayAmount

  let dtiPercentage = 0
  if (baseIncome > 0) {
    dtiPercentage = Math.round((totalCommitment / baseIncome) * 1000) / 10
  } else if (totalCommitment > 0) {
    dtiPercentage = 100
  }

  const safeMargin = Math.max(0, baseIncome - totalCommitment)

  let status: 'healthy' | 'moderate' | 'critical' = 'healthy'
  if (dtiPercentage > 50) {
    status = 'critical'
  } else if (dtiPercentage > 30) {
    status = 'moderate'
  } else {
    status = 'healthy'
  }

  return {
    currency,
    baseIncome,
    isIncomeConfigured,
    cardInvoicesAmount,
    recurringBillsAmount,
    debtsToPayAmount,
    totalCommitment,
    dtiPercentage,
    safeMargin,
    status,
  }
}
