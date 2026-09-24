import React, { useState, useMemo } from 'react'
import type { Wallet, Transaction } from '../lib/types'
import { getCreditCardInvoiceDetails, payCreditCardInvoice } from '../lib/creditCardService'
import { calculateAccountBalance } from '../lib/accountingService'
import { convertAmount } from '../lib/exchangeRateService'
import { formatCurrency, formatMaskedInput, sanitizeNumericInput } from '../lib/formatters'
import { hasMathExpression, evaluateMathExpression } from '../lib/mathParser'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { useModalScrollLock } from '../hooks/useModalScrollLock'
import {
  X,
  CreditCard,
  Landmark,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Calculator,
  Loader2,
  Banknote,
  RotateCw,
} from 'lucide-react'

interface PayInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  cardWallet: Wallet | null
  invoiceAmount?: number
  wallets: Wallet[]
  transactions: Transaction[]
  onSuccess: () => Promise<void> | void
}

export const PayInvoiceModal: React.FC<PayInvoiceModalProps> = ({
  isOpen,
  onClose,
  cardWallet,
  invoiceAmount,
  wallets,
  transactions,
  onSuccess,
}) => {
  const { t, language } = useTranslation()
  useModalScrollLock(isOpen)

  // 1. Detalhes da fatura e ciclo do cartão
  const cardDetails = useMemo(() => {
    if (!cardWallet) return null
    return getCreditCardInvoiceDetails(cardWallet, transactions)
  }, [cardWallet, transactions])

  // Valor alvo da fatura a liquidar
  const targetInvoiceAmount = useMemo(() => {
    if (invoiceAmount != null && invoiceAmount > 0) return invoiceAmount
    if (cardDetails && cardDetails.currentInvoiceAmount > 0) return cardDetails.currentInvoiceAmount
    if (cardDetails && cardDetails.totalDebt > 0) return cardDetails.totalDebt
    return 0
  }, [invoiceAmount, cardDetails])

  // 2. Contas de liquidação disponíveis (Efetivo e Contas Correntes ativas)
  const liquidWallets = useMemo(() => {
    return wallets.filter(
      (w) =>
        !w.is_archived &&
        (w.account_type === 'checking' || w.account_type === 'cash') &&
        (!cardWallet || w.type === cardWallet.type)
    )
  }, [wallets, cardWallet])

  // Buscar melhor conta de liquidação padrão (mesma moeda com saldo suficiente, ou primeira conta corrente)
  const defaultSourceWallet = useMemo(() => {
    if (!cardWallet) return null
    return (
      liquidWallets.find((w) => {
        const bal = calculateAccountBalance(w, transactions)
        return w.currency === cardWallet.currency && bal >= targetInvoiceAmount
      }) ||
      liquidWallets.find((w) => w.currency === cardWallet.currency) ||
      liquidWallets[0] ||
      null
    )
  }, [cardWallet, liquidWallets, transactions, targetInvoiceAmount])

  // Estados do formulário
  const [sourceWalletId, setSourceWalletId] = useState<string>(() => defaultSourceWallet?.id || '')
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial'>('full')
  const [amount, setAmount] = useState<string>(() =>
    cardWallet ? formatMaskedInput(targetInvoiceAmount, cardWallet.currency) : ''
  )
  const [paymentDate, setPaymentDate] = useState<string>(() =>
    new Date().toISOString().substring(0, 10)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const effectiveSourceWalletId = sourceWalletId || defaultSourceWallet?.id || ''

  const selectedSourceWallet = useMemo(() => {
    return liquidWallets.find((w) => w.id === effectiveSourceWalletId) || null
  }, [liquidWallets, effectiveSourceWalletId])

  // Resolução da calculadora e expressão matemática
  const mathPreview = useMemo(() => {
    if (!cardWallet) return null
    if (hasMathExpression(amount)) {
      const evaluated = evaluateMathExpression(amount)
      return evaluated !== null && !isNaN(evaluated) ? evaluated : null
    }
    return null
  }, [amount, cardWallet])

  const resolveAmountMath = () => {
    if (!cardWallet) return
    if (mathPreview !== null) {
      setAmount(formatMaskedInput(mathPreview, cardWallet.currency))
    } else if (amount.trim()) {
      setAmount(formatMaskedInput(amount, cardWallet.currency))
    }
  }

  // Alternar modo de pagamento
  const handleSetMode = (mode: 'full' | 'partial') => {
    if (!cardWallet) return
    setPaymentMode(mode)
    if (mode === 'full') {
      setAmount(formatMaskedInput(targetInvoiceAmount, cardWallet.currency))
    }
  }

  // Cálculos contábeis da liquidação
  const numPaymentAmount = useMemo(() => {
    if (!cardWallet) return 0
    return mathPreview !== null
      ? mathPreview
      : sanitizeNumericInput(amount, cardWallet.currency)
  }, [mathPreview, amount, cardWallet])

  const isPartialPayment = paymentMode === 'partial' && numPaymentAmount < targetInvoiceAmount
  const remainingRollover = Math.max(0, targetInvoiceAmount - numPaymentAmount)

  // Conversão de valor para a moeda da conta de liquidação
  const sourceDebitAmount = useMemo(() => {
    if (!selectedSourceWallet || !cardWallet) return numPaymentAmount
    if (selectedSourceWallet.currency === cardWallet.currency) return numPaymentAmount
    return convertAmount(numPaymentAmount, cardWallet.currency, selectedSourceWallet.currency)
  }, [selectedSourceWallet, cardWallet, numPaymentAmount])

  // Saldo da conta de liquidação antes e depois
  const sourceCurrentBalance = useMemo(() => {
    if (!selectedSourceWallet) return 0
    return calculateAccountBalance(selectedSourceWallet, transactions)
  }, [selectedSourceWallet, transactions])

  const sourceProjectedBalance = sourceCurrentBalance - sourceDebitAmount
  const hasInsufficientSourceBalance = sourceProjectedBalance < 0

  // Restauração de limite do cartão
  const currentTotalDebt = cardDetails?.totalDebt || 0
  const projectedTotalDebt = Math.max(0, currentTotalDebt - numPaymentAmount)
  const creditLimit = cardWallet?.credit_limit != null ? Number(cardWallet.credit_limit) : null
  const projectedAvailableLimit = creditLimit !== null ? Math.max(0, creditLimit - projectedTotalDebt) : null

  // Submissão do pagamento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    resolveAmountMath()

    if (!cardWallet) return

    if (!selectedSourceWallet) {
      setErrorMsg(
        language === 'es'
          ? 'Seleccione una cuenta de liquidación para el pago.'
          : 'Selecione uma conta de liquidação para o pagamento.'
      )
      return
    }

    if (numPaymentAmount <= 0) {
      setErrorMsg(
        language === 'es'
          ? 'Ingrese un monto de pago válido mayor a cero.'
          : 'Informe um valor de pagamento válido maior que zero.'
      )
      return
    }

    setIsSubmitting(true)
    try {
      await payCreditCardInvoice({
        userId: cardWallet.owner_id,
        cardWallet,
        sourceWallet: selectedSourceWallet,
        amount: numPaymentAmount,
        sourceAmount: sourceDebitAmount,
        paymentDate,
        isPartial: isPartialPayment,
      })

      await onSuccess()
      onClose()
    } catch (err) {
      console.error('Error settling credit card invoice:', err)
      setErrorMsg(
        language === 'es'
          ? 'Error al procesar la liquidación del extracto. Intente nuevamente.'
          : 'Erro ao processar a liquidação da fatura. Tente novamente.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !cardWallet) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {language === 'es' ? 'Pagar Extracto de Tarjeta' : 'Pagar Fatura do Cartão'}
              </h2>
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-300">
                {cardWallet.name} • {cardWallet.currency}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Resumo do Ciclo Atual da Fatura */}
          <div className="p-3.5 rounded-2xl bg-purple-500/10 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                {language === 'es' ? 'Total del Extracto Actual' : 'Total da Fatura Atual'}
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-200/60 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200">
                {cardWallet.currency}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold font-mono text-purple-900 dark:text-purple-100">
                {formatCurrency(targetInvoiceAmount, cardWallet.currency)}
              </span>
              <div className="text-right text-[11px] text-purple-700/80 dark:text-purple-300/80 font-medium">
                {cardDetails?.closingDay && (
                  <div>
                    {t('creditCard.closesDay') || (language === 'es' ? 'Cierra el' : 'Fecha dia')}{' '}
                    <strong>{cardDetails.closingDay}</strong>
                  </div>
                )}
                {cardDetails?.dueDay && (
                  <div>
                    {t('creditCard.dueOnDay') || (language === 'es' ? 'Vence el' : 'Vence dia')}{' '}
                    <strong>{cardDetails.dueDay}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seleção do Modo: Pagamento Total vs Pagamento Parcial */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              {language === 'es' ? 'Modalidad de Pago' : 'Modalidade de Pagamento'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSetMode('full')}
                className={`cursor-pointer px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  paymentMode === 'full'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{language === 'es' ? 'Pago Total' : 'Pagamento Total'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetMode('partial')}
                className={`cursor-pointer px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  paymentMode === 'partial'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{language === 'es' ? 'Pago Parcial (Rotativo)' : 'Pagamento Parcial (Rotativo)'}</span>
              </button>
            </div>
          </div>

          {/* Campo de Valor com Calculadora e Máscara */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {language === 'es' ? 'Monto a Pagar' : 'Valor a Pagar'} ({cardWallet.currency})
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Calculator className="w-3 h-3" />
                <span>{language === 'es' ? 'Calculadora activa' : 'Calculadora ativa'}</span>
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  if (paymentMode === 'full') setPaymentMode('partial')
                }}
                onBlur={resolveAmountMath}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') resolveAmountMath()
                }}
                placeholder="0"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all pr-12"
              />
              <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 uppercase font-mono">
                {cardWallet.currency}
              </span>
            </div>
            {mathPreview !== null && (
              <p className="text-xs text-purple-600 dark:text-purple-400 font-mono font-semibold">
                = {formatCurrency(mathPreview, cardWallet.currency)}
              </p>
            )}
          </div>

          {/* Seleção da Conta de Liquidação (Origem) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              {language === 'es' ? 'Cuenta de Liquidación (Origen)' : 'Conta de Liquidação (Origem)'}
            </label>
            {liquidWallets.length === 0 ? (
              <p className="text-xs text-rose-500">
                {language === 'es'
                  ? 'No hay cuentas bancarias ni efectivo disponibles.'
                  : 'Nenhuma conta bancária ou dinheiro em espécie disponível.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {liquidWallets.map((w) => {
                  const bal = calculateAccountBalance(w, transactions)
                  const isSelected = w.id === sourceWalletId
                  const Icon = w.account_type === 'checking' ? Landmark : Banknote

                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSourceWalletId(w.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                            {w.name}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">
                            {w.currency} • {w.account_type === 'checking' ? t('accounts.checking') : t('accounts.cash')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-mono font-bold ${
                            bal < 0 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {formatCurrency(bal, w.currency)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {selectedSourceWallet && selectedSourceWallet.currency !== cardWallet.currency && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                {language === 'es' ? 'Débito convertido en la cuenta origen:' : 'Débito convertido na conta de origem:'}{' '}
                <strong className="font-mono">{formatCurrency(sourceDebitAmount, selectedSourceWallet.currency)}</strong>
              </p>
            )}
            {hasInsufficientSourceBalance && (
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {language === 'es'
                    ? 'Atención: El saldo en la cuenta origen quedará negativo o utilizará sobregiro.'
                    : 'Atenção: O saldo na conta de origem ficará negativo ou utilizará o cheque especial.'}
                </span>
              </div>
            )}
          </div>

          {/* Simulação em Tempo Real do Pagamento e Restauração de Limite */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {language === 'es' ? 'Conciliación y Restauración de Saldo' : 'Conciliação e Restauração de Saldo'}
            </span>

            <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
              {/* Rolagem de Saldo em Pagamento Parcial */}
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">
                  {language === 'es' ? 'Saldo Rotativo (Prox. Extracto)' : 'Saldo Rotativo (Próx. Fatura)'}
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatCurrency(remainingRollover, cardWallet.currency)}
                </span>
                {remainingRollover > 0 && (
                  <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                    {language === 'es' ? 'Pasa al ciclo siguiente' : 'Transfere p/ próximo ciclo'}
                  </span>
                )}
              </div>

              {/* Limite Restaurado */}
              {creditLimit !== null && (
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">
                    {language === 'es' ? 'Nuevo Límite Disponible' : 'Novo Limite Disponível'}
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(projectedAvailableLimit || 0, cardWallet.currency)}
                  </span>
                  <span className="block text-[9px] text-slate-400 mt-0.5">
                    +{formatCurrency(numPaymentAmount, cardWallet.currency)} {language === 'es' ? 'liberado' : 'liberado'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Data do Pagamento */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === 'es' ? 'Fecha de Liquidación' : 'Data da Liquidação'}</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
            />
          </div>

          {/* Nota de Integridade Contábil Estrita */}
          <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 flex items-start gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <p>
              {language === 'es'
                ? 'El pago se registra como una transferencia contable de la cuenta origen al tarjeta. Esto preserva las categorías de compras y evita la duplicación de gastos.'
                : 'O pagamento é registrado como uma transferência contábil da conta de origem para o cartão. Isso preserva as categorias das compras e evita a dupla contagem de despesas.'}
            </p>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="cursor-pointer px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {language === 'es' ? 'Cancelar' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || numPaymentAmount <= 0 || !selectedSourceWallet}
              className="cursor-pointer px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'es' ? 'Procesando...' : 'Processando...'}</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>{language === 'es' ? 'Confirmar Pago de Extracto' : 'Confirmar Pagamento de Fatura'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
