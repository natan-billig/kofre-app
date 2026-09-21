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
import { convertAmount } from './exchangeRateService'

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

  // 2. Receita Base do Perfil:
  // O denominador "RECEITA BASE" consulta ESTRITAMENTE o userProfile.base_monthly_income
  // correspondente à moeda ativa (ex.: ₲ 3.700.000 em PYG).
  // NUNCA utiliza receitas fixas recorrentes ou ingressos fracionados de transações.
  const profileCurrency: CurrencyCode = userProfile?.preferred_currency || preferredCurrency || 'PYG'
  const rawProfileIncome =
    userProfile?.base_monthly_income != null && userProfile.base_monthly_income > 0
      ? Number(userProfile.base_monthly_income)
      : 0

  const baseIncome =
    rawProfileIncome > 0 ? convertAmount(rawProfileIncome, profileCurrency, currency) : 0
  const isIncomeConfigured = baseIncome > 0

  // 3. Faturas de cartões de crédito no escopo (convertidas para a moeda ativa)
  const creditCards = scopedWallets.filter((w) => w.account_type === 'credit_card')

  let cardInvoicesAmount = 0
  for (const card of creditCards) {
    const details = getCreditCardInvoiceDetails(card, transactions, referenceDate)
    const invoiceInCardCurrency = Math.max(0, details.currentInvoiceAmount)
    const convertedInvoice = convertAmount(invoiceInCardCurrency, card.currency, currency)
    cardInvoicesAmount += convertedInvoice
  }

  // 4. Contas Fixas Vigentes no escopo com deduplicação de débito em cartão
  let recurringBillsAmount = 0
  for (const bill of recurringBills) {
    if (!bill.is_active) continue
    if (bill.scope !== currentScope) continue
    if (bill.type === 'income') continue

    // Deduplicação de Contas Fixas Debitadas em Cartão:
    // Se a conta vinculada for um Cartão de Crédito ('credit_card'), o valor já
    // compõe a fatura do cartão no bloco "FATURAS DE CARTÃO".
    // Ignoramos este valor para não duplicar despesas como mensalidades pagas via cartão.
    const linkedWalletId =
      (bill as unknown as { destination_wallet_id?: string; account_id?: string }).destination_wallet_id ||
      (bill as unknown as { destination_wallet_id?: string; account_id?: string }).account_id ||
      bill.wallet_id

    const linkedWallet = linkedWalletId ? scopedWallets.find((w) => w.id === linkedWalletId) : null
    if (linkedWallet && linkedWallet.account_type === 'credit_card') {
      continue
    }

    // Cota Pessoal: se is_shared === true, considerar estritamente my_share_amount
    const effectiveAmount =
      bill.is_shared && bill.my_share_amount != null && Number(bill.my_share_amount) > 0
        ? Number(bill.my_share_amount)
        : Number(bill.amount) || 0

    if (effectiveAmount <= 0) continue

    // Conversão Cambial Automática se a moeda do fixo for diferente da moeda de visualização
    const convertedBillAmount = convertAmount(effectiveAmount, bill.currency, currency)
    recurringBillsAmount += convertedBillAmount
  }

  // 5. Dívidas a pagar no período (i_owe e status pending)
  let debtsToPayAmount = 0
  for (const debt of debts) {
    if (debt.status !== 'pending') continue
    if (debt.scope !== currentScope) continue
    if (debt.type !== 'i_owe') continue

    const rawDebt = Number(debt.amount) || 0
    if (rawDebt <= 0) continue

    const convertedDebt = convertAmount(rawDebt, debt.currency, currency)
    debtsToPayAmount += convertedDebt
  }

  // 6. Total Comprometido e DTI (%)
  const totalCommitment = cardInvoicesAmount + recurringBillsAmount + debtsToPayAmount

  // Fallback defensivo para evitar divisão por zero se baseIncome <= 0
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
