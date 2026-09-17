import React, { useState, useEffect, useMemo } from 'react'
import type {
  Wallet,
  Transaction,
  TransactionType,
  CurrencyCode,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  Category,
  WalletScope,
} from '../lib/types'
import { createTransaction, updateTransaction } from '../lib/accountingService'
import { fetchCategories, DEFAULT_MACRO_MAP } from '../lib/categoryService'
import { CategoryManagerModal } from './CategoryManagerModal'
import { formatExchangeRate } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
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
  Edit3,
  Settings2,
  Tag,
} from 'lucide-react'

interface QuickTransactionModalProps {
  userId: string
  wallets: Wallet[]
  isOpen: boolean
  editingTransaction?: Transaction | null
  initialType?: TransactionType
  initialSourceWalletId?: string
  initialDestWalletId?: string
  initialAmount?: number
  initialCategory?: string
  initialDescription?: string
  onClose: () => void
  onTransactionCreated: () => void
}

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Alimentação: Utensils,
  Supermercado: ShoppingBag,
  Transporte: Car,
  Moradia: Home,
  Lazer: Gamepad2,
  Saúde: HeartPulse,
  Compras: ShoppingBag,
  Salário: Briefcase,
  Investimentos: PiggyBank,
  Transferência: ArrowRightLeft,
  Outros: MoreHorizontal,
}

