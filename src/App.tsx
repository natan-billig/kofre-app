import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import type {
  Wallet,
  Transaction,
  ScopeFilterType,
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
import { getBudgetPeriod, isDateInBudgetPeriod } from './lib/dateUtils'
import { Navbar } from './components/Navbar'
import { ScopeFilter } from './components/ScopeFilter'
import { CurrencyDashboard } from './components/CurrencyDashboard'
import { AccountList } from './components/AccountList'
import { SavingsGoalsWidget } from './components/SavingsGoalsWidget'
import { TransactionList } from './components/TransactionList'
import { MonthSelector } from './components/MonthSelector'
import { MonthlySummary } from './components/MonthlySummary'
import { CategoryBreakdown } from './components/CategoryBreakdown'
import { MonthlyBillsWidget } from './components/MonthlyBillsWidget'
import { DebtsWidget } from './components/DebtsWidget'
import { FinancialHealthWidget } from './components/FinancialHealthWidget'
import { DueDatesCalendarWidget } from './components/DueDatesCalendarWidget'
import { QuickTransactionModal } from './components/QuickTransactionModal'
import { RecurringBillsModal } from './components/RecurringBillsModal'
import { CreateDebtModal } from './components/CreateDebtModal'
import { ProfileModal } from './components/ProfileModal'
import { CreateAccountModal } from './components/CreateAccountModal'
import { ManageAccountModal } from './components/ManageAccountModal'
import { FamilySettingsModal } from './components/FamilySettingsModal'
import { WhatsNewModal } from './components/WhatsNewModal'
import { OnboardingTourModal } from './components/OnboardingTourModal'
import { DashboardLayout } from './components/DashboardLayout'
import { MobileMenuDrawer } from './components/MobileMenuDrawer'
import { SmartNotificationParserModal } from './components/SmartNotificationParserModal'
import { CurrencyExchangeModal } from './components/CurrencyExchangeModal'
import { SplitBillModal } from './components/SplitBillModal'
import { CategoryManagerModal } from './components/CategoryManagerModal'
import { AuthModal } from './components/auth/AuthModal'
import { CURRENT_APP_VERSION, getUnseenCount } from './data/changelog'
import { Plus, Loader2 } from 'lucide-react'
import { useTranslation } from './lib/i18n/LanguageContext'

export default function App() {
  const { t, language } = useTranslation()
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

  // Scope filter: 'personal' (Minhas Contas) | 'shared' (Caixa da Família)
  const [currentScope, setCurrentScope] = useState<ScopeFilterType>('personal')

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
  const [quickTxDate, setQuickTxDate] = useState<string | undefined>()
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNotificationParserOpen, setIsNotificationParserOpen] = useState(false)
  const [isCurrencyExchangeOpen, setIsCurrencyExchangeOpen] = useState(false)
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'wallet' | 'planning' | 'statement'>('wallet')

  // WhatsNew & Onboarding Tour State
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false)
  const [isOnboardingTourOpen, setIsOnboardingTourOpen] = useState(false)
  const [unseenWhatsNewCount, setUnseenWhatsNewCount] = useState<number>(() => {
    return getUnseenCount()
  })

  const checkInitialModals = () => {
    try {
      const onboardingCompleted = localStorage.getItem('kofre_onboarding_completed')
      if (!onboardingCompleted) {
        setIsOnboardingTourOpen(true)
        return
      }

      const count = getUnseenCount()
      setUnseenWhatsNewCount(count)
      if (count > 0) {
        setIsWhatsNewOpen(true)
      }
    } catch {
      // Ignora falhas de localStorage
    }
  }

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

        checkInitialModals()
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

        setSessionUser((prev) => {
          if (
            prev &&
            prev.id === session.user.id &&
            prev.email === session.user.email &&
            prev.name === userName
          ) {
            return prev
          }
          return {
            id: session.user.id,
            email: session.user.email,
            name: userName,
          }
        })

        if (session.user.email && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          await upsertProfile(
            session.user.id,
            userName || session.user.email.split('@')[0],
            session.user.email
          ).catch((err) => console.warn('Erro ao sincronizar perfil social:', err))

          if (event === 'SIGNED_IN') {
            checkInitialModals()
          }
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

  const sessionUserId = sessionUser?.id

  const refreshData = useCallback(async () => {
    if (!sessionUserId) return
    try {
      const loadedWallets = await ensureInitialWallets(sessionUserId)
      setWallets(loadedWallets)

      const sharedWallet = loadedWallets.find((w) => w.type === 'shared' && w.family_id)
      const familyId = sharedWallet?.family_id || null

      const [loadedTxs, loadedBills, loadedProfile, loadedDebts] = await Promise.all([
        loadedWallets.length > 0
          ? fetchTransactions(loadedWallets.map((w) => w.id))
          : Promise.resolve([]),
        fetchRecurringBills('all', familyId).catch(() => []),
        fetchUserProfile(sessionUserId).catch(() => null),
        fetchDebts('all', familyId, sessionUserId).catch(() => []),
      ])

      setTransactions(loadedTxs)
      setRecurringBills(loadedBills)
      if (loadedProfile) setUserProfile(loadedProfile)
      setDebts(loadedDebts)
    } catch (err) {
      console.error('Error refreshing data:', err)
    }
  }, [sessionUserId])

  // Realtime subscription for debts synchronization across devices
  useEffect(() => {
    if (!sessionUserId) return

    const debtsChannel = supabase
      .channel('kofre-debts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debts' },
        () => {
          refreshData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(debtsChannel)
    }
  }, [sessionUserId, refreshData])

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
            fetchDebts('all', familyId, sessionUser.id).catch(() => []),
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
  }, [sessionUser?.id])

  // Compute calculated balances and credit card summaries
  const balances = calculateBalances(wallets, transactions, currentScope)
  const cardInvoices = calculateCardInvoices(wallets, transactions, currentScope)

  // Active currencies based on user preference and active wallets
  const preferredCurrency: CurrencyCode = userProfile?.preferred_currency || 'PYG'
  const scopedWallets = wallets.filter((w) => w.type === currentScope)
  const activeCurrencies = getActiveCurrencies(scopedWallets, preferredCurrency)

  // Filter transactions for the selected month (respecting flexible budget cycle)
  const budgetStartDay = userProfile?.budget_start_day || 1
  const locale = language === 'es' ? 'es-PY' : 'pt-BR'
  const budgetPeriod = getBudgetPeriod(selectedDate, budgetStartDay, locale)

  const monthlyTransactions = transactions.filter((t) => {
    if (!t.transaction_date) return false
    return isDateInBudgetPeriod(t.transaction_date, budgetPeriod)
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

  // Quick Action: Guardar Dinheiro em Conta Poupança
  const handleSaveMoney = (savingsWallet: Wallet) => {
    const sourceAccount =
      wallets.find(
        (w) =>
          w.id !== savingsWallet.id &&
          (w.account_type === 'checking' || w.account_type === 'cash') &&
          w.currency === savingsWallet.currency &&
          !w.is_archived
      ) ||
      wallets.find(
        (w) =>
          w.id !== savingsWallet.id &&
          (w.account_type === 'checking' || w.account_type === 'cash') &&
          !w.is_archived
      ) ||
      wallets.find((w) => w.id !== savingsWallet.id && !w.is_archived)

    setEditingTransaction(null)
    setQuickTxType('transfer')
    setQuickTxSourceId(sourceAccount?.id)
    setQuickTxDestId(savingsWallet.id)
    setQuickTxAmount(undefined)
    setQuickTxCategory('Investimentos')
    setQuickTxDescription(`Aporte Poupança: ${savingsWallet.name}`)
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
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex items-center justify-center transition-colors">
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
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col antialiased selection:bg-indigo-500/30 transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        userEmail={sessionUser.email}
        userName={userProfile?.full_name || sessionUser.name}
        userAvatar={userProfile?.avatar}
        currentScope={currentScope}
        onScopeChange={setCurrentScope}
        onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
        onOpenFamilySettings={() => setIsFamilySettingsOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenRecurringBills={() => setIsRecurringBillsModalOpen(true)}
        onOpenWhatsNew={() => {
          setIsWhatsNewOpen(true)
          setUnseenWhatsNewCount(0)
        }}
        unseenCount={unseenWhatsNewCount}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onOpenCurrencyExchange={() => setIsCurrencyExchangeOpen(true)}
        onOpenSplitBill={() => setIsSplitBillOpen(true)}
        onOpenNotificationParser={() => setIsNotificationParserOpen(true)}
        onSignOut={() => {
          setSessionUser(null)
          setWallets([])
          setTransactions([])
          setRecurringBills([])
          setDebts([])
          setUserProfile(null)
        }}
      />

      <main className="flex-1 max-w-[1680px] w-full max-w-full overflow-x-clip mx-auto px-3 sm:px-4 lg:px-8 xl:px-12 py-4 sm:py-6 space-y-6">
        {/* Scope Filter Bar (Minhas Contas / Caixa da Família) - Desktop */}
        <div className="hidden md:block">
          <ScopeFilter
            currentScope={currentScope}
            onSelectScope={setCurrentScope}
            personalCount={personalCount}
            sharedCount={sharedCount}
            onOpenFamilySettings={() => setIsFamilySettingsOpen(true)}
          />
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <DashboardLayout
            activeMobileTab={mobileTab}
            onMobileTabChange={setMobileTab}
            currencyDashboard={
              <CurrencyDashboard
                balances={balances}
                cardInvoices={cardInvoices}
                activeCurrencies={activeCurrencies}
                onPayCardInvoice={handlePayCardInvoice}
              />
            }
            transactionList={
              <TransactionList
                transactions={monthlyTransactions}
                wallets={wallets}
                currentScope={currentScope}
                currentUserId={sessionUser.id}
                selectedDate={selectedDate}
                selectedCategory={activeCategoryFilter}
                onSelectCategory={setActiveCategoryFilter}
                onEditTransaction={handleEditTransaction}
                onTransactionDeleted={() => refreshData()}
              />
            }
            monthSelector={
              <MonthSelector
                selectedDate={selectedDate}
                budgetStartDay={budgetStartDay}
                onSelectDate={setSelectedDate}
              />
            }
            financialHealth={
              <FinancialHealthWidget
                wallets={wallets}
                transactions={monthlyTransactions}
                recurringBills={recurringBills}
                debts={debts}
                currentScope={currentScope}
                preferredCurrency={preferredCurrency}
                userProfile={userProfile}
                onOpenProfile={() => setIsProfileModalOpen(true)}
              />
            }
            monthlySummary={
              <MonthlySummary
                transactions={monthlyTransactions}
                wallets={wallets}
                currentScope={currentScope}
                preferredCurrency={preferredCurrency}
              />
            }
            categoryBreakdown={
              <CategoryBreakdown
                transactions={monthlyTransactions}
                wallets={wallets}
                currentScope={currentScope}
                preferredCurrency={preferredCurrency}
                onSelectCategory={(catName) => setActiveCategoryFilter(catName)}
                onNavigateToStatement={(catName) => {
                  setActiveCategoryFilter(catName)
                  setMobileTab('statement')
                  document.getElementById('transaction-list')?.scrollIntoView({ behavior: 'smooth' })
                }}
                onOpenManageCategories={() => setIsCategoryManagerOpen(true)}
              />
            }
            dueDatesCalendar={
              <DueDatesCalendarWidget
                wallets={wallets}
                transactions={monthlyTransactions}
                recurringBills={recurringBills}
                debts={debts}
                currentScope={currentScope}
                preferredCurrency={preferredCurrency}
                selectedMonthDate={selectedDate}
                onTransactionPaid={async () => {
                  await refreshData()
                }}
              />
            }
            monthlyBills={
              <MonthlyBillsWidget
                recurringBills={recurringBills}
                monthlyTransactions={monthlyTransactions}
                wallets={wallets}
                currentScope={currentScope}
                selectedDate={selectedDate}
                onOpenManage={() => setIsRecurringBillsModalOpen(true)}
                onPayBill={handlePayBill}
              />
            }
            accountList={
              <AccountList
                wallets={wallets}
                transactions={transactions}
                currentScope={currentScope}
                onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
                onManageAccount={(wallet) => setManagingWallet(wallet)}
              />
            }
            savingsGoals={
              <SavingsGoalsWidget
                wallets={wallets}
                transactions={transactions}
                currentScope={currentScope}
                onSaveMoney={handleSaveMoney}
                onManageAccount={(wallet) => setManagingWallet(wallet)}
              />
            }
            debtsWidget={
              <DebtsWidget
                debts={debts}
                wallets={wallets}
                currentScope={currentScope}
                currentUserId={sessionUser?.id}
                onOpenCreateDebt={() => setIsCreateDebtOpen(true)}
                onDebtChanged={() => refreshData()}
              />
            }
          />
        )}
      </main>

      {/* Global Footer with Version and Developer Credit */}
      <footer className="w-full py-6 text-center border-t border-slate-200/60 dark:border-slate-800/60 mt-auto">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono font-medium">Kofre v{CURRENT_APP_VERSION}</span>
          <span>•</span>
          <a
            href="https://wa.me/595994195695"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors font-medium cursor-pointer"
            title="WhatsApp: +595 994 195695"
          >
            <span>Developed by Natan Billig</span>
          </a>
        </div>
      </footer>

      {/* Floating Action Button (+) for Quick Transaction */}
      <div className="fixed bottom-6 right-6 z-40 mb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={handleOpenDefaultQuickTx}
          aria-label={t('quickModal.newTitle')}
          className="cursor-pointer flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 active:scale-95 transition-transform"
          title={t('quickModal.newTitle')}
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
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
        initialDate={quickTxDate}
        onOpenNotificationParser={() => setIsNotificationParserOpen(true)}
        onClose={() => {
          setIsQuickTxOpen(false)
          setEditingTransaction(null)
          setQuickTxDate(undefined)
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
        onOpenOnboardingTour={() => setIsOnboardingTourOpen(true)}
        onOpenWhatsNew={() => {
          setIsWhatsNewOpen(true)
          setUnseenWhatsNewCount(0)
        }}
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
        initialScope={currentScope}
        wallets={wallets}
        onDebtCreated={() => refreshData()}
      />

      {/* What's New / Changelog Modal */}
      <WhatsNewModal
        isOpen={isWhatsNewOpen}
        onClose={() => setIsWhatsNewOpen(false)}
        onVersionAcknowledged={() => {
          setUnseenWhatsNewCount(0)
        }}
      />

      {/* Onboarding Tour / Guia Rápido Modal */}
      <OnboardingTourModal
        isOpen={isOnboardingTourOpen}
        onClose={() => setIsOnboardingTourOpen(false)}
        onCompleted={() => {
          setUnseenWhatsNewCount(getUnseenCount())
        }}
      />

      {/* Mobile Menu Drawer */}
      <MobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        userEmail={sessionUser.email}
        userName={userProfile?.full_name || sessionUser.name}
        userAvatar={userProfile?.avatar}
        unseenCount={unseenWhatsNewCount}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
        onOpenRecurringBills={() => setIsRecurringBillsModalOpen(true)}
        onOpenDebts={() => setIsCreateDebtOpen(true)}
        onOpenFamilySettings={() => setIsFamilySettingsOpen(true)}
        onOpenManageCategories={() => setIsCategoryManagerOpen(true)}
        onOpenWhatsNew={() => {
          setIsWhatsNewOpen(true)
          setUnseenWhatsNewCount(0)
        }}
        onOpenOnboardingTour={() => setIsOnboardingTourOpen(true)}
        onOpenCurrencyExchange={() => setIsCurrencyExchangeOpen(true)}
        onOpenSplitBill={() => setIsSplitBillOpen(true)}
        onOpenNotificationParser={() => setIsNotificationParserOpen(true)}
        onSignOut={() => {
          setSessionUser(null)
          setWallets([])
          setTransactions([])
          setRecurringBills([])
          setDebts([])
          setUserProfile(null)
        }}
      />

      {/* Smart Notification Parser Modal */}
      <SmartNotificationParserModal
        isOpen={isNotificationParserOpen}
        onClose={() => setIsNotificationParserOpen(false)}
        wallets={wallets}
        onApplyParsed={(parsed, selectedWalletId) => {
          setQuickTxType(parsed.type)
          if (selectedWalletId) setQuickTxSourceId(selectedWalletId)
          if (parsed.amount) setQuickTxAmount(parsed.amount)
          if (parsed.suggestedCategory) setQuickTxCategory(parsed.suggestedCategory)
          if (parsed.description) setQuickTxDescription(parsed.description)
          if (parsed.date) setQuickTxDate(parsed.date)
          setIsQuickTxOpen(true)
        }}
      />

      {/* Currency Exchange Simulator Modal */}
      <CurrencyExchangeModal
        isOpen={isCurrencyExchangeOpen}
        onClose={() => setIsCurrencyExchangeOpen(false)}
        preferredCurrency={preferredCurrency}
      />

      {/* Split Bill / Racha de Contas Modal */}
      <SplitBillModal
        isOpen={isSplitBillOpen}
        onClose={() => setIsSplitBillOpen(false)}
        preferredCurrency={preferredCurrency}
        userProfile={userProfile}
        onRecordMyShare={(data) => {
          setQuickTxType('expense')
          const matchingWallet =
            wallets.find(
              (w) =>
                !w.is_archived &&
                w.currency === data.currency &&
                w.type === currentScope
            ) || wallets.find((w) => !w.is_archived && w.currency === data.currency)
          if (matchingWallet) setQuickTxSourceId(matchingWallet.id)
          setQuickTxAmount(data.amount)
          setQuickTxDescription(data.description)
          if (data.category) setQuickTxCategory(data.category)
          setIsQuickTxOpen(true)
        }}
      />

      {/* Category & Budget Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        scope={currentScope}
        familyId={wallets.find((w) => w.type === 'shared' && w.family_id)?.family_id}
        onCategoriesChanged={() => refreshData()}
      />
    </div>
  )
}
