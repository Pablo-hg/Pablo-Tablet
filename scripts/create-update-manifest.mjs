import { readFileSync, statSync, writeFileSync } from 'node:fs'
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
  releaseNotes,
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
  return {
    schemaVersion: 1,
    versionName,
    releaseName: `Pablo Tablet ${versionName}`,
    releaseNotes,
    publishedAt,
    downloadUrl: `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`,
    sha256: normalizedSha256,
    assetName,
    assetSize,
  }
}

function readArguments(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1])
  const required = ['--repository', '--tag', '--apk', '--sha256-file', '--notes-file', '--output']
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
  const releaseNotes = readFileSync(resolve(values['notes-file']), 'utf8').trim()
  const manifest = createUpdateManifest({
    repository: values.repository,
    tag: values.tag,
    assetName,
    assetSize: statSync(apk).size,
    sha256,
    releaseNotes,
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