const QuickTransactionForm: React.FC<QuickTransactionModalProps> = ({
  userId,
  wallets,
  editingTransaction,
  initialType = 'expense',
  initialSourceWalletId,
  initialDestWalletId,
  initialAmount,
  initialCategory,
  initialDescription,
  onClose,
  onTransactionCreated,
}) => {
  const { t, language } = useTranslation()
  // Filter selectable active wallets
  const selectableWallets = wallets.filter(
    (w) =>
      !w.is_archived ||
      w.id === editingTransaction?.wallet_id ||
      w.id === editingTransaction?.destination_wallet_id
  )

  const defaultSource =
    editingTransaction?.wallet_id ??
    (initialSourceWalletId && selectableWallets.some((w) => w.id === initialSourceWalletId)
      ? initialSourceWalletId
      : selectableWallets[0]?.id || '')

  const defaultDest =
    editingTransaction?.destination_wallet_id ??
    (initialDestWalletId && selectableWallets.some((w) => w.id === initialDestWalletId)
      ? initialDestWalletId
      : selectableWallets.find((w) => w.id !== defaultSource)?.id || '')

  const [type, setType] = useState<TransactionType>(
    editingTransaction?.type ?? initialType
  )
  const [sourceWalletId, setSourceWalletId] = useState<string>(defaultSource)
  const [destWalletId, setDestWalletId] = useState<string>(defaultDest)
  const [amount, setAmount] = useState<string>(
    editingTransaction
      ? String(editingTransaction.amount)
      : initialAmount
      ? String(initialAmount)
      : ''
  )
  const [destAmount, setDestAmount] = useState<string>(
    editingTransaction?.destination_amount ? String(editingTransaction.destination_amount) : ''
  )
  const [category, setCategory] = useState<string>(
    editingTransaction?.category ??
      initialCategory ??
      (initialType === 'income'
        ? 'Salário'
        : initialType === 'transfer'
        ? 'Transferência'
        : 'Alimentação')
  )
  const [description, setDescription] = useState<string>(
    editingTransaction?.description ?? initialDescription ?? ''
  )
  const [transactionDate, setTransactionDate] = useState<string>(
    editingTransaction?.transaction_date
      ? editingTransaction.transaction_date.substring(0, 10)
      : new Date().toISOString().split('T')[0]
  )

  // Bimoeda / Despesa Internacional
  const [isBimonetary, setIsBimonetary] = useState<boolean>(
    Boolean(editingTransaction?.original_amount)
  )
  const [originalAmount, setOriginalAmount] = useState<string>(
    editingTransaction?.original_amount ? String(editingTransaction.original_amount) : ''
  )
  const [originalCurrency, setOriginalCurrency] = useState<CurrencyCode>(
    editingTransaction?.original_currency ?? 'BRL'
  )

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const sourceWallet = selectableWallets.find((w) => w.id === sourceWalletId)
  const destWallet = selectableWallets.find((w) => w.id === destWalletId)

  const currentScope: WalletScope = sourceWallet?.type || 'personal'
  const familyId = sourceWallet?.family_id

  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [categoryVersion, setCategoryVersion] = useState(0)

  useEffect(() => {
    let isMounted = true
    queueMicrotask(() => {
      if (isMounted) setLoadingCategories(true)
    })
    fetchCategories(currentScope, familyId)
      .then((data) => {
        if (isMounted) setCategories(data)
      })
      .catch((err) => {
        console.error('Erro ao carregar categorias:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingCategories(false)
      })
    return () => {
      isMounted = false
    }
  }, [currentScope, familyId, categoryVersion])

  const displayedCategories = categories.filter((cat) => {
    if (type === 'expense') return cat.type === 'expense' || cat.type === 'both'
    if (type === 'income') return cat.type === 'income' || cat.type === 'both'
    return true
  })

  const groupedCategories = useMemo(() => {
    const groups: Record<string, Category[]> = {}

    for (const cat of displayedCategories) {
      const macro =
        cat.macro_category?.trim() ||
        DEFAULT_MACRO_MAP[cat.name] ||
        'Outros'

      if (!groups[macro]) {
        groups[macro] = []
      }
      groups[macro].push(cat)
    }

    return groups
  }, [displayedCategories])

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
      setErrorMsg(t('quickModal.fillRequired'))
      return
    }

    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      setErrorMsg(t('quickModal.fillRequired'))
      return
    }

    let numDestAmount: number | null = null
    if (type === 'transfer') {
      if (!destWalletId || destWalletId === sourceWalletId) {
        setErrorMsg(t('quickModal.diffAccounts'))
        return
      }

      if (isCrossCurrencyTransfer) {
        const parsedDest = parseFloat(destAmount)
        if (!parsedDest || parsedDest <= 0) {
          setErrorMsg(t('quickModal.fillRequired'))
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
      if (editingTransaction) {
        const updatePayload: UpdateTransactionDTO = {
          wallet_id: sourceWalletId,
          destination_wallet_id: type === 'transfer' ? destWalletId : null,
          type,
          amount: numAmount,
          destination_amount: numDestAmount,
          category:
            type === 'transfer'
              ? isInvoicePayment
                ? 'Fatura Cartão'
                : 'Transferência'
              : category,
          description: description.trim() || null,
          transaction_date: transactionDate,
          original_amount: numOrigAmount,
          original_currency: origCurr,
        }

        await updateTransaction(editingTransaction.id, updatePayload)
      } else {
        const payload: CreateTransactionDTO = {
          user_id: userId,
          wallet_id: sourceWalletId,
          destination_wallet_id: type === 'transfer' ? destWalletId : null,
          type,
          amount: numAmount,
          destination_amount: numDestAmount,
          category:
            type === 'transfer'
              ? isInvoicePayment
                ? 'Fatura Cartão'
                : 'Transferência'
              : category,
          description: description.trim() || null,
          transaction_date: transactionDate,
          original_amount: numOrigAmount,
          original_currency: origCurr,
        }

        await createTransaction(payload)
      }

      onTransactionCreated()
      onClose()
    } catch (err: unknown) {
      console.error('Error saving transaction:', err)
      const msg = err instanceof Error ? err.message : (language === 'es' ? 'Error al guardar movimiento.' : 'Erro ao salvar transação.')
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
          <div className="flex items-center gap-2">
            {editingTransaction ? (
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                <Edit3 className="w-4 h-4" />
              </div>
            ) : null}
            <h2 className="text-lg font-bold text-white">
              {editingTransaction ? t('quickModal.editTitle') : t('quickModal.newTitle')}
            </h2>
          </div>
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
              setType('expense')
              setCategory('Alimentação')
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'expense'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>{t('quickModal.expense')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setType('income')
              setCategory('Salário')
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'income'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>{t('quickModal.income')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setType('transfer')
              setCategory('Transferência')
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'transfer'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{t('quickModal.transfer')}</span>
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
                    {t('quickModal.sourceAccount')} {language === 'es' ? '(Debitar)' : '(Debitar)'}
                  </label>
                  <select
                    value={sourceWalletId}
                    onChange={(e) => setSourceWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:border-indigo-500 outline-none"
                  >
                    {selectableWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.currency}) - {w.type === 'shared' ? t('nav.family') : (language === 'es' ? 'Personal' : 'Pessoal')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conta Destino */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    {t('quickModal.destAccount')} {language === 'es' ? '(Acreditar)' : '(Creditar)'}
                  </label>
                  <select
                    value={destWalletId}
                    onChange={(e) => setDestWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:border-indigo-500 outline-none"
                  >
                    {selectableWallets
                      .filter((w) => w.id !== sourceWalletId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.account_type === 'credit_card' ? '💳 ' : ''}
                          {w.name} ({w.currency}) - {w.type === 'shared' ? t('nav.family') : (language === 'es' ? 'Personal' : 'Pessoal')}
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
                    <strong>{t('categories.Pagamento de Fatura')}:</strong>{' '}
                    {language === 'es'
                      ? 'Reduce el saldo de la cuenta de origen y amortiza el extracto de la tarjeta sin duplicar gastos.'
                      : 'Reduz o saldo da conta de origem e amortiza a fatura do cartão sem duplicar despesas.'}
                  </span>
                </div>
              )}

              {/* Valores da Transferência */}
              {!isCrossCurrencyTransfer ? (
                /* Mesma Moeda: Input Único */
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    {language === 'es' ? 'Monto de la Transferencia' : 'Valor da Transferência'} ({sourceWallet?.currency})
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
                    <span>
                      {language === 'es' ? 'Operación de Cambio' : 'Operação de Câmbio'} ({sourceWallet?.currency} ➔ {destWallet?.currency})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">
                        {t('quickModal.debitedAmount')} ({sourceWallet?.currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={language === 'es' ? `Monto en ${sourceWallet?.currency}` : `Valor em ${sourceWallet?.currency}`}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-sm font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">
                        {t('quickModal.creditedAmount')} ({destWallet?.currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={destAmount}
                        onChange={(e) => setDestAmount(e.target.value)}
                        placeholder={language === 'es' ? `Monto en ${destWallet?.currency}` : `Valor em ${destWallet?.currency}`}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-sm font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Cotação implícita */}
                  {parseFloat(amount) > 0 && parseFloat(destAmount) > 0 && sourceWallet && destWallet && (
                    <div className="text-center pt-1 text-xs text-indigo-300/80 font-mono">
                      {t('quickModal.exchangeRate')}: {formatExchangeRate(
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
                    {type === 'expense'
                      ? (language === 'es' ? 'Cuenta Debitada' : 'Conta Debitada')
                      : (language === 'es' ? 'Cuenta Acreditada' : 'Conta Creditada')}
                  </label>
                  <select
                    value={sourceWalletId}
                    onChange={(e) => setSourceWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:border-indigo-500 outline-none"
                  >
                    {selectableWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.account_type === 'credit_card' ? '💳 ' : ''}
                        {w.name} ({w.currency}) - {w.type === 'shared' ? t('nav.family') : (language === 'es' ? 'Personal' : 'Pessoal')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Valor Efetivamente Cobrado */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">
                    {t('quickModal.amount')} ({sourceWallet?.currency})
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
                    <span>
                      {isBimonetary
                        ? (language === 'es' ? 'Quitar monto internacional' : 'Remover valor internacional')
                        : (language === 'es' ? '¿Compra en otra moneda? (Bimoneda)' : 'Compra em outra moeda? (Bimoeda)')}
                    </span>
                  </button>

                  {isBimonetary && (
                    <div className="mt-2 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                        {language === 'es' ? 'Monto Original de la Compra (Frontera)' : 'Valor Original da Compra (Fronteira)'}
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
                        {language === 'es'
                          ? 'El monto debitado de su cuenta sigue siendo el campo principal arriba.'
                          : 'O valor debitado da sua conta continua sendo o campo principal acima.'}
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-400 uppercase">
                  {t('quickModal.category')}
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryManagerOpen(true)}
                  className="cursor-pointer text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>{t('quickModal.manageCategories')}</span>
                </button>
              </div>

              {loadingCategories && categories.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Select com <optgroup> por Macro-categoria */}
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {!displayedCategories.some((c) => c.name === category) && category && (
                      <option value={category}>{category}</option>
                    )}
                    {Object.entries(groupedCategories).map(([macroName, cats]) => (
                      <optgroup
                        key={macroName}
                        label={macroName}
                        className="bg-slate-900 text-indigo-300 font-semibold"
                      >
                        {cats.map((cat) => (
                          <option
                            key={cat.id || cat.name}
                            value={cat.name}
                            className="bg-slate-950 text-slate-100 font-normal"
                          >
                            {t(`categories.${cat.name}`, cat.name)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Pills rápidas para seleção instantânea */}
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-0.5">
                    {displayedCategories.map((cat) => {
                      const Icon = CATEGORY_ICON_MAP[cat.name] || Tag
                      const isSelected = category === cat.name
                      return (
                        <button
                          key={cat.id || cat.name}
                          type="button"
                          onClick={() => setCategory(cat.name)}
                          className={`cursor-pointer px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200 shadow-sm'
                              : 'border-slate-800/80 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{t(`categories.${cat.name}`, cat.name)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data e Descrição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">{t('quickModal.date')}</label>
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
                {t('quickModal.description')}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('quickModal.descriptionPlaceholder')}
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
                <span>
                  {editingTransaction
                    ? (language === 'es' ? 'Guardar Cambios' : 'Salvar Alterações')
                    : t('quickModal.save')}
                </span>
              )}
            </button>
          </div>
        </form>

        {/* Category Manager Modal */}
        <CategoryManagerModal
          isOpen={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
          scope={currentScope}
          familyId={familyId}
          onCategoriesChanged={() => {
            setCategoryVersion((v) => v + 1)
          }}
        />
      </div>
    </div>
  )
}

export const QuickTransactionModal: React.FC<QuickTransactionModalProps> = (props) => {
  if (!props.isOpen) return null

  // Mounting key resets form cleanly on open or transaction switch without needing useEffect
  const formKey =
    props.editingTransaction?.id ??
    `new-tx-${props.initialType || ''}-${props.initialSourceWalletId || ''}-${props.initialAmount || ''}-${props.initialCategory || ''}-${props.initialDescription || ''}`

  return <QuickTransactionForm key={formKey} {...props} />
}
