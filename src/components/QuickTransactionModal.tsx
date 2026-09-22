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
import {
  createTransaction,
  updateTransaction,
  createTransactionsBatch,
  syncCashbackTransaction,
} from '../lib/accountingService'
import { fetchCategories, DEFAULT_MACRO_MAP } from '../lib/categoryService'
import { CategoryManagerModal } from './CategoryManagerModal'
import { formatCurrency, formatExchangeRate, formatMaskedInput, sanitizeNumericInput } from '../lib/formatters'
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
  Sparkles,
  Layers,
  Calculator,
  ClipboardPaste,
  CalendarClock,
} from 'lucide-react'
import { hasMathExpression, evaluateMathExpression } from '../lib/mathParser'
import { predictCategory } from '../lib/categoryPredictor'

function projectInstallmentDate(baseDateStr: string, monthOffset: number): string {
  const [year, month, day] = baseDateStr.split('-').map(Number)
  const targetYear = year + Math.floor((month - 1 + monthOffset) / 12)
  const targetMonth = ((month - 1 + monthOffset) % 12) + 1
  const maxDays = new Date(targetYear, targetMonth, 0).getDate()
  const targetDay = Math.min(day, maxDays)
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

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
  initialDate?: string
  onOpenNotificationParser?: () => void
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
  initialDate,
  onOpenNotificationParser,
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
      : initialDate ?? new Date().toISOString().split('T')[0]
  )
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [isScheduled, setIsScheduled] = useState<boolean>(
    Boolean(
      editingTransaction?.is_paid === false ||
      editingTransaction?.status === 'pending'
    )
  )

  // Sugestão Preditiva de Categorias
  const [userHasManuallySelectedCategory, setUserHasManuallySelectedCategory] = useState<boolean>(
    Boolean(editingTransaction?.category)
  )
  const [isSuggestedCategory, setIsSuggestedCategory] = useState<boolean>(false)

  // Calculadora Aritmética Segura no Campo de Montante
  const mathPreview = useMemo(() => {
    if (hasMathExpression(amount)) {
      return evaluateMathExpression(amount)
    }
    return null
  }, [amount])

  const sourceWallet = selectableWallets.find((w) => w.id === sourceWalletId)
  const destWallet = selectableWallets.find((w) => w.id === destWalletId)

  const resolveAmountMath = () => {
    const curr = sourceWallet?.currency || 'PYG'
    if (mathPreview !== null) {
      setAmount(formatMaskedInput(mathPreview, curr))
    } else if (amount.trim()) {
      setAmount(formatMaskedInput(amount, curr))
    }
  }

  const destMathPreview = useMemo(() => {
    if (hasMathExpression(destAmount)) {
      return evaluateMathExpression(destAmount)
    }
    return null
  }, [destAmount])

  const resolveDestAmountMath = () => {
    const curr = destWallet?.currency || 'PYG'
    if (destMathPreview !== null) {
      setDestAmount(formatMaskedInput(destMathPreview, curr))
    } else if (destAmount.trim()) {
      setDestAmount(formatMaskedInput(destAmount, curr))
    }
  }

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

  const isCreditCardExpense = type === 'expense' && sourceWallet?.account_type === 'credit_card'

  // Parcelas / Cuotas
  const [installments, setInstallments] = useState<number>(
    editingTransaction?.total_installments || 1
  )

  // Reintegro Bancário (Cashback)
  const [hasCashback, setHasCashback] = useState<boolean>(
    Boolean(editingTransaction?.cashback_amount && Number(editingTransaction.cashback_amount) > 0)
  )
  const [cashbackType, setCashbackType] = useState<'percent' | 'fixed'>(
    editingTransaction?.cashback_percent ? 'percent' : 'percent'
  )
  const [cashbackPercent, setCashbackPercent] = useState<string>(
    editingTransaction?.cashback_percent ? String(editingTransaction.cashback_percent) : '10'
  )
  const [cashbackAmountInput, setCashbackAmountInput] = useState<string>(
    editingTransaction?.cashback_amount ? String(editingTransaction.cashback_amount) : ''
  )
  const [cashbackMaxCap, setCashbackMaxCap] = useState<string>('')
  const [cashbackDate, setCashbackDate] = useState<string>(
    editingTransaction?.transaction_date
      ? editingTransaction.transaction_date.substring(0, 10)
      : transactionDate
  )

  const numAmount = mathPreview !== null ? mathPreview : sanitizeNumericInput(amount, sourceWallet?.currency || 'PYG')
  const sourceCurrency = sourceWallet?.currency || 'PYG'

  let perInstallmentAmount = numAmount
  if (installments > 1 && numAmount > 0) {
    perInstallmentAmount =
      sourceCurrency === 'PYG'
        ? Math.round(numAmount / installments)
        : Number((numAmount / installments).toFixed(2))
  }

  let effectiveCashback = 0
  if (hasCashback && numAmount > 0) {
    if (cashbackType === 'percent') {
      const p = parseFloat(cashbackPercent) || 0
      let raw = (numAmount * p) / 100
      const cap = parseFloat(cashbackMaxCap) || 0
      if (cap > 0) {
        raw = Math.min(raw, cap)
      }
      effectiveCashback = sourceCurrency === 'PYG' ? Math.round(raw) : Number(raw.toFixed(2))
    } else {
      const fixed = parseFloat(cashbackAmountInput) || 0
      effectiveCashback = sourceCurrency === 'PYG' ? Math.round(fixed) : Number(fixed.toFixed(2))
    }
  }

  const effectiveCost = Math.max(0, numAmount - effectiveCashback)

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

  const handleDescriptionChange = (val: string) => {
    setDescription(val)
    if (!userHasManuallySelectedCategory && (type === 'expense' || type === 'income')) {
      const suggested = predictCategory(val, displayedCategories)
      if (suggested && suggested !== category) {
        setCategory(suggested)
        setIsSuggestedCategory(true)
      }
    }
  }

  const handleSelectCategory = (catName: string) => {
    setUserHasManuallySelectedCategory(true)
    setIsSuggestedCategory(false)
    setCategory(catName)
  }

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

    resolveAmountMath()
    if (isCrossCurrencyTransfer) {
      resolveDestAmountMath()
    }

    if (!sourceWalletId) {
      setErrorMsg(t('quickModal.fillRequired'))
      return
    }

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
        const parsedDest = destMathPreview !== null ? destMathPreview : sanitizeNumericInput(destAmount, destWallet?.currency || 'PYG')
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
      const parsedOrig = sanitizeNumericInput(originalAmount, originalCurrency)
      if (parsedOrig && parsedOrig > 0) {
        numOrigAmount = parsedOrig
        origCurr = originalCurrency
      }
    }

    if (
      type === 'expense' &&
      !isScheduled &&
      (sourceWallet?.account_type === 'cash' || sourceWallet?.account_type === 'checking') &&
      transactionDate > todayStr
    ) {
      setErrorMsg(
        language === 'es'
          ? 'No se permiten fechas futuras para efectivo o cuentas bancarias sin activar "Programar Pago".'
          : 'Não são permitidas datas futuras para contas de liquidez sem ativar "Agendar Pagamento".'
      )
      return
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
          cashback_amount:
            type === 'expense' && hasCashback && effectiveCashback > 0 ? effectiveCashback : null,
          cashback_percent:
            type === 'expense' && hasCashback && cashbackType === 'percent'
              ? parseFloat(cashbackPercent) || null
              : null,
          is_paid: type === 'expense' ? !isScheduled : true,
          status: type === 'expense' && isScheduled ? 'pending' : 'completed',
        }

        const updated = await updateTransaction(editingTransaction.id, updatePayload)
        if (type === 'expense') {
          await syncCashbackTransaction(
            updated,
            hasCashback ? effectiveCashback : 0,
            cashbackDate || transactionDate,
            cashbackType === 'percent' ? parseFloat(cashbackPercent) || null : null
          )
        }
      } else if (isCreditCardExpense && installments > 1) {
        // Criar em lote as N parcelas
        const groupId = crypto.randomUUID()
        const batchPayloads: CreateTransactionDTO[] = []

        for (let i = 0; i < installments; i++) {
          const projDate = projectInstallmentDate(transactionDate, i)
          batchPayloads.push({
            user_id: userId,
            wallet_id: sourceWalletId,
            destination_wallet_id: null,
            type: 'expense',
            amount: perInstallmentAmount,
            destination_amount: null,
            category,
            description: description.trim() || null,
            transaction_date: projDate,
            installment_number: i + 1,
            total_installments: installments,
            installment_group_id: groupId,
            // Reintegro aplicado na 1ª parcela
            cashback_amount:
              i === 0 && hasCashback && effectiveCashback > 0 ? effectiveCashback : null,
            cashback_percent:
              i === 0 && hasCashback && cashbackType === 'percent'
                ? parseFloat(cashbackPercent) || null
                : null,
            original_amount:
              isBimonetary && numOrigAmount
                ? sourceWallet?.currency === 'PYG'
                  ? Math.round(numOrigAmount / installments)
                  : Number((numOrigAmount / installments).toFixed(2))
                : null,
            original_currency: isBimonetary ? origCurr : null,
          })
        }

        const createdBatch = await createTransactionsBatch(batchPayloads)
        if (hasCashback && effectiveCashback > 0 && createdBatch.length > 0) {
          await syncCashbackTransaction(
            createdBatch[0],
            effectiveCashback,
            cashbackDate || transactionDate,
            cashbackType === 'percent' ? parseFloat(cashbackPercent) || null : null
          )
        }
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
          cashback_amount:
            type === 'expense' && hasCashback && effectiveCashback > 0 ? effectiveCashback : null,
          cashback_percent:
            type === 'expense' && hasCashback && cashbackType === 'percent'
              ? parseFloat(cashbackPercent) || null
              : null,
          is_paid: type === 'expense' ? !isScheduled : true,
          status: type === 'expense' && isScheduled ? 'pending' : 'completed',
        }

        const created = await createTransaction(payload)
        if (type === 'expense') {
          await syncCashbackTransaction(
            created,
            hasCashback ? effectiveCashback : 0,
            cashbackDate || transactionDate,
            cashbackType === 'percent' ? parseFloat(cashbackPercent) || null : null
          )
        }
      }

      onTransactionCreated()
      onClose()
    } catch (err: unknown) {
      console.error('Error saving transaction:', err)
      const msg =
        err instanceof Error
          ? err.message
          : language === 'es'
          ? 'Error al guardar movimiento.'
          : 'Erro ao salvar transação.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {editingTransaction ? (
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center">
                <Edit3 className="w-4 h-4" />
              </div>
            ) : null}
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingTransaction ? t('quickModal.editTitle') : t('quickModal.newTitle')}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {!editingTransaction && onOpenNotificationParser && (
              <button
                type="button"
                onClick={onOpenNotificationParser}
                className="cursor-pointer px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 transition-colors"
                title={t('notificationParser.title') || 'Colar Notificação Bancária'}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('notificationParser.buttonShort') || 'Colar Notificação'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Type Tabs */}
        <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-950/60 p-1 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setType('expense')
              setCategory('Alimentação')
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'expense'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{t('quickModal.transfer')}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
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
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">
                    {t('quickModal.sourceAccount')} {language === 'es' ? '(Debitar)' : '(Debitar)'}
                  </label>
                  <select
                    value={sourceWalletId}
                    onChange={(e) => setSourceWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:border-indigo-500 outline-none cursor-pointer"
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
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">
                    {t('quickModal.destAccount')} {language === 'es' ? '(Acreditar)' : '(Creditar)'}
                  </label>
                  <select
                    value={destWalletId}
                    onChange={(e) => setDestWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:border-indigo-500 outline-none cursor-pointer"
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
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 flex items-center gap-2 text-purple-800 dark:text-purple-200 text-xs">
                  <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">
                      {language === 'es' ? 'Monto de la Transferencia' : 'Valor da Transferência'} ({sourceWallet?.currency})
                    </label>
                    {mathPreview !== null && (
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Calculator className="w-3.5 h-3.5" />
                        = {formatCurrency(mathPreview, sourceWallet?.currency || 'PYG')}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="text"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={resolveAmountMath}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') resolveAmountMath()
                    }}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-base font-semibold focus:border-indigo-500 outline-none"
                  />
                  {mathPreview !== null && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-semibold px-1">
                      = {formatCurrency(mathPreview, sourceWallet?.currency || 'PYG')}
                    </p>
                  )}
                </div>
              ) : (
                /* Moedas Diferentes: Operação de Câmbio */
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <Globe2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      {language === 'es' ? 'Operación de Cambio' : 'Operação de Câmbio'} ({sourceWallet?.currency} ➔ {destWallet?.currency})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 uppercase">
                          {t('quickModal.debitedAmount')} ({sourceWallet?.currency})
                        </label>
                        {mathPreview !== null && (
                          <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            = {formatCurrency(mathPreview, sourceWallet?.currency || 'PYG')}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="text"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onBlur={resolveAmountMath}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') resolveAmountMath()
                        }}
                        placeholder={language === 'es' ? `Monto en ${sourceWallet?.currency}` : `Valor em ${sourceWallet?.currency}`}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 uppercase">
                          {t('quickModal.creditedAmount')} ({destWallet?.currency})
                        </label>
                        {destMathPreview !== null && (
                          <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            = {formatCurrency(destMathPreview, destWallet?.currency || 'PYG')}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="text"
                        required
                        value={destAmount}
                        onChange={(e) => setDestAmount(e.target.value)}
                        onBlur={resolveDestAmountMath}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') resolveDestAmountMath()
                        }}
                        placeholder={language === 'es' ? `Monto en ${destWallet?.currency}` : `Valor em ${destWallet?.currency}`}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Cotação implícita */}
                  {parseFloat(amount) > 0 && parseFloat(destAmount) > 0 && sourceWallet && destWallet && (
                    <div className="text-center pt-1 text-xs text-indigo-700 dark:text-indigo-300/80 font-mono">
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
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">
                    {type === 'expense'
                      ? (language === 'es' ? 'Cuenta Debitada' : 'Conta Debitada')
                      : (language === 'es' ? 'Cuenta Acreditada' : 'Conta Creditada')}
                  </label>
                  <select
                    value={sourceWalletId}
                    onChange={(e) => setSourceWalletId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:border-indigo-500 outline-none cursor-pointer"
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">
                      {t('quickModal.amount')} ({sourceWallet?.currency})
                    </label>
                    {mathPreview !== null && (
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Calculator className="w-3.5 h-3.5" />
                        = {formatCurrency(mathPreview, sourceWallet?.currency || 'PYG')}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="text"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={resolveAmountMath}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') resolveAmountMath()
                    }}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-base font-semibold focus:border-indigo-500 outline-none"
                  />
                  {mathPreview !== null && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-semibold px-1">
                      = {formatCurrency(mathPreview, sourceWallet?.currency || 'PYG')}
                    </p>
                  )}
                </div>
              </div>

              {/* Toggle Despesa Internacional (Bimoeda) apenas para Despesas */}
              {type === 'expense' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsBimonetary(!isBimonetary)}
                    className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                  >
                    <Globe2 className="w-3.5 h-3.5" />
                    <span>
                      {isBimonetary
                        ? (language === 'es' ? 'Quitar monto internacional' : 'Remover valor internacional')
                        : (language === 'es' ? '¿Compra en otra moneda? (Bimoneda)' : 'Compra em outra moeda? (Bimoeda)')}
                    </span>
                  </button>

                  {isBimonetary && (
                    <div className="mt-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 uppercase block">
                        {language === 'es' ? 'Monto Original de la Compra (Frontera)' : 'Valor Original da Compra (Fronteira)'}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={originalAmount}
                          onChange={(e) => setOriginalAmount(e.target.value)}
                          onBlur={() => {
                            if (originalAmount.trim()) {
                              setOriginalAmount(formatMaskedInput(originalAmount, originalCurrency))
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && originalAmount.trim()) {
                              setOriginalAmount(formatMaskedInput(originalAmount, originalCurrency))
                            }
                          }}
                          placeholder="Ex: 10.00"
                          className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none"
                        />
                        <select
                          value={originalCurrency}
                          onChange={(e) => setOriginalCurrency(e.target.value as CurrencyCode)}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none"
                        >
                          <option value="BRL">BRL (Reais)</option>
                          <option value="USD">USD (Dólares)</option>
                          <option value="PYG">PYG (Guaranis)</option>
                        </select>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {language === 'es'
                          ? 'El monto debitado de su cuenta sigue siendo el campo principal arriba.'
                          : 'O valor debitado da sua conta continua sendo o campo principal acima.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Compras Parceladas / Cuotas (Apenas em Cartão de Crédito ao criar) */}
              {isCreditCardExpense && !editingTransaction && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{t('quickModal.installments')}</span>
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      <option value={1}>{t('quickModal.installmentsCount')}</option>
                      {Array.from({ length: 47 }, (_, i) => i + 2).map((num) => (
                        <option key={num} value={num}>
                          {num}x
                        </option>
                      ))}
                    </select>
                  </div>

                  {installments > 1 && numAmount > 0 && (
                    <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 text-xs font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>
                        {t('quickModal.installmentSummary')
                          .replace('{total}', formatCurrency(numAmount, sourceWallet?.currency || 'PYG'))
                          .replace('{n}', String(installments))
                          .replace(
                            '{perMonth}',
                            formatCurrency(perInstallmentAmount, sourceWallet?.currency || 'PYG')
                          )}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Reintegro Bancário (Cashback) na criação e edição de despesas */}
              {type === 'expense' && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasCashback}
                        onChange={(e) => setHasCashback(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                      />
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t('quickModal.cashbackToggle')}</span>
                    </label>
                  </div>

                  {hasCashback && (
                    <div className="mt-2 p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-500/20 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 uppercase">
                            {t('quickModal.cashbackType')}
                          </label>
                          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => setCashbackType('percent')}
                              className={`flex-1 py-1 text-xs font-medium rounded-lg cursor-pointer transition-all ${
                                cashbackType === 'percent'
                                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => setCashbackType('fixed')}
                              className={`flex-1 py-1 text-xs font-medium rounded-lg cursor-pointer transition-all ${
                                cashbackType === 'fixed'
                                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              $
                            </button>
                          </div>
                        </div>

                        {cashbackType === 'percent' ? (
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 uppercase">
                              {t('quickModal.cashbackPercent')}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={cashbackPercent}
                                onChange={(e) => setCashbackPercent(e.target.value)}
                                placeholder="Ex: 20"
                                className="w-full pl-3 pr-7 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                %
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 uppercase">
                              {t('quickModal.cashbackAmount')}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={cashbackAmountInput}
                              onChange={(e) => setCashbackAmountInput(e.target.value)}
                              placeholder="Ex: 100000"
                              className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cashbackType === 'percent' && (
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 uppercase">
                              {t('quickModal.cashbackMaxCap')}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={cashbackMaxCap}
                              onChange={(e) => setCashbackMaxCap(e.target.value)}
                              placeholder={t('quickModal.cashbackMaxCapHelp')}
                              className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 uppercase">
                            {t('quickModal.cashbackDate')}
                          </label>
                          <input
                            type="date"
                            value={cashbackDate}
                            onChange={(e) => setCashbackDate(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none"
                          />
                        </div>
                      </div>

                      {/* Card em tempo real de Total | Reintegro | Custo Efetivo */}
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between text-xs">
                        <div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium">
                            {t('quickModal.cashbackSummaryTotal')}
                          </div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatCurrency(numAmount, sourceWallet?.currency || 'PYG')}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-medium">
                            {t('quickModal.cashbackSummaryCashback')}
                          </div>
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">
                            - {formatCurrency(effectiveCashback, sourceWallet?.currency || 'PYG')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-medium">
                            {t('quickModal.cashbackSummaryEffective')}
                          </div>
                          <div className="font-extrabold text-indigo-700 dark:text-indigo-300">
                            {formatCurrency(effectiveCost, sourceWallet?.currency || 'PYG')}
                          </div>
                        </div>
                      </div>
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
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">
                    {t('quickModal.category')}
                  </label>
                  {isSuggestedCategory && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                      <Sparkles className="w-2.5 h-2.5" />
                      {t('quickModal.suggestedCategoryBadge')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryManagerOpen(true)}
                  className="cursor-pointer text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
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
                    onChange={(e) => handleSelectCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {!displayedCategories.some((c) => c.name === category) && category && (
                      <option value={category}>{category}</option>
                    )}
                    {Object.entries(groupedCategories).map(([macroName, cats]) => (
                      <optgroup
                        key={macroName}
                        label={macroName}
                        className="bg-slate-100 text-indigo-700 dark:bg-slate-900 dark:text-indigo-300 font-semibold"
                      >
                        {cats.map((cat) => (
                          <option
                            key={cat.id || cat.name}
                            value={cat.name}
                            className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-normal"
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
                          onClick={() => handleSelectCategory(cat.name)}
                          className={`cursor-pointer px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-200 shadow-sm font-semibold'
                              : 'border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-300'
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

          {/* Comutador de Agendamento / Vencimento Futuro */}
          {type === 'expense' && installments <= 1 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {language === 'es' ? 'Programar Pago / Vencimiento Futuro' : 'Agendar Pagamento / Vencimento Futuro'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'es'
                      ? 'No descuenta el saldo actual hasta marcarse como pagado'
                      : 'Não desconta o saldo atual até ser marcado como pago'}
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setIsScheduled(checked)
                    if (checked && transactionDate < todayStr) {
                      setTransactionDate(todayStr)
                    } else if (!checked && transactionDate > todayStr && sourceWallet?.account_type !== 'credit_card') {
                      setTransactionDate(todayStr)
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          )}

          {/* Data e Descrição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">{t('quickModal.date')}</label>
              <input
                type="date"
                required
                value={transactionDate}
                min={isScheduled ? todayStr : undefined}
                max={
                  !isScheduled &&
                  (sourceWallet?.account_type === 'cash' || sourceWallet?.account_type === 'checking')
                    ? todayStr
                    : undefined
                }
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase">
                {t('quickModal.description')}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder={t('quickModal.descriptionPlaceholder')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:border-indigo-500 outline-none"
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
