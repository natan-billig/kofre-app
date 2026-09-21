export type CurrencyCode = 'PYG' | 'USD' | 'BRL'

export type AccountType = 'cash' | 'checking' | 'credit_card' | 'savings'

export type WalletScope = 'personal' | 'shared'

export type ScopeFilterType = 'personal' | 'shared'

export type TransactionType = 'expense' | 'income' | 'transfer'

export interface Wallet {
  id: string
  created_at?: string
  owner_id: string
  name: string
  type: WalletScope
  account_type: AccountType
  currency: CurrencyCode
  family_id?: string | null
  initial_balance?: number | null
  credit_limit?: number | null
  closing_day?: number | null
  due_day?: number | null
  is_archived?: boolean | null
  target_amount?: number | null
  annual_yield_rate?: number | null
  yield_benchmark?: 'cdi' | 'fixed_annual' | 'fixed_monthly' | null
  yield_percentage?: number | null
}

export type WalletAccount = Wallet

export interface Transaction {
  id: string
  created_at?: string
  user_id: string
  wallet_id: string
  destination_wallet_id?: string | null
  type: TransactionType
  amount: number
  destination_amount?: number | null
  category: string
  description?: string | null
  transaction_date: string
  original_amount?: number | null
  original_currency?: CurrencyCode | null
  debt_id?: string | null
  installment_number?: number | null
  total_installments?: number | null
  installment_group_id?: string | null
  cashback_amount?: number | null
  cashback_percent?: number | null
  parent_transaction_id?: string | null
  is_paid?: boolean | null
  status?: 'pending' | 'completed' | null
  is_shared?: boolean | null
  total_amount?: number | null
  my_share_amount?: number | null
  split_participants?: number | null
}

export interface Profile {
  id: string
  created_at?: string
  full_name: string | null
  email?: string | null
  avatar?: string | null
  preferred_currency?: CurrencyCode | null
  budget_start_day?: number | null
  base_monthly_income?: number | null
  family_id?: string | null
  pix_key?: string | null
  alias_py?: string | null
  bank_details?: string | null
}

export interface CurrencyBalances {
  PYG: number
  USD: number
  BRL: number
}

export interface CardInvoiceSummary {
  wallet: Wallet
  invoiceAmount: number
  availableLimit: number | null
}

export interface CreateTransactionDTO {
  user_id: string
  wallet_id: string
  destination_wallet_id?: string | null
  type: TransactionType
  amount: number
  destination_amount?: number | null
  category: string
  description?: string | null
  transaction_date: string
  original_amount?: number | null
  original_currency?: CurrencyCode | null
  debt_id?: string | null
  installment_number?: number | null
  total_installments?: number | null
  installment_group_id?: string | null
  cashback_amount?: number | null
  cashback_percent?: number | null
  parent_transaction_id?: string | null
  is_paid?: boolean | null
  status?: 'pending' | 'completed' | null
  is_shared?: boolean | null
  total_amount?: number | null
  my_share_amount?: number | null
  split_participants?: number | null
}

export type UpdateTransactionDTO = Partial<Omit<CreateTransactionDTO, 'user_id'>>

export interface Family {
  id: string
  created_at?: string
  name: string
  invite_code: string
}

export interface FamilyMember {
  id: string
  created_at?: string
  user_id: string
  family_id: string
  role: 'owner' | 'member' | string
  families?: Family | null
}

export interface JoinFamilyResult {
  success: boolean
  message?: string
}

export interface FamilyMemberItem {
  user_id: string
  full_name: string | null
  role: 'admin' | 'owner' | 'member' | string
  joined_at?: string
  is_current_user: boolean
}

export type CategoryType = 'expense' | 'income' | 'both'

export interface Category {
  id: string
  created_at?: string
  user_id: string
  name: string
  type: CategoryType
  scope: WalletScope
  family_id?: string | null
  macro_category?: string | null
  budget_limit?: number | null
}

export type CategoryItem = Category

export interface CategoryExpenseItem {
  category: string
  amount: number
  percentage: number
}

export interface MacroCategoryExpenseItem {
  macroCategory: string
  amount: number
  percentage: number
  subcategories: CategoryExpenseItem[]
}

export interface CurrencyCategoryBreakdown {
  currency: CurrencyCode
  total: number
  items: CategoryExpenseItem[]
}

export interface CreditCardInvoiceDetails {
  wallet: Wallet
  currentInvoiceAmount: number
  nextInvoiceAmount: number
  totalDebt: number
  closingDay: number | null
  dueDay: number | null
  currentClosingDate: Date | null
  dueDate: Date | null
  isClosed: boolean
}

export interface RecurringBill {
  id: string
  created_at?: string
  user_id?: string
  name: string
  amount: number
  currency: CurrencyCode
  category: string
  wallet_id: string
  due_day: number
  start_date?: string
  is_active: boolean
  scope: WalletScope
  family_id?: string | null
  type?: 'expense' | 'income'
  is_shared?: boolean
  total_amount?: number
  my_share_amount?: number
  split_participants?: number
}

export type DebtType = 'i_owe' | 'they_owe'
export type DebtStatus = 'pending' | 'settled'

export interface DebtItem {
  id: string
  user_id: string
  family_id?: string | null
  scope: 'personal' | 'shared'
  type: DebtType
  contact_name: string
  target_user_id?: string | null
  amount: number
  currency: CurrencyCode
  wallet_id?: string | null
  description?: string
  issue_date?: string
  due_date?: string | null
  status: DebtStatus
  settled_at?: string | null
  created_at?: string
  creator?: { full_name: string | null } | null
  target?: { full_name: string | null } | null
}

export interface FinancialHealthMetrics {
  currency: CurrencyCode
  baseIncome: number
  isIncomeConfigured: boolean
  cardInvoicesAmount: number
  recurringBillsAmount: number
  debtsToPayAmount: number
  totalCommitment: number
  dtiPercentage: number
  safeMargin: number
  status: 'healthy' | 'moderate' | 'critical'
}

export interface DueCommitmentItem {
  id: string
  title: string
  amount: number
  currency: CurrencyCode
  type:
    | 'card_invoice'
    | 'recurring_bill'
    | 'debt'
    | 'scheduled_expense'
    | 'recurring_income'
    | 'scheduled_income'
    | 'base_salary'
  flowType?: 'in' | 'out'
  dueDay?: number
  dueDate?: string
  entityName?: string
  scope: WalletScope
  status?: 'pending' | 'overdue' | 'paid'
  transactionId?: string
  is_paid?: boolean | null
}

export interface ParsedNotification {
  amount?: number
  currency?: CurrencyCode
  type: TransactionType
  description: string
  date: string
  merchant?: string
  suggestedCategory?: string
  bankSource?: string
  rawSnippet?: string
  suggestedSourceWallet?: string
  suggestedDestinationWallet?: string
}
