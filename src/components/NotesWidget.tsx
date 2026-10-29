import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronRight, FileText, Pin } from 'lucide-react'
import type { Note, NoteDrawingStroke } from '../dashboardState'
import { parseNoteList } from '../noteList'
import { tx } from '../i18n'

export function NotesWidget({ notes, onOpenNote, renderDrawing }: {
  notes: Note[]
  onOpenNote: (noteId?: string) => void
  renderDrawing: (drawing: NoteDrawingStroke[]) => ReactNode
}) {
  const candidates = useMemo(() => {
    const active = notes.filter(note => !note.archived)
    const pinned = active.filter(note => note.pinned)
    return [...(pinned.length ? pinned : active)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
  }, [notes])
  const gridRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ columns: 1, capacity: 1 })
  const richContent = candidates.some(note => note.type !== 'text')

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const measure = () => {
      const style = getComputedStyle(grid)
      const fontSize = parseFloat(style.fontSize) || 16
      const gap = parseFloat(style.gap) || 8
      const columns = Math.max(1, Math.min(candidates.length, Math.floor((grid.clientWidth + gap) / (11 * fontSize + gap))))
      const rows = Math.max(1, Math.floor((grid.clientHeight + gap) / ((richContent ? 7 : 4.75) * fontSize + gap)))
      const capacity = columns * rows
      setLayout(current => current.columns === columns && current.capacity === capacity ? current : { columns, capacity })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [candidates.length, richContent])

  const visible = candidates.slice(0, layout.capacity)
  const rows = Math.max(1, Math.ceil(visible.length / layout.columns))
  return <article className="note-card responsive-note-widget adaptive-note-widget widget-card">
    <button type="button" className="notes-widget-open" onClick={() => onOpenNote()}>
      <span className="heading-icon coral"><FileText size={18} /></span>
      <span><strong>{tx('Notas')}</strong><small>{tx(candidates.some(note => note.pinned) ? 'Notas fijadas: {{count}}' : 'Notas guardadas: {{count}}', { count: candidates.length })}</small></span>
      <ChevronRight size={16} />
    </button>
    {visible.length ? <div ref={gridRef} className="notes-widget-grid" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
      {visible.map(note => <article key={note.id} className={`notes-widget-preview note-${note.color}`} data-note-id={note.id}>
        <button type="button" className="notes-widget-note-title" aria-label={tx('Abrir {{name}}', { name: note.title || tx('Sin título') })} onClick={() => onOpenNote(note.id)}><strong>{note.title || tx('Sin título')}</strong>{note.pinned ? <Pin size={12} /> : null}</button>
        <div className={`notes-widget-note-body ${note.type === 'drawing' ? 'is-drawing' : ''}`} tabIndex={0} aria-label={tx('Contenido de la nota')} data-swipe-block>
          {note.type === 'drawing' ? renderDrawing(note.drawing) : note.type === 'list' ? <ul className="notes-widget-checklist">{parseNoteList(note.content).map((item, index) => <li key={index} className={item.checked ? 'is-checked' : ''}><span className="notes-widget-check" role="img" aria-label={tx(item.checked ? 'Marcado' : 'Pendiente')}>{item.checked ? <Check size={11} aria-hidden="true" /> : null}</span><span>{item.text}</span></li>)}</ul> : note.content || tx('Sin contenido')}
        </div>
      </article>)}
    </div> : <button type="button" className="notes-widget-empty" onClick={() => onOpenNote()}>{tx('Toca aquí para crear una nota de texto, una lista o un dibujo.')}</button>}
    {visible.length ? <button type="button" className="notes-widget-footer" onClick={() => onOpenNote()}><span>{tx('Notas: {{shown}} de {{count}}', { shown: visible.length, count: candidates.length })}</span><ChevronRight size={14} /></button> : null}
  </article>
}
