// Fuente de verdad para versionName Android y las versiones de npm.
// Las APK de release siguen recibiendo versionCode y versionName desde su tag en CI.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function validateVersion(value) {
  if (!SEMVER.test(value || '')) throw new Error('Versión inválida: ' + value + '. Usa X.Y.Z.')
  return value
}

export function readProjectVersions(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
  const gradle = readFileSync(join(root, 'android', 'gradle.properties'), 'utf8')
  const matches = [...gradle.matchAll(/^appVersionName=([^\r\n]+)$/gm)]
  if (matches.length !== 1) throw new Error('android/gradle.properties debe tener exactamente un appVersionName.')
  if (lock.name !== manifest.name || lock.packages?.['']?.name !== manifest.name) {
    throw new Error('package-lock.json no coincide con el nombre del proyecto.')
  }
  return { manifest, lock, gradle, versions: {
    npm: manifest.version,
    lock: lock.version,
    lockRoot: lock.packages[''].version,
    android: matches[0][1].trim(),
  } }
}

export function checkProjectVersion(root, expected) {
  const { versions } = readProjectVersions(root)
  const base = validateVersion(expected || versions.android)
  for (const [source, version] of Object.entries(versions)) {
    if (version !== base) throw new Error(source + ' tiene ' + version + ', pero se esperaba ' + base + '.')
  }
  return base
}

export function setProjectVersion(root, version) {
  validateVersion(version)
  const { manifest, lock, gradle } = readProjectVersions(root)
  // No alteramos dependencias ni el resto de los datos del lockfile.
  manifest.version = version
  lock.version = version
  lock.packages[''].version = version
  const updatedGradle = gradle.replace(/^appVersionName=[^\r\n]+$/m, 'appVersionName=' + version)
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n')
  writeFileSync(join(root, 'android', 'gradle.properties'), updatedGradle)
  return checkProjectVersion(root, version)
}
