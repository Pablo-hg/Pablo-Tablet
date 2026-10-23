import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RELEASE_REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/
const SHA256 = /^[a-f0-9]{64}$/

export function createUpdateManifest({
  repository,
  tag,
  assetName,
  assetSize,
  sha256,
  releaseHistory,
  publishedAt,
}) {
  if (!RELEASE_REPOSITORY.test(repository)) {
    throw new Error(`Repositorio invalido: ${repository}`)
  }
  if (!RELEASE_TAG.test(tag)) {
    throw new Error(`Tag de version invalido: ${tag}`)
  }
  if (!assetName.toLowerCase().endsWith('.apk') || basename(assetName) !== assetName) {
    throw new Error(`Nombre de APK invalido: ${assetName}`)
  }
  if (!Number.isSafeInteger(assetSize) || assetSize <= 0) {
    throw new Error(`Tamano de APK invalido: ${assetSize}`)
  }
  const normalizedSha256 = sha256.trim().toLowerCase()
  if (!SHA256.test(normalizedSha256)) {
    throw new Error('La huella SHA-256 del APK no es valida.')
  }
  if (Number.isNaN(Date.parse(publishedAt))) {
    throw new Error(`Fecha de publicacion invalida: ${publishedAt}`)
  }

  const versionName = tag.substring(1)
  const normalizedHistory = normalizeReleaseHistory(releaseHistory, versionName)
  const currentRelease = normalizedHistory.find((release) => release.versionName === versionName)
  if (!currentRelease) {
    throw new Error(`Faltan las novedades de la version ${versionName}.`)
  }
  return {
    schemaVersion: 2,
    versionName,
    releaseName: `Pablo Tablet ${versionName}`,
    releaseNotes: currentRelease.releaseNotes,
    releaseHistory: normalizedHistory,
    publishedAt,
    downloadUrl: `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`,
    sha256: normalizedSha256,
    assetName,
    assetSize,
  }
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function normalizeReleaseHistory(releaseHistory, latestVersion) {
  if (!Array.isArray(releaseHistory) || releaseHistory.length === 0) {
    throw new Error('El historial de novedades esta vacio.')
  }
  const versions = new Set()
  return releaseHistory
    .map((release) => {
      const versionName = String(release.versionName ?? '').trim()
      const releaseNotes = String(release.releaseNotes ?? '').trim()
      if (!/^\d+\.\d+\.\d+$/.test(versionName)) {
        throw new Error(`Version invalida en el historial: ${versionName}`)
      }
      if (!releaseNotes) throw new Error(`Faltan las novedades de la version ${versionName}.`)
      if (versions.has(versionName)) throw new Error(`Version duplicada en el historial: ${versionName}`)
      if (compareVersions(versionName, latestVersion) > 0) {
        throw new Error(`El historial contiene una version posterior: ${versionName}`)
      }
      versions.add(versionName)
      return {
        versionName,
        releaseName: `Pablo Tablet ${versionName}`,
        releaseNotes,
      }
    })
    .sort((left, right) => compareVersions(left.versionName, right.versionName))
}

export function readReleaseHistory(notesDirectory, latestTag) {
  if (!RELEASE_TAG.test(latestTag)) throw new Error(`Tag de version invalido: ${latestTag}`)
  const latestVersion = latestTag.substring(1)
  return readdirSync(notesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^v\d+\.\d+\.\d+\.md$/.test(entry.name))
    .map((entry) => {
      const versionName = entry.name.slice(1, -3)
      return {
        versionName,
        releaseName: `Pablo Tablet ${versionName}`,
        releaseNotes: readFileSync(resolve(notesDirectory, entry.name), 'utf8').trim(),
      }
    })
    .filter((release) => compareVersions(release.versionName, latestVersion) <= 0)
    .sort((left, right) => compareVersions(left.versionName, right.versionName))
}

function readArguments(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1])
  const required = ['--repository', '--tag', '--apk', '--sha256-file', '--notes-directory', '--output']
  for (const name of required) {
    if (!values.get(name)) throw new Error(`Falta el argumento ${name}.`)
  }
  return Object.fromEntries(required.map((name) => [name.substring(2), values.get(name)]))
}

function createFromArguments(args) {
  const values = readArguments(args)
  const apk = resolve(values.apk)
  const assetName = basename(apk)
  const sha256 = readFileSync(resolve(values['sha256-file']), 'utf8').trim().split(/\s+/)[0]
  const releaseHistory = readReleaseHistory(resolve(values['notes-directory']), values.tag)
  const manifest = createUpdateManifest({
    repository: values.repository,
    tag: values.tag,
    assetName,
    assetSize: statSync(apk).size,
    sha256,
    releaseHistory,
    publishedAt: new Date().toISOString(),
  })
  writeFileSync(resolve(values.output), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = createFromArguments(process.argv.slice(2))
    console.log(`Manifiesto creado para ${manifest.releaseName}: ${manifest.assetName}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
