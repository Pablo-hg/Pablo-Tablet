import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { loadDashboardState } from '../dashboardState'

describe('navegación y flujos principales', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('permite recorrer las páginas principales y volver al inicio', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('Buenos días, Pablo')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Páginas del dashboard' }).querySelectorAll('svg')).toHaveLength(8)
    await user.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    expect(document.querySelector('.tablet-content')).toHaveClass('is-calendar')
    expect(screen.getByText('Tu agenda')).toBeInTheDocument()
    const upcomingHeading = screen.getByRole('heading', { name: 'Próximos eventos' })
    const connectionsHeading = screen.getByRole('heading', { name: 'Cuentas sincronizadas' })
    expect(upcomingHeading.compareDocumentPosition(connectionsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Ir a Tiempo' }))
    expect(screen.getByText('Añade tu primera ubicación')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ir a Inicio' }))
    expect(screen.getByText('Buenos días, Pablo')).toBeInTheDocument()
  })

  it('permite deslizar desde la caja de cuentas sincronizadas del calendario', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    const connectionsPanel = screen.getByRole('heading', { name: 'Cuentas sincronizadas' }).closest('.calendar-connections')
    expect(connectionsPanel).not.toHaveAttribute('data-swipe-block')

    fireEvent.touchStart(connectionsPanel!, { changedTouches: [{ clientX: 500, clientY: 200 }] })
    fireEvent.touchEnd(connectionsPanel!, { changedTouches: [{ clientX: 350, clientY: 205 }] })

    expect(screen.getByText('Reloj', { selector: '.welcome' })).toBeInTheDocument()
  })

  it('permite deslizar desde un día de la agenda unificada', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    const dayButton = document.querySelector('.calendar-month-grid > button')
    expect(dayButton).toBeInTheDocument()

    fireEvent.touchStart(dayButton!, { changedTouches: [{ clientX: 500, clientY: 260 }] })
    fireEvent.touchEnd(dayButton!, { changedTouches: [{ clientX: 350, clientY: 265 }] })

    expect(screen.getByText('Reloj', { selector: '.welcome' })).toBeInTheDocument()
  })

  it('resume las tareas del día y crea los eventos locales en naranja', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const state = loadDashboardState()
    state.calendarEvents = [{
      id: 'task-today', source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local',
      type: 'task', recurrence: 'none', completed: false, title: 'Preparar informe', date, endDate: date,
      startTime: '09:00', endTime: '10:00', allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'sun', reminders: [],
      createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z`,
    }]
    window.localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    expect(screen.getByText('1 tarea')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Nuevo' }))
    expect(document.querySelector('.calendar-color.event-sun')).toHaveClass('is-selected')
  })

  it('abre el día seleccionado en una agenda horaria con el día anterior y posterior', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T08:00:00'))
    const state = loadDashboardState()
    state.calendarEvents = [{
      id: 'event-next-day', source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local',
      type: 'event', recurrence: 'none', completed: false, title: 'Revisión médica', date: '2026-10-17', endDate: '2026-10-17',
      startTime: '09:30', endTime: '10:45', allDay: false, timeZone: 'Europe/Madrid', location: 'Consulta 2', notes: '', color: 'coral', reminders: [],
      createdAt: '2026-10-16T08:00:00.000Z', updatedAt: '2026-10-16T08:00:00.000Z',
    }]
    window.localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    const dayButton = screen.getByRole('button', { name: /^17.*Revisión médica/ })
    const pointerCapture = vi.mocked(HTMLElement.prototype.setPointerCapture)
    pointerCapture.mockClear()
    fireEvent.pointerDown(dayButton, { button: 0, pointerId: 1, clientX: 120, clientY: 120 })
    fireEvent.pointerUp(dayButton, { button: 0, pointerId: 1, clientX: 120, clientY: 120 })
    fireEvent.click(dayButton)

    expect(pointerCapture).toHaveBeenCalledWith(1)
    expect(screen.getByRole('heading', { name: /sábado, 17 de octubre/i })).toBeVisible()
    expect(screen.getByLabelText('Agenda por horas del 2026-10-16 al 2026-10-18')).toBeVisible()
    expect(document.querySelector('.calendar-three-day-all-day')).toBeInTheDocument()
    expect(screen.getByText('Todo el día', { selector: '.calendar-time-corner' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Revisión médica.*09:30–10:45.*Consulta 2/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Día anterior' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Volver al mes' }))
    expect(screen.getByRole('heading', { name: 'octubre de 2026' })).toBeVisible()
  })

  it('abre directamente desde el widget del dashboard el día pulsado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T10:00:00'))
    render(<App />)

    const dayButton = screen.getByRole('button', { name: /Abrir domingo, 25 de octubre/i })
    fireEvent.pointerDown(dayButton, { button: 0, pointerId: 1, clientX: 120, clientY: 120 })
    fireEvent.pointerUp(dayButton, { button: 0, pointerId: 1, clientX: 120, clientY: 120 })
    fireEvent.click(dayButton)

    expect(screen.getByRole('heading', { name: /domingo, 25 de octubre/i })).toBeVisible()
    expect(screen.getByLabelText('Agenda por horas del 2026-10-24 al 2026-10-26')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Volver al mes' })).toBeVisible()
  })

  it('mantiene las fechas nativas en el calendario pero no en Próximos eventos', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T10:00:00'))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Calendario' }))

    expect(screen.getByRole('button', { name: /25.*Cambio al horario de invierno/ })).toBeVisible()
    expect(document.querySelector('.calendar-upcoming-panel')).not.toHaveTextContent('Cambio al horario de invierno')
    expect(document.querySelector('.calendar-upcoming-panel')).not.toHaveTextContent('Todos los Santos')
    expect(screen.queryByText('Tablet')).not.toBeInTheDocument()
  })

  it('separa festivos sincronizados, conserva eventos de todo el día y permite ocultar la sección del widget', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T10:00:00'))
    const state = loadDashboardState()
    const holidayCalendarId = 'es.spain#holiday@group.v.calendar.google.com'
    state.calendarAccounts = [{ id: 'g1', provider: 'google', email: 'pablo@example.com', displayName: 'Pablo', status: 'connected', enabled: true, lastSyncedAt: null, error: null }]
    state.externalCalendars = [
      { id: 'google:g1:holidays', accountId: 'g1', provider: 'google', remoteId: holidayCalendarId, name: 'Festivos en España', color: 'mint', visible: true, readOnly: true },
      { id: 'google:g1:primary', accountId: 'g1', provider: 'google', remoteId: 'primary', name: 'Personal', color: 'blue', visible: true, readOnly: false },
    ]
    state.calendarEvents = [
      {
        id: 'holiday-1', source: 'google', accountId: 'g1', calendarId: holidayCalendarId, externalId: 'holiday-1', externalVersion: '1', syncStatus: 'synced',
        type: 'event', recurrence: 'none', completed: false, title: 'Festivo sincronizado', date: '2026-10-17', endDate: '2026-10-17',
        startTime: '00:00', endTime: '23:59', allDay: true, timeZone: 'Europe/Madrid', location: '', notes: 'Calendario de festivos', color: 'mint', reminders: [],
        createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z',
      },
      {
        id: 'all-day-1', source: 'google', accountId: 'g1', calendarId: 'primary', externalId: 'all-day-1', externalVersion: '1', syncStatus: 'synced',
        type: 'event', recurrence: 'none', completed: false, title: 'Evento normal de todo el día', date: '2026-10-18', endDate: '2026-10-18',
        startTime: '00:00', endTime: '23:59', allDay: true, timeZone: 'Europe/Madrid', location: '', notes: '', color: 'blue', reminders: [],
        createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z',
      },
    ]
    const agenda = state.widgets.find((widget) => widget.id === 'agenda')!
    agenda.layouts.landscape = { x: 0, y: 0, width: 3, height: 3 }
    state.preferences.showUpcomingCalendarHolidays = true
    window.localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    render(<App />)

    const widget = document.querySelector('.calendar-widget')!
    expect(widget.querySelector('.calendar-widget-month-grid')).toHaveTextContent('Festivo sincronizado')
    expect(widget.querySelector('.calendar-widget-upcoming')).not.toHaveTextContent('Festivo sincronizado')
    expect(widget.querySelector('.calendar-widget-upcoming')).toHaveTextContent('Evento normal de todo el día')
    expect(widget.querySelector('.calendar-widget-holidays')).toHaveTextContent('Festivo sincronizado')

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    expect(document.querySelector('.calendar-upcoming-panel')).not.toHaveTextContent('Festivo sincronizado')
    expect(document.querySelector('.calendar-upcoming-panel')).toHaveTextContent('Evento normal de todo el día')
    fireEvent.click(screen.getByRole('button', { name: /^17.*Festivo sincronizado/ }))

    const allDayRow = document.querySelector('.calendar-three-day-all-day')!
    const holiday = [...allDayRow.querySelectorAll('.calendar-timeline-all-day')].find((item) => item.textContent?.includes('Festivo sincronizado'))
    const normalAllDay = [...allDayRow.querySelectorAll('.calendar-timeline-all-day')].find((item) => item.textContent?.includes('Evento normal de todo el día'))
    expect(holiday).toHaveClass('is-holiday')
    expect(holiday).toHaveTextContent('Festivo')
    expect(normalAllDay).not.toHaveClass('is-holiday')

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))
    const holidayToggle = screen.getByRole('switch', { name: /Próximos festivos/ })
    expect(holidayToggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(holidayToggle)
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }))
    expect(document.querySelector('.calendar-widget-holidays')).not.toBeInTheDocument()
  })

  it('abre Ajustes directamente desde el dock y regresa al dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Widgets y páginas' })).toBeInTheDocument()

    const categoryHeadings = ['Apariencia', 'Widgets y páginas', 'Asistente', 'Administración móvil', 'Pantalla', 'Sonido', 'Notificaciones', 'Salvapantallas', 'Actualizaciones', 'Sistema']
    const categoryCards = categoryHeadings.map((name) => screen.getByRole('heading', { name }).closest('.settings-section'))
    expect(categoryCards.every(Boolean)).toBe(true)
    expect(new Set(categoryCards).size).toBe(categoryHeadings.length)
    expect(document.querySelector('.settings-compact-grid')?.querySelectorAll(':scope > .settings-section')).toHaveLength(4)

    const readResponsesToggle = screen.getByRole('switch', { name: /Leer respuestas automáticamente/ })
    const mobileAdminToggle = screen.getByRole('switch', { name: /Permitir administración desde otros dispositivos/ })
    expect(readResponsesToggle).toHaveClass('settings-row', 'toggle-row')
    expect(mobileAdminToggle).toHaveClass('settings-row', 'toggle-row')
    expect(readResponsesToggle.querySelector('.toggle')).toBeInTheDocument()
    expect(mobileAdminToggle.querySelector('.toggle')).toBeInTheDocument()
    expect(screen.getByText('Permisos de Android')).toBeInTheDocument()

    const rotationToggle = screen.getByRole('switch', { name: /Rotación automática/ })
    expect(rotationToggle).toHaveAttribute('aria-checked', 'true')
    await user.click(rotationToggle)
    expect(rotationToggle).toHaveAttribute('aria-checked', 'false')

    const nightModeToggle = screen.getByRole('switch', { name: /Modo nocturno/ })
    const nightModeSettings = document.querySelector('.night-mode-settings')
    expect(nightModeSettings).toHaveClass('is-enabled')
    await user.click(nightModeToggle)
    expect(nightModeSettings).not.toHaveClass('is-enabled')

    await user.click(screen.getByRole('radio', { name: /1\. Cálido/ }))
    expect(document.querySelector('.tablet-shell')).toHaveAttribute('data-theme', 'warm')

    await user.click(screen.getByRole('radio', { name: /2\. AMOLED/ }))
    expect(document.querySelector('.tablet-shell')).toHaveAttribute('data-theme', 'amoled')

    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }))
    expect(screen.getByText('Buenos días, Pablo')).toBeInTheDocument()
  })

  it('cambia el idioma desde Ajustes y conserva la selección', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Idioma/ }), 'en')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible())
    expect(screen.getByRole('button', { name: 'Back to home' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Dashboard pages' })).toBeVisible()
    expect(document.documentElement.lang).toBe('en')
    await waitFor(() => expect(loadDashboardState().preferences.language).toBe('en'))
  })

  it('permite activar widgets y páginas de forma independiente', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))

    const calendarWidget = screen.getByRole('switch', { name: /Widget Calendario/ })
    const calendarPage = screen.getByRole('switch', { name: /Página Calendario/ })
    const assistantWidget = screen.getByRole('switch', { name: /Widget Asistente/ })
    expect(calendarWidget.closest('.dashboard-visibility-row')).toBe(calendarPage.closest('.dashboard-visibility-row'))
    expect(calendarWidget).toHaveAttribute('aria-checked', 'true')
    expect(calendarPage).toHaveAttribute('aria-checked', 'true')
    expect(assistantWidget).toHaveAttribute('aria-checked', 'false')

    await user.click(calendarWidget)
    await user.click(assistantWidget)
    expect(calendarWidget).toHaveAttribute('aria-checked', 'false')
    expect(calendarPage).toHaveAttribute('aria-checked', 'true')
    expect(assistantWidget).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }))
    expect(document.querySelector('.calendar-widget')).not.toBeInTheDocument()
    expect(document.querySelector('.assistant-widget')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ir a Calendario' })).toBeInTheDocument()
  })

  it('permite elegir el diseño, los nombres y la posición del paginador', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))
    await user.selectOptions(screen.getByLabelText('Diseño del paginador'), 'segmented')
    await user.selectOptions(screen.getByLabelText('Posición del dock'), 'left')
    await user.click(screen.getByRole('switch', { name: /Mostrar nombre de la página/ }))
    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }))

    const paginator = screen.getByRole('navigation', { name: 'Páginas del dashboard' })
    expect(paginator).toHaveClass('page-indicators--segmented', 'is-position-left', 'show-labels')
    expect(paginator).toContainElement(screen.getByRole('button', { name: 'Ir a Ajustes' }))
    expect(document.querySelector('.tablet-shell')).toHaveClass('page-nav-style-segmented', 'page-nav-position-left', 'page-nav-has-labels')
    expect(screen.getByRole('button', { name: 'Ir a Calendario' })).toHaveTextContent('Calendario')
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('pablo-tablet.dashboard.v17')!)
      expect(stored.preferences).toMatchObject({
        pageNavigationStyle: 'segmented',
        pageNavigationPosition: 'left',
        showPageNavigationLabels: true,
      })
    })
  })

  it('desliza el indicador entre páginas adyacentes y salta al navegar lejos', () => {
    render(<App />)
    const paginator = screen.getByRole('navigation', { name: 'Páginas del dashboard' })
    expect(paginator.querySelector('.page-indicator-glider')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    expect(paginator).toHaveClass('is-direct-transition')

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Reloj' }))
    expect(paginator).toHaveClass('is-adjacent-transition')

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Galería' }))
    expect(paginator).toHaveClass('is-direct-transition')
  })

  it('mantiene el paginador visible en Ajustes y abre la página elegida', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))
    expect(screen.getByRole('navigation', { name: 'Páginas del dashboard' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    expect(screen.queryByRole('heading', { name: 'Ajustes' })).not.toBeInTheDocument()
    expect(screen.getByText('Tu agenda', { selector: '.eyebrow' })).toBeVisible()
  })

  it('incluye Ajustes en el recorrido por deslizamiento', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Galería' }))
    const shell = document.querySelector('.tablet-shell')!

    fireEvent.touchStart(shell, { changedTouches: [{ clientX: 500, clientY: 200 }] })
    fireEvent.touchEnd(shell, { changedTouches: [{ clientX: 350, clientY: 205 }] })
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeVisible()

    fireEvent.touchStart(shell, { changedTouches: [{ clientX: 350, clientY: 200 }] })
    fireEvent.touchEnd(shell, { changedTouches: [{ clientX: 500, clientY: 205 }] })
    expect(screen.getByRole('heading', { name: 'Mis fotos' })).toBeVisible()
  })

  it('crea y persiste una nota desde el flujo de navegación', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Notas' }))
    expect(screen.getByRole('heading', { name: 'Mis notas' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nueva nota' }))
    await user.click(screen.getByRole('button', { name: /^Texto/ }))
    const title = screen.getByRole('textbox', { name: 'Título de la nota' })
    await user.clear(title)
    await user.type(title, 'Lista de compra')
    await user.type(screen.getByRole('textbox', { name: 'Contenido de la nota' }), 'Pan y leche')

    expect(screen.getByDisplayValue('Lista de compra')).toBeInTheDocument()
    await waitFor(() => {
      const stored = window.localStorage.getItem('pablo-tablet.dashboard.v17')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!).notes[0]).toMatchObject({ title: 'Lista de compra', content: 'Pan y leche' })
    })
  })

  it('crea, reordena y marca elementos en una nota de tipo Lista', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Notas' }))
    await user.click(screen.getByRole('button', { name: 'Nueva nota' }))
    await user.click(screen.getByRole('button', { name: /^Lista/ }))
    expect(screen.getByText('Lista', { selector: '.note-format-badge' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Añadir elemento' }))
    await user.type(screen.getByRole('textbox', { name: 'Elemento de lista 1' }), 'Primero')
    await user.click(screen.getByRole('button', { name: 'Añadir elemento' }))
    await user.type(screen.getByRole('textbox', { name: 'Elemento de lista 2' }), 'Segundo')
    expect(screen.queryByRole('button', { name: /Subir elemento/ })).not.toBeInTheDocument()
    const firstRow = screen.getByRole('textbox', { name: 'Elemento de lista 1' }).closest('.note-list-row')!
    const secondRow = screen.getByRole('textbox', { name: 'Elemento de lista 2' }).closest('.note-list-row')!
    const rowRect = (top: number): DOMRect => ({ x: 0, y: top, top, right: 500, bottom: top + 48, left: 0, width: 500, height: 48, toJSON: () => ({}) })
    vi.spyOn(firstRow, 'getBoundingClientRect').mockImplementation(() => rowRect(0))
    vi.spyOn(secondRow, 'getBoundingClientRect').mockImplementation(() => rowRect(54 + Number.parseFloat((secondRow as HTMLElement).style.getPropertyValue('--note-drag-y') || '0')))
    const originalElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => firstRow) })
    const reorderHandle = screen.getByRole('button', { name: 'Mover elemento 2' })
    fireEvent.pointerDown(reorderHandle, { pointerId: 7, clientX: 20, clientY: 78 })
    expect(reorderHandle.closest('.note-list-row')).toHaveClass('is-dragging')
    expect(reorderHandle.closest('.note-list-row')).toHaveStyle({ '--note-drag-y': '0px' })
    fireEvent.pointerMove(reorderHandle, { pointerId: 7, clientX: 20, clientY: 50 })
    expect(reorderHandle.closest('.note-list-row')).toHaveClass('is-dragging')
    expect(screen.getByRole('textbox', { name: 'Elemento de lista 1' })).toHaveValue('Primero')
    fireEvent.pointerMove(reorderHandle, { pointerId: 7, clientX: 20, clientY: 15 })
    expect(screen.getByRole('textbox', { name: 'Elemento de lista 1' })).toHaveValue('Primero')
    expect(firstRow).toHaveClass('is-drop-before')
    expect(firstRow.querySelector('.note-list-drop-indicator')).toHaveTextContent('Soltar aquí')
    fireEvent.pointerUp(reorderHandle, { pointerId: 7, clientX: 20, clientY: 15 })
    expect(reorderHandle.closest('.note-list-row')).not.toHaveClass('is-dragging')
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: originalElementFromPoint })
    expect(screen.getByRole('textbox', { name: 'Elemento de lista 1' })).toHaveValue('Segundo')

    await user.click(screen.getByRole('checkbox', { name: 'Marcar elemento 1' }))
    const completedToggle = screen.getByRole('button', { name: '1 elemento marcado' })
    expect(completedToggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(completedToggle)
    expect(screen.getByRole('checkbox', { name: 'Desmarcar elemento 1' })).toBeVisible()

    await waitFor(() => {
      const stored = window.localStorage.getItem('pablo-tablet.dashboard.v17')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!).notes[0]).toMatchObject({ type: 'list', content: '- [x] Segundo\n- [ ] Primero' })
    })
  })

  it('activa la selección múltiple al mantener pulsada una foto', async () => {
    vi.useFakeTimers()
    const state = loadDashboardState()
    state.galleryPhotos = [
      { id: 'foto-1', name: 'Primera.jpg', uri: 'file:///gallery/primera.jpg', createdAt: '2026-10-04T10:00:00.000Z', deletedAt: null },
      { id: 'foto-2', name: 'Segunda.jpg', uri: 'file:///gallery/segunda.jpg', createdAt: '2026-10-04T10:01:00.000Z', deletedAt: null },
      { id: 'foto-3', name: 'Papelera.jpg', uri: 'file:///gallery/papelera.jpg', createdAt: '2026-10-04T10:02:00.000Z', deletedAt: '2026-10-04T10:03:00.000Z' },
    ]
    window.localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Ir a Galería' }))
    const firstPhoto = screen.getByRole('button', { name: 'Abrir Primera.jpg' })
    fireEvent.pointerDown(firstPhoto, { button: 0, pointerId: 1, clientX: 20, clientY: 20 })
    await act(async () => vi.advanceTimersByTime(550))

    expect(screen.getByRole('heading', { name: 'Seleccionar fotos' })).toBeInTheDocument()
    expect(screen.getByText('1 seleccionada')).toBeInTheDocument()
    fireEvent.pointerUp(firstPhoto, { pointerId: 1 })
    fireEvent.click(firstPhoto)
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Segunda.jpg' }))
    expect(screen.getByText('2 seleccionadas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mover todas a papelera' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('heading', { name: 'Mis fotos' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }))
    expect(screen.getByText('0 seleccionadas')).toBeInTheDocument()
    const firstPhotoImage = screen.getByRole('img', { name: 'Primera.jpg' })
    expect(firstPhotoImage).toHaveAttribute('draggable', 'false')
    fireEvent.click(firstPhotoImage)
    expect(screen.getByText('1 seleccionada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))
    expect(screen.getByText('2 seleccionadas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mover todas a papelera' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    fireEvent.click(screen.getByRole('button', { name: 'Papelera · 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }))
    expect(screen.getByRole('button', { name: 'Restaurar todas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar todas definitivamente' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  })
})
