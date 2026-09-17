import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import type {
  Wallet,
  Transaction,
  WalletScope,
  TransactionType,
  RecurringBill,
  Profile,
  DebtItem,
  CurrencyCode,
} from './lib/types'
import { ensureInitialWallets } from './lib/walletService'
import {
  fetchTransactions,
  calculateBalances,
  calculateCardInvoices,
  getActiveCurrencies,
} from './lib/accountingService'
import { fetchRecurringBills } from './lib/recurringService'
import { fetchUserProfile, upsertProfile } from './lib/profileService'
import { fetchDebts } from './lib/debtService'
import { Navbar } from './components/Navbar'
import { ScopeFilter } from './components/ScopeFilter'
import { CurrencyDashboard } from './components/CurrencyDashboard'
import { AccountList } from './components/AccountList'
import { TransactionList } from './components/TransactionList'
import { MonthSelector } from './components/MonthSelector'
import { MonthlySummary } from './components/MonthlySummary'
import { CategoryBreakdown } from './components/CategoryBreakdown'
import { MonthlyBillsWidget } from './components/MonthlyBillsWidget'
import { DebtsWidget } from './components/DebtsWidget'
import { QuickTransactionModal } from './components/QuickTransactionModal'
import { RecurringBillsModal } from './components/RecurringBillsModal'
import { CreateDebtModal } from './components/CreateDebtModal'
import { ProfileModal } from './components/ProfileModal'
import { CreateAccountModal } from './components/CreateAccountModal'
import { ManageAccountModal } from './components/ManageAccountModal'
import { FamilySettingsModal } from './components/FamilySettingsModal'
import { AuthModal } from './components/auth/AuthModal'
import { Plus, Loader2 } from 'lucide-react'
import { useTranslation } from './lib/i18n/LanguageContext'

