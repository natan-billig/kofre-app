import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import type {
  Wallet,
  Transaction,
  WalletScope,
  TransactionType,
} from './lib/types'
import { ensureInitialWallets } from './lib/walletService'
import {
  fetchTransactions,
  calculateBalances,
  calculateCardInvoices,
} from './lib/accountingService'
import { Navbar } from './components/Navbar'
import { ScopeFilter } from './components/ScopeFilter'
import { CurrencyDashboard } from './components/CurrencyDashboard'
import { AccountList } from './components/AccountList'
import { TransactionList } from './components/TransactionList'
import { QuickTransactionModal } from './components/QuickTransactionModal'
import { CreateAccountModal } from './components/CreateAccountModal'
import { AuthModal } from './components/auth/AuthModal'
import { Plus, Loader2 } from 'lucide-react'

export default function App() {
  const [sessionUser, setSessionUser] = useState<{
    id: string
    email?: string | null
    name?: string | null
  } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Core Data
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  // Scope filter: 'personal' (Minhas Contas) | 'shared' (Caixa da Família) | 'all' (Consolidado)
  const [currentScope, setCurrentScope] = useState<WalletScope | 'all'>('personal')

  // Modals state
  const [isQuickTxOpen, setIsQuickTxOpen] = useState(false)
  const [quickTxType, setQuickTxType] = useState<TransactionType>('expense')
  const [quickTxSourceId, setQuickTxSourceId] = useState<string | undefined>()
  const [quickTxDestId, setQuickTxDestId] = useState<string | undefined>()
  const [quickTxAmount, setQuickTxAmount] = useState<number | undefined>()

  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false)

  // 1. Supabase Auth Session listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSessionUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || null,
        })
      } else {
        setSessionUser(null)
      }
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSessionUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || null,
        })
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

      if (loadedWallets.length > 0) {
        const walletIds = loadedWallets.map((w) => w.id)
        const loadedTxs = await fetchTransactions(walletIds)
        setTransactions(loadedTxs)
      } else {
        setTransactions([])
      }
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
          if (loadedWallets.length > 0) {
            const walletIds = loadedWallets.map((w) => w.id)
            const loadedTxs = await fetchTransactions(walletIds)
            if (isMounted) setTransactions(loadedTxs)
          } else {
            if (isMounted) setTransactions([])
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

  const personalCount = wallets.filter((w) => w.type === 'personal').length
  const sharedCount = wallets.filter((w) => w.type === 'shared').length

  // Quick Action: Pagar Fatura
  const handlePayCardInvoice = (cardWallet: Wallet, invoiceAmount: number) => {
    // Find a bank account to pay from (checking or cash in same or compatible currency)
    const bankAccount = wallets.find(
      (w) => w.id !== cardWallet.id && w.account_type === 'checking'
    ) || wallets.find((w) => w.id !== cardWallet.id)

    setQuickTxType('transfer')
    setQuickTxSourceId(bankAccount?.id)
    setQuickTxDestId(cardWallet.id)
    setQuickTxAmount(invoiceAmount > 0 ? invoiceAmount : undefined)
    setIsQuickTxOpen(true)
  }

  // Open default Quick Transaction (+)
  const handleOpenDefaultQuickTx = () => {
    setQuickTxType('expense')
    setQuickTxSourceId(undefined)
    setQuickTxDestId(undefined)
    setQuickTxAmount(undefined)
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
        userName={sessionUser.name}
        onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
        onSignOut={() => {
          setSessionUser(null)
          setWallets([])
          setTransactions([])
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-24">
        {/* Scope Switcher: Minhas Contas / Caixa da Família / Consolidado */}
        <ScopeFilter
          currentScope={currentScope}
          onSelectScope={setCurrentScope}
          personalCount={personalCount}
          sharedCount={sharedCount}
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
              onPayCardInvoice={handlePayCardInvoice}
            />

            {/* Accounts and Institutions list */}
            <AccountList
              wallets={wallets}
              transactions={transactions}
              currentScope={currentScope}
              onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
            />

            {/* Chronological Transactions Feed */}
            <TransactionList
              transactions={transactions}
              wallets={wallets}
              currentScope={currentScope}
            />
          </>
        )}
      </main>

      {/* Floating Action Button (+) for Quick Transaction */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={handleOpenDefaultQuickTx}
          className="cursor-pointer flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all"
          title="Novo lançamento rápido"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Quick Transaction Modal */}
      <QuickTransactionModal
        userId={sessionUser.id}
        wallets={wallets}
        isOpen={isQuickTxOpen}
        initialType={quickTxType}
        initialSourceWalletId={quickTxSourceId}
        initialDestWalletId={quickTxDestId}
        initialAmount={quickTxAmount}
        onClose={() => setIsQuickTxOpen(false)}
        onTransactionCreated={() => {
          refreshData()
        }}
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
    </div>
  )
}
