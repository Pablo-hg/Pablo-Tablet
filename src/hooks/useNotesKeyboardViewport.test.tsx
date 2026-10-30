// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useNotesKeyboardViewport, visibleNotesHeight } from './useNotesKeyboardViewport'

function NotesFixture() {
  const ref = useNotesKeyboardViewport()
  return <main className="tablet-shell"><div className="notes-page" ref={ref}><textarea aria-label="Contenido" /></div></main>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('visualización del editor de notas con teclado', () => {
  it('usa la altura visual de WebView y nunca supera el viewport disponible', () => {
    expect(visibleNotesHeight(850, 370)).toBe(370)
    expect(visibleNotesHeight(850, 900)).toBe(850)
    expect(visibleNotesHeight(850, undefined)).toBe(850)
  })

  it('compacta solo la pantalla de notas al editar en horizontal y la restaura al salir', () => {
    vi.stubGlobal('innerWidth', 1200)
    vi.stubGlobal('innerHeight', 800)
    const resizeHandlers = new Set<EventListenerOrEventListenerObject>()
    const viewport = {
      height: 370,
      addEventListener: (_name: string, handler: EventListenerOrEventListenerObject) => { resizeHandlers.add(handler) },
      removeEventListener: (_name: string, handler: EventListenerOrEventListenerObject) => { resizeHandlers.delete(handler) },
    }
    vi.stubGlobal('visualViewport', viewport)

    const { container, unmount } = render(<NotesFixture />)
    const shell = container.querySelector<HTMLElement>('.tablet-shell')!
    const editor = container.querySelector<HTMLTextAreaElement>('textarea')!
    editor.focus()
    expect(shell.classList.contains('is-notes-keyboard-open')).toBe(true)
    expect(shell.style.getPropertyValue('--notes-visible-height')).toBe('370px')

    editor.blur()
    expect(shell.classList.contains('is-notes-keyboard-open')).toBe(false)
    unmount()
    expect(shell.style.getPropertyValue('--notes-visible-height')).toBe('')
  })

  it('no activa el modo compacto en orientación vertical', () => {
    vi.stubGlobal('innerWidth', 600)
    vi.stubGlobal('innerHeight', 900)
    vi.stubGlobal('visualViewport', undefined)
    const { container } = render(<NotesFixture />)
    const editor = container.querySelector<HTMLTextAreaElement>('textarea')!
    editor.focus()
    expect(container.querySelector('.tablet-shell')!.classList.contains('is-notes-keyboard-open')).toBe(false)
  })
})