export default function App() {
  const { t } = useTranslation()
  const [sessionUser, setSessionUser] = useState<{
    id: string
    email?: string | null
    name?: string | null
  } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Core Data
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([])
  const [debts, setDebts] = useState<DebtItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  // Scope filter: 'personal' (Minhas Contas) | 'shared' (Caixa da Família) | 'all' (Consolidado)
  const [currentScope, setCurrentScope] = useState<WalletScope | 'all'>('personal')

  // Selected Month for Temporal Navigation
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Modals state
  const [isQuickTxOpen, setIsQuickTxOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [quickTxType, setQuickTxType] = useState<TransactionType>('expense')
  const [quickTxSourceId, setQuickTxSourceId] = useState<string | undefined>()
  const [quickTxDestId, setQuickTxDestId] = useState<string | undefined>()
  const [quickTxAmount, setQuickTxAmount] = useState<number | undefined>()
  const [quickTxCategory, setQuickTxCategory] = useState<string | undefined>()
  const [quickTxDescription, setQuickTxDescription] = useState<string | undefined>()

  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false)
  const [managingWallet, setManagingWallet] = useState<Wallet | null>(null)
  const [isFamilySettingsOpen, setIsFamilySettingsOpen] = useState(false)
  const [isRecurringBillsModalOpen, setIsRecurringBillsModalOpen] = useState(false)
  const [isCreateDebtOpen, setIsCreateDebtOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  // 1. Supabase Auth Session listener
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const userName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          null

        setSessionUser({
          id: session.user.id,
          email: session.user.email,
          name: userName,
        })

        if (session.user.email) {
          await upsertProfile(
            session.user.id,
            userName || session.user.email.split('@')[0],
            session.user.email
          ).catch((err) => console.warn('Erro ao sincronizar perfil social:', err))
        }
      } else {
        setSessionUser(null)
      }
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const userName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          null

        setSessionUser({
          id: session.user.id,
          email: session.user.email,
          name: userName,
        })

        if (session.user.email && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          await upsertProfile(
            session.user.id,
            userName || session.user.email.split('@')[0],
            session.user.email
          ).catch((err) => console.warn('Erro ao sincronizar perfil social:', err))
        }
      } else {
        setSessionUser(null)
      }
      setAuthLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const refreshData = useCallback(async () => {
    if (!sessionUser?.id) return
    try {
      const loadedWallets = await ensureInitialWallets(sessionUser.id)
      setWallets(loadedWallets)

      const sharedWallet = loadedWallets.find((w) => w.type === 'shared' && w.family_id)
      const familyId = sharedWallet?.family_id || null

      const [loadedTxs, loadedBills, loadedProfile, loadedDebts] = await Promise.all([
        loadedWallets.length > 0
          ? fetchTransactions(loadedWallets.map((w) => w.id))
          : Promise.resolve([]),
        fetchRecurringBills('all', familyId).catch(() => []),
        fetchUserProfile(sessionUser.id).catch(() => null),
        fetchDebts('all', familyId).catch(() => []),
      ])

      setTransactions(loadedTxs)
      setRecurringBills(loadedBills)
      if (loadedProfile) setUserProfile(loadedProfile)
      setDebts(loadedDebts)
    } catch (err) {
      console.error('Error refreshing data:', err)
    }
  }, [sessionUser])

  useEffect(() => {
    let isMounted = true
    if (sessionUser?.id) {
      queueMicrotask(() => {
        if (isMounted) setDataLoading(true)
      })
      ensureInitialWallets(sessionUser.id)
        .then(async (loadedWallets) => {
          if (!isMounted) return
          setWallets(loadedWallets)

          const sharedWallet = loadedWallets.find((w) => w.type === 'shared' && w.family_id)
          const familyId = sharedWallet?.family_id || null

          const [loadedTxs, loadedBills, loadedProfile, loadedDebts] = await Promise.all([
            loadedWallets.length > 0
              ? fetchTransactions(loadedWallets.map((w) => w.id))
              : Promise.resolve([]),
            fetchRecurringBills('all', familyId).catch(() => []),
            fetchUserProfile(sessionUser.id).catch(() => null),
            fetchDebts('all', familyId).catch(() => []),
          ])

          if (isMounted) {
            setTransactions(loadedTxs)
            setRecurringBills(loadedBills)
            if (loadedProfile) setUserProfile(loadedProfile)
            setDebts(loadedDebts)
          }
        })
        .catch((err) => {
          console.error('Error loading core data:', err)
        })
        .finally(() => {
          if (isMounted) setDataLoading(false)
        })
    }

    return () => {
      isMounted = false
    }
  }, [sessionUser])

  // Compute calculated balances and credit card summaries
  const balances = calculateBalances(wallets, transactions, currentScope)
  const cardInvoices = calculateCardInvoices(wallets, transactions, currentScope)

  // Active currencies based on user preference and active wallets
  const preferredCurrency: CurrencyCode = userProfile?.preferred_currency || 'PYG'
  const scopedWallets = currentScope === 'all' ? wallets : wallets.filter((w) => w.type === currentScope)
  const activeCurrencies = getActiveCurrencies(scopedWallets, preferredCurrency)

  // Filter transactions for the selected month (UTC-safe via YYYY-MM substring)
  const selectedYear = selectedDate.getFullYear()
  const selectedMonth = selectedDate.getMonth()
  const monthlyTransactions = transactions.filter((t) => {
    if (!t.transaction_date) return false
    const [txYear, txMonth] = t.transaction_date.substring(0, 7).split('-').map(Number)
    return txYear === selectedYear && txMonth - 1 === selectedMonth
  })

  const personalCount = wallets.filter((w) => w.type === 'personal').length
  const sharedCount = wallets.filter((w) => w.type === 'shared').length

  // Quick Action: Pagar Fatura
  const handlePayCardInvoice = (cardWallet: Wallet, invoiceAmount: number) => {
    const bankAccount = wallets.find(
      (w) => w.id !== cardWallet.id && w.account_type === 'checking' && !w.is_archived
    ) || wallets.find((w) => w.id !== cardWallet.id && !w.is_archived)

    setEditingTransaction(null)
    setQuickTxType('transfer')
    setQuickTxSourceId(bankAccount?.id)
    setQuickTxDestId(cardWallet.id)
    setQuickTxAmount(invoiceAmount > 0 ? invoiceAmount : undefined)
    setQuickTxCategory(undefined)
    setQuickTxDescription(undefined)
    setIsQuickTxOpen(true)
  }

  // Quick Action: Pagar Conta Fixa ou Confirmar Recebimento de Renda/Salário
  const handlePayBill = (bill: RecurringBill) => {
    setEditingTransaction(null)
    setQuickTxType(bill.type === 'income' ? 'income' : 'expense')
    setQuickTxSourceId(bill.wallet_id)
    setQuickTxDestId(undefined)
    setQuickTxAmount(bill.amount)
    setQuickTxCategory(bill.category)
    setQuickTxDescription(bill.name)
    setIsQuickTxOpen(true)
  }

  // Open default Quick Transaction (+)
  const handleOpenDefaultQuickTx = () => {
    setEditingTransaction(null)
    setQuickTxType('expense')
    setQuickTxSourceId(undefined)
    setQuickTxDestId(undefined)
    setQuickTxAmount(undefined)
    setQuickTxCategory(undefined)
    setQuickTxDescription(undefined)
    setIsQuickTxOpen(true)
  }

  // Edit existing transaction
  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx)
    setQuickTxType(tx.type)
    setQuickTxSourceId(tx.wallet_id)
    setQuickTxDestId(tx.destination_wallet_id || undefined)
    setQuickTxAmount(Number(tx.amount))
    setQuickTxCategory(tx.category)
    setQuickTxDescription(tx.description || undefined)
    setIsQuickTxOpen(true)
  }

  // Auth Loading screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    )
  }

  // Unauthenticated: Show Auth Modal
  if (!sessionUser) {
    return (
      <AuthModal
        onSuccess={() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              setSessionUser({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || null,
              })
            }
          })
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <Navbar
        userEmail={sessionUser.email}
        userName={userProfile?.full_name || sessionUser.name}
        userAvatar={userProfile?.avatar}
        onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
        onOpenFamilySettings={() => setIsFamilySettingsOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onSignOut={() => {
          setSessionUser(null)
          setWallets([])
          setTransactions([])
          setRecurringBills([])
          setDebts([])
          setUserProfile(null)
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Scope Filter Bar (Minhas Contas / Caixa da Família / Consolidado) */}
        <ScopeFilter
          currentScope={currentScope}
          onSelectScope={setCurrentScope}
          personalCount={personalCount}
          sharedCount={sharedCount}
          onOpenFamilySettings={() => setIsFamilySettingsOpen(true)}
        />

        {dataLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Currency Dashboard: Liquid Balances & Card Invoices */}
            <CurrencyDashboard
              balances={balances}
              cardInvoices={cardInvoices}
              activeCurrencies={activeCurrencies}
              onPayCardInvoice={handlePayCardInvoice}
            />

            {/* Desktop 2-column layout / Mobile vertical stack */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Main Column: TransactionList with MonthSelector and MonthlySummary */}
              <div className="lg:col-span-8 order-2 lg:order-1 space-y-4">
                {/* Monthly Time Navigation */}
                <MonthSelector
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />

                {/* Monthly Operational Summary */}
                <MonthlySummary
                  transactions={monthlyTransactions}
                  wallets={wallets}
                  currentScope={currentScope}
                  preferredCurrency={preferredCurrency}
                />

                {/* Monthly Category Spending Breakdown */}
                <CategoryBreakdown
                  transactions={monthlyTransactions}
                  wallets={wallets}
                  currentScope={currentScope}
                  preferredCurrency={preferredCurrency}
                />

                {/* Chronological Transactions Feed */}
                <TransactionList
                  transactions={monthlyTransactions}
                  wallets={wallets}
                  currentScope={currentScope}
                  currentUserId={sessionUser.id}
                  selectedDate={selectedDate}
                  onEditTransaction={handleEditTransaction}
                  onTransactionDeleted={() => refreshData()}
                />
              </div>

              {/* Sidebar Column: MonthlyBillsWidget and AccountList */}
              <div className="lg:col-span-4 order-1 lg:order-2 space-y-6">
                <MonthlyBillsWidget
                  recurringBills={recurringBills}
                  monthlyTransactions={monthlyTransactions}
                  wallets={wallets}
                  currentScope={currentScope}
                  selectedDate={selectedDate}
                  onOpenManage={() => setIsRecurringBillsModalOpen(true)}
                  onPayBill={handlePayBill}
                />

                <DebtsWidget
                  debts={debts}
                  wallets={wallets}
                  currentScope={currentScope}
                  onOpenCreateDebt={() => setIsCreateDebtOpen(true)}
                  onDebtChanged={() => refreshData()}
                />

                <AccountList
                  wallets={wallets}
                  transactions={transactions}
                  currentScope={currentScope}
                  onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
                  onManageAccount={(wallet) => setManagingWallet(wallet)}
                />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Floating Action Button (+) for Quick Transaction */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={handleOpenDefaultQuickTx}
          className="cursor-pointer flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all"
          title={t('quickModal.newTitle')}
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Quick Transaction Modal (Novo / Editar) */}
      <QuickTransactionModal
        userId={sessionUser.id}
        wallets={wallets}
        isOpen={isQuickTxOpen}
        editingTransaction={editingTransaction}
        initialType={quickTxType}
        initialSourceWalletId={quickTxSourceId}
        initialDestWalletId={quickTxDestId}
        initialAmount={quickTxAmount}
        initialCategory={quickTxCategory}
        initialDescription={quickTxDescription}
        onClose={() => {
          setIsQuickTxOpen(false)
          setEditingTransaction(null)
        }}
        onTransactionCreated={() => {
          refreshData()
        }}
      />

      {/* Recurring Bills Modal */}
      <RecurringBillsModal
        isOpen={isRecurringBillsModalOpen}
        onClose={() => setIsRecurringBillsModalOpen(false)}
        wallets={wallets}
        scope={currentScope}
        familyId={wallets.find((w) => w.type === 'shared' && w.family_id)?.family_id}
        onBillsChanged={() => refreshData()}
      />

      {/* Create Account Modal */}
      <CreateAccountModal
        userId={sessionUser.id}
        isOpen={isCreateAccountOpen}
        onClose={() => setIsCreateAccountOpen(false)}
        onAccountCreated={() => {
          refreshData()
        }}
      />

      {/* Manage / Archive / Delete Account Modal */}
      <ManageAccountModal
        key={managingWallet?.id}
        wallet={managingWallet}
        isOpen={Boolean(managingWallet)}
        transactions={transactions}
        onClose={() => setManagingWallet(null)}
        onAccountUpdated={() => {
          refreshData()
        }}
      />

      {/* Family Settings & Invite Code Modal */}
      <FamilySettingsModal
        userId={sessionUser.id}
        isOpen={isFamilySettingsOpen}
        onClose={() => setIsFamilySettingsOpen(false)}
        onFamilyLinked={() => {
          refreshData()
          setCurrentScope('shared')
        }}
      />

      {/* Profile Edition & Customization Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        userId={sessionUser.id}
        userEmail={sessionUser.email}
        currentProfile={userProfile}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileUpdated={(updatedProfile) => {
          setUserProfile(updatedProfile)
          if (updatedProfile.full_name) {
            setSessionUser((prev) =>
              prev ? { ...prev, name: updatedProfile.full_name } : null
            )
          }
        }}
        onSignOut={() => {
          setSessionUser(null)
          setWallets([])
          setTransactions([])
          setRecurringBills([])
          setDebts([])
          setUserProfile(null)
        }}
      />

      {/* Create Debt / Loan Modal */}
      <CreateDebtModal
        isOpen={isCreateDebtOpen}
        onClose={() => setIsCreateDebtOpen(false)}
        userId={sessionUser.id}
        familyId={wallets.find((w) => w.type === 'shared' && w.family_id)?.family_id}
        initialScope={currentScope === 'shared' ? 'shared' : 'personal'}
        onDebtCreated={() => refreshData()}
      />
    </div>
  )
}
