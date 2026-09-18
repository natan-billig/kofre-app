/**
 * Utilitários de Data e Ciclos Orçamentais
 */

export interface BudgetPeriod {
  startDate: Date
  endDate: Date
  startDateStr: string // YYYY-MM-DD
  endDateStr: string   // YYYY-MM-DD
  label: string        // ex: "Outubro" ou "Outubro (05/10 - 04/11)"
  monthName: string    // ex: "Outubro"
  isCustomCycle: boolean
}

function padZero(num: number): string {
  return String(num).padStart(2, '0')
}

export function formatDateToISO(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`
}

/**
 * Calcula o período orçamental ativo para um determinado mês de referência (selectedDate)
 * e o dia de início configurado no perfil (budgetStartDay: 1 a 28).
 */
export function getBudgetPeriod(
  selectedDate: Date,
  budgetStartDay: number = 1,
  locale: string = 'pt-BR'
): BudgetPeriod {
  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth()

  // Nome do mês localizado
  const rawMonth = selectedDate.toLocaleDateString(locale, {
    month: 'long',
  })
  const monthName = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)
  const fullYear = selectedDate.getFullYear()

  // Se o dia de início for 1 ou inválido, usa o mês civil padrão
  if (!budgetStartDay || budgetStartDay <= 1) {
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0) // Último dia do mês

    return {
      startDate,
      endDate,
      startDateStr: formatDateToISO(startDate),
      endDateStr: formatDateToISO(endDate),
      label: `${monthName} de ${fullYear}`,
      monthName,
      isCustomCycle: false,
    }
  }

  // Ciclo flexível: do dia X deste mês até o dia (X - 1) do mês seguinte
  const validStartDay = Math.min(Math.max(budgetStartDay, 1), 28)
  const startDate = new Date(year, month, validStartDay)
  const endDate = new Date(year, month + 1, validStartDay - 1)

  const startDayFormatted = `${padZero(startDate.getDate())}/${padZero(startDate.getMonth() + 1)}`
  const endDayFormatted = `${padZero(endDate.getDate())}/${padZero(endDate.getMonth() + 1)}`

  return {
    startDate,
    endDate,
    startDateStr: formatDateToISO(startDate),
    endDateStr: formatDateToISO(endDate),
    label: `${monthName} (${startDayFormatted} - ${endDayFormatted})`,
    monthName,
    isCustomCycle: true,
  }
}

/**
 * Verifica se uma data YYYY-MM-DD está dentro do período orçamental especificado.
 */
export function isDateInBudgetPeriod(dateStr: string, period: BudgetPeriod): boolean {
  if (!dateStr) return false
  const cleanDate = dateStr.substring(0, 10)
  return cleanDate >= period.startDateStr && cleanDate <= period.endDateStr
}
