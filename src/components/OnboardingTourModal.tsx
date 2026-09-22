import React, { useState } from 'react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { useModalScrollLock } from '../hooks/useModalScrollLock'
import {
  Users2,
  Wallet2,
  CreditCard,
  PieChart,
  Search,
  PiggyBank,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Sparkles,
  CalendarRange,
  FileSpreadsheet,
  ArrowRightLeft,
  Coins,
  ShieldAlert,
} from 'lucide-react'

interface OnboardingTourModalProps {
  isOpen: boolean
  onClose: () => void
  onCompleted?: () => void
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onCompleted,
}) => {
  const { t, language } = useTranslation()
  const [step, setStep] = useState(0)

  useModalScrollLock(isOpen)

  if (!isOpen) return null

  const steps = [
    {
      id: 'scope',
      icon: Users2,
      badge: t('onboarding.steps.scope.badge'),
      title: t('onboarding.steps.scope.title'),
      description: t('onboarding.steps.scope.description'),
      visual: (
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center gap-3">
          <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 shadow-sm text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{t('onboarding.steps.scope.tagPersonal')}</span>
          </div>
          <span className="text-slate-400 font-bold text-sm">⇄</span>
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 shadow-sm text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Users2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{t('onboarding.steps.scope.tagShared')}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'liquidity',
      icon: Wallet2,
      badge: t('onboarding.steps.liquidity.badge'),
      title: t('onboarding.steps.liquidity.title'),
      description: t('onboarding.steps.liquidity.description'),
      visual: (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
              <Coins className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{t('onboarding.steps.liquidity.liquidCash')}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'es' ? 'Disponibilidad real' : 'Disponibilidade real'}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{t('onboarding.steps.liquidity.overdraftLimit')}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'es' ? 'Límite no inflado' : 'Limite não inflado'}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'cards',
      icon: CreditCard,
      badge: t('onboarding.steps.cards.badge'),
      title: t('onboarding.steps.cards.title'),
      description: t('onboarding.steps.cards.description'),
      visual: (
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-around gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-semibold flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            <span>{t('onboarding.steps.cards.installments')}</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>{t('onboarding.steps.cards.cashback')}</span>
          </span>
        </div>
      ),
    },
    {
      id: 'budgets',
      icon: PieChart,
      badge: t('onboarding.steps.budgets.badge'),
      title: t('onboarding.steps.budgets.title'),
      description: t('onboarding.steps.budgets.description'),
      visual: (
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <PieChart className="w-4 h-4 text-indigo-500" />
              <span>{t('onboarding.steps.budgets.withinBudget')}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold font-mono">
              65%
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full w-[65%]" />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center font-medium">
            {t('onboarding.steps.budgets.interactiveDrilldown')}
          </div>
        </div>
      ),
    },
    {
      id: 'statement',
      icon: Search,
      badge: t('onboarding.steps.statement.badge'),
      title: t('onboarding.steps.statement.title'),
      description: t('onboarding.steps.statement.description'),
      visual: (
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-around gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <CalendarRange className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{t('onboarding.steps.statement.dateRange')}</span>
          </span>
          <span className="text-slate-300 dark:text-slate-700 font-bold">&bull;</span>
          <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{t('onboarding.steps.statement.instantSearch')}</span>
          </span>
        </div>
      ),
    },
    {
      id: 'savingsAndDebts',
      icon: PiggyBank,
      badge: t('onboarding.steps.savingsAndDebts.badge'),
      title: t('onboarding.steps.savingsAndDebts.title'),
      description: t('onboarding.steps.savingsAndDebts.description'),
      visual: (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
              <PiggyBank className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{t('onboarding.steps.savingsAndDebts.savingsGoal')}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'es' ? 'Cofre aislado' : 'Cofre isolado'}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
              <ArrowRightLeft className="w-4 h-4 text-blue-500 shrink-0" />
              <span>{t('onboarding.steps.savingsAndDebts.bilateralDebts')}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'es' ? 'Ajuste bilateral' : 'Estorno bilateral'}
            </div>
          </div>
        </div>
      ),
    },
  ]

  const currentStep = steps[step]
  const isLastStep = step === steps.length - 1
  const progressPercent = ((step + 1) / steps.length) * 100

  const stepIndicatorText = t('onboarding.stepIndicator')
    .replace('{current}', (step + 1).toString())
    .replace('{total}', steps.length.toString())

  const handleFinish = () => {
    try {
      localStorage.setItem('kofre_onboarding_completed', 'true')
    } catch {
      // Ignora falhas de quota
    }
    onCompleted?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
        {/* Top Progress Bar & Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {stepIndicatorText}
            </span>
            <button
              type="button"
              onClick={handleFinish}
              className="cursor-pointer font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-0.5 rounded-lg transition-colors"
            >
              {t('onboarding.skip')}
            </button>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 dark:bg-indigo-400 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step Badge */}
        <div className="flex justify-center">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            {currentStep.badge}
          </span>
        </div>

        {/* Step Icon & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-sm mx-auto">
            {React.createElement(currentStep.icon, { className: 'w-7 h-7' })}
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {currentStep.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed px-2">
            {currentStep.description}
          </p>
        </div>

        {/* Visual Graphic */}
        <div>{currentStep.visual}</div>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {steps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStep(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === step
                  ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                  : 'w-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
              title={`Etapa ${idx + 1}`}
            />
          ))}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              step === 0
                ? 'opacity-0 pointer-events-none'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('onboarding.previous')}</span>
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={handleFinish}
              className="cursor-pointer flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('onboarding.completeGuide')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="cursor-pointer flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
            >
              <span>{t('onboarding.next')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
