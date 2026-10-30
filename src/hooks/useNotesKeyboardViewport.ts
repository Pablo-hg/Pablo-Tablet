import { useEffect, useRef } from 'react'

// Android WebView puede conservar 100svh cuando aparece el teclado; visualViewport
// refleja la altura realmente visible y permite mantener el cursor a la vista.
export function visibleNotesHeight(layoutHeight: number, visualHeight?: number): number {
  const height = typeof visualHeight === 'number' && Number.isFinite(visualHeight) && visualHeight > 0
    ? Math.min(layoutHeight, visualHeight)
    : layoutHeight
  return Math.max(1, Math.floor(height))
}

export function useNotesKeyboardViewport() {
  const notesPageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const notesPage = notesPageRef.current
    const shell = notesPage?.closest<HTMLElement>('.tablet-shell')
    if (!notesPage || !shell) return

    const viewport = window.visualViewport
    let pendingUpdate: number | undefined

    const update = () => {
      const focused = document.activeElement
      const editingNote = focused instanceof HTMLElement
        && notesPage.contains(focused)
        && focused.matches('textarea, input:not([type="checkbox"]):not([type="radio"]), [contenteditable="true"]')
      const nativeOrientation = window.screen.orientation?.type
      const landscape = nativeOrientation
        ? nativeOrientation.startsWith('landscape')
        : window.innerWidth > window.innerHeight

      shell.style.setProperty('--notes-visible-height', String(visibleNotesHeight(window.innerHeight, viewport?.height)) + 'px')
      shell.classList.toggle('is-notes-keyboard-open', editingNote && landscape)
    }

    const scheduleUpdate = () => {
      update()
      window.clearTimeout(pendingUpdate)
      // El IME puede ajustar visualViewport después de focusin.
      pendingUpdate = window.setTimeout(update, 120)
    }

    notesPage.addEventListener('focusin', scheduleUpdate)
    notesPage.addEventListener('focusout', scheduleUpdate)
    window.addEventListener('resize', scheduleUpdate)
    viewport?.addEventListener('resize', scheduleUpdate)
    viewport?.addEventListener('scroll', scheduleUpdate)
    scheduleUpdate()

    return () => {
      window.clearTimeout(pendingUpdate)
      notesPage.removeEventListener('focusin', scheduleUpdate)
      notesPage.removeEventListener('focusout', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      viewport?.removeEventListener('resize', scheduleUpdate)
      viewport?.removeEventListener('scroll', scheduleUpdate)
      shell.classList.remove('is-notes-keyboard-open')
      shell.style.removeProperty('--notes-visible-height')
    }
  }, [])

  return notesPageRef
}
