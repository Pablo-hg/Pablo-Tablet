import { afterEach, describe, expect, it } from 'vitest'
import { checkForAppUpdate, releaseNotesForInstalledVersion, releaseNotesForUpdate, type AppUpdateInfo } from '../appUpdater'

afterEach(() => {
  window.history.replaceState({}, '', '/')
  window.localStorage.clear()
})

function update(overrides: Partial<AppUpdateInfo> = {}): AppUpdateInfo {
  return {
    currentVersionName: '0.4.0',
    currentVersionCode: 1040,
    releaseAvailable: true,
    updateAvailable: true,
    latestVersionName: '0.4.2',
    releaseName: 'Pablo Tablet 0.4.2',
    releaseNotes: 'Solo la última versión.',
    releaseHistory: [
      { versionName: '0.3.7', releaseName: 'Pablo Tablet 0.3.7', releaseNotes: 'Anterior.' },
      { versionName: '0.4.2', releaseName: 'Pablo Tablet 0.4.2', releaseNotes: '## Novedades\n\nSegunda.' },
      { versionName: '0.4.1', releaseName: 'Pablo Tablet 0.4.1', releaseNotes: '## Novedades\n\nPrimera.' },
    ],
    publishedAt: '2026-10-19T22:30:00.000Z',
    downloadUrl: 'https://github.com/Pablo-hg/Pablo-Tablet/releases/download/v0.4.2/Pablo-Tablet-0.4.2.apk',
    sha256: 'a'.repeat(64),
    assetName: 'Pablo-Tablet-0.4.2.apk',
    assetSize: 42_000_000,
    ...overrides,
  }
}

describe('novedades acumuladas del actualizador', () => {
  it('muestra en orden todas las versiones saltadas', () => {
    expect(releaseNotesForUpdate(update())).toBe(
      'Versión 0.4.1\nPrimera.\n\nVersión 0.4.2\nSegunda.',
    )
  })

  it('excluye las versiones que ya están instaladas', () => {
    expect(releaseNotesForUpdate(update({ currentVersionName: '0.4.1' }))).toBe(
      'Versión 0.4.2\nSegunda.',
    )
  })

  it('conserva las notas simples de manifiestos antiguos', () => {
    expect(releaseNotesForUpdate(update({ releaseHistory: null }))).toBe(
      'Solo la última versión.',
    )
  })
})

describe('novedades de la versión instalada', () => {
  it('recupera solo las notas de la versión instalada desde el historial', () => {
    expect(releaseNotesForInstalledVersion(update(), '0.4.1')).toBe('Primera.')
  })

  it('usa las notas principales en manifiestos antiguos si la instalada es la última', () => {
    expect(releaseNotesForInstalledVersion(update({ releaseHistory: null }), '0.4.2')).toBe(
      'Solo la última versión.',
    )
  })

  it('no confunde una versión anterior con las notas de la última', () => {
    expect(releaseNotesForInstalledVersion(update({ releaseHistory: null }), '0.4.1')).toBeNull()
  })

  it('incluye las novedades completas de la versión instalada en la demo web', async () => {
    window.history.replaceState({}, '', '/?simulate-update=0.4.4')

    const simulatedUpdate = await checkForAppUpdate()
    const notes = releaseNotesForInstalledVersion(simulatedUpdate, '0.4.4')

    expect(notes).toContain('Los widgets se adaptan mejor a todos sus tamaños')
    expect(notes).toContain('La vista del tiempo aprovecha mejor el espacio')
    expect(notes).toContain('El calendario puede seguir desplazándose')
    expect(notes).toContain('El Asistente permite cambiar de página')
    expect(notes).toContain('Se ha reducido el espacio vertical alrededor del dock')
    expect(notes).toContain('Al actualizar saltando una o varias versiones')
    expect(notes).toContain('La actualización conserva los datos y la configuración existentes.')
  })
})
