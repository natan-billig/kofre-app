import React, { useState } from 'react'
import type {
  Wallet,
  TransactionType,
  CurrencyCode,
  CreateTransactionDTO,
} from '../lib/types'
import { createTransaction } from '../lib/accountingService'
import { formatExchangeRate } from '../lib/formatters'
import {
  X,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Globe2,
  CreditCard,
  Utensils,
  Car,
  Home,
  Gamepad2,
  HeartPulse,
  ShoppingBag,
  Briefcase,
  PiggyBank,
  MoreHorizontal,
} from 'lucide-react'

interface QuickTransactionModalProps {
  userId: string
  wallets: Wallet[]
  isOpen: boolean
  initialType?: TransactionType
  initialSourceWalletId?: string
  initialDestWalletId?: string
  initialAmount?: number
  onClose: () => void
  onTransactionCreated: () => void
}

const EXPENSE_CATEGORIES = [
  { name: 'Alimentação', icon: Utensils },
  { name: 'Transporte', icon: Car },
  { name: 'Moradia', icon: Home },
  { name: 'Lazer', icon: Gamepad2 },
  { name: 'Saúde', icon: HeartPulse },
  { name: 'Compras', icon: ShoppingBag },
  { name: 'Outros', icon: MoreHorizontal },
]

const INCOME_CATEGORIES = [
  { name: 'Salário', icon: Briefcase },
  { name: 'Investimentos', icon: PiggyBank },
  { name: 'Transferência', icon: ArrowRightLeft },
  { name: 'Outros', icon: MoreHorizontal },
]

