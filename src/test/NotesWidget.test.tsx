import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotesWidget } from '../components/NotesWidget'
import type { Note } from '../dashboardState'

const note = (id: string, patch: Partial<Note> = {}): Note => ({ id, title: `Nota ${id}`, content: `Contenido ${id}`, type: 'text', color: 'sun', pinned: true, archived: false, drawing: [], drawingPosition: 'above', drawingVisible: true, reminderAt: null, createdAt: '2026-10-29T00:00:00Z', updatedAt: '2026-10-29T00:00:00Z', ...patch })

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('widget adaptable de notas', () => {
  it('muestra más notas fijadas cuando crece el espacio, sin mezclar las archivadas o sin fijar', () => {
    let width = 800, height = 360
    let resize = () => {}
    const disconnect = vi.fn()
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height)
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect = disconnect })
    const notes = [...Array.from({ length: 18 }, (_, i) => note(String(i))), note('sin fijar', { pinned: false }), note('archivada', { archived: true })]
    const view = render(<NotesWidget notes={notes} onOpenNote={vi.fn()} renderDrawing={() => null} />)
    expect(view.container.querySelectorAll('[data-note-id]')).toHaveLength(16)
    expect(screen.queryByText('Nota sin fijar')).not.toBeInTheDocument()
    expect(screen.queryByText('Nota archivada')).not.toBeInTheDocument()
    width = 400; height = 200
    act(() => resize())
    expect(view.container.querySelectorAll('[data-note-id]')).toHaveLength(4)
    height = 540
    act(() => resize())
    expect(view.container.querySelectorAll('[data-note-id]')).toHaveLength(12)
    view.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('conserva todos los elementos de la lista y sus estados, y abre la nota elegida', () => {
    const onOpenNote = vi.fn()
    render(<NotesWidget notes={[note('lista', { type: 'list', content: '- [ ] Leche\n- [x] Pan\n- [X] Café\n- [ ] Fruta' })]} onOpenNote={onOpenNote} renderDrawing={() => null} />)
    for (const item of ['Leche', 'Pan', 'Café', 'Fruta']) expect(screen.getByText(item)).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Marcado' })).toHaveLength(2)
    expect(screen.getAllByRole('img', { name: 'Pendiente' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Nota lista' }))
    expect(onOpenNote).toHaveBeenCalledWith('lista')
  })

  it('usa las notas recientes si no hay fijadas y conserva el estado vacío', () => {
    const view = render(<NotesWidget notes={[note('reciente', { pinned: false })]} onOpenNote={vi.fn()} renderDrawing={() => null} />)
    expect(screen.getByText('Nota reciente')).toBeInTheDocument()
    view.rerender(<NotesWidget notes={[]} onOpenNote={vi.fn()} renderDrawing={() => null} />)
    expect(view.container.querySelector('[data-note-id]')).not.toBeInTheDocument()
    expect(screen.getByText('Toca aquí para crear una nota de texto, una lista o un dibujo.')).toBeInTheDocument()
  })
})
