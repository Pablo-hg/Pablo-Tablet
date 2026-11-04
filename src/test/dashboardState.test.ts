import { beforeEach, describe, expect, it } from 'vitest'
import { DASHBOARD_PAGES, DASHBOARD_THEMES, loadDashboardState, saveDashboardState } from '../dashboardState'

describe('migraciones del estado', () => {
  beforeEach(() => window.localStorage.clear())

  it('migra una nota simple de v1 y habilita las páginas añadidas después', () => {
    window.localStorage.setItem('pablo-tablet.dashboard.v1', JSON.stringify({
      note: 'Comprar pan',
      preferences: { enabledPageIds: ['dashboard', 'clock'] },
    }))

    const state = loadDashboardState()

    expect(state.notes).toHaveLength(1)
    expect(state.notes[0]).toMatchObject({
      id: 'legacy-note',
      type: 'text',
      title: 'Nota rápida',
      content: 'Comprar pan',
    })
    expect(state.preferences.enabledPageIds).toEqual(['dashboard', 'clock', 'weather', 'calendar', 'gallery', 'assistant'])
    expect(state.preferences.enabledPageIds).not.toContain('notes')
    expect(DASHBOARD_PAGES.map((page) => page.id)).toContain('notes')
  })

  it('normaliza datos actuales incompletos sin perder registros válidos', () => {
    const state = loadDashboardState(JSON.stringify({
      notes: [{ id: 'n1', title: 'Prueba', content: 'Contenido', color: 'blue' }],
      alarms: [{ id: 'a1', label: 'Despertar', time: '07:30', enabled: true, weekdays: [1, 9] }],
      timers: [{ id: 't1', label: 'Horno', durationSeconds: 300, remainingSeconds: 999 }],
      widgets: [{ id: 'clock', visible: true, layouts: { landscape: { x: 99, y: -2, width: 2, height: 1 }, portrait: { x: 0, y: 0, width: 1, height: 1 } } }],
      preferences: { enabledPageIds: ['clock'] },
    }))

    expect(state.notes[0].color).toBe('violet')
    expect(state.alarms[0].weekdays).toEqual([1])
    expect(state.timers[0].remainingSeconds).toBe(300)
    expect(state.timers[0]).toMatchObject({ soundName: 'Sonido predeterminado', soundUri: null })
    expect(state.widgets).toHaveLength(5)
    expect(state.widgets.find((widget) => widget.id === 'assistant')?.visible).toBe(false)
    expect(state.widgets.find((widget) => widget.id === 'clock')?.layouts.landscape).toEqual({ x: 2, y: 0, width: 2, height: 1 })
    expect(state.preferences.enabledPageIds[0]).toBe('dashboard')
    expect(state.preferences.themeId).toBe('original')
    expect(state.preferences.autoRotate).toBe(true)
    expect(state.preferences.showUpcomingCalendarHolidays).toBe(true)
  })

  it('conserva todos los trazos y puntos válidos al guardar y reabrir un dibujo grande', () => {
    const drawing = Array.from({ length: 301 }, (_, index) => ({
      color: '#7fa2ff', width: 3,
      points: Array.from({ length: index === 300 ? 2001 : 2 }, (_, point) => ({ x: point % 1000, y: point % 600 })),
    }))
    const state = loadDashboardState(JSON.stringify({ notes: [{ id: 'large-drawing', type: 'drawing', drawing }] }))
    expect(state.notes[0].drawing).toHaveLength(301)
    expect(state.notes[0].drawing[300].points).toHaveLength(2001)
    expect(state.notes[0].drawing).toEqual(drawing)
    saveDashboardState(state)
    expect(loadDashboardState().notes[0].drawing).toEqual(drawing)
  })

  it('descarta puntos inválidos sin recortar el resto de un dibujo', () => {
    const state = loadDashboardState(JSON.stringify({ notes: [{ id: 'drawing', type: 'drawing', drawing: [
      { color: '#7fa2ff', width: 3, points: [null, { x: 'invalid', y: 1 }, { x: 20, y: 30 }] },
    ] }] }))
    expect(state.notes[0].drawing[0].points).toEqual([{ x: 20, y: 30 }])
  })

  it('conserva la preferencia para bloquear la rotación', () => {
    expect(loadDashboardState(JSON.stringify({ preferences: { autoRotate: false } })).preferences.autoRotate).toBe(false)
  })

  it('conserva el sonido del temporizador al guardar y volver a abrir la aplicación', () => {
    const state = loadDashboardState(JSON.stringify({ timers: [{
      id: 't1', label: 'Horno', durationSeconds: 300, remainingSeconds: 180,
      endsAt: '2099-01-01T10:03:00.000Z', soundName: 'Campanas', soundUri: 'content://sounds/7',
    }] }))
    expect(loadDashboardState(JSON.stringify(state)).timers[0]).toMatchObject({
      soundName: 'Campanas', soundUri: 'content://sounds/7', remainingSeconds: 180, endsAt: '2099-01-01T10:03:00.000Z',
    })
  })

  it('conserva idiomas compatibles y usa español ante valores desconocidos', () => {
    expect(loadDashboardState(JSON.stringify({ preferences: { language: 'en' } })).preferences.language).toBe('en')
    expect(loadDashboardState(JSON.stringify({ preferences: { language: 'fr' } })).preferences.language).toBe('es')
    expect(loadDashboardState().preferences.language).toBe('es')
  })

  it('conserva temas válidos y descarta identificadores desconocidos', () => {
    expect(loadDashboardState(JSON.stringify({ preferences: { themeId: 'retro' } })).preferences.themeId).toBe('retro')
    expect(loadDashboardState(JSON.stringify({ preferences: { themeId: 'inexistente' } })).preferences.themeId).toBe('original')
  })

  it('conserva opciones válidas del paginador y descarta valores desconocidos', () => {
    const configured = loadDashboardState(JSON.stringify({ preferences: {
      pageNavigationStyle: 'labels',
      pageNavigationPosition: 'right',
      showPageNavigationLabels: true,
    } }))
    expect(configured.preferences).toMatchObject({
      pageNavigationStyle: 'labels',
      pageNavigationPosition: 'right',
      showPageNavigationLabels: true,
    })

    const invalid = loadDashboardState(JSON.stringify({ preferences: {
      pageNavigationStyle: 'unknown',
      pageNavigationPosition: 'center',
      showPageNavigationLabels: 'yes',
    } }))
    expect(invalid.preferences).toMatchObject({
      pageNavigationStyle: 'dock',
      pageNavigationPosition: 'bottom',
      showPageNavigationLabels: false,
    })
  })

  it('mantiene el catálogo de diez temas con Original en quinta posición', () => {
    expect(DASHBOARD_THEMES).toHaveLength(10)
    expect(DASHBOARD_THEMES[4]).toMatchObject({ id: 'original', label: 'Original' })
    expect(new Set(DASHBOARD_THEMES.map((theme) => theme.id))).toHaveProperty('size', 10)
  })

  it('recupera el estado por defecto cuando el almacenamiento está corrupto', () => {
    window.localStorage.setItem('pablo-tablet.dashboard.v17', '{estado-invalido')
    const state = loadDashboardState()
    expect(state.notes).toEqual([])
    expect(state.widgets).toHaveLength(5)
    expect(state.preferences.enabledPageIds).toContain('dashboard')
    expect(state.preferences.enabledPageIds).toContain('assistant')
    expect(state.preferences.assistantEnabled).toBe(true)
    expect(state.preferences.assistantVoiceEnabled).toBe(true)
    expect(state.preferences.assistantReadAloud).toBe(false)
  })
})
