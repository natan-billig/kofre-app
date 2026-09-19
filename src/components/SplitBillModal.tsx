import React, { useState, useMemo } from 'react'
import type { CurrencyCode, Profile } from '../lib/types'
import { formatCurrency } from '../lib/formatters'
import { hasMathExpression, evaluateMathExpression } from '../lib/mathParser'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  X,
  Users,
  Percent,
  Share2,
  Copy,
  Check,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react'

interface SplitBillModalProps {
  isOpen: boolean
  onClose: () => void
  userProfile?: Profile | null
  preferredCurrency?: CurrencyCode
  onRecordMyShare?: (params: {
    amount: number
    currency: CurrencyCode
    description: string
    category: string
  }) => void
}

export const SplitBillModal: React.FC<SplitBillModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  preferredCurrency = 'PYG',
  onRecordMyShare,
}) => {
  const { t, language } = useTranslation()

  const [billTitle, setBillTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>(preferredCurrency)
  const [tipPercent, setTipPercent] = useState<number>(10)
  const [peopleCount, setPeopleCount] = useState<number>(3)
  const [copied, setCopied] = useState(false)

  // Dados bancários locais ou do perfil
  const pixKey = userProfile?.pix_key || ''
  const aliasPy = userProfile?.alias_py || ''
  const bankDetails = userProfile?.bank_details || ''

  // Avaliação matemática no input do total
  const evaluatedBaseAmount = useMemo(() => {
    if (!amountStr) return 0
    if (hasMathExpression(amountStr)) {
      const res = evaluateMathExpression(amountStr)
      return res != null && res > 0 ? res : 0
    }
    return parseFloat(amountStr) || 0
  }, [amountStr])

  // Cálculos de divisão
  const { totalWithTip, amountPerPerson } = useMemo(() => {
    const base = evaluatedBaseAmount
    const tip = (base * tipPercent) / 100
    const total = base + tip
    const perPerson = peopleCount > 0 ? total / peopleCount : total
    return {
      tipAmount: tip,
      totalWithTip: total,
      amountPerPerson: currency === 'PYG' ? Math.round(perPerson) : parseFloat(perPerson.toFixed(2)),
    }
  }, [evaluatedBaseAmount, tipPercent, peopleCount, currency])

  // Gerador de mensagem formatada para WhatsApp
  const generatedWhatsAppMessage = useMemo(() => {
    const formattedTotal = formatCurrency(totalWithTip, currency)
    const formattedPerPerson = formatCurrency(amountPerPerson, currency)
    const isEs = language === 'es'

    const tipNotice =
      tipPercent > 0
        ? isEs
          ? ` (+${tipPercent}% propina)`
          : ` (+${tipPercent}% serviço)`
        : ''

    const defaultTitle = isEs ? 'Almuerzo / Cena' : 'Almoço / Jantar'
    const resolvedTitle = billTitle.trim() || defaultTitle

    const header = isEs
      ? `🍕 *División de Cuenta / Vaca - ${resolvedTitle}*\n`
      : `🍕 *Divisão de Conta / Racha - ${resolvedTitle}*\n`

    const peopleUnit = isEs ? 'personas' : 'pessoas'
    const totalLine = `💰 Total: ${formattedTotal}${tipNotice} (${peopleCount} ${peopleUnit})\n`

    const eachPaysText = isEs ? 'Cada uno paga' : 'Cada um paga'
    const eachPaysLine = `👉 *${eachPaysText}: ${formattedPerPerson}*\n\n`

    let text = header + totalLine + eachPaysLine

    // Regra contextual de priorização por moeda
    const isBrl = currency === 'BRL'
    const isPyOrUsd = currency === 'PYG' || currency === 'USD'

    const hasBankDetails = Boolean(aliasPy || pixKey || bankDetails)

    if (hasBankDetails) {
      if (isBrl) {
        if (pixKey) {
          text += isEs
            ? `📲 *Datos para pago (Brasil):*\nClave PIX: ${pixKey}\n`
            : `📲 *Dados para pagamento (Brasil):*\nChave PIX: ${pixKey}\n`
          if (aliasPy) {
            text += isEs
              ? `(O vía Alias SIPAP Paraguay: ${aliasPy})\n`
              : `(Ou via Alias SIPAP Paraguay: ${aliasPy})\n`
          }
        } else if (aliasPy) {
          text += isEs
            ? `📲 *Datos para transferencia (Paraguay):*\nAlias SIPAP: ${aliasPy}\n`
            : `📲 *Dados para transferência (Paraguay):*\nAlias SIPAP: ${aliasPy}\n`
        }
      } else if (isPyOrUsd) {
        if (aliasPy) {
          text += isEs
            ? `📲 *Datos para transferencia (Paraguay):*\nAlias SIPAP: ${aliasPy}\n`
            : `📲 *Dados para transferência (Paraguay):*\nAlias SIPAP: ${aliasPy}\n`
          if (pixKey) {
            text += isEs
              ? `(O vía PIX si prefieres: ${pixKey})\n`
              : `(Ou via PIX caso prefira: ${pixKey})\n`
          }
        } else if (pixKey) {
          text += isEs
            ? `📲 *Datos para pago (PIX):*\nClave PIX: ${pixKey}\n`
            : `📲 *Dados para pagamento (PIX):*\nChave PIX: ${pixKey}\n`
        }
      } else {
        text += isEs
          ? `📲 *Datos para transferencia (Paraguay):*\n`
          : `📲 *Dados para transferência (Paraguay):*\n`
        if (aliasPy) text += `Alias SIPAP: ${aliasPy}\n`
        if (pixKey) text += isEs ? `Clave PIX: ${pixKey}\n` : `Chave PIX: ${pixKey}\n`
      }

      if (bankDetails) {
        text += isEs ? `Otros datos: ${bankDetails}\n` : `Outros dados: ${bankDetails}\n`
      }
      text += '\n'
    }

    const calculatedInText = isEs ? 'Calculado en Kofre' : 'Calculado no Kofre'
    text += `🛡️ _${calculatedInText}_`
    return text
  }, [
    billTitle,
    totalWithTip,
    amountPerPerson,
    currency,
    tipPercent,
    peopleCount,
    pixKey,
    aliasPy,
    bankDetails,
    language,
  ])

  if (!isOpen) return null

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(generatedWhatsAppMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Ignora erro de clipboard
    }
  }

  const handleOpenWhatsApp = async () => {
    // 1. Mobile nativo via navigator.share se suportado
    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

    if (isMobile && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          text: generatedWhatsAppMessage,
        })
        return
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return
      }
    }

    // 2. Desktop / Fallback: encodeURIComponent em todo o corpo da mensagem
    const encoded = encodeURIComponent(generatedWhatsAppMessage)
    const url = isMobile
      ? `https://wa.me/?text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleRecordShare = () => {
    if (!onRecordMyShare || amountPerPerson <= 0) return
    onRecordMyShare({
      amount: amountPerPerson,
      currency,
      description: `${billTitle || (language === 'es' ? 'Vaca' : 'Racha de Conta')} (${language === 'es' ? 'mi parte de' : 'minha parte de'} ${peopleCount} ${language === 'es' ? 'personas' : 'pessoas'})`,
      category: 'Alimentação',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {t('splitBill.title') || 'Divisão Rápida de Despesas (Racha)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('splitBill.subtitle') || 'Cálculo por pessoa e partilha instantânea no WhatsApp'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Título / Descrição */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('splitBill.billTitle') || 'Identificação da Conta'}
            </label>
            <input
              type="text"
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              placeholder={t('splitBill.billTitlePlaceholder') || 'Almoço / Jantar'}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-xs sm:text-sm font-semibold outline-none focus:border-indigo-500"
            />
          </div>

          {/* Valor Total e Moeda */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('splitBill.totalAmount') || 'Valor Total'}
              </label>
              <input
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="Ex: 240000 ou 150 + 45"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 font-mono font-bold text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('splitBill.currency') || 'Moeda'}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="PYG">PYG (₲)</option>
                <option value="USD">USD ($)</option>
                <option value="BRL">BRL (R$)</option>
              </select>
            </div>
          </div>

          {/* Gorjeta / Taxa de Serviço e Participantes */}
          <div className="grid grid-cols-2 gap-3">
            {/* Taxa de Serviço */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Percent className="w-3 h-3 text-amber-500" />
                <span>{t('splitBill.tip') || 'Serviço / Gorjeta'}</span>
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[0, 10, 15].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTipPercent(p)}
                    className={`cursor-pointer py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      tipPercent === p
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* Contador de Pessoas */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Users className="w-3 h-3 text-indigo-500" />
                <span>{t('splitBill.people') || 'Participantes'}</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPeopleCount((prev) => Math.max(2, prev - 1))}
                  className="cursor-pointer w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-bold"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 text-center font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {peopleCount}{' '}
                  {(t('splitBill.people') && !t('splitBill.people').includes('.')
                    ? t('splitBill.people')
                    : language === 'es'
                    ? 'personas'
                    : 'pessoas'
                  ).toLowerCase()}
                </div>
                <button
                  type="button"
                  onClick={() => setPeopleCount((prev) => prev + 1)}
                  className="cursor-pointer w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Resultado: Card Individual */}
          {evaluatedBaseAmount > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-amber-500/5 to-transparent border border-indigo-200 dark:border-indigo-800/60 space-y-2 text-center">
              <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">
                {t('splitBill.eachPersonPays') && !t('splitBill.eachPersonPays').includes('.')
                  ? t('splitBill.eachPersonPays')
                  : language === 'es'
                  ? 'Cada uno paga'
                  : 'Cada um paga'}:
              </span>
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight font-mono">
                {formatCurrency(amountPerPerson, currency)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                <span>
                  {t('splitBill.totalWithService') && !t('splitBill.totalWithService').includes('.')
                    ? `${t('splitBill.totalWithService')}:`
                    : language === 'es'
                    ? 'Total con propina/servicio:'
                    : 'Total com serviço:'}{' '}
                  {formatCurrency(totalWithTip, currency)}
                </span>
                <span>•</span>
                <span>{peopleCount} partes</span>
              </div>
            </div>
          )}

          {/* Dados de Transferência Detectados */}
          {(aliasPy || pixKey) && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                {t('splitBill.linkedDetailsTitle') && !t('splitBill.linkedDetailsTitle').includes('.')
                  ? t('splitBill.linkedDetailsTitle')
                  : language === 'es'
                  ? 'DATOS VINCULADOS PARA RECEPCIÓN:'
                  : 'DADOS VINCULADOS PARA RECEBIMENTO:'}
              </span>
              <div className="space-y-0.5 text-slate-700 dark:text-slate-300">
                {currency === 'BRL' ? (
                  <>
                    {pixKey && (
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        PIX: {pixKey}
                      </p>
                    )}
                    {aliasPy && <p className="text-[11px] text-slate-400">Alias PY: {aliasPy}</p>}
                  </>
                ) : (
                  <>
                    {aliasPy && (
                      <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Alias SIPAP: {aliasPy}
                      </p>
                    )}
                    {pixKey && <p className="text-[11px] text-slate-400">PIX: {pixKey}</p>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/40">
          {onRecordMyShare && evaluatedBaseAmount > 0 && (
            <button
              type="button"
              onClick={handleRecordShare}
              className="cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('splitBill.recordMyShare') || 'Lançar Minha Parte'}</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={evaluatedBaseAmount <= 0}
              onClick={handleCopyMessage}
              className="cursor-pointer px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>
                {copied
                  ? language === 'es'
                    ? '¡Copiado!'
                    : 'Copiado!'
                  : language === 'es'
                  ? 'Copiar'
                  : 'Copiar'}
              </span>
            </button>

            <button
              type="button"
              disabled={evaluatedBaseAmount <= 0}
              onClick={handleOpenWhatsApp}
              className="cursor-pointer px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-1.5 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
