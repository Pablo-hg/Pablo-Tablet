import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { loadDashboardState } from '../dashboardState'

const storage = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }))
vi.mock('../appStorage', () => ({
  DASHBOARD_STORAGE_KEY: 'dashboard-state', WEATHER_STORAGE_KEY: 'pablo-tablet.weather-cache.v1',
  usesNativeAppStorage: () => true, readAppStorageRecord: storage.read,
  writeAppStorage: storage.write, readAppStorage: async () => null,
}))

describe('edición durante la recuperación del almacenamiento Android', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    storage.read.mockReset()
    storage.write.mockReset().mockResolvedValue({ updatedAt: 2 })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.useRealTimers())

  it('espera a recuperar las notas y permite guardarlas después sin perder las anteriores', async () => {
    const restored = loadDashboardState(JSON.stringify({ notes: [{ id: 'saved', title: 'Nota anterior', content: 'Conservar' }] }))
    let finish!: (value: { value: string; updatedAt: number }) => void
    storage.read.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Recuperando los datos guardados…')
    expect(screen.queryByRole('button', { name: 'Ir a Notas' })).not.toBeInTheDocument()
    expect(storage.write).not.toHaveBeenCalled()

    await act(async () => { finish({ value: JSON.stringify(restored), updatedAt: 1 }) })
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Notas' }))
    expect(screen.getByRole('textbox', { name: 'Título de la nota' })).toHaveValue('Nota anterior')
    fireEvent.click(screen.getByRole('button', { name: 'Crear una nota' }))
    fireEvent.click(screen.getByRole('button', { name: /^Texto/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Título de la nota' }), { target: { value: 'Nota nueva' } })
    const lastWrite = storage.write.mock.calls.at(-1)!
    const saved = loadDashboardState(lastWrite[1])
    expect(saved.notes.map((note) => note.title)).toEqual(expect.arrayContaining(['Nota anterior', 'Nota nueva']))
  })

  it('reintenta una lectura fallida y desbloquea también un almacenamiento vacío', async () => {
    storage.read.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValue({ value: null, updatedAt: null })
    render(<App />)
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(screen.queryByRole('button', { name: 'Ir a Notas' })).not.toBeInTheDocument()
    expect(storage.write).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(screen.getByRole('button', { name: 'Ir a Notas' })).toBeInTheDocument()
    expect(storage.write).toHaveBeenCalledWith('dashboard-state', expect.any(String))
  })

  it('no solapa lecturas mientras sigue pendiente la recuperación inicial', async () => {
    storage.read.mockReturnValue(new Promise(() => {}))
    render(<App />)
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(storage.read).toHaveBeenCalledTimes(1)
    expect(storage.write).not.toHaveBeenCalled()
  })
})
