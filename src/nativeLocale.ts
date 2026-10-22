import { Capacitor, registerPlugin } from '@capacitor/core'
import type { SupportedLanguage } from './i18n'

interface AppLocalePlugin {
  setLanguage(options: { language: SupportedLanguage }): Promise<{ language: SupportedLanguage }>
}

const NativeAppLocale = registerPlugin<AppLocalePlugin>('AppLocale')

export async function setNativeAppLanguage(language: SupportedLanguage): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  await NativeAppLocale.setLanguage({ language })
}
