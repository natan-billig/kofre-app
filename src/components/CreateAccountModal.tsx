import React, { useState } from 'react'
import type { AccountType, CurrencyCode, WalletScope } from '../lib/types'
import { createWallet } from '../lib/walletService'
import { getOrCreateMyFamilyId } from '../lib/familyService'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { X, Loader2, Building2, Banknote, CreditCard, Users2, User } from 'lucide-react'

interface CreateAccountModalProps {
  userId: string
  isOpen: boolean
  onClose: () => void
  onAccountCreated: () => void
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  userId,
  isOpen,
  onClose,
  onAccountCreated,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('checking')
  const [currency, setCurrency] = useState<CurrencyCode>('PYG')
  const [scope, setScope] = useState<WalletScope>('personal')
  const [creditLimit, setCreditLimit] = useState<string>('')
  const [closingDay, setClosingDay] = useState<string>('')
  const [dueDay, setDueDay] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!name.trim()) {
      setErrorMsg(t('createAccount.fillName'))
      return
    }

    setLoading(true)

    try {
      let familyId: string | null = null
      if (scope === 'shared') {
        familyId = await getOrCreateMyFamilyId()
      }

      await createWallet({
        owner_id: userId,
        name: name.trim(),
        type: scope,
        account_type: accountType,
        currency,
        family_id: familyId,
        credit_limit: accountType === 'credit_card' && creditLimit ? Number(creditLimit) : null,
        closing_day: accountType === 'credit_card' && closingDay ? parseInt(closingDay, 10) : null,
        due_day: accountType === 'credit_card' && dueDay ? parseInt(dueDay, 10) : null,
      })

      setName('')
      setCreditLimit('')
      setClosingDay('')
      setDueDay('')
      onAccountCreated()
      onClose()
    } catch (err: unknown) {
      console.error('Error creating account:', err)
      const errObj = err as Record<string, unknown> | null
      const msg =
        (typeof errObj?.message === 'string' && errObj.message) ||
        (typeof errObj?.error_description === 'string' && errObj.error_description) ||
        (typeof errObj?.details === 'string' && errObj.details) ||
        (err instanceof Error ? err.message : 'Erro ao criar conta.')
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t('createAccount.title')}</h2>
              <p className="text-xs text-slate-400">{t('createAccount.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Conta */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('createAccount.accountType')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('cash')}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  accountType === 'cash'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>{t('createAccount.cash')}</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountType('checking')}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  accountType === 'checking'
                    ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>{t('createAccount.checking')}</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountType('credit_card')}
                className={`py-2 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  accountType === 'credit_card'
                    ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>{t('createAccount.creditCard')}</span>
              </button>
            </div>
          </div>

          {/* Nome da Conta */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('createAccount.name')}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('createAccount.namePlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 text-sm outline-none transition-all"
            />
          </div>

          {/* Moeda Base */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('createAccount.currency')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['PYG', 'USD', 'BRL'] as CurrencyCode[]).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setCurrency(curr)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    currency === curr
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300 shadow-sm'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          {/* Escopo (Pessoal vs Compartilhado) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t('createAccount.scope')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('personal')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  scope === 'personal'
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{t('createAccount.personal')}</span>
              </button>
              <button
                type="button"
                onClick={() => setScope('shared')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  scope === 'shared'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Users2 className="w-3.5 h-3.5" />
                <span>{t('createAccount.shared')}</span>
              </button>
            </div>
          </div>

          {/* Campos Específicos para Cartão de Crédito */}
          {accountType === 'credit_card' && (
            <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                  {t('createAccount.creditLimit')} ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="Ex: 5000000"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-purple-500 text-slate-100 text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">
                    {t('createAccount.closingDay')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-purple-500 text-slate-100 text-sm outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">
                    {t('createAccount.dueDay')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    placeholder="Ex: 28"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-purple-500 text-slate-100 text-sm outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer transition-all active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>{t('createAccount.create')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
