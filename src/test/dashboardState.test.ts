import { beforeEach, describe, expect, it } from 'vitest'
import { DASHBOARD_PAGES, DASHBOARD_THEMES, loadDashboardState } from '../dashboardState'

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
    expect(state.preferences.enabledPageIds).toEqual(['dashboard', 'clock', 'weather', 'calendar', 'gallery'])
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
    expect(state.widgets).toHaveLength(4)
    expect(state.widgets.find((widget) => widget.id === 'clock')?.layouts.landscape).toEqual({ x: 2, y: 0, width: 2, height: 1 })
    expect(state.preferences.enabledPageIds[0]).toBe('dashboard')
    expect(state.preferences.themeId).toBe('original')
  })

  it('conserva temas válidos y descarta identificadores desconocidos', () => {
    expect(loadDashboardState(JSON.stringify({ preferences: { themeId: 'retro' } })).preferences.themeId).toBe('retro')
    expect(loadDashboardState(JSON.stringify({ preferences: { themeId: 'inexistente' } })).preferences.themeId).toBe('original')
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
    expect(state.widgets).toHaveLength(4)
    expect(state.preferences.enabledPageIds).toContain('dashboard')
  })
})
