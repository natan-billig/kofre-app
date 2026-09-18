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
  const { t } = useTranslation()

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
    const tipNotice = tipPercent > 0 ? ` (+${tipPercent}% serviço)` : ''

    const resolvedTitle = billTitle.trim() || t('splitBill.billTitlePlaceholder') || 'Almoço / Jantar'
    let text = `🍕 *${t('splitBill.title') || 'Divisão de Conta'} - ${resolvedTitle}*\n`
    text += `Total: ${formattedTotal}${tipNotice} (${peopleCount} ${(t('splitBill.people') || 'pessoas').toLowerCase()})\n`
    text += `👉 *${t('splitBill.eachPays') || 'Cada um paga'}:* ${formattedPerPerson}\n\n`

    // Regra contextual de priorização por moeda
    const isBrl = currency === 'BRL'
    const isPyOrUsd = currency === 'PYG' || currency === 'USD'

    if (isBrl) {
      if (pixKey) {
        text += `📲 *Dados para pagamento (Brasil):*\n`
        text += `Chave PIX: ${pixKey}\n`
        if (aliasPy) {
          text += `(Ou via Alias SIPAP Paraguai: ${aliasPy})\n`
        }
      } else if (aliasPy) {
        text += `📲 *Dados para transferência:*\nAlias SIPAP: ${aliasPy}\n`
      }
    } else if (isPyOrUsd) {
      if (aliasPy) {
        text += `📲 *Dados para transferência (Paraguai):*\n`
        text += `Alias SIPAP: ${aliasPy}\n`
        if (pixKey) {
          text += `(Ou via PIX caso prefira: ${pixKey})\n`
        }
      } else if (pixKey) {
        text += `📲 *Dados para pagamento (PIX):*\nChave PIX: ${pixKey}\n`
      }
    } else {
      if (aliasPy) text += `Alias SIPAP: ${aliasPy}\n`
      if (pixKey) text += `Chave PIX: ${pixKey}\n`
    }

    if (bankDetails) {
      text += `Outros dados: ${bankDetails}\n`
    }

    text += `\n_Calculado no Kofre 🛡️_`
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
    t,
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

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(generatedWhatsAppMessage)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  const handleRecordShare = () => {
    if (!onRecordMyShare || amountPerPerson <= 0) return
    onRecordMyShare({
      amount: amountPerPerson,
      currency,
      description: `${billTitle || 'Racha de Conta'} (minha parte de ${peopleCount} pessoas)`,
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
                  {peopleCount} {t('splitBill.people').toLowerCase()}
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
                {t('splitBill.eachPersonPays') || 'Total por Pessoa:'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight font-mono">
                {formatCurrency(amountPerPerson, currency)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                <span>Total com serviço: {formatCurrency(totalWithTip, currency)}</span>
                <span>•</span>
                <span>{peopleCount} partes</span>
              </div>
            </div>
          )}

          {/* Dados de Transferência Detectados */}
          {(aliasPy || pixKey) && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Dados Vinculados para Recebimento:
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
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
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
