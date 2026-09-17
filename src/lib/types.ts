export type CurrencyCode = 'PYG' | 'USD' | 'BRL'

export type AccountType = 'cash' | 'checking' | 'credit_card'

export type WalletScope = 'personal' | 'shared'

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
  credit_limit?: number | null
  closing_day?: number | null
  due_day?: number | null
  is_archived?: boolean | null
}

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
}

export interface Profile {
  id: string
  created_at?: string
  full_name: string | null
  email: string | null
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
}

export interface CategoryExpenseItem {
  category: string
  amount: number
  percentage: number
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
