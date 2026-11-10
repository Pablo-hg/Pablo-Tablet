import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { loadDashboardState } from '../dashboardState'

const storageKey = 'pablo-tablet.dashboard.v17'
const touch = (clientX: number, clientY: number, identifier = 1) => ({ clientX, clientY, identifier })

describe('protección de gestos de navegación', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  })

  it('no cambia de página al desplazar primero en vertical y terminar en horizontal', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    const surface = screen.getByText('Tu agenda')
    fireEvent.touchStart(surface, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchMove(surface, { touches: [touch(500, 250)], changedTouches: [touch(500, 250)] })
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(350, 255)] })
    expect(screen.getByText('Tu agenda')).toBeVisible()
  })

  it('cancela el deslizamiento cuando interviene un segundo dedo', () => {
    render(<App />)
    const surface = screen.getByText('Buenos días, Pablo')
    fireEvent.touchStart(surface, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchStart(surface, { touches: [touch(500, 200), touch(520, 220, 2)], changedTouches: [touch(520, 220, 2)] })
    fireEvent.touchEnd(surface, { touches: [touch(500, 200)], changedTouches: [touch(350, 220, 2)] })
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(350, 200)] })
    expect(screen.getByText('Buenos días, Pablo')).toBeVisible()
  })

  it('no completa el gesto con un identificador de contacto diferente', () => {
    render(<App />)
    const surface = screen.getByText('Buenos días, Pablo')
    fireEvent.touchStart(surface, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(350, 200, 2)] })
    expect(screen.getByText('Buenos días, Pablo')).toBeVisible()
  })

  it('permite seleccionar texto en una nota sin cambiar de página ni quitarle el foco', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Notas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nueva nota' }))
    fireEvent.click(screen.getByRole('button', { name: /^Texto/ }))
    const editor = document.querySelector<HTMLTextAreaElement>('.note-editor textarea')!
    editor.focus()
    fireEvent.touchStart(editor, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchEnd(editor, { touches: [], changedTouches: [touch(350, 200)] })
    expect(editor).toHaveFocus()
    expect(editor).toBeVisible()
  })

  it('no navega con el botón secundario del ratón', () => {
    render(<App />)
    const surface = screen.getByText('Buenos días, Pablo')
    fireEvent.pointerDown(surface, { pointerType: 'mouse', button: 2, isPrimary: true, pointerId: 1, clientX: 500, clientY: 200 })
    fireEvent.pointerUp(surface, { pointerType: 'mouse', button: 2, isPrimary: true, pointerId: 1, clientX: 350, clientY: 200 })
    expect(screen.getByText('Buenos días, Pablo')).toBeVisible()
  })

  it('protege los botones del mes y mantiene el deslizamiento desde los días', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    const previousMonth = screen.getByRole('button', { name: 'Mes anterior' })
    fireEvent.touchStart(previousMonth, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchEnd(previousMonth, { touches: [], changedTouches: [touch(350, 200)] })
    expect(screen.getByText('Tu agenda')).toBeVisible()
    const day = document.querySelector('.calendar-month-grid > button')!
    fireEvent.touchStart(day, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchEnd(day, { touches: [], changedTouches: [touch(350, 200)] })
    expect(screen.getByText('Reloj', { selector: '.welcome' })).toBeVisible()
  })

  it('mantiene la navegación al arrastrar con el botón principal del ratón', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    const surface = screen.getByText('Tu agenda')
    fireEvent.pointerDown(surface, { pointerType: 'mouse', isPrimary: true, button: 0, pointerId: 1, clientX: 500, clientY: 200 })
    fireEvent.pointerUp(surface, { pointerType: 'mouse', isPrimary: true, button: 0, pointerId: 1, clientX: 350, clientY: 200 })
    expect(screen.getByText('Reloj', { selector: '.welcome' })).toBeVisible()
  })

  it.each(['blur', 'resize'] as const)('descarta la navegación si ocurre %s durante el gesto', event => {
    render(<App />)
    const surface = screen.getByText('Buenos días, Pablo')
    fireEvent.touchStart(surface, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent(window, new Event(event))
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(350, 200)] })
    expect(screen.getByText('Buenos días, Pablo')).toBeVisible()
  })

  it.each([
    { delta: -150, destination: 'Ir a Inicio' },
    { delta: 150, destination: 'Ir a Galería' },
  ])('permite deslizar desde las tarjetas de Ajustes hacia $destination', ({ delta, destination }) => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))
    const surface = screen.getByRole('heading', { name: 'Apariencia' })
    fireEvent.touchStart(surface, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchEnd(surface, { touches: [], changedTouches: [touch(500 + delta, 205)] })
    expect(screen.getByRole('button', { name: destination })).toHaveAttribute('aria-current', 'page')
  })

  it('respeta los controles de Ajustes y su scroll vertical', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))
    const control = screen.getByRole('switch', { name: /Rotación automática/ })
    const checked = control.getAttribute('aria-checked')
    fireEvent.touchStart(control, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchEnd(control, { touches: [], changedTouches: [touch(350, 205)] })
    expect(control).toHaveAttribute('aria-checked', checked)
    const heading = screen.getByRole('heading', { name: 'Sonido' })
    fireEvent.touchStart(heading, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchMove(heading, { touches: [touch(500, 250)], changedTouches: [touch(500, 250)] })
    fireEvent.touchEnd(heading, { touches: [], changedTouches: [touch(350, 255)] })
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeVisible()
  })

  it.each(['done', 'escape'])('permite salir del editor ampliado de notas con %s', exit => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Notas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nueva nota' }))
    fireEvent.click(screen.getByRole('button', { name: /^Texto/ }))
    const editor = screen.getByRole('textbox', { name: 'Contenido de la nota' })
    const shell = document.querySelector('.tablet-shell')!
    fireEvent.change(editor, { target: { value: 'Texto que se conserva al terminar la edición.' } })
    act(() => editor.focus())
    expect(shell).toHaveClass('is-notes-keyboard-open')
    if (exit === 'done') fireEvent.click(screen.getByRole('button', { name: 'Terminar edición' }))
    else fireEvent.keyDown(editor, { key: 'Escape' })
    expect(shell).not.toHaveClass('is-notes-keyboard-open')
    expect(editor).not.toHaveFocus()
    expect(editor).toHaveValue('Texto que se conserva al terminar la edición.')
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Inicio' }))
    expect(screen.getByText('Buenos días, Pablo')).toBeVisible()
    expect(loadDashboardState().notes.some(note => note.content === 'Texto que se conserva al terminar la edición.')).toBe(true)
  })
})

