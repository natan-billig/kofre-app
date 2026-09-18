import React, { useState, useEffect } from 'react'
import type { CurrencyCode, DebtType, FamilyMemberItem, WalletScope } from '../lib/types'
import { createDebt } from '../lib/debtService'
import { fetchFamilyMembers } from '../lib/familyService'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  X,
  Loader2,
  HandCoins,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Calendar,
  DollarSign,
  FileText,
  AlertCircle,
} from 'lucide-react'

interface CreateDebtModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  familyId?: string | null
  initialScope?: WalletScope
  onDebtCreated: () => void
}

export const CreateDebtModal: React.FC<CreateDebtModalProps> = ({
  isOpen,
  onClose,
  userId,
  familyId,
  initialScope = 'personal',
  onDebtCreated,
}) => {
  const { t } = useTranslation()

  const [type, setType] = useState<DebtType>('i_owe')
  const [contactMode, setContactMode] = useState<'family' | 'external'>('family')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [externalName, setExternalName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('PYG')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [scope, setScope] = useState<'personal' | 'shared'>(
    initialScope === 'shared' && familyId ? 'shared' : 'personal'
  )

  const [familyMembers, setFamilyMembers] = useState<FamilyMemberItem[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset and load members on open
  useEffect(() => {
    let isMounted = true
    if (isOpen) {
      queueMicrotask(() => {
        if (!isMounted) return
        setType('i_owe')
        setAmount('')
        setDescription('')
        setDueDate('')
        setExternalName('')
        setErrorMessage(null)
        setScope(initialScope === 'shared' && familyId ? 'shared' : 'personal')
        if (familyId) {
          setLoadingMembers(true)
        } else {
          setContactMode('external')
        }
      })

      if (familyId) {
        fetchFamilyMembers()
          .then((members) => {
            if (!isMounted) return
            // Filter other members (different from current user)
            const otherMembers = members.filter((m) => m.user_id !== userId)
            setFamilyMembers(otherMembers)
            if (otherMembers.length > 0) {
              setSelectedMemberId(otherMembers[0].user_id)
              setContactMode('family')
            } else {
              setContactMode('external')
            }
          })
          .catch((err) => {
            console.error('Erro ao buscar membros da família:', err)
            if (isMounted) setContactMode('external')
          })
          .finally(() => {
            if (isMounted) setLoadingMembers(false)
          })
      }
    }
    return () => {
      isMounted = false
    }
  }, [isOpen, familyId, initialScope, userId])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage(t('recurringBills.fillRequired'))
      return
    }

    let contactName = ''
    let targetUserId: string | null = null

    if (contactMode === 'family') {
      const member = familyMembers.find((m) => m.user_id === selectedMemberId)
      if (!member) {
        setErrorMessage(t('debts.selectContact'))
        return
      }
      contactName = member.full_name || t('familyModal.memberBadge')
      targetUserId = member.user_id
    } else {
      const cleanName = externalName.trim()
      if (!cleanName) {
        setErrorMessage(t('debts.fillContactName'))
        return
      }
      contactName = cleanName
      targetUserId = null
    }

    setIsSubmitting(true)
    try {
      await createDebt({
        user_id: userId,
        family_id: scope === 'shared' ? familyId || null : null,
        scope,
        type,
        contact_name: contactName,
        target_user_id: targetUserId,
        amount: parsedAmount,
        currency,
        description: description.trim() || undefined,
        due_date: dueDate || null,
        status: 'pending',
      })

      onDebtCreated()
      onClose()
    } catch (err: unknown) {
      console.error('Erro ao cadastrar dívida:', err)
      const errorObj = err as { message?: string }
      setErrorMessage(errorObj.message || t('auth.authError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {t('debts.newDebt')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('debts.title')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Direction Selector: "Eu Devo" vs "Me Devem" */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
              {t('debts.typeLabel')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('i_owe')}
                className={`cursor-pointer flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  type === 'i_owe'
                    ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/50 dark:text-amber-400 shadow-sm shadow-amber-950/30'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-950/40 dark:border-slate-800/80 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800/40'
                }`}
              >
                <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{t('debts.iOwe')}</span>
              </button>

              <button
                type="button"
                onClick={() => setType('they_owe')}
                className={`cursor-pointer flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  type === 'they_owe'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/50 dark:text-emerald-400 shadow-sm shadow-emerald-950/30'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-950/40 dark:border-slate-800/80 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800/40'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('debts.theyOwe')}</span>
              </button>
            </div>
          </div>

          {/* Contact / Person */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                {t('debts.contact')}
              </label>
              {familyId && familyMembers.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setContactMode('family')}
                    className={`cursor-pointer px-2 py-0.5 rounded-md transition-colors ${
                      contactMode === 'family'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {t('debts.familyMember')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMode('external')}
                    className={`cursor-pointer px-2 py-0.5 rounded-md transition-colors ${
                      contactMode === 'external'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {t('debts.otherExternal')}
                  </button>
                </div>
              )}
            </div>

            {contactMode === 'family' && familyId && familyMembers.length > 0 ? (
              <div className="relative">
                <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  disabled={loadingMembers}
                  className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors cursor-pointer"
                >
                  {familyMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.full_name || t('familyModal.memberBadge')}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  placeholder={t('debts.contactNamePlaceholder')}
                  className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors"
                  required
                />
              </div>
            )}
          </div>

          {/* Amount and Currency Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                {t('recurringBills.expectedAmount')}
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                {t('recurringBills.currency')}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors cursor-pointer"
              >
                <option value="PYG">PYG (₲ Guaraní)</option>
                <option value="USD">USD ($ Dólar)</option>
                <option value="BRL">BRL (R$ Real)</option>
              </select>
            </div>
          </div>

          {/* Description & Due Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                {t('transactions.title')} (Opcional)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('debts.descriptionPlaceholder')}
                  className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                {t('debts.dueDate')} (Opcional)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Scope selection if user belongs to family */}
          {familyId && (
            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                {t('recurringBills.scope')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('personal')}
                  className={`cursor-pointer py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    scope === 'personal'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-slate-800 dark:border-indigo-500/40 dark:text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-950/40 dark:border-slate-800/80 dark:text-slate-400 dark:hover:text-slate-300'
                  }`}
                >
                  {t('scope.personal')}
                </button>
                <button
                  type="button"
                  onClick={() => setScope('shared')}
                  className={`cursor-pointer py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    scope === 'shared'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-slate-800 dark:border-indigo-500/40 dark:text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-950/40 dark:border-slate-800/80 dark:text-slate-400 dark:hover:text-slate-300'
                  }`}
                >
                  {t('scope.shared')}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors"
            >
              {t('transactions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-violet-950/40 transition-all"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? t('recurringBills.saving') : t('debts.saveDebt')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
