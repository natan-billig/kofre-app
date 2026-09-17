import React, { useEffect, useState } from 'react'
import type { Transaction, Wallet, WalletScope } from '../lib/types'
import { formatCurrency, formatDate } from '../lib/formatters'
import { fetchProfilesMap } from '../lib/profileService'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Utensils,
  Car,
  Home,
  Gamepad2,
  HeartPulse,
  ShoppingBag,
  Briefcase,
  PiggyBank,
  MoreHorizontal,
  User,
  Globe2,
} from 'lucide-react'

interface TransactionListProps {
  transactions: Transaction[]
  wallets: Wallet[]
  currentScope: WalletScope | 'all'
}

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Alimentação: Utensils,
  Transporte: Car,
  Moradia: Home,
  Lazer: Gamepad2,
  Saúde: HeartPulse,
  Compras: ShoppingBag,
  Salário: Briefcase,
  Investimentos: PiggyBank,
  Transferência: ArrowRightLeft,
  'Fatura Cartão': ArrowRightLeft,
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  wallets,
  currentScope,
}) => {
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({})

  // Fetch author profiles for all transaction user_ids
  useEffect(() => {
    const userIds = transactions.map((t) => t.user_id).filter(Boolean)
    if (userIds.length > 0) {
      fetchProfilesMap(userIds).then(setProfilesMap)
    }
  }, [transactions])

  const walletMap = new Map<string, Wallet>()
  for (const w of wallets) {
    walletMap.set(w.id, w)
  }

  // Filter transactions according to scope
  const filteredTransactions = transactions.filter((t) => {
    if (currentScope === 'all') return true

    const sourceWallet = walletMap.get(t.wallet_id)
    const destWallet = t.destination_wallet_id ? walletMap.get(t.destination_wallet_id) : null

    // Se for 'shared' (Caixa da Família), deve envolver carteira shared
    if (currentScope === 'shared') {
      return sourceWallet?.type === 'shared' || destWallet?.type === 'shared'
    }

    // Se for 'personal' (Minhas Contas), deve envolver carteira personal
    if (currentScope === 'personal') {
      return sourceWallet?.type === 'personal' || destWallet?.type === 'personal'
    }

    return true
  })

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Extrato de Movimentações
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {filteredTransactions.length}
          </span>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-800/80 text-slate-500 mb-1">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-300">Nenhuma movimentação registrada</p>
          <p className="text-xs text-slate-500">
            Clique no botão (+) abaixo para registrar sua primeira despesa, receita ou transferência.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {filteredTransactions.map((t) => {
            const sourceWallet = walletMap.get(t.wallet_id)
            const destWallet = t.destination_wallet_id
              ? walletMap.get(t.destination_wallet_id)
              : null

            // Determine if this transaction touches a shared family account
            const isSharedTransaction =
              sourceWallet?.type === 'shared' || destWallet?.type === 'shared'

            const authorName = profilesMap[t.user_id] || 'Membro da Família'

            const CategoryIcon =
              CATEGORY_ICON_MAP[t.category] ||
              (t.type === 'expense'
                ? ArrowDownCircle
                : t.type === 'income'
                ? ArrowUpCircle
                : ArrowRightLeft)

            return (
              <div
                key={t.id}
                className="py-3.5 flex items-start justify-between gap-3 hover:bg-slate-800/20 px-2 rounded-2xl transition-all"
              >
                {/* Left side: Icon and description */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      t.type === 'expense'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : t.type === 'income'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}
                  >
                    <CategoryIcon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    {/* Title / Description */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">
                        {t.description || t.category}
                      </span>

                      {/* Transferred From/To route */}
                      {t.type === 'transfer' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 font-medium">
                          <span>{sourceWallet?.name || 'Origem'}</span>
                          <span>➔</span>
                          <span>{destWallet?.name || 'Destino'}</span>
                        </span>
                      )}
                    </div>

                    {/* Metadata line: Category, Date, Account, and Author for shared */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                      <span>{t.category}</span>
                      <span>&bull;</span>
                      <span>{formatDate(t.transaction_date)}</span>

                      {/* Account indicator if not transfer */}
                      {t.type !== 'transfer' && sourceWallet && (
                        <>
                          <span>&bull;</span>
                          <span className="text-slate-300 font-medium">
                            {sourceWallet.name}
                          </span>
                        </>
                      )}

                      {/* Etiqueta Obrigatória: Por: [Nome do Usuário] em transações do Caixa da Família */}
                      {isSharedTransaction && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                          <User className="w-3 h-3" />
                          <span>Por: {authorName}</span>
                        </span>
                      )}
                    </div>

                    {/* Bimonetary display for frontier expenses */}
                    {t.original_amount && t.original_currency && (
                      <div className="flex items-center gap-1 text-[11px] text-amber-400 font-mono">
                        <Globe2 className="w-3 h-3" />
                        <span>
                          Valor original:{' '}
                          {formatCurrency(Number(t.original_amount), t.original_currency)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Formatted Amount */}
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <div
                    className={`text-sm sm:text-base font-bold tracking-tight ${
                      t.type === 'expense'
                        ? 'text-rose-400'
                        : t.type === 'income'
                        ? 'text-emerald-400'
                        : 'text-indigo-300'
                    }`}
                  >
                    {t.type === 'expense' && '- '}
                    {t.type === 'income' && '+ '}
                    {formatCurrency(Number(t.amount), sourceWallet?.currency || 'PYG')}
                  </div>

                  {/* If cross-currency transfer, show credited amount */}
                  {t.type === 'transfer' &&
                    destWallet &&
                    sourceWallet &&
                    sourceWallet.currency !== destWallet.currency &&
                    t.destination_amount && (
                      <div className="text-[11px] text-emerald-400/90 font-mono">
                        Recebe: +{formatCurrency(Number(t.destination_amount), destWallet.currency)}
                      </div>
                    )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
