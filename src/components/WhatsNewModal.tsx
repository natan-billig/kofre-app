import React, { useState } from 'react'
import {
  CURRENT_APP_VERSION,
  CHANGELOG_DATA,
  type ChangelogRelease,
} from '../data/changelog'
import { useTranslation } from '../lib/i18n/LanguageContext'
import { formatDate } from '../lib/formatters'
import {
  X,
  Sparkles,
  Layers,
  Trash2,
  PiggyBank,
  CreditCard,
  ShieldAlert,
  ArrowRightLeft,
  Zap,
  Calendar,
  CheckCircle2,
  PieChart,
  CalendarRange,
  Users,
  Coins,
  Search,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface WhatsNewModalProps {
  isOpen: boolean
  onClose: () => void
  onVersionAcknowledged?: () => void
}

const ICON_MAP: Record<string, React.ElementType> = {
  Layers,
  Sparkles,
  Trash2,
  PiggyBank,
  CreditCard,
  ShieldAlert,
  ArrowRightLeft,
  Zap,
  Calendar,
  CheckCircle2,
  PieChart,
  CalendarRange,
  Users,
  Coins,
  Search,
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  onClose,
  onVersionAcknowledged,
}) => {
  const { language } = useTranslation()
  const [showHistory, setShowHistory] = useState(false)
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({})

  if (!isOpen) return null

  const latestRelease = CHANGELOG_DATA[0]
  const pastReleases = CHANGELOG_DATA.slice(1)

  const handleAcknowledge = () => {
    try {
      localStorage.setItem('kofre_last_seen_version', CURRENT_APP_VERSION)
    } catch {
      // Ignora falhas de quota ou navegação anônima
    }
    onVersionAcknowledged?.()
    onClose()
  }

  const toggleVersionAccordion = (ver: string) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [ver]: !prev[ver],
    }))
  }

  const renderHighlightItem = (
    item: {
      icon: string
      title: { pt: string; es: string }
      description: { pt: string; es: string }
    },
    index: number
  ) => {
    const IconComponent = ICON_MAP[item.icon] || Sparkles
    const titleText = item.title[language] || item.title.pt
    const descText = item.description[language] || item.description.pt

    return (
      <div
        key={index}
        className="flex items-start gap-3.5 p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <IconComponent className="w-4 h-4" />
        </div>
        <div className="space-y-0.5 min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            {titleText}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {descText}
          </p>
        </div>
      </div>
    )
  }

  const renderReleaseCard = (release: ChangelogRelease, isLatest = false) => {
    const title = release.title[language] || release.title.pt
    const formattedDate = formatDate(release.releaseDate, language)

    return (
      <div
        key={release.version}
        className={`rounded-2xl border transition-all ${
          isLatest
            ? 'p-4 sm:p-5 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 border-indigo-200 dark:border-indigo-800/60 shadow-sm'
            : 'p-4 bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tracking-wide ${
                isLatest
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              v{release.version}
            </span>
            {isLatest && (
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {language === 'es' ? 'Versión Actual' : 'Versão Atual'}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {formattedDate}
          </span>
        </div>

        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-3">
          {title}
        </h3>

        <div className="space-y-2.5">
          {release.highlights.map((item, idx) => renderHighlightItem(item, idx))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {language === 'es' ? 'Novedades de Kofre' : 'Novidades do Kofre'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'es'
                  ? 'Descubre las mejoras y nuevas funciones de esta versión'
                  : 'Descubra as melhorias e novos recursos desta versão'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAcknowledge}
            className="cursor-pointer p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={language === 'es' ? 'Cerrar' : 'Fechar'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Latest Version Card */}
          {latestRelease && renderReleaseCard(latestRelease, true)}

          {/* Past Releases Accordion Toggle */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="cursor-pointer w-full py-2 px-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  {language === 'es'
                    ? 'Ver historial de actualizaciones anteriores'
                    : 'Ver histórico de atualizações anteriores'}
                </span>
              </span>
              {showHistory ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2.5 animate-in fade-in duration-150">
                {pastReleases.map((release) => {
                  const isExpanded = !!expandedVersions[release.version]
                  const releaseTitle = release.title[language] || release.title.pt
                  const formattedDate = formatDate(release.releaseDate, language)

                  return (
                    <div
                      key={release.version}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/60"
                    >
                      <button
                        type="button"
                        onClick={() => toggleVersionAccordion(release.version)}
                        className="cursor-pointer w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold font-mono text-slate-700 dark:text-slate-300">
                            v{release.version}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">
                            {releaseTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-slate-400">
                            {formattedDate}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 pt-1 border-t border-slate-100 dark:border-slate-800/60 space-y-2 bg-slate-50/50 dark:bg-slate-950/30">
                          {release.highlights.map((item, idx) =>
                            renderHighlightItem(item, idx)
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleAcknowledge}
            className="cursor-pointer w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {language === 'es' ? '¡Entendido! Explorar Kofre' : 'Entendi / Explorar Novidades'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
