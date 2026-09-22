import React, { useState, useMemo } from 'react'
import type {
  Wallet,
  Transaction,
  RecurringBill,
  DebtItem,
  ScopeFilterType,
  CurrencyCode,
  Profile,
} from '../lib/types'
import { calculateFinancialHealth } from '../lib/financialHealthService'
import { formatCurrency } from '../lib/formatters'
import { getActiveCurrencies } from '../lib/accountingService'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  CreditCard,
  CalendarCheck,
  HandCoins,
  TrendingUp,
  Settings,
  Sparkles,
} from 'lucide-react'

interface FinancialHealthWidgetProps {
  wallets: Wallet[]
  transactions: Transaction[]
  recurringBills: RecurringBill[]
  debts: DebtItem[]
  currentScope?: ScopeFilterType
  preferredCurrency?: CurrencyCode
  userProfile?: Profile | null
  onOpenProfile?: () => void
}

export const FinancialHealthWidget: React.FC<FinancialHealthWidgetProps> = ({
  wallets,
  transactions,
  recurringBills,
  debts,
  currentScope = 'personal',
  preferredCurrency = 'PYG',
  userProfile,
  onOpenProfile,
}) => {
  const { t } = useTranslation()

  // Moedas disponíveis para visualização:
  // Só incluir BRL se houver dados ativos em BRL
  const hasBrlData = useMemo(() => {
    if (preferredCurrency === 'BRL') return true
    if (userProfile?.preferred_currency === 'BRL' && (userProfile?.base_monthly_income ?? 0) > 0) return true
    if (wallets.some((w) => !w.is_archived && w.currency === 'BRL')) return true
    if (recurringBills.some((b) => b.is_active && b.currency === 'BRL')) return true
    if (debts.some((d) => d.status === 'pending' && d.currency === 'BRL')) return true
    return transactions.some((t) => {
      const w = wallets.find((sw) => sw.id === t.wallet_id)
      return (t.original_currency || w?.currency) === 'BRL'
    })
  }, [preferredCurrency, userProfile, wallets, recurringBills, debts, transactions])

  const activeCurrencies = useMemo(() => {
    const list = getActiveCurrencies(wallets, preferredCurrency)
    if (hasBrlData && !list.includes('BRL')) {
      list.push('BRL')
    }
    if (!hasBrlData) {
      return list.filter((c) => c !== 'BRL')
    }
    return list
  }, [wallets, preferredCurrency, hasBrlData])

  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(preferredCurrency)

  if (currentScope !== 'personal') {
    return null
  }

  const currencyToUse = activeCurrencies.includes(selectedCurrency)
    ? selectedCurrency
    : preferredCurrency

  const metrics = calculateFinancialHealth({
    wallets,
    transactions,
    recurringBills,
    debts,
    currentScope,
    preferredCurrency,
    userProfile,
    targetCurrency: currencyToUse,
  })

  // Cores semafóricas
  const statusConfig = {
    healthy: {
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800/50',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      progressBg: 'bg-emerald-500',
      icon: ShieldCheck,
      label: t('dti.statusHealthy') || 'Saudável',
      desc: t('dti.descHealthy') || 'Margem livre para poupar ou novos projetos',
    },
    moderate: {
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800/50',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      progressBg: 'bg-amber-500',
      icon: AlertTriangle,
      label: t('dti.statusModerate') || 'Atenção / Moderado',
      desc: t('dti.descModerate') || 'Atenção ao limite de novas compras parceladas',
    },
    critical: {
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800/50',
      badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      progressBg: 'bg-rose-500',
      icon: ShieldAlert,
      label: t('dti.statusCritical') || 'Crítico',
      desc: t('dti.descCritical') || 'Risco de sobreendividamento. Travar novos gastos fixos',
    },
  }[metrics.status]

  const StatusIcon = statusConfig.icon
  const clampedProgress = Math.min(100, Math.max(0, metrics.dtiPercentage))

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm transition-colors">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {t('dti.title') || 'Termômetro DTI (% Endividamento)'}
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {currentScope === 'personal'
                ? t('dti.personalSubtitle') || 'Minhas Contas Pessoais'
                : t('dti.sharedSubtitle') || 'Caixa da Família Consolidado'}
            </span>
          </div>
        </div>

        {/* Currency Switcher */}
        {activeCurrencies.length > 1 && (
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-bold">
            {activeCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCurrency(c)}
                className={`cursor-pointer px-2 py-0.5 rounded-md transition-all ${
                  currencyToUse === c
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DTI Gauge and Progress */}
      <div className={`p-4 rounded-2xl border ${statusConfig.bg} ${statusConfig.border} space-y-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-2xl sm:text-3xl font-black tracking-tight ${statusConfig.color}`}>
                {metrics.dtiPercentage}%
              </span>
              <span
                className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusConfig.badgeBg}`}
              >
                <StatusIcon className="w-3 h-3" />
                <span>{statusConfig.label}</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {statusConfig.desc}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
              {t('dti.safeMargin') || 'Margem Livre Segura'}
            </span>
            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {formatCurrency(metrics.safeMargin, metrics.currency)}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1">
          <div className="w-full h-2.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${statusConfig.progressBg} transition-all duration-500 rounded-full`}
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-medium px-0.5">
            <span>0%</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">30% (Ideal)</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">50% (Limite)</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        {/* Receita Base */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase">{t('dti.baseIncome') || 'Receita Base'}</span>
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
            {formatCurrency(metrics.baseIncome, metrics.currency)}
          </span>
        </div>

        {/* Faturas de Cartão */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <CreditCard className="w-3 h-3 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase">{t('dti.cards') || 'Faturas'}</span>
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
            {formatCurrency(metrics.cardInvoicesAmount, metrics.currency)}
          </span>
        </div>

        {/* Contas Fixas */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <CalendarCheck className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-bold uppercase">{t('dti.fixedBills') || 'Fixas'}</span>
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
            {formatCurrency(metrics.recurringBillsAmount, metrics.currency)}
          </span>
        </div>

        {/* Dívidas a Pagar */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <HandCoins className="w-3 h-3 text-rose-500" />
            <span className="text-[10px] font-bold uppercase">{t('dti.debts') || 'Dívidas'}</span>
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
            {formatCurrency(metrics.debtsToPayAmount, metrics.currency)}
          </span>
        </div>
      </div>

      {/* Renda não configurada prompt */}
      {!metrics.isIncomeConfigured && onOpenProfile && (
        <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-tight truncate">
              {t('dti.noIncomePrompt') || 'Defina sua renda mensal base no perfil para diagnóstico exato.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenProfile}
            className="cursor-pointer shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />
            <span>{t('profile.editTitle') || 'Configurar'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
