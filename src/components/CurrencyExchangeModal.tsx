import React, { useState, useMemo } from 'react'
import type { CurrencyCode } from '../lib/types'
import { formatCurrency } from '../lib/formatters'
import { useTranslation } from '../lib/i18n/LanguageContext'
import {
  X,
  Coins,
  DollarSign,
  Banknote,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  Globe,
} from 'lucide-react'
import {
  fetchLiveRates,
  getCachedExchangeRates,
  DEFAULT_EXCHANGE_RATES,
} from '../lib/exchangeRateService'

interface CurrencyExchangeModalProps {
  isOpen: boolean
  onClose: () => void
  preferredCurrency?: CurrencyCode
}

export const CurrencyExchangeModal: React.FC<CurrencyExchangeModalProps> = ({
  isOpen,
  onClose,
  preferredCurrency = 'PYG',
}) => {
  const { t } = useTranslation()

  // Aba ativa: 'converter' (Conversor Triplo) | 'comparator' (Comparador de Compras)
  const [activeTab, setActiveTab] = useState<'converter' | 'comparator'>('converter')

  // Taxas configuráveis (iniciadas com cache ou padrão)
  const initialCache = getCachedExchangeRates()
  const [usdToPyg, setUsdToPyg] = useState(initialCache?.usdToPyg ?? DEFAULT_EXCHANGE_RATES.usdToPyg)
  const [usdToBrl, setUsdToBrl] = useState(initialCache?.usdToBrl ?? DEFAULT_EXCHANGE_RATES.usdToBrl)
  const [liveRatesInfo, setLiveRatesInfo] = useState<string | null>(initialCache?.lastUpdatedText ?? null)
  const [isLoadingLive, setIsLoadingLive] = useState(false)

  // Valores do conversor simultâneo
  const [activeInput, setActiveInput] = useState<CurrencyCode>(preferredCurrency)
  const [inputValue, setInputValue] = useState<string>('100')

  const handleFetchLiveRates = async () => {
    setIsLoadingLive(true)
    try {
      const res = await fetchLiveRates(true)
      setUsdToPyg(res.usdToPyg)
      setUsdToBrl(res.usdToBrl)
      setLiveRatesInfo(res.lastUpdated)
    } finally {
      setIsLoadingLive(false)
    }
  }

  // Valores do Comparador de Compras
  const [purchaseAmount, setPurchaseAmount] = useState<string>('100')
  const [purchaseCurrency, setPurchaseCurrency] = useState<CurrencyCode>('USD')
  const [storePygRate, setStorePygRate] = useState<string>('8050')
  const [storeBrlRate, setStoreBrlRate] = useState<string>('6.05')
  const [cardFeePercent, setCardFeePercent] = useState<string>('4.38') // IOF Brasil padrão

  // Taxa implícita BRL -> PYG
  const brlToPyg = useMemo(() => {
    return usdToBrl > 0 ? Math.round(usdToPyg / usdToBrl) : 1365
  }, [usdToPyg, usdToBrl])

  // Cálculo das 3 moedas sincronizadas
  const convertedValues = useMemo(() => {
    const num = parseFloat(inputValue) || 0
    if (num <= 0) {
      return { PYG: 0, USD: 0, BRL: 0 }
    }

    if (activeInput === 'USD') {
      return {
        USD: num,
        PYG: Math.round(num * usdToPyg),
        BRL: parseFloat((num * usdToBrl).toFixed(2)),
      }
    } else if (activeInput === 'PYG') {
      const inUsd = num / usdToPyg
      return {
        PYG: num,
        USD: parseFloat(inUsd.toFixed(2)),
        BRL: parseFloat((inUsd * usdToBrl).toFixed(2)),
      }
    } else {
      // BRL
      const inUsd = num / usdToBrl
      return {
        BRL: num,
        USD: parseFloat(inUsd.toFixed(2)),
        PYG: Math.round(inUsd * usdToPyg),
      }
    }
  }, [inputValue, activeInput, usdToPyg, usdToBrl])

  // Cálculo do Comparador de Pagamento mais Econômico
  const comparatorAnalysis = useMemo(() => {
    const baseAmt = parseFloat(purchaseAmount) || 0
    if (baseAmt <= 0) return null

    // Converter baseAmt para USD de referência de mercado
    let baseInUsd = baseAmt
    if (purchaseCurrency === 'PYG') baseInUsd = baseAmt / usdToPyg
    else if (purchaseCurrency === 'BRL') baseInUsd = baseAmt / usdToBrl

    // Opção 1: Pagar em USD em espécie
    const costUsd = baseInUsd
    const costUsdInPyg = costUsd * usdToPyg

    // Opção 2: Pagar em Guaranies pela cotação da loja
    const storePyg = parseFloat(storePygRate) || usdToPyg
    const costPygInPyg = baseInUsd * storePyg

    // Opção 3: Pagar em Reais pela cotação da loja
    const storeBrl = parseFloat(storeBrlRate) || usdToBrl
    const costBrlInBrl = baseInUsd * storeBrl
    // Converte o custo em Reais da loja para Guaranies de mercado para equiparar
    const costBrlInPyg = (costBrlInBrl / usdToBrl) * usdToPyg

    // Opção 4: Cartão Internacional (IOF / taxas)
    const fee = (parseFloat(cardFeePercent) || 0) / 100
    const costCardInPyg = costUsdInPyg * (1 + fee)

    const options = [
      {
        id: 'cash_usd',
        name: 'Dólar em Espécie (USD)',
        costInPyg: costUsdInPyg,
        formattedPrimary: `$ ${costUsd.toFixed(2)}`,
        formattedEquiv: formatCurrency(costUsdInPyg, 'PYG'),
      },
      {
        id: 'cash_pyg',
        name: 'Guaranis na Loja (PYG)',
        costInPyg: costPygInPyg,
        formattedPrimary: formatCurrency(costPygInPyg, 'PYG'),
        formattedEquiv: formatCurrency(costPygInPyg, 'PYG'),
      },
      {
        id: 'cash_brl',
        name: 'Reais na Loja (BRL)',
        costInPyg: costBrlInPyg,
        formattedPrimary: `R$ ${costBrlInBrl.toFixed(2)}`,
        formattedEquiv: formatCurrency(costBrlInPyg, 'PYG'),
      },
      {
        id: 'card_intl',
        name: 'Cartão de Crédito (+IOF/Taxas)',
        costInPyg: costCardInPyg,
        formattedPrimary: `$ ${(costUsd * (1 + fee)).toFixed(2)}`,
        formattedEquiv: formatCurrency(costCardInPyg, 'PYG'),
      },
    ]

    options.sort((a, b) => a.costInPyg - b.costInPyg)
    const best = options[0]
    const worst = options[options.length - 1]
    const savingsInPyg = worst.costInPyg - best.costInPyg

    return {
      best,
      savingsInPyg,
      options,
    }
  }, [
    purchaseAmount,
    purchaseCurrency,
    storePygRate,
    storeBrlRate,
    cardFeePercent,
    usdToPyg,
    usdToBrl,
  ])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {t('currencyExchange.title') || 'Simulador de Câmbio & Fronteira'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('currencyExchange.subtitle') || 'Cotações em tempo real e comparador de compras'}
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

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('converter')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'converter'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {t('currencyExchange.tabConverter') || 'Conversor Triplo'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comparator')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'comparator'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {t('currencyExchange.tabComparator') || 'Comparador de Compras'}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {activeTab === 'converter' ? (
            /* ABA CONVERSOR TRIPLO */
            <div className="space-y-4">
              {/* Cotações Ativas */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                    {t('currencyExchange.marketRates') || 'Taxas Base da Fronteira'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isLoadingLive}
                      onClick={handleFetchLiveRates}
                      className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-[10px] flex items-center gap-1 font-bold disabled:opacity-50"
                      title={t('currencyExchange.fetchLive') || 'Buscar Cotação do Dia'}
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingLive ? 'animate-spin' : ''}`} />
                      <span>
                        {isLoadingLive
                          ? (t('currencyExchange.fetching') || 'Buscando...')
                          : (t('currencyExchange.fetchLive') || 'Buscar Cotação do Dia')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUsdToPyg(DEFAULT_EXCHANGE_RATES.usdToPyg)
                        setUsdToBrl(DEFAULT_EXCHANGE_RATES.usdToBrl)
                        setLiveRatesInfo(null)
                      }}
                      className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-[10px] flex items-center gap-0.5"
                      title={t('common.reset') || 'Restaurar'}
                    >
                      <span>{t('common.reset') || 'Restaurar'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-medium block">
                      1 USD = ? PYG
                    </label>
                    <input
                      type="number"
                      value={usdToPyg}
                      onChange={(e) => setUsdToPyg(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-medium block">
                      1 USD = ? BRL
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={usdToBrl}
                      onChange={(e) => setUsdToBrl(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-medium gap-1">
                  <span>Taxa implícita: 1 BRL ≈ {brlToPyg.toLocaleString('es-PY')} PYG</span>
                  {liveRatesInfo && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span>{liveRatesInfo}</span>
                    </span>
                  )}
                </div>

                {/* Etiqueta informativa com a cotação oficial */}
                {liveRatesInfo && (
                  <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-[11px] text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {t('currencyExchange.liveRateBadge') || 'Cotação oficial de mercado:'}{' '}
                      <strong>
                        1 USD = Gs. {usdToPyg.toLocaleString('es-PY')} | R$ {usdToBrl.toFixed(2)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Três Caixas de Conversão Simultânea */}
              <div className="space-y-3">
                {/* Dólar (USD) */}
                <div
                  onClick={() => setActiveInput('USD')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activeInput === 'USD'
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Dólar Americano (USD)</span>
                    </span>
                    {activeInput === 'USD' && (
                      <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                        Editando
                      </span>
                    )}
                  </div>
                  {activeInput === 'USD' ? (
                    <input
                      type="number"
                      step="any"
                      autoFocus
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full text-lg font-black text-slate-900 dark:text-white bg-transparent outline-none font-mono"
                    />
                  ) : (
                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono block">
                      $ {convertedValues.USD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                {/* Guarani (PYG) */}
                <div
                  onClick={() => setActiveInput('PYG')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activeInput === 'PYG'
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      <span>Guarani (Paraguay - PYG)</span>
                    </span>
                    {activeInput === 'PYG' && (
                      <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                        Editando
                      </span>
                    )}
                  </div>
                  {activeInput === 'PYG' ? (
                    <input
                      type="number"
                      step="any"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full text-lg font-black text-slate-900 dark:text-white bg-transparent outline-none font-mono"
                    />
                  ) : (
                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono block">
                      ₲ {convertedValues.PYG.toLocaleString('es-PY')}
                    </span>
                  )}
                </div>

                {/* Real (BRL) */}
                <div
                  onClick={() => setActiveInput('BRL')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activeInput === 'BRL'
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Real Brasileiro (BRL)</span>
                    </span>
                    {activeInput === 'BRL' && (
                      <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                        Editando
                      </span>
                    )}
                  </div>
                  {activeInput === 'BRL' ? (
                    <input
                      type="number"
                      step="any"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full text-lg font-black text-slate-900 dark:text-white bg-transparent outline-none font-mono"
                    />
                  ) : (
                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono block">
                      R$ {convertedValues.BRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ABA COMPARADOR DE COMPRAS */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p>
                  {t('currencyExchange.comparatorHelp') ||
                    'Lojas de Ciudad del Este aplicam cotações próprias. Insira o preço e as taxas cobradas no balcão para descobrir a opção mais barata.'}
                </p>
              </div>

              {/* Preço na Etiqueta */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Preço da Etiqueta
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 font-mono font-bold text-sm outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Moeda
                  </label>
                  <select
                    value={purchaseCurrency}
                    onChange={(e) => setPurchaseCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="PYG">PYG (₲)</option>
                    <option value="BRL">BRL (R$)</option>
                  </select>
                </div>
              </div>

              {/* Taxas da Loja */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-[10px] text-slate-500 uppercase block">
                  Cotações Oferecidas pelo Caixa da Loja:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block">₲ / USD (Loja)</label>
                    <input
                      type="number"
                      value={storePygRate}
                      onChange={(e) => setStorePygRate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">R$ / USD (Loja)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={storeBrlRate}
                      onChange={(e) => setStoreBrlRate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">IOF/Taxa %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cardFeePercent}
                      onChange={(e) => setCardFeePercent(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Vencedor / Diagnóstico */}
              {comparatorAnalysis && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Mais Econômico</span>
                    </span>
                    <h4 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                      {comparatorAnalysis.best.name}
                    </h4>
                    {comparatorAnalysis.savingsInPyg > 1000 && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Economia estimada de até{' '}
                        <strong>{formatCurrency(comparatorAnalysis.savingsInPyg, 'PYG')}</strong> em
                        relação à pior opção.
                      </p>
                    )}
                  </div>

                  {/* Comparativo de Todas as Opções */}
                  <div className="space-y-1.5 text-xs">
                    {comparatorAnalysis.options.map((opt, idx) => (
                      <div
                        key={opt.id}
                        className={`p-2.5 rounded-xl flex items-center justify-between border ${
                          idx === 0
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 text-center font-mono text-[10px] text-slate-400">
                            #{idx + 1}
                          </span>
                          <span>{opt.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-slate-900 dark:text-white block">
                            {opt.formattedPrimary}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ≈ {opt.formattedEquiv}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end bg-slate-50/70 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            {t('common.close') || 'Fechar'}
          </button>
        </div>
      </div>
    </div>
  )
}