describe('ampliación del editor de dibujo', () => {
  function openDrawing() {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Notas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nueva nota' }))
    fireEvent.click(screen.getByRole('button', { name: /^Dibujo/ }))
    return screen.getByRole('img', { name: 'Lienzo de dibujo de la nota' })
  }

  it('amplía y reduce conservando el lienzo, los trazos y la herramienta elegida', () => {
    const canvas = openDrawing()
    Object.defineProperties(canvas, {
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: vi.fn(() => false) },
      releasePointerCapture: { value: vi.fn() },
    })
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    const ink = screen.getByRole('button', { name: 'Color #7fa2ff' })
    fireEvent.click(ink)
    fireEvent.change(screen.getByRole('combobox', { name: 'Grosor' }), { target: { value: '12' } })
    fireEvent.pointerDown(canvas, { pointerId: 21, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(canvas, { pointerId: 21, clientX: 300, clientY: 200 })
    fireEvent.pointerUp(canvas, { pointerId: 21, clientX: 300, clientY: 200 })
    const savedDrawing = loadDashboardState().notes.find(note => note.type === 'drawing')!.drawing
    expect(savedDrawing).toEqual([{ color: '#7fa2ff', width: 12, points: [{ x: 100, y: 100 }, { x: 300, y: 200 }] }])
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar editor de dibujo' }))
    expect(screen.getByRole('button', { name: 'Reducir editor de dibujo' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.notes-page')).toHaveClass('is-drawing-expanded')
    expect(screen.getByRole('img', { name: 'Lienzo de dibujo de la nota' })).toBe(canvas)
    expect(ink).toHaveClass('is-active')
    expect(screen.getByRole('combobox', { name: 'Grosor' })).toHaveValue('12')
    fireEvent.click(screen.getByRole('button', { name: 'Reducir editor de dibujo' }))
    expect(document.querySelector('.notes-page')).not.toHaveClass('is-drawing-expanded')
    expect(canvas.querySelector('path')).toHaveAttribute('d', 'M 100 100 L 300 200')
    expect(loadDashboardState().notes.find(note => note.type === 'drawing')!.drawing).toEqual(savedDrawing)
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(canvas.querySelector('path')).not.toBeInTheDocument()
    expect(loadDashboardState().notes.find(note => note.type === 'drawing')!.drawing).toEqual([])
  })

  it('protege la vista ampliada frente a navegación accidental y permite salir con Escape', () => {
    openDrawing()
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar editor de dibujo' }))
    const page = document.querySelector('.notes-page')!
    fireEvent.touchStart(page, { touches: [touch(500, 200)], changedTouches: [touch(500, 200)] })
    fireEvent.touchEnd(page, { touches: [], changedTouches: [touch(350, 200)] })
    expect(screen.getByRole('button', { name: 'Ir a Notas' })).toHaveAttribute('aria-current', 'page')
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reducir editor de dibujo' }), { key: 'Escape' })
    expect(page).not.toHaveClass('is-drawing-expanded')
    expect(screen.getByRole('button', { name: 'Ampliar editor de dibujo' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('edición táctil de widgets', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const state = loadDashboardState()
    state.widgets = state.widgets.map(widget => ({ ...widget, visible: widget.id === 'clock', layouts: {
      landscape: { x: 0, y: 0, width: 1, height: 1 },
      portrait: { x: 0, y: 0, width: 1, height: 1 },
    } }))
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function editClock() {
    render(<App />)
    const widget = document.querySelector<HTMLElement>('[data-widget-id="clock"]')!
    const grid = document.querySelector<HTMLElement>('.dashboard-grid')!
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    vi.spyOn(widget, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.pointerDown(widget, { button: 0, isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 80, clientY: 80 })
    act(() => vi.advanceTimersByTime(1000))
    fireEvent.pointerUp(widget, { pointerId: 1, clientX: 80, clientY: 80 })
    expect(screen.getByRole('button', { name: 'Listo' })).toBeVisible()
    return widget
  }

  function savedLayout() {
    return loadDashboardState().widgets.find(widget => widget.id === 'clock')!.layouts.landscape
  }

  it.each(['pointerCancel', 'lostPointerCapture'] as const)('descarta el arrastre ante %s', event => {
    const widget = editClock()
    fireEvent.pointerDown(widget, { button: 0, isPrimary: true, pointerType: 'touch', pointerId: 2, clientX: 80, clientY: 80 })
    fireEvent.pointerMove(widget, { pointerId: 2, clientX: 310, clientY: 80 })
    fireEvent[event](widget, { pointerId: 2, clientX: 310, clientY: 80 })
    expect(widget).not.toHaveClass('is-dragging')
    expect(savedLayout()).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it.each(['pointerCancel', 'lostPointerCapture'] as const)('descarta el redimensionado ante %s', event => {
    const widget = editClock()
    const handle = screen.getByRole('button', { name: 'Ajustar borde derecho de Reloj' })
    fireEvent.pointerDown(handle, { button: 0, isPrimary: true, pointerType: 'touch', pointerId: 2, clientX: 200, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 430, clientY: 100 })
    expect(widget).toHaveAttribute('data-widget-size', '2x1')
    fireEvent[event](handle, { pointerId: 2, clientX: 430, clientY: 100 })
    expect(widget).toHaveAttribute('data-widget-size', '1x1')
    expect(savedLayout()).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('guarda el arrastre y el tamaño cuando se suelta el control normalmente', () => {
    const widget = editClock()
    fireEvent.pointerDown(widget, { button: 0, isPrimary: true, pointerType: 'touch', pointerId: 2, clientX: 80, clientY: 80 })
    fireEvent.pointerMove(widget, { pointerId: 2, clientX: 310, clientY: 80 })
    fireEvent.pointerUp(widget, { pointerId: 2, clientX: 310, clientY: 80 })
    expect(savedLayout()).toEqual({ x: 1, y: 0, width: 1, height: 1 })
    const handle = screen.getByRole('button', { name: 'Ajustar borde derecho de Reloj' })
    fireEvent.pointerDown(handle, { button: 0, isPrimary: true, pointerType: 'touch', pointerId: 3, clientX: 400, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 3, clientX: 630, clientY: 100 })
    fireEvent.pointerUp(handle, { pointerId: 3, clientX: 630, clientY: 100 })
    expect(savedLayout()).toEqual({ x: 1, y: 0, width: 2, height: 1 })
  })

  it.each(['blur', 'resize'] as const)('descarta la previsualización ante %s de la ventana', event => {
    const widget = editClock()
    fireEvent.pointerDown(widget, { button: 0, isPrimary: true, pointerType: 'touch', pointerId: 2, clientX: 80, clientY: 80 })
    fireEvent.pointerMove(widget, { pointerId: 2, clientX: 310, clientY: 80 })
    fireEvent(window, new Event(event))
    fireEvent.pointerUp(widget, { pointerId: 2, clientX: 310, clientY: 80 })
    expect(widget).not.toHaveClass('is-dragging')
    expect(savedLayout()).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('cancela la pulsación larga cuando el dedo se desplaza', () => {
    render(<App />)
    const widget = document.querySelector('[data-widget-id="clock"]')!
    fireEvent.pointerDown(widget, { button: 0, isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 80, clientY: 80 })
    fireEvent.pointerMove(widget, { pointerId: 1, clientX: 80, clientY: 110 })
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('button', { name: 'Listo' })).not.toBeInTheDocument()
    expect(widget).not.toHaveClass('is-holding')
  })

  it('traduce los controles de edición al inglés', async () => {
    const state = loadDashboardState()
    state.preferences.language = 'en'
    window.localStorage.setItem(storageKey, JSON.stringify(state))
    render(<App />)
    await act(async () => {})
    const widget = document.querySelector('[data-widget-id="clock"]')!
    fireEvent.pointerDown(widget, { button: 0, isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 80, clientY: 80 })
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByRole('button', { name: 'Done' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resize right edge of Clock' })).toBeVisible()
  })
})
