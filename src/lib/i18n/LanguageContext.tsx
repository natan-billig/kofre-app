/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { pt, type TranslationDictionary } from './pt'
import { es } from './es'

export type Language = 'pt' | 'es'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (path: string, fallback?: string) => string
  dict: TranslationDictionary
}

const dictionaries: Record<Language, TranslationDictionary> = { pt, es }

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'pt'
  try {
    const saved = localStorage.getItem('kofre_lang')
    if (saved === 'pt' || saved === 'es') return saved

    if (navigator.language && navigator.language.toLowerCase().startsWith('es')) {
      return 'es'
    }
  } catch (e) {
    console.warn('Error reading language preference:', e)
  }
  return 'pt'
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage)

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem('kofre_lang', lang)
    } catch (e) {
      console.warn('Error saving language preference:', e)
    }
  }

  // Sincroniza atributo lang no HTML
  useEffect(() => {
    document.documentElement.lang = language === 'es' ? 'es-PY' : 'pt-BR'
  }, [language])

  const dict = useMemo(() => dictionaries[language] || pt, [language])

  const t = useMemo(() => {
    return (path: string, fallback?: string): string => {
      const parts = path.split('.')
      let current: unknown = dict

      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part]
        } else {
          return fallback || path
        }
      }

      if (typeof current === 'string') {
        return current
      }

      return fallback || path
    }
  }, [dict])

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      dict,
    }),
    [language, t, dict]
  )

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}
