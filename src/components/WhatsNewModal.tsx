import React, { useState } from 'react'
import {
  CURRENT_APP_VERSION,
  CHANGELOG_DATA,
  type ChangelogRelease,
  getUnseenReleases,
  getLatestFeatureRelease,
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
  Smartphone,
  Layout,
  ShieldCheck,
  Calculator,
  Pin,
  MessageCircle,
  Activity,
  ClipboardPaste,
  Share2,
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
  Smartphone,
  Layout,
  ShieldCheck,
  Calculator,
  Pin,
  MessageCircle,
  Activity,
  ClipboardPaste,
  Share2,
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  onClose,
  onVersionAcknowledged,
}) => {
  const { t, language } = useTranslation()
  const [showHistory, setShowHistory] = useState(false)
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({})

  if (!isOpen) return null

  const unseenReleases = getUnseenReleases()
  const latestFeature = getLatestFeatureRelease()
  const displayReleases = unseenReleases.length > 0 ? unseenReleases : [latestFeature]
  const hasAccumulated = unseenReleases.length >= 2

  const pastReleases = CHANGELOG_DATA.filter(
    (release) => !displayReleases.some((d) => d.version === release.version)
  )

  const handleAcknowledge = () => {
    try {
      localStorage.setItem('kofre_last_seen_feature_version', latestFeature.version)
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

  const renderReleaseCard = (
    release: ChangelogRelease,
    isLatest = false,
    isPending = false
  ) => {
    const title = release.title[language] || release.title.pt
    const formattedDate = formatDate(release.releaseDate, language)

    return (
      <div
        key={release.version}
        className={`rounded-2xl border transition-all ${
          isLatest
            ? 'p-4 sm:p-6 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 border-indigo-200 dark:border-indigo-800/60 shadow-sm'
            : isPending
            ? 'p-4 sm:p-6 bg-amber-50/40 dark:bg-amber-950/15 border-amber-200 dark:border-amber-800/50 shadow-sm'
            : 'p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tracking-wide ${
                isLatest
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isPending
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              v{release.version}
            </span>
            {isLatest ? (
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t('whatsNew.currentVersion')}
              </span>
            ) : isPending ? (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t('whatsNew.pendingBadge')}
              </span>
            ) : null}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {formattedDate}
          </span>
        </div>

        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-3 whitespace-normal">
          {title}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {release.highlights.map((item, idx) => renderHighlightItem(item, idx))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {t('whatsNew.title')}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                {t('whatsNew.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAcknowledge}
            className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={language === 'es' ? 'Cerrar' : 'Fechar'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2">
          {/* Accumulated Updates Celebratory Banner */}
          {hasAccumulated && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-indigo-500/10 border border-amber-500/30 flex items-center gap-3 animate-in fade-in">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                🎉
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {t('whatsNew.accumulatedBanner').replace(
                      '{count}',
                      unseenReleases.length.toString()
                    )}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-500 text-white shadow-sm">
                    {t('whatsNew.pendingBadge')}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {t('whatsNew.accumulatedSubtitle')}
                </p>
              </div>
            </div>
          )}

          {/* Pending / Featured Release Cards */}
          <div className="space-y-4">
            {displayReleases.map((release) =>
              renderReleaseCard(
                release,
                release.version === latestFeature.version || release.version === CURRENT_APP_VERSION,
                hasAccumulated && release.version !== latestFeature.version
              )
            )}
          </div>

          {/* Past Releases Accordion Toggle */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="cursor-pointer w-full py-2.5 px-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" />
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
              <div className="mt-3 space-y-3 animate-in fade-in duration-150">
                {pastReleases.map((release) => {
                  const isExpanded = !!expandedVersions[release.version]
                  const releaseTitle = release.title[language] || release.title.pt
                  const formattedDate = formatDate(release.releaseDate, language)

                  return (
                    <div
                      key={release.version}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleVersionAccordion(release.version)}
                        className="cursor-pointer w-full p-3.5 sm:p-4 flex items-start sm:items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors rounded-2xl"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                            v{release.version}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-normal">
                            {releaseTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 pt-0.5 sm:pt-0">
                          <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
                            {formattedDate}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/30 rounded-b-2xl">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {release.highlights.map((item, idx) =>
                              renderHighlightItem(item, idx)
                            )}
                          </div>
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
