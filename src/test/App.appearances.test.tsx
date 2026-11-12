import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { DASHBOARD_THEMES, loadDashboardState } from '../dashboardState'
import { setAppLanguage } from '../i18n'

describe('las diez apariencias en la aplicación', () => {
  it.each(['es', 'en'] as const)('permite cambiarlas y reabrir sin perder contenido ni personalización (%s)', async language => {
    await setAppLanguage(language)
    const initial = structuredClone(loadDashboardState())
    initial.preferences.language = language
    initial.preferences.clockWidgetStyle = 'analog-minimal'
    initial.notes = [{
      id: 'drawing-to-preserve', type: 'drawing', title: 'Dibujo guardado', content: '',
      drawing: [{ color: '#f4f7ff', width: 6, points: [{ x: 10, y: 20 }, { x: 300, y: 400 }] }],
      drawingPosition: 'below', drawingVisible: true, color: 'mint', pinned: true,
      reminderAt: null, archived: false, createdAt: '2026-11-11T07:00:00Z', updatedAt: '2026-11-11T07:00:00Z',
    }]
    initial.alarms = [{ id: 'saved-alarm', label: 'Alarma guardada', time: '07:30', enabled: false, weekdays: [2, 3, 4, 5, 6], soundName: 'Sonido predeterminado', soundUri: null, createdAt: '2026-11-11T07:00:00Z' }]
    initial.timers = [{ id: 'saved-timer', label: 'Temporizador guardado', durationSeconds: 600, remainingSeconds: 245, endsAt: null, soundName: 'Sonido predeterminado', soundUri: null, createdAt: '2026-11-11T07:00:00Z' }]
    localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(initial))
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: language === 'es' ? 'Ir a Ajustes' : 'Go to Settings' }))
    const picker = screen.getByRole('radiogroup', { name: language === 'es' ? 'Tema visual' : 'Visual theme' })
    expect(within(picker).getAllByRole('radio')).toHaveLength(10)
    for (const [index, theme] of DASHBOARD_THEMES.entries()) {
      fireEvent.click(within(picker).getByRole('radio', { name: new RegExp(`^${index + 1}\\. `) }))
      expect(document.querySelector('.tablet-shell')).toHaveAttribute('data-theme', theme.id)
      expect(within(picker).getAllByRole('radio').filter(radio => radio.getAttribute('aria-checked') === 'true')).toHaveLength(1)
      const saved = loadDashboardState()
      expect(saved.preferences).toEqual({ ...initial.preferences, themeId: theme.id })
      expect(saved.widgets).toEqual(initial.widgets)
      expect(saved.notes).toEqual(initial.notes)
      expect(saved.alarms).toEqual(initial.alarms)
      expect(saved.timers).toEqual(initial.timers)
    }
    first.unmount()
    render(<App />)
    expect(document.querySelector('.tablet-shell')).toHaveAttribute('data-theme', 'brutalist')
    fireEvent.click(screen.getByRole('button', { name: language === 'es' ? 'Ir a Reloj' : 'Go to Clock' }))
    expect(screen.getByRole('radio', { name: language === 'es' ? 'Analógico minimalista' : 'Minimal analog' })).toBeChecked()
    expect(loadDashboardState().notes[0].drawing).toEqual(initial.notes[0].drawing)
  })
})
