import i18n, { type TOptions } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { english, spanish, type TranslationKey } from './translations'

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

export const languageLocales = {
  es: 'es-ES',
  en: 'en-GB',
} as const satisfies Record<SupportedLanguage, string>

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: spanish },
      en: { translation: english },
    },
    lng: 'es',
    fallbackLng: 'es',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: 'translation',
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  })

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
}

export function tx(key: TranslationKey, options?: TOptions): string {
  return i18n.t(key, options)
}

export function activeLocale(language: SupportedLanguage = i18n.resolvedLanguage as SupportedLanguage): typeof languageLocales[SupportedLanguage] {
  return languageLocales[isSupportedLanguage(language) ? language : 'es']
}

export async function setAppLanguage(language: SupportedLanguage): Promise<void> {
  if (i18n.resolvedLanguage !== language) await i18n.changeLanguage(language)
  document.documentElement.lang = language
}

export { i18n }
