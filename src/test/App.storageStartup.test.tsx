import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { loadDashboardState } from '../dashboardState'

const storage = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }))
const nativeEffects = vi.hoisted(() => ({ language: vi.fn(async () => {}), deletePhoto: vi.fn(async () => {}) }))
vi.mock('../nativeLocale', () => ({ setNativeAppLanguage: nativeEffects.language }))
vi.mock('../gallery', () => ({
  deleteGalleryPhotoFile: nativeEffects.deletePhoto, galleryPhotoSource: (uri: string) => uri,
  pickGalleryPhotos: async () => [],
}))
vi.mock('../appStorage', () => ({
  DASHBOARD_STORAGE_KEY: 'dashboard-state', WEATHER_STORAGE_KEY: 'pablo-tablet.weather-cache.v1',
  usesNativeAppStorage: () => true, readAppStorageRecord: storage.read,
  writeAppStorage: storage.write, readAppStorage: async () => null,
}))

describe('edición durante la recuperación del almacenamiento Android', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    nativeEffects.language.mockClear()
    nativeEffects.deletePhoto.mockClear()
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

  it('conserva las notas y la configuración nativa tras editar y volver a arrancar', async () => {
    const restored = loadDashboardState(JSON.stringify({
      notes: [{ id: 'saved', title: 'Nota original', content: 'Contenido guardado' }],
      preferences: { brightness: 17, mediaVolume: 9, autoRotate: false, nightModeEnabled: false, themeId: 'glass' },
    }))
    let persisted = JSON.stringify(restored)
    let revision = 1
    storage.read.mockImplementation(async () => ({ value: persisted, updatedAt: revision }))
    storage.write.mockImplementation(async (_key: string, value: string) => { persisted = value; return { updatedAt: ++revision } })
    const first = render(<App />)
    await act(async () => {})
    expect(storage.write).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Notas' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Contenido de la nota' }), { target: { value: 'Contenido actualizado' } })
    await act(async () => {})
    expect(loadDashboardState(persisted).preferences).toMatchObject(restored.preferences)
    first.unmount()
    render(<App />)
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Notas' }))
    expect(screen.getByRole('textbox', { name: 'Contenido de la nota' })).toHaveValue('Contenido actualizado')
    expect(loadDashboardState(persisted).preferences).toMatchObject(restored.preferences)
    expect(loadDashboardState(persisted).notes).toHaveLength(1)
  })

  it('espera a los datos nativos antes de cambiar el idioma o purgar fotos del respaldo antiguo', async () => {
    const photo = { id: 'kept-photo', uri: 'file:///audit-only.jpg', name: 'Foto conservada', createdAt: '', deletedAt: new Date(Date.now() - 70 * 86_400_000).toISOString() }
    const legacy = loadDashboardState(JSON.stringify({ galleryPhotos: [photo] }))
    window.localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(legacy))
    const restored = loadDashboardState(JSON.stringify({ galleryPhotos: [{ ...photo, deletedAt: null }], preferences: { language: 'en' } }))
    let finish!: (value: { value: string; updatedAt: number }) => void
    storage.read.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<App />)
    expect(nativeEffects.language).not.toHaveBeenCalled()
    expect(nativeEffects.deletePhoto).not.toHaveBeenCalled()
    expect(storage.write).not.toHaveBeenCalled()
    await act(async () => { finish({ value: JSON.stringify(restored), updatedAt: 1 }) })
    expect(nativeEffects.language).toHaveBeenCalledWith('en')
    expect(nativeEffects.deletePhoto).not.toHaveBeenCalled()
    expect(storage.write).not.toHaveBeenCalled()
  })

  it('no escribe una recuperación pendiente después de desmontar la aplicación', async () => {
    let finish!: (value: { value: null; updatedAt: null }) => void
    storage.read.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const view = render(<App />)
    view.unmount()
    await act(async () => { finish({ value: null, updatedAt: null }) })
    expect(storage.write).not.toHaveBeenCalled()
  })

  it('no solapa lecturas mientras sigue pendiente la recuperación inicial', async () => {
    storage.read.mockReturnValue(new Promise(() => {}))
    render(<App />)
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(storage.read).toHaveBeenCalledTimes(1)
    expect(storage.write).not.toHaveBeenCalled()
  })
})
