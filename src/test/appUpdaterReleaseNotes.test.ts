import { describe, expect, it } from 'vitest'
import { releaseNotesForUpdate, type AppUpdateInfo } from '../appUpdater'

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
