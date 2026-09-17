import React, { useState, useEffect } from 'react'
import type { RecurringBill, Wallet, Category, CurrencyCode, WalletScope } from '../lib/types'
import {
  fetchRecurringBills,
  createRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
} from '../lib/recurringService'
import { fetchCategories } from '../lib/categoryService'
import { formatCurrency } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  X,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Power,
  CreditCard,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react'

interface RecurringBillsModalProps {
  isOpen: boolean
  onClose: () => void
  wallets: Wallet[]
  scope: WalletScope | 'all'
  familyId?: string | null
  onBillsChanged: () => void
}

export const RecurringBillsModal: React.FC<RecurringBillsModalProps> = ({
  isOpen,
  onClose,
  wallets,
  scope,
  familyId,
  onBillsChanged,
}) => {
  const { t } = useTranslation()

  const [bills, setBills] = useState<RecurringBill[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null)
  const [billType, setBillType] = useState<'expense' | 'income'>('expense')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('PYG')
  const [category, setCategory] = useState('')
  const [walletId, setWalletId] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [billScope, setBillScope] = useState<WalletScope>(
    scope === 'shared' ? 'shared' : 'personal'
  )
  const [isActive, setIsActive] = useState(true)

  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  // Deletion confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter selectable wallets
  const selectableWallets = wallets.filter((w) => !w.is_archived)

  const categories = allCategories.filter((c) =>
    billType === 'income'
      ? c.type === 'income' || c.type === 'both'
      : c.type === 'expense' || c.type === 'both'
  )

  useEffect(() => {
    let isMounted = true
    if (isOpen) {
      queueMicrotask(() => {
        if (isMounted) {
          setLoading(true)
          setIsFormOpen(false)
          setEditingBill(null)
          setFormError(null)
          setFeedbackMsg(null)
        }
      })
      const effectiveScope = scope === 'all' ? 'all' : scope
      Promise.all([
        fetchRecurringBills(effectiveScope, familyId),
        fetchCategories(scope === 'shared' ? 'shared' : 'personal', familyId),
      ])
        .then(([fetchedBills, fetchedCats]) => {
          if (isMounted) {
            setBills(fetchedBills)
            setAllCategories(fetchedCats)
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar dados de contas fixas:', err)
        })
        .finally(() => {
          if (isMounted) setLoading(false)
        })
    }
    return () => {
      isMounted = false
    }
  }, [isOpen, scope, familyId])

  if (!isOpen) return null

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setBillType(newType)
    const validCats = allCategories.filter((c) =>
      newType === 'income'
        ? c.type === 'income' || c.type === 'both'
        : c.type === 'expense' || c.type === 'both'
    )
    if (!validCats.some((c) => c.name === category)) {
      const defaultCat =
        newType === 'income'
          ? validCats.find((c) => c.name === 'Salário')?.name || validCats[0]?.name || 'Salário'
          : validCats.find((c) => c.name === 'Moradia')?.name || validCats[0]?.name || 'Moradia'
      setCategory(defaultCat)
    }
  }

  const handleOpenCreateForm = () => {
    setEditingBill(null)
    setBillType('expense')
    setName('')
    setAmount('')
    const defaultWallet = selectableWallets[0]
    setWalletId(defaultWallet?.id || '')
    setCurrency(defaultWallet?.currency || 'PYG')
    const expenseCats = allCategories.filter((c) => c.type === 'expense' || c.type === 'both')
    setCategory(expenseCats[0]?.name || 'Moradia')
    setDueDay('10')
    setStartDate(new Date().toISOString().split('T')[0])
    setBillScope(scope === 'shared' ? 'shared' : 'personal')
    setIsActive(true)
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleOpenEditForm = (bill: RecurringBill) => {
    setEditingBill(bill)
    setBillType(bill.type || 'expense')
    setName(bill.name)
    setAmount(String(bill.amount))
    setCurrency(bill.currency)
    setCategory(bill.category)
    setWalletId(bill.wallet_id)
    setDueDay(String(bill.due_day))
    setStartDate(
      bill.start_date
        ? bill.start_date.substring(0, 10)
        : new Date().toISOString().split('T')[0]
    )
    setBillScope(bill.scope)
    setIsActive(bill.is_active)
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleCancelForm = () => {
    setIsFormOpen(false)
    setEditingBill(null)
    setFormError(null)
  }

  const handleWalletChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    setWalletId(selectedId)
    const selectedWallet = selectableWallets.find((w) => w.id === selectedId)
    if (selectedWallet) {
      setCurrency(selectedWallet.currency)
      setBillScope(selectedWallet.type)
    }
  }

  const handleToggleActive = async (bill: RecurringBill) => {
    try {
      const updated = await updateRecurringBill(bill.id, { is_active: !bill.is_active })
      setBills((prev) => prev.map((b) => (b.id === bill.id ? updated : b)))
      onBillsChanged()
    } catch (err) {
      console.error('Erro ao alternar status da conta fixa:', err)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await deleteRecurringBill(id)
      setBills((prev) => prev.filter((b) => b.id !== id))
      setDeletingId(null)
      onBillsChanged()
    } catch (err) {
      console.error('Erro ao excluir conta fixa:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    const numAmount = parseFloat(amount)
    const numDay = parseInt(dueDay, 10)

    if (!trimmedName || !amount || !walletId || !category) {
      setFormError(t('recurringBills.fillRequired'))
      return
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError(t('recurringBills.fillRequired'))
      return
    }

    if (isNaN(numDay) || numDay < 1 || numDay > 31) {
      setFormError(t('recurringBills.invalidDay'))
      return
    }

    setIsSaving(true)
    try {
      if (editingBill) {
        const updated = await updateRecurringBill(editingBill.id, {
          name: trimmedName,
          amount: numAmount,
          currency,
          category,
          wallet_id: walletId,
          due_day: numDay,
          start_date: startDate || undefined,
          is_active: isActive,
          scope: billScope,
          family_id: billScope === 'shared' ? familyId || null : null,
          type: billType,
        })
        setBills((prev) => prev.map((b) => (b.id === editingBill.id ? updated : b)))
        setFeedbackMsg(t('recurringBills.updatedSuccess'))
      } else {
        const created = await createRecurringBill({
          name: trimmedName,
          amount: numAmount,
          currency,
          category,
          wallet_id: walletId,
          due_day: numDay,
          start_date: startDate || undefined,
          is_active: isActive,
          scope: billScope,
          family_id: billScope === 'shared' ? familyId || null : null,
          type: billType,
        })
        setBills((prev) => [...prev, created].sort((a, b) => a.due_day - b.due_day))
        setFeedbackMsg(t('recurringBills.createdSuccess'))
      }

      setIsFormOpen(false)
      setEditingBill(null)
      onBillsChanged()

      setTimeout(() => setFeedbackMsg(null), 3000)
    } catch (err: unknown) {
      console.error('Erro ao salvar conta fixa:', err)
      setFormError((err as Error).message || t('authModal.authError'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-slate-900/95 border border-slate-800/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {t('recurringBills.manageTitle')}
              </h2>
              <p className="text-xs text-slate-400">
                {scope === 'shared'
                  ? t('scope.shared')
                  : scope === 'personal'
                  ? t('scope.personal')
                  : t('scope.all')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Message */}
        {feedbackMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Action Bar / Toggle Form Button */}
          {!isFormOpen && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                {bills.length} {t('recurringBills.title')}
              </span>
              <button
                type="button"
                onClick={handleOpenCreateForm}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-sm shadow-emerald-950/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{t('recurringBills.newBill')}</span>
              </button>
            </div>
          )}

          {/* Add / Edit Form Card */}
          {isFormOpen && (
            <form
              onSubmit={handleSaveForm}
              className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                <h3 className="text-sm font-semibold text-white">
                  {editingBill ? t('recurringBills.editBill') : t('recurringBills.newBill')}
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selector: Despesa Fixa vs. Receita / Salário */}
              <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`cursor-pointer py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    billType === 'expense'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{t('recurringBills.typeExpense')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`cursor-pointer py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    billType === 'income'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>{t('recurringBills.typeIncome')}</span>
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {billType === 'income' ? t('recurringBills.nameIncome') : t('recurringBills.name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    billType === 'income'
                      ? t('recurringBills.nameIncomePlaceholder')
                      : t('recurringBills.namePlaceholder')
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
                  required
                />
              </div>

              {/* Amount & Currency Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t('recurringBills.expectedAmount')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t('recurringBills.currency')}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
                  >
                    <option value="PYG">PYG (₲ Guaraní)</option>
                    <option value="USD">USD ($ Dólar)</option>
                    <option value="BRL">BRL (R$ Real)</option>
                  </select>
                </div>
              </div>

              {/* Category & Debit Account Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t('recurringBills.category')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {billType === 'income' ? t('recurringBills.creditAccount') : t('recurringBills.debitAccount')}
                  </label>
                  <select
                    value={walletId}
                    onChange={handleWalletChange}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
                    required
                  >
                    {selectableWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.currency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Day & Start Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {(billType === 'income' ? t('recurringBills.receiptDay') : t('recurringBills.dueDay'))} (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    placeholder={t('recurringBills.dueDayPlaceholder')}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t('recurringBills.startDate')}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 h-[38px] px-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-900"
                  />
                  <span className="text-xs font-medium text-slate-300">
                    {isActive ? t('recurringBills.active') : t('recurringBills.paused')}
                  </span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors"
                >
                  {t('transactions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-all"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? t('recurringBills.saving') : t('recurringBills.save')}</span>
                </button>
              </div>
            </form>
          )}

          {/* Bills List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
            </div>
          ) : bills.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-800/80 rounded-2xl">
              <CalendarClock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">{t('recurringBills.empty')}</p>
              {!isFormOpen && (
                <button
                  type="button"
                  onClick={handleOpenCreateForm}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('recurringBills.newBill')}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => {
                const debitWallet = wallets.find((w) => w.id === bill.wallet_id)
                const isConfirmingDelete = deletingId === bill.id

                return (
                  <div
                    key={bill.id}
                    className={`group bg-slate-950/40 hover:bg-slate-950/70 border ${
                      bill.is_active ? 'border-slate-800/80' : 'border-slate-800/40 opacity-60'
                    } rounded-xl p-3.5 transition-all flex items-center justify-between gap-3`}
                  >
                    {/* Left: Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm truncate">
                          {bill.name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            bill.type === 'income'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          }`}
                        >
                          {bill.type === 'income' ? (
                            <>
                              <ArrowDownLeft className="w-2.5 h-2.5" />
                              <span>{t('recurringBills.typeIncome')}</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-2.5 h-2.5" />
                              <span>{t('recurringBills.typeExpense')}</span>
                            </>
                          )}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            bill.is_active
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {bill.is_active
                            ? t('recurringBills.active')
                            : t('recurringBills.paused')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-slate-500" />
                          {bill.category}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-slate-500" />
                          {debitWallet?.name || 'Conta'}
                        </span>
                        <span>•</span>
                        <span className="text-indigo-400 font-medium">
                          {bill.type === 'income' ? t('recurringBills.receiptOn') : t('recurringBills.dueOn')} {bill.due_day}
                        </span>
                        {bill.start_date && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">
                              {t('recurringBills.billingStart')}: {bill.start_date.substring(0, 7)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-sm font-bold tracking-tight block font-mono ${
                            bill.type === 'income' ? 'text-emerald-400' : 'text-white'
                          }`}
                        >
                          {bill.type === 'income' ? '+' : ''}{formatCurrency(bill.amount, bill.currency)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(bill)}
                          title={bill.is_active ? t('recurringBills.paused') : t('recurringBills.active')}
                          className={`p-1.5 rounded-lg transition-colors ${
                            bill.is_active
                              ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                              : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(bill)}
                          title={t('recurringBills.editBill')}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(bill.id)}
                              disabled={isDeleting}
                              className="text-[10px] font-bold text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded transition-colors"
                            >
                              {isDeleting ? '...' : t('transactions.confirm')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="text-slate-400 hover:text-white p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingId(bill.id)}
                            title="Excluir"
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
