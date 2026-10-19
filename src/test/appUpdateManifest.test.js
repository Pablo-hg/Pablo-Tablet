import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { createUpdateManifest, readReleaseHistory } from '../../scripts/create-update-manifest.mjs'

const validManifest = {
  repository: 'Pablo-hg/Pablo-Tablet',
  tag: 'v0.4.2',
  assetName: 'Pablo-Tablet-0.4.2.apk',
  assetSize: 42_000_000,
  sha256: 'a'.repeat(64),
  releaseHistory: [
    {
      versionName: '0.4.1',
      releaseName: 'Pablo Tablet 0.4.1',
      releaseNotes: 'Listas y calendario mejorados.',
    },
    {
      versionName: '0.4.2',
      releaseName: 'Pablo Tablet 0.4.2',
      releaseNotes: 'Actualizador más fiable.',
    },
  ],
  publishedAt: '2026-10-19T22:30:00.000Z',
}

describe('manifiesto de actualización Android', () => {
  it('publica toda la información necesaria sin consultar la API de GitHub', () => {
    expect(createUpdateManifest(validManifest)).toEqual({
      schemaVersion: 2,
      versionName: '0.4.2',
      releaseName: 'Pablo Tablet 0.4.2',
      releaseNotes: 'Actualizador más fiable.',
      releaseHistory: validManifest.releaseHistory,
      publishedAt: '2026-10-19T22:30:00.000Z',
      downloadUrl:
        'https://github.com/Pablo-hg/Pablo-Tablet/releases/download/v0.4.2/Pablo-Tablet-0.4.2.apk',
      sha256: 'a'.repeat(64),
      assetName: 'Pablo-Tablet-0.4.2.apk',
      assetSize: 42_000_000,
    })
  })

  it('rechaza repositorios, versiones y APK no válidos', () => {
    expect(() => createUpdateManifest({ ...validManifest, repository: '../otro' })).toThrow(
      'Repositorio invalido',
    )
    expect(() => createUpdateManifest({ ...validManifest, tag: '0.4.2' })).toThrow(
      'Tag de version invalido',
    )
    expect(() => createUpdateManifest({ ...validManifest, assetName: '../app.apk' })).toThrow(
      'Nombre de APK invalido',
    )
  })

  it('rechaza huellas, tamaños y fechas no válidos', () => {
    expect(() => createUpdateManifest({ ...validManifest, sha256: 'abc' })).toThrow(
      'huella SHA-256',
    )
    expect(() => createUpdateManifest({ ...validManifest, assetSize: 0 })).toThrow(
      'Tamano de APK invalido',
    )
    expect(() => createUpdateManifest({ ...validManifest, publishedAt: 'ayer' })).toThrow(
      'Fecha de publicacion invalida',
    )
  })

  it('exige las novedades de la versión publicada y rechaza duplicados', () => {
    expect(() =>
      createUpdateManifest({
        ...validManifest,
        releaseHistory: validManifest.releaseHistory.slice(0, 1),
      }),
    ).toThrow('Faltan las novedades de la version 0.4.2')
    expect(() =>
      createUpdateManifest({
        ...validManifest,
        releaseHistory: [validManifest.releaseHistory[1], validManifest.releaseHistory[1]],
      }),
    ).toThrow('Version duplicada')
  })

  it('lee las novedades disponibles sin incluir versiones posteriores', () => {
    const history = readReleaseHistory(resolve('.github/release-notes'), 'v0.4.1')
    expect(history.map((release) => release.versionName)).toEqual(['0.3.7', '0.4.1'])
  })
})
