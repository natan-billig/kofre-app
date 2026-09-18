import React, { useState } from 'react'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  Users2,
  Wallet2,
  PlusCircle,
  Search,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  PiggyBank,
  Layers,
  Sparkles,
  PieChart,
  CalendarRange,
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
  const { language } = useTranslation()
  const [step, setStep] = useState(0)

  if (!isOpen) return null

  const steps = [
    {
      id: 'scope',
      icon: Users2,
      badge: language === 'es' ? 'Paso 1 de 4: Escopo' : 'Etapa 1 de 4: Escopo',
      title: {
        pt: 'Escopo Binário: Pessoal vs. Caixa da Família',
        es: 'Alcance Binario: Personal vs. Caja de la Familia',
      },
      description: {
        pt: 'Alterne no topo entre "Minhas Contas" (suas finanças estritamente pessoais) e "Caixa da Família" (gastos e saldos compartilhados em tempo real). Cada conta possui seu escopo isolado.',
        es: 'Alterna arriba entre "Mis Cuentas" (finanzas estrictamente personales) y "Caja de la Familia" (gastos y saldos compartidos en tiempo real). Cada cuenta tiene su alcance aislado.',
      },
      visual: (
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 shadow-sm text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>{language === 'es' ? 'Mis Cuentas' : 'Minhas Contas'}</span>
          </div>
          <span className="text-slate-400 font-bold">⇄</span>
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 shadow-sm text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <Users2 className="w-4 h-4 text-emerald-500" />
            <span>{language === 'es' ? 'Caja de la Familia' : 'Caixa da Família'}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'accounts',
      icon: Wallet2,
      badge: language === 'es' ? 'Paso 2 de 4: Cuentas' : 'Etapa 2 de 4: Contas',
      title: {
        pt: 'Carteiras, Cartões e Cofres de Metas',
        es: 'Cuentas, Tarjetas y Cofres de Metas',
      },
      description: {
        pt: 'Cadastre contas bancárias com sobregiro, faturas de cartão com ciclo de fechamento, e contas poupança para metas que não inflam sua liquidez diária disponível.',
        es: 'Registra cuentas bancarias con sobregiro, extractos de tarjeta con ciclo de cierre y cuentas de ahorro con metas que no inflan tu liquidez diaria disponible.',
      },
      visual: (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {language === 'es' ? 'Tarjetas' : 'Cartões'}
              </div>
              <div className="text-[10px] text-slate-400">
                {language === 'es' ? 'Fatura e Limite' : 'Fatura e Limite'}
              </div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {language === 'es' ? 'Ahorro / Metas' : 'Poupança / Metas'}
              </div>
              <div className="text-[10px] text-slate-400">
                {language === 'es' ? 'Cofre Isolado' : 'Cofre Isolado'}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'quickTx',
      icon: PlusCircle,
      badge: language === 'es' ? 'Paso 3 de 4: Operaciones' : 'Etapa 3 de 4: Lançamentos',
      title: {
        pt: 'Lançamento Rápido, Cuotas e Reintegros',
        es: 'Registro Rápido, Cuotas y Reintegros',
      },
      description: {
        pt: 'Toque no botão flutuante (+) para registrar entradas, saídas ou transferências. Suporta compras parceladas em até 48x no cartão, promoções com reintegro (cashback) e gastos bimoeda.',
        es: 'Toca el botón flotante (+) para registrar ingresos, gastos o transferencias. Soporta compras en cuotas hasta 48x en tarjeta, reintegros promocionales y gastos bimoneda.',
      },
      visual: (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-around gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-semibold flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            <span>{language === 'es' ? 'Cuotas 1x-48x' : 'Parcelas 1x-48x'}</span>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'es' ? 'Reintegros' : 'Reintegros'}</span>
          </span>
        </div>
      ),
    },
    {
      id: 'analysis',
      icon: Search,
      badge: language === 'es' ? 'Paso 4 de 4: Análisis' : 'Etapa 4 de 4: Análise',
      title: {
        pt: 'Extrato, Filtros e Teto de Gastos',
        es: 'Extracto, Filtros y Presupuesto',
      },
      description: {
        pt: 'Acompanhe o consumo do teto mensal por categoria, filtre despesas com busca textual ou períodos customizados, e exporte seu extrato formatado para Excel/CSV.',
        es: 'Monitorea el tope mensual por categoría, filtra gastos con búsqueda de texto o períodos personalizados, y exporta tu extracto a Excel/CSV.',
      },
      visual: (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
            <PieChart className="w-4 h-4 text-indigo-500" />
            <span>{language === 'es' ? 'Topes por Categoría' : 'Teto por Categoria'}</span>
          </span>
          <span className="text-slate-300 dark:text-slate-700">&bull;</span>
          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
            <CalendarRange className="w-4 h-4 text-indigo-500" />
            <span>{language === 'es' ? 'Filtro por Fechas' : 'Filtro por Datas'}</span>
          </span>
        </div>
      ),
    },
  ]

  const currentStep = steps[step]
  const isLastStep = step === steps.length - 1

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              {currentStep.badge}
            </span>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1 rounded-lg transition-colors"
          >
            {language === 'es' ? 'Saltar' : 'Pular'}
          </button>
        </div>

        {/* Step Icon & Title */}
        <div className="text-center space-y-2 pt-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-sm mx-auto">
            {React.createElement(currentStep.icon, { className: 'w-7 h-7' })}
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {currentStep.title[language] || currentStep.title.pt}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed px-1">
            {currentStep.description[language] || currentStep.description.pt}
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
            <span>{language === 'es' ? 'Anterior' : 'Anterior'}</span>
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={handleFinish}
              className="cursor-pointer flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{language === 'es' ? '¡Comenzar a Usar!' : 'Começar a Usar!'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="cursor-pointer flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
            >
              <span>{language === 'es' ? 'Siguiente' : 'Próximo'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
