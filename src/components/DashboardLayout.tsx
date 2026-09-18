import React, { useState, useSyncExternalStore } from 'react'
import { useTranslation } from '../lib/i18n/LanguageContext'

interface DashboardLayoutProps {
  // Coluna 1 (Fluxo Operacional Diário)
  currencyDashboard: React.ReactNode
  transactionList: React.ReactNode

  // Coluna 2 (Orçamento e Análise Mensal)
  monthSelector: React.ReactNode
  financialHealth?: React.ReactNode
  monthlySummary: React.ReactNode
  categoryBreakdown: React.ReactNode
  dueDatesCalendar?: React.ReactNode
  monthlyBills: React.ReactNode

  // Coluna 3 (Património, Reservas e Compromissos)
  accountList: React.ReactNode
  savingsGoals: React.ReactNode
  debtsWidget: React.ReactNode

  // Controle de Abas Móveis
  activeMobileTab?: 'wallet' | 'planning' | 'statement'
  onMobileTabChange?: (tab: 'wallet' | 'planning' | 'statement') => void
}

function subscribeXlQuery(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const media = window.matchMedia('(min-width: 1280px)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getDesktopXlSnapshot() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 1280px)').matches
}

function subscribeMdQuery(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const media = window.matchMedia('(min-width: 768px)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getDesktopMdSnapshot() {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(min-width: 768px)').matches
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currencyDashboard,
  transactionList,
  monthSelector,
  financialHealth,
  monthlySummary,
  categoryBreakdown,
  dueDatesCalendar,
  monthlyBills,
  accountList,
  savingsGoals,
  debtsWidget,
  activeMobileTab,
  onMobileTabChange,
}) => {
  const { language } = useTranslation()
  const [internalMobileTab, setInternalMobileTab] = useState<'wallet' | 'planning' | 'statement'>('wallet')
  const mobileTab = activeMobileTab ?? internalMobileTab
  const setMobileTab = onMobileTabChange ?? setInternalMobileTab

  const isDesktop = useSyncExternalStore(
    subscribeMdQuery,
    getDesktopMdSnapshot,
    () => true
  )

  const isDesktopXl = useSyncExternalStore(
    subscribeXlQuery,
    getDesktopXlSnapshot,
    () => true
  )

  // Telemóvel (< md: < 768px): Feed em 3 Abas Segmentadas
  if (!isDesktop) {
    return (
      <div className="w-full max-w-full overflow-x-clip space-y-4">
        {/* Seletor de 3 Abas Móveis */}
        <div className="flex items-center justify-between p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setMobileTab('wallet')}
            className={`cursor-pointer flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
              mobileTab === 'wallet'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>💳</span>
            <span>{language === 'es' ? 'Billetera' : 'Carteira'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('planning')}
            className={`cursor-pointer flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
              mobileTab === 'planning'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>📊</span>
            <span>{language === 'es' ? 'Plan' : 'Planeamento'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('statement')}
            className={`cursor-pointer flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all ${
              mobileTab === 'statement'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>📋</span>
            <span>{language === 'es' ? 'Extracto' : 'Extrato'}</span>
          </button>
        </div>

        {/* Aba 1: Carteira (Saldos, Faturas, Contas e Metas) */}
        {mobileTab === 'wallet' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {currencyDashboard}
            {accountList}
            {savingsGoals}
          </div>
        )}

        {/* Aba 2: Planeamento (Mês, DTI, Resumo, Orçamento, Vencimentos, Fixas e Dívidas) */}
        {mobileTab === 'planning' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {monthSelector}
            {financialHealth}
            {monthlySummary}
            {categoryBreakdown}
            {dueDatesCalendar}
            {monthlyBills}
            {debtsWidget}
          </div>
        )}

        {/* Aba 3: Extrato (Histórico, Busca e Filtros) */}
        {mobileTab === 'statement' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {transactionList}
          </div>
        )}
      </div>
    )
  }

  // Ecrãs Largos (xl: e 2xl: >= 1280px): Grelha Balanceada em 3 Colunas
  if (isDesktopXl) {
    return (
      <div className="w-full max-w-full overflow-x-clip grid grid-cols-12 gap-6 items-start">
        {/* Coluna 1 (Fluxo Operacional Diário): 4 colunas em 2xl, 4 colunas em xl */}
        <div className="col-span-12 xl:col-span-4 2xl:col-span-4 space-y-6">
          {currencyDashboard}
          {transactionList}
        </div>

        {/* Coluna 2 (Orçamento e Análise Mensal): 4 colunas */}
        <div className="col-span-12 xl:col-span-4 2xl:col-span-4 space-y-6">
          {monthSelector}
          {financialHealth}
          {monthlySummary}
          {categoryBreakdown}
          {dueDatesCalendar}
          {monthlyBills}
        </div>

        {/* Coluna 3 (Património, Reservas e Compromissos): 4 colunas */}
        <div className="col-span-12 xl:col-span-4 2xl:col-span-4 space-y-6">
          {accountList}
          {savingsGoals}
          {debtsWidget}
        </div>
      </div>
    )
  }

  // Ecrãs Intermédios (md: e lg: 768px a 1279px, 2 colunas fluidas)
  return (
    <div className="w-full max-w-full overflow-x-clip space-y-6">
      {/* Topo: Saldos e Faturas */}
      {currencyDashboard}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Principal: Análise e Extrato */}
        <div className="lg:col-span-7 xl:col-span-8 order-2 lg:order-1 space-y-4">
          {monthSelector}
          {financialHealth}
          {monthlySummary}
          {categoryBreakdown}
          {dueDatesCalendar}
          {transactionList}
        </div>

        {/* Coluna Lateral: Contas Fixas, Dívidas, Metas e Contas */}
        <div className="lg:col-span-5 xl:col-span-4 order-1 lg:order-2 space-y-6">
          {monthlyBills}
          {debtsWidget}
          {savingsGoals}
          {accountList}
        </div>
      </div>
    </div>
  )
}