export const QuickTransactionModal: React.FC<QuickTransactionModalProps> = ({
  userId,
  wallets,
  isOpen,
  initialType = 'expense',
  initialSourceWalletId,
  initialDestWalletId,
  initialAmount,
  onClose,
  onTransactionCreated,
}) => {
  const [customType, setCustomType] = useState<TransactionType | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null)
  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : '')
  const [destAmount, setDestAmount] = useState<string>('')
  const [category, setCategory] = useState<string>('Alimentação')
  const [description, setDescription] = useState<string>('')
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  // Bimoeda / Despesa Internacional
  const [isBimonetary, setIsBimonetary] = useState<boolean>(false)
  const [originalAmount, setOriginalAmount] = useState<string>('')
  const [originalCurrency, setOriginalCurrency] = useState<CurrencyCode>('BRL')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const type = customType ?? initialType
  const sourceWalletId = selectedSourceId ?? initialSourceWalletId ?? wallets[0]?.id ?? ''
  const defaultDest = wallets.find((w) => w.id !== sourceWalletId)?.id ?? ''
  const destWalletId = selectedDestId ?? initialDestWalletId ?? defaultDest

  const sourceWallet = wallets.find((w) => w.id === sourceWalletId)
  const destWallet = wallets.find((w) => w.id === destWalletId)

  const isCrossCurrencyTransfer =
    type === 'transfer' &&
    sourceWallet &&
    destWallet &&
    sourceWallet.currency !== destWallet.currency

  const isInvoicePayment =
    type === 'transfer' && destWallet && destWallet.account_type === 'credit_card'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!sourceWalletId) {
      setErrorMsg('Selecione a conta.')
      return
    }

    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Informe um valor válido maior que zero.')
      return
    }

    let numDestAmount: number | null = null
    if (type === 'transfer') {
      if (!destWalletId || destWalletId === sourceWalletId) {
        setErrorMsg('Selecione uma conta de destino diferente da conta de origem.')
        return
      }

      if (isCrossCurrencyTransfer) {
        const parsedDest = parseFloat(destAmount)
        if (!parsedDest || parsedDest <= 0) {
          setErrorMsg('Informe o valor creditado na conta de destino.')
          return
        }
        numDestAmount = parsedDest
      } else {
        numDestAmount = numAmount
      }
    }

    let numOrigAmount: number | null = null
    let origCurr: CurrencyCode | null = null
    if (type === 'expense' && isBimonetary) {
      const parsedOrig = parseFloat(originalAmount)
      if (parsedOrig && parsedOrig > 0) {
        numOrigAmount = parsedOrig
        origCurr = originalCurrency
      }
    }

    setLoading(true)

    try {
      const payload: CreateTransactionDTO = {
        user_id: userId,
        wallet_id: sourceWalletId,
        destination_wallet_id: type === 'transfer' ? destWalletId : null,
        type,
        amount: numAmount,
        destination_amount: numDestAmount,
        category: type === 'transfer' ? (isInvoicePayment ? 'Fatura Cartão' : 'Transferência') : category,
        description: description.trim() || null,
        transaction_date: transactionDate,
        original_amount: numOrigAmount,
        original_currency: origCurr,
      }

      await createTransaction(payload)

      // Reset fields
      setAmount('')
      setDestAmount('')
      setDescription('')
      setIsBimonetary(false)
      setOriginalAmount('')
      setCustomType(null)
      setSelectedSourceId(null)
      setSelectedDestId(null)
      onTransactionCreated()
      onClose()
    } catch (err: unknown) {
      console.error('Error creating transaction:', err)
      const msg = err instanceof Error ? err.message : 'Erro ao registrar transação.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Novo Lançamento</h2>
          <button
            onClick={onClose}
            className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Tabs */}
        <div className="flex rounded-2xl bg-slate-950/60 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setCustomType('expense')
              setCategory('Alimentação')
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'expense'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Despesa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCustomType('income')
              setCategory('Salário')
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'income'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>Receita</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCustomType('transfer')
              setCategory('Transferência')
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'transfer'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transferência</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* TRANSFERÊNCIA: Origem e Destino */}
          {type === 'transfer' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Conta Origem */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    Conta de Origem (Debitar)
                  </label>
                  <select
                    value={sourceWalletId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:border-indigo-500 outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.currency}) - {w.type === 'shared' ? 'Família' : 'Pessoal'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conta Destino */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    Conta de Destino (Creditar)
                  </label>
                  <select
                    value={destWalletId}
                    onChange={(e) => setSelectedDestId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:border-indigo-500 outline-none"
                  >
                    {wallets
                      .filter((w) => w.id !== sourceWalletId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.account_type === 'credit_card' ? '💳 ' : ''}
                          {w.name} ({w.currency}) - {w.type === 'shared' ? 'Família' : 'Pessoal'}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Badge Informativo de Pagamento de Fatura */}
              {isInvoicePayment && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center gap-2 text-purple-200 text-xs">
                  <CreditCard className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>
                    <strong>Pagamento de Fatura:</strong> Reduz o saldo da conta de origem e amortiza a fatura do cartão sem duplicar despesas.
                  </span>
                </div>
              )}

              {/* Valores da Transferência */}
              {!isCrossCurrencyTransfer ? (
                /* Mesma Moeda: Input Único */
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    Valor da Transferência ({sourceWallet?.currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-base font-semibold focus:border-indigo-500 outline-none"
                  />
                </div>
              ) : (
                /* Moedas Diferentes: Operação de Câmbio */
                <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                    <Globe2 className="w-4 h-4 text-indigo-400" />
                    <span>Operação de Câmbio ({sourceWallet?.currency} ➔ {destWallet?.currency})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">
                        Debitar na Origem ({sourceWallet?.currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Valor em ${sourceWallet?.currency}`}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-sm font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">
                        Creditar no Destino ({destWallet?.currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={destAmount}
                        onChange={(e) => setDestAmount(e.target.value)}
                        placeholder={`Valor em ${destWallet?.currency}`}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-sm font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Cotação implícita */}
                  {parseFloat(amount) > 0 && parseFloat(destAmount) > 0 && sourceWallet && destWallet && (
                    <div className="text-center pt-1 text-xs text-indigo-300/80 font-mono">
                      Cotação: {formatExchangeRate(
                        parseFloat(amount),
                        sourceWallet.currency,
                        parseFloat(destAmount),
                        destWallet.currency
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* DESPESA OU RECEITA NORMAL */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Seleção de Conta */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    {type === 'expense' ? 'Conta Debitada' : 'Conta Creditada'}
                  </label>
                  <select
                    value={sourceWalletId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:border-indigo-500 outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.account_type === 'credit_card' ? '💳 ' : ''}
                        {w.name} ({w.currency}) - {w.type === 'shared' ? 'Família' : 'Pessoal'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Valor Efetivamente Cobrado */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    Valor ({sourceWallet?.currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-base font-semibold focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Toggle Despesa Internacional (Bimoeda) apenas para Despesas */}
              {type === 'expense' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsBimonetary(!isBimonetary)}
                    className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <Globe2 className="w-3.5 h-3.5" />
                    <span>{isBimonetary ? 'Remover valor internacional' : 'Compra em outra moeda? (Bimoeda)'}</span>
                  </button>

                  {isBimonetary && (
                    <div className="mt-2 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                        Valor Original da Compra (Fronteira)
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={originalAmount}
                          onChange={(e) => setOriginalAmount(e.target.value)}
                          placeholder="Ex: 10.00"
                          className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm outline-none"
                        />
                        <select
                          value={originalCurrency}
                          onChange={(e) => setOriginalCurrency(e.target.value as CurrencyCode)}
                          className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-sm outline-none"
                        >
                          <option value="BRL">BRL (Reais)</option>
                          <option value="USD">USD (Dólares)</option>
                          <option value="PYG">PYG (Guaranis)</option>
                        </select>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        O valor debitado da sua conta continua sendo o campo principal acima.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Categorias (Despesa / Receita) */}
          {type !== 'transfer' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">Categoria</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                {(type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat) => {
                  const Icon = cat.icon
                  const isSelected = category === cat.name
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`cursor-pointer px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Data e Descrição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Data</label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-xs focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                Descrição (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Supermercado, Abastecimento, Farmácia"
                className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-xs focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-[0.98] ${
                type === 'expense'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  : type === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Confirmar Lançamento</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
