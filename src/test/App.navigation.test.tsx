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
    await user.click(screen.getByRole('button', { name: 'Ir a Calendario' }))
    expect(screen.getByText('Tu agenda')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ir a Tiempo' }))
    expect(screen.getByText('Añade tu primera ubicación')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ir a Inicio' }))
    expect(screen.getByText('Buenos días, Pablo')).toBeInTheDocument()
  })

  it('abre Ajustes desde la navegación contextual y regresa al dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Mostrar navegación' }))
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Páginas' })).toBeInTheDocument()

    const rotationToggle = screen.getByRole('switch', { name: /Rotación automática/ })
    expect(rotationToggle).toHaveAttribute('aria-checked', 'true')
    await user.click(rotationToggle)
    expect(rotationToggle).toHaveAttribute('aria-checked', 'false')

    await user.click(screen.getByRole('radio', { name: /1\. Cálido/ }))
    expect(document.querySelector('.tablet-shell')).toHaveAttribute('data-theme', 'warm')

    await user.click(screen.getByRole('radio', { name: /2\. AMOLED/ }))
    expect(document.querySelector('.tablet-shell')).toHaveAttribute('data-theme', 'amoled')

    await user.click(screen.getByRole('button', { name: 'Volver al inicio' }))
    expect(screen.getByText('Buenos días, Pablo')).toBeInTheDocument()
  })

  it('crea y persiste una nota desde el flujo de navegación', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Ir a Notas' }))
    expect(screen.getByRole('heading', { name: 'Mis notas' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nueva nota' }))
    await user.click(screen.getByRole('button', { name: /Texto \/ lista/ }))
    const title = screen.getByRole('textbox', { name: 'Título de la nota' })
    await user.clear(title)
    await user.type(title, 'Lista de compra')
    await user.type(screen.getByRole('textbox', { name: 'Contenido de texto o lista de la nota' }), 'Pan y leche')

    expect(screen.getByDisplayValue('Lista de compra')).toBeInTheDocument()
    await waitFor(() => {
      const stored = window.localStorage.getItem('pablo-tablet.dashboard.v17')
      expect(stored).not.toBeNull()
      expect(JSON.parse(stored!).notes[0]).toMatchObject({ title: 'Lista de compra', content: 'Pan y leche' })
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
