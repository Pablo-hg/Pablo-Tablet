import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function parseBadging(output) {
  const match = output.match(
    /^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m,
  )
  if (!match) throw new Error('No se pudo leer el paquete y la version del APK.')
  return { packageName: match[1], versionCode: match[2], versionName: match[3] }
}

export function parseCertificateSha256(output) {
  const match = output.match(/Signer #1 certificate SHA-256 digest:\s*([0-9a-f:]+)/i)
  if (!match) throw new Error('No se pudo leer el SHA-256 del certificado firmante.')
  return match[1].replaceAll(':', '').toLowerCase()
}

export function validateIdentity(actual, expected) {
  if (actual.packageName !== expected.packageName) {
    throw new Error(`Paquete inesperado: ${actual.packageName}`)
  }
  if (actual.versionName !== expected.versionName) {
    throw new Error(`Version inesperada: ${actual.versionName}`)
  }
  if (!/^\d+$/.test(actual.versionCode) || Number(actual.versionCode) <= 0) {
    throw new Error(`versionCode invalido: ${actual.versionCode}`)
  }
  if (Number(actual.versionCode) < expected.minimumVersionCode) {
    throw new Error(`versionCode demasiado bajo: ${actual.versionCode}`)
  }
}

export function validateCertificate(actual, expected) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Certificado de firma inesperado: ${actual}`)
  }
}

function latestBuildTools(sdkRoot) {
  const root = join(sdkRoot, 'build-tools')
  const versions = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  if (!versions[0]) throw new Error(`No hay Android build-tools en ${root}.`)
  return join(root, versions[0])
}

function toolPath(directory, name) {
  const candidates = process.platform === 'win32' ? [`${name}.bat`, `${name}.exe`, name] : [name]
  const result = candidates.map((candidate) => join(directory, candidate)).find(existsSync)
  if (!result) throw new Error(`No se encontro ${name} en ${directory}.`)
  return result
}

function runTool(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32' && command.endsWith('.bat'),
  })
}

export function verifyAndroidRelease({
  apk,
  expectedPackage,
  expectedVersion,
  expectedCertificateSha256,
  minimumVersionCode,
  output,
}) {
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME
  if (!sdkRoot) throw new Error('ANDROID_SDK_ROOT o ANDROID_HOME no esta definido.')
  if (!existsSync(apk)) throw new Error(`No existe el APK: ${apk}`)

  const tools = latestBuildTools(sdkRoot)
  const apksigner = toolPath(tools, 'apksigner')
  const aapt = toolPath(tools, 'aapt')
  const certificateSha256 = parseCertificateSha256(
    runTool(apksigner, ['verify', '--verbose', '--print-certs', apk]),
  )
  const identity = parseBadging(runTool(aapt, ['dump', 'badging', apk]))
  validateIdentity(identity, {
    packageName: expectedPackage,
    versionName: expectedVersion,
    minimumVersionCode,
  })
  validateCertificate(certificateSha256, expectedCertificateSha256)

  const apkSha256 = createHash('sha256').update(readFileSync(apk)).digest('hex')
  const metadata = [
    `artifact=${basename(apk)}`,
    `package=${identity.packageName}`,
    `versionName=${identity.versionName}`,
    `versionCode=${identity.versionCode}`,
    `certificateSha256=${certificateSha256}`,
    `apkSha256=${apkSha256}`,
    '',
  ].join('\n')
  writeFileSync(output, metadata, 'utf8')
  return { ...identity, certificateSha256, apkSha256 }
}

function readArguments(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1])
  const required = [
    '--apk',
    '--expected-package',
    '--expected-version',
    '--expected-certificate-sha256',
    '--minimum-version-code',
    '--output',
  ]
  for (const name of required) {
    if (!values.get(name)) throw new Error(`Falta el argumento ${name}.`)
  }
  const minimumVersionCode = Number(values.get('--minimum-version-code'))
  if (!Number.isSafeInteger(minimumVersionCode) || minimumVersionCode <= 0) {
    throw new Error('El argumento --minimum-version-code debe ser un entero positivo.')
  }
  return {
    apk: resolve(values.get('--apk')),
    expectedPackage: values.get('--expected-package'),
    expectedVersion: values.get('--expected-version'),
    expectedCertificateSha256: values.get('--expected-certificate-sha256').toLowerCase(),
    minimumVersionCode,
    output: resolve(values.get('--output')),
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyAndroidRelease(readArguments(process.argv.slice(2)))
    console.log(
      `APK verificado: ${result.packageName} ${result.versionName} (${result.versionCode}), certificado ${result.certificateSha256}`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
