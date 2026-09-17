import React, { useState } from 'react'
import type { Wallet, Transaction, WalletScope } from '../lib/types'
import { calculateAccountBalance } from '../lib/accountingService'
import { formatCurrency } from '../lib/formatters'
import {
  Banknote,
  Landmark,
  CreditCard,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface AccountListProps {
  wallets: Wallet[]
  transactions: Transaction[]
  currentScope: WalletScope | 'all'
  onOpenCreateAccount: () => void
  onSelectAccountForTransaction?: (wallet: Wallet) => void
}

export const AccountList: React.FC<AccountListProps> = ({
  wallets,
  transactions,
  currentScope,
  onOpenCreateAccount,
}) => {
  const [collapsed, setCollapsed] = useState(false)

  const filteredWallets = wallets.filter(
    (w) => currentScope === 'all' || w.type === currentScope
  )

  const cashWallets = filteredWallets.filter((w) => w.account_type === 'cash')
  const checkingWallets = filteredWallets.filter((w) => w.account_type === 'checking')
  const creditWallets = filteredWallets.filter((w) => w.account_type === 'credit_card')

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Contas e Instituições
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {filteredWallets.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenCreateAccount}
            className="cursor-pointer inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 transition-all font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="cursor-pointer p-1 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title={collapsed ? 'Expandir lista' : 'Recolher lista'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-4">
          {/* Efetivo */}
          {cashWallets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                <span>Efetivo / Dinheiro Físico</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cashWallets.map((w) => {
                  const bal = calculateAccountBalance(w, transactions)
                  return (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-100">{w.name}</span>
                          {w.type === 'shared' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              Família
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 uppercase font-mono">
                          {w.currency}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-100">
                        {formatCurrency(bal, w.currency)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contas Bancárias */}
          {checkingWallets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Landmark className="w-3.5 h-3.5 text-sky-400" />
                <span>Contas Bancárias</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {checkingWallets.map((w) => {
                  const bal = calculateAccountBalance(w, transactions)
                  return (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-100">{w.name}</span>
                          {w.type === 'shared' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              Família
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 uppercase font-mono">
                          {w.currency}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-100">
                        {formatCurrency(bal, w.currency)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cartões de Crédito */}
          {creditWallets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                <span>Cartões de Crédito</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {creditWallets.map((w) => {
                  const invoice = calculateAccountBalance(w, transactions)
                  return (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-purple-500/20 flex items-center justify-between hover:border-purple-500/40 transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-100">{w.name}</span>
                          {w.type === 'shared' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              Família
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-purple-300 uppercase font-mono">
                          Fatura: {w.currency}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-300">
                          {formatCurrency(invoice, w.currency)}
                        </div>
                        {w.credit_limit && (
                          <div className="text-[10px] text-slate-400">
                            Lim: {formatCurrency(Number(w.credit_limit), w.currency)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {filteredWallets.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-xs">
              Nenhuma conta encontrada neste filtro.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
