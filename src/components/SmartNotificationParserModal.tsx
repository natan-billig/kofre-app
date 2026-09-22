import React, { useState, useMemo } from 'react'
import type { ParsedNotification, Wallet } from '../lib/types'
import { parseBankNotification } from '../lib/notificationParser'
import { formatCurrency } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { useModalScrollLock } from '../hooks/useModalScrollLock'
import {
  X,
  Sparkles,
  ClipboardPaste,
  ArrowRight,
  AlertCircle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

interface SmartNotificationParserModalProps {
  isOpen: boolean
  wallets: Wallet[]
  onClose: () => void
  onApplyParsed: (
    parsed: ParsedNotification,
    selectedWalletId?: string,
    destinationWalletId?: string
  ) => void
}

export const SmartNotificationParserModal: React.FC<SmartNotificationParserModalProps> = ({
  isOpen,
  wallets,
  onClose,
  onApplyParsed,
}) => {
  const { t } = useTranslation()
  const [inputText, setInputText] = useState('')

  const parsed = useMemo(() => {
    return parseBankNotification(inputText)
  }, [inputText])

  useModalScrollLock(isOpen)

  if (!isOpen) return null

  // Filtrar carteiras ativas que combinem com a moeda detectada
  const matchingWallets = wallets.filter(
    (w) => !w.is_archived && w.currency === (parsed?.currency || 'PYG')
  )
  let defaultWalletId = matchingWallets[0]?.id || wallets.find((w) => !w.is_archived)?.id
  let destWalletId: string | undefined = undefined

  // Reconhecimento de Pagamento de Fatura Sudameris (débito em conta bancária, crédito em cartão)
  if (parsed?.bankSource === 'Sudameris' && parsed.type === 'transfer') {
    const sudamerisBank =
      matchingWallets.find(
        (w) => w.name.toLowerCase().includes('sudameris') && w.account_type !== 'credit_card'
      ) ||
      wallets.find(
        (w) =>
          !w.is_archived &&
          w.name.toLowerCase().includes('sudameris') &&
          w.account_type !== 'credit_card'
      )
    if (sudamerisBank) defaultWalletId = sudamerisBank.id

    const creditCard =
      matchingWallets.find(
        (w) => w.account_type === 'credit_card' && w.name.toLowerCase().includes('sudameris')
      ) ||
      matchingWallets.find((w) => w.account_type === 'credit_card') ||
      wallets.find((w) => !w.is_archived && w.account_type === 'credit_card')
    if (creditCard) destWalletId = creditCard.id
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setInputText(text)
      }
    } catch {
      // Falha permissão de clipboard do navegador
    }
  }

  const handleConfirm = () => {
    if (!parsed) return
    onApplyParsed(parsed, defaultWalletId, destWalletId)
    setInputText('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md transition-all animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {t('notificationParser.title') || 'Leitor de Notificações Bancárias'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('notificationParser.subtitle') || 'Cole o SMS ou push para preenchimento em 1 toque'}
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

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Textarea Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('notificationParser.pasteLabel') || 'Cole o texto do SMS ou notificação do banco:'}
              </label>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="cursor-pointer text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <ClipboardPaste className="w-3 h-3" />
                <span>{t('notificationParser.pasteButton') || 'Colar da área de transferência'}</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ex: Compra aprobada por Gs. 150.000 en SUPERSEIS el 18/09 com tarjeta..."
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none resize-none font-sans"
            />
          </div>

          {/* Parsed Result Preview */}
          {parsed ? (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-b from-indigo-50/40 to-white dark:from-indigo-950/20 dark:to-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('notificationParser.detected') || 'Dados Identificados com Sucesso'}</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                  {parsed.bankSource}
                </span>
              </div>

              {/* Grid de Dados Extraídos */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {/* Montante */}
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    {t('notificationParser.amount') || 'Valor'}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                    {parsed.type === 'expense' ? (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                    ) : parsed.type === 'income' ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                    )}
                    {parsed.amount
                      ? formatCurrency(parsed.amount, parsed.currency || 'PYG')
                      : 'Não detectado'}
                  </span>
                </div>

                {/* Tipo / Operação */}
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    {t('notificationParser.type') || 'Tipo'}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {t(`types.${parsed.type}`) ||
                      (parsed.type === 'expense'
                        ? 'Despesa'
                        : parsed.type === 'income'
                        ? 'Receita'
                        : 'Transferência')}
                  </span>
                </div>

                {/* Descrição / Estabelecimento */}
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    {t('notificationParser.merchant') || 'Estabelecimento / Pessoa'}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {parsed.description || 'Geral'}
                  </span>
                </div>

                {/* Categoria Sugerida */}
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    {t('notificationParser.category') || 'Categoria Sugerida'}
                  </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                    {parsed.suggestedCategory}
                  </span>
                </div>
              </div>
            </div>
          ) : inputText.trim().length > 5 ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                {t('notificationParser.notRecognized') ||
                  'Não foi possível extrair os dados automaticamente. Verifique se o texto inclui o valor e o nome da transação.'}
              </span>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50/70 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel') || 'Cancelar'}
          </button>

          <button
            type="button"
            disabled={!parsed || !parsed.amount}
            onClick={handleConfirm}
            className="cursor-pointer px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all"
          >
            <span>{t('notificationParser.apply') || 'Preencher Lançamento'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
