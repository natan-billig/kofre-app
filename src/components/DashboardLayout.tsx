import React, { useSyncExternalStore } from 'react'

interface DashboardLayoutProps {
  // Coluna 1 (Fluxo Operacional Diário)
  currencyDashboard: React.ReactNode
  transactionList: React.ReactNode

  // Coluna 2 (Orçamento e Análise Mensal)
  monthSelector: React.ReactNode
  monthlySummary: React.ReactNode
  categoryBreakdown: React.ReactNode
  monthlyBills: React.ReactNode

  // Coluna 3 (Património, Reservas e Compromissos)
  accountList: React.ReactNode
  savingsGoals: React.ReactNode
  debtsWidget: React.ReactNode
}

function subscribeMediaQuery(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const media = window.matchMedia('(min-width: 1280px)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getDesktopSnapshot() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 1280px)').matches
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currencyDashboard,
  transactionList,
  monthSelector,
  monthlySummary,
  categoryBreakdown,
  monthlyBills,
  accountList,
  savingsGoals,
  debtsWidget,
}) => {
  const isDesktopXl = useSyncExternalStore(
    subscribeMediaQuery,
    getDesktopSnapshot,
    () => true
  )

  if (isDesktopXl) {
    // Ecrãs Largos (xl: e 2xl: >= 1280px): Grelha Balanceada em 3 Colunas
    return (
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Coluna 1 (Fluxo Operacional Diário): 4 colunas em 2xl, 4 colunas em xl */}
        <div className="col-span-12 xl:col-span-4 2xl:col-span-4 space-y-6">
          {currencyDashboard}
          {transactionList}
        </div>

        {/* Coluna 2 (Orçamento e Análise Mensal): 4 colunas */}
        <div className="col-span-12 xl:col-span-4 2xl:col-span-4 space-y-6">
          {monthSelector}
          {monthlySummary}
          {categoryBreakdown}
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

  // Ecrãs Intermédios (md: e lg: 2 colunas fluidas) e Telemóvel (sm: 1 coluna linear)
  return (
    <div className="space-y-6">
      {/* Topo: Saldos e Faturas */}
      {currencyDashboard}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Principal: Análise e Extrato */}
        <div className="lg:col-span-7 xl:col-span-8 order-2 lg:order-1 space-y-4">
          {monthSelector}
          {monthlySummary}
          {categoryBreakdown}
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
