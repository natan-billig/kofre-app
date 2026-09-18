import React, { useState, useEffect, useMemo } from 'react'
import type { CurrencyCode, DebtType, FamilyMemberItem, Wallet, WalletScope } from '../lib/types'
import { createDebt } from '../lib/debtService'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { supabase } from '../lib/supabase'
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
  CreditCard,
  CheckSquare,
  Square,
} from 'lucide-react'

interface CreateDebtModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  familyId?: string | null
  initialScope?: WalletScope
  wallets?: Wallet[]
  onDebtCreated: () => void
}

export function CreateDebtModal({
  isOpen,
  onClose,
  userId,
  familyId,
  initialScope = 'personal',
  wallets = [],
  onDebtCreated,
}: CreateDebtModalProps) {
  const { t } = useTranslation()

  const [type, setType] = useState<DebtType>('i_owe')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('PYG')
  const [scope, setScope] = useState<WalletScope>('personal')
  const [description, setDescription] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [selectedWalletId, setSelectedWalletId] = useState<string>('')
  const [moveWalletBalance, setMoveWalletBalance] = useState(false)

  // Contacts state
  const [selectedContactKey, setSelectedContactKey] = useState<string>('other')
  const [externalName, setExternalName] = useState('')
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberItem[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filter available wallets by current currency and scope
  const matchingWallets = useMemo(() => {
    return wallets.filter((w) => w.currency === currency)
  }, [wallets, currency])

  // Derive effective wallet id directly during render
  const effectiveWalletId = useMemo(() => {
    if (selectedWalletId && matchingWallets.some((w) => w.id === selectedWalletId)) {
      return selectedWalletId
    }
    return matchingWallets[0]?.id || ''
  }, [selectedWalletId, matchingWallets])

  // Reset and load members on open
  useEffect(() => {
    let isMounted = true
    if (isOpen) {
      queueMicrotask(() => {
        if (!isMounted) return
        setType('i_owe')
        setAmount('')
        setDescription('')
        setIssueDate(new Date().toISOString().split('T')[0])
        setDueDate('')
        setExternalName('')
        setMoveWalletBalance(false)
        setErrorMessage(null)
        setScope(initialScope === 'shared' && familyId ? 'shared' : 'personal')
        setLoadingMembers(true)
      })

      const loadMembers = async () => {
        try {
          // 1. Obter a(s) família(s) do usuário ativo
          let targetFamilyIds: string[] = []
          if (familyId) {
            targetFamilyIds = [familyId]
          } else {
            const { data: myMemberships } = await supabase
              .from('family_members')
              .select('family_id')
              .eq('user_id', userId)

            targetFamilyIds = (myMemberships?.map((m) => m.family_id).filter(Boolean) || []) as string[]
          }

          // 2. Se houver família, buscar os outros integrantes com os dados de perfil
          let membersList: FamilyMemberItem[] = []

          if (targetFamilyIds.length > 0) {
            const { data: members, error } = await supabase
              .from('family_members')
              .select('user_id, role, profiles:user_id(full_name, avatar)')
              .in('family_id', targetFamilyIds)
              .neq('user_id', userId)

            if (!error && members) {
              const seen = new Set<string>()
              membersList = members
                .filter((m: any) => {
                  if (seen.has(m.user_id)) return false
                  seen.add(m.user_id)
                  return true
                })
                .map((m: any) => ({
                  user_id: m.user_id,
                  full_name: m.profiles?.full_name || 'Membro da Família',
                  role: m.role || 'member',
                  is_current_user: false,
                }))
            }
          }

          if (!isMounted) return

          setFamilyMembers(membersList)
          if (membersList.length > 0) {
            setSelectedContactKey(`member_${membersList[0].user_id}`)
          } else {
            setSelectedContactKey('other')
          }
        } catch (err) {
          console.error('Erro ao buscar membros da família:', err)
          if (isMounted) setSelectedContactKey('other')
        } finally {
          if (isMounted) setLoadingMembers(false)
        }
      }

      loadMembers()
    }
    return () => {
      isMounted = false
    }
  }, [isOpen, familyId, initialScope, userId])

  if (!isOpen) return null

  const isOtherContact = selectedContactKey === 'other'

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

    if (isOtherContact) {
      const cleanName = externalName.trim()
      if (!cleanName) {
        setErrorMessage(t('debts.fillContactName'))
        return
      }
      contactName = cleanName
      targetUserId = null
    } else {
      const memberId = selectedContactKey.replace('member_', '')
      const member = familyMembers.find((m) => m.user_id === memberId)
      if (!member) {
        setErrorMessage(t('debts.selectContact'))
        return
      }
      contactName = member.full_name || t('debts.familyMember')
      targetUserId = member.user_id
    }

    if (moveWalletBalance && !effectiveWalletId) {
      setErrorMessage(t('debts.selectWallet'))
      return
    }

    setIsSubmitting(true)
    try {
      await createDebt(
        {
          user_id: userId,
          family_id: scope === 'shared' ? familyId || null : null,
          scope,
          type,
          contact_name: contactName,
          target_user_id: targetUserId,
          amount: parsedAmount,
          currency,
          wallet_id: moveWalletBalance ? effectiveWalletId || null : null,
          description: description.trim() || undefined,
          issue_date: issueDate || new Date().toISOString().split('T')[0],
          due_date: dueDate || null,
          status: 'pending',
        },
        moveWalletBalance
      )

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

          {/* Seletor de Contato Híbrido (Campo Único) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
              {t('debts.contact')}
            </label>

            <div className="relative">
              <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedContactKey}
                onChange={(e) => {
                  setSelectedContactKey(e.target.value)
                  setErrorMessage(null)
                }}
                disabled={loadingMembers}
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors cursor-pointer"
              >
                {familyMembers.length > 0 && (
                  <optgroup label={t('debts.familyMembersGroup')}>
                    {familyMembers.map((member) => (
                      <option key={member.user_id} value={`member_${member.user_id}`}>
                        {member.full_name || t('debts.familyMember')}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="other">
                  {t('debts.otherExternalOption')}
                </option>
              </select>
            </div>

            {/* Quando seleciona 'Outro', exibe input para digitar livremente */}
            {isOtherContact && (
              <div className="relative mt-2 animate-in fade-in duration-150">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  placeholder={t('debts.contactNamePlaceholder')}
                  className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                  required={isOtherContact}
                  autoFocus={isOtherContact && familyMembers.length > 0}
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
                  className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors font-mono"
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
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors cursor-pointer"
              >
                <option value="PYG">PYG (₲ Guaraní)</option>
                <option value="USD">USD ($ Dólar)</option>
                <option value="BRL">BRL (R$ Real)</option>
              </select>
            </div>
          </div>

          {/* Checkbox: Movimentar Saldo da Conta Agora */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <button
              type="button"
              onClick={() => setMoveWalletBalance(!moveWalletBalance)}
              className="w-full flex items-center justify-between text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                {moveWalletBalance ? (
                  <CheckSquare className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400 shrink-0" />
                ) : (
                  <Square className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                )}
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {t('debts.moveBalanceNow')}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {type === 'i_owe'
                      ? t('debts.receiveInAccount')
                      : t('debts.debitFromAccount')}
                  </span>
                </div>
              </div>
            </button>

            {moveWalletBalance && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5 animate-in fade-in duration-150">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-violet-500" />
                  <span>
                    {type === 'i_owe'
                      ? t('debts.destinationWallet')
                      : t('debts.originWallet')}
                  </span>
                </label>

                {matchingWallets.length > 0 ? (
                  <select
                    value={effectiveWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    {matchingWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.currency})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                    {t('debts.noWalletAvailable')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
              {t('transactions.description')} (Opcional)
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

          {/* Dates Grid: Issue Date & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                {t('debts.issueDate')}
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors"
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
