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

  // 2. Receita Base do Perfil (Segregação Bimonetária Real):
  // O denominador "RECEITA BASE" consulta a renda correspondente à moeda ativa:
  // - Se a moeda do perfil for a mesma da visualização, utiliza base_monthly_income.
  // - NUNCA converte renda de PYG para BRL (nem BRL para PYG), pois são economias desvinculadas.
  //   Em moedas secundárias, busca receitas recorrentes ativas cadastradas naquela moeda (ex.: salário em BRL).
  const profileCurrency: CurrencyCode = userProfile?.preferred_currency || preferredCurrency || 'PYG'
  const rawProfileIncome =
    userProfile?.base_monthly_income != null && userProfile.base_monthly_income > 0
      ? Number(userProfile.base_monthly_income)
      : 0

  let baseIncome = 0
  if (profileCurrency === currency && rawProfileIncome > 0) {
    baseIncome = rawProfileIncome
  } else {
    // Buscar receitas recorrentes ativas cadastradas diretamente na moeda ativa
    const activeCurrencyIncomes = recurringBills.filter(
      (b) => b.is_active && b.type === 'income' && b.scope === currentScope && b.currency === currency
    )
    if (activeCurrencyIncomes.length > 0) {
      baseIncome = activeCurrencyIncomes.reduce((acc, b) => acc + (Number(b.amount) || 0), 0)
    }
  }
  const isIncomeConfigured = baseIncome > 0

  // 3. Faturas de cartões de crédito no escopo:
  // Estritamente cartões denominados na moeda ativa (ex: cartões em BRL para DTI em BRL, cartões em PYG para DTI em PYG)
  const creditCards = scopedWallets.filter(
    (w) => w.account_type === 'credit_card' && w.currency === currency
  )

  let cardInvoicesAmount = 0
  for (const card of creditCards) {
    const details = getCreditCardInvoiceDetails(card, transactions, referenceDate)
    // Faturas quitadas deixam de comprometer a margem de endividamento do mês de referência no Termômetro DTI
    if (details.isPaid && details.currentInvoiceAmount <= 0) {
      continue
    }

    const openDebt = details.nextInvoiceAmount > 0 ? details.nextInvoiceAmount : details.totalDebt
    const invoiceInCardCurrency = details.currentInvoiceAmount > 0
      ? details.currentInvoiceAmount
      : (!details.isPaid && openDebt > 0 ? openDebt : 0)

    cardInvoicesAmount += Math.max(0, invoiceInCardCurrency)
  }

  // 4. Contas Fixas Vigentes no escopo com segregação bimonetária e deduplicação de débito em cartão
  let recurringBillsAmount = 0
  for (const bill of recurringBills) {
    if (!bill.is_active) continue
    if (bill.scope !== currentScope) continue
    if (bill.type === 'income') continue

    // Deduplicação de Contas Fixas Debitadas em Cartão:
    // Se a conta vinculada for um Cartão de Crédito ('credit_card'), o valor já
    // compõe a fatura do cartão no bloco "FATURAS DE CARTÃO".
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

    // Segregação Bimonetária Estrita:
    if (currency === 'BRL') {
      // Em BRL: apenas contas em BRL ou com carteira vinculada em BRL. NUNCA converter PYG para BRL.
      if (bill.currency === 'BRL') {
        recurringBillsAmount += effectiveAmount
      } else if (linkedWallet && linkedWallet.currency === 'BRL') {
        recurringBillsAmount += convertAmount(effectiveAmount, bill.currency, 'BRL')
      }
    } else if (currency === 'PYG') {
      // Em PYG: apenas contas em PYG, ou contas em USD se a carteira debitada for em PYG (ex: streaming em USD cobrado no PYG).
      // Contas em BRL NUNCA entram no DTI em PYG.
      if (bill.currency === 'PYG') {
        recurringBillsAmount += effectiveAmount
      } else if (bill.currency === 'USD' && linkedWallet && linkedWallet.currency === 'PYG') {
        recurringBillsAmount += convertAmount(effectiveAmount, 'USD', 'PYG')
      }
    } else {
      // USD ou outras:
      if (bill.currency === currency) {
        recurringBillsAmount += effectiveAmount
      } else if (linkedWallet && linkedWallet.currency === currency) {
        recurringBillsAmount += convertAmount(effectiveAmount, bill.currency, currency)
      }
    }
  }

  // 5. Dívidas a pagar no período: estritamente na moeda ativa e no mês de referência
  let debtsToPayAmount = 0
  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth() + 1

  for (const debt of debts) {
    if (debt.status !== 'pending') continue
    if (debt.scope !== currentScope) continue
    if (debt.type !== 'i_owe') continue

    // Se houver data de vencimento especificada, filtra pelo mês de referência
    if (debt.due_date) {
      const parts = debt.due_date.split('-')
      if (parts.length >= 2) {
        const dYear = parseInt(parts[0], 10)
        const dMonth = parseInt(parts[1], 10)
        if (dYear !== refYear || dMonth !== refMonth) {
          continue
        }
      }
    }

    const rawDebt = Number(debt.amount) || 0
    if (rawDebt <= 0) continue

    if (debt.currency === currency) {
      debtsToPayAmount += rawDebt
    }
  }

  // 6. Total Comprometido e DTI (%)
  const totalCommitment = cardInvoicesAmount + recurringBillsAmount + debtsToPayAmount

  // Se não houver compromissos nem renda na moeda, DTI = 0% e status saudável
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
