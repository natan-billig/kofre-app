import React from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useTranslation } from '../lib/i18n/LanguageContext'

interface MonthSelectorProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedDate,
  onSelectDate,
}) => {
  const { t, language } = useTranslation()

  const today = new Date()
  const isCurrentMonth =
    selectedDate.getFullYear() === today.getFullYear() &&
    selectedDate.getMonth() === today.getMonth()

  const handlePrevMonth = () => {
    onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))
  }

  const handleCurrentMonth = () => {
    onSelectDate(new Date())
  }

  // Format month and year capitalized according to locale
  const locale = language === 'es' ? 'es-PY' : 'pt-BR'
  const rawMonthYear = selectedDate.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })
  const formattedMonthYear = rawMonthYear.charAt(0).toUpperCase() + rawMonthYear.slice(1)

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 flex items-center justify-between shadow-sm transition-colors">
      {/* Botão Anterior */}
      <button
        type="button"
        onClick={handlePrevMonth}
        className="cursor-pointer p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80 transition-all flex items-center justify-center"
        title={t('monthSelector.previousMonth')}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Mês e Ano Centralizados */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight select-none">
          {formattedMonthYear}
        </span>
      </div>

      {/* Ações da Direita: Botão Próximo e Atalho Mês Atual */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={handleCurrentMonth}
            className="cursor-pointer text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-600/15 hover:bg-indigo-100 dark:hover:bg-indigo-600/25 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 transition-all"
            title={t('monthSelector.currentMonth')}
          >
            {t('monthSelector.currentMonth')}
          </button>
        )}

        <button
          type="button"
          onClick={handleNextMonth}
          className="cursor-pointer p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80 transition-all flex items-center justify-center"
          title={t('monthSelector.nextMonth')}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
