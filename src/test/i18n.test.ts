import { describe, expect, it } from 'vitest'
import { activeLocale, setAppLanguage, tx } from '../i18n'

describe('i18n', () => {
  it('aplica español y su configuración regional', async () => {
    await setAppLanguage('es')

    expect(tx('Ajustes')).toBe('Ajustes')
    expect(activeLocale()).toBe('es-ES')
    expect(document.documentElement.lang).toBe('es')
  })

  it('cambia a inglés y mantiene las interpolaciones', async () => {
    await setAppLanguage('en')

    expect(tx('Ajustes')).toBe('Settings')
    expect(tx('{{count}} notas guardadas en esta tablet', { count: 3 })).toBe('3 notes saved on this tablet')
    expect(activeLocale()).toBe('en-GB')
    expect(document.documentElement.lang).toBe('en')
  })
})
