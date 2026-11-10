#!/usr/bin/env node
// Comandos de desarrollo de Pablo Tablet DEV. Solo pueden actuar sobre com.pablohorcajada.tablet.debug.
// Uso: node scripts/android-dev/cli.mjs <doctor|status|build|install|live|live-off|stop|logcat|test> [--yes]
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEV_ID, LIVE_PORT, LIVE_URL, MAIN_ACTIVITY, STABLE_ID,
  adbArgs, assertAdbAllowed, labHome, parseListeningPid, assertDevApk, assertDevTarget, cleanEnvironment, liveEnvironment,
  parseBadging, parseDevices, selectDevice, viteArgs,
} from './lib.mjs'

const root = resolve(fileURLToPath(import.meta.url), '../../..')
const apkPath = join(root, 'android/app/build/outputs/apk/debug/app-debug.apk')
const sdk = process.env.ANDROID_HOME || join(process.env.HOME || '', 'Android/Sdk')

function fail(message) {
  console.error(`\n[android:dev] ${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options })
  return result
}

function adb(args, options = {}) {
  assertAdbAllowed(args)
  return run(join(sdk, 'platform-tools/adb'), args, options)
}

// 1. La copia de trabajo debe contener la variante DEV. Si no, estamos en main o en una rama sin protección.
function assertDevCheckout() {
  const gradle = readFileSync(join(root, 'android/app/build.gradle'), 'utf8')
  if (!/applicationIdSuffix\s+"\.debug"/.test(gradle)) {
    fail('Esta copia de trabajo NO define applicationIdSuffix ".debug". Un debug de aquí usaría el identificador estable. Usa el worktree de chore/android-dev-variant.')
  }
  const config = readFileSync(join(root, 'capacitor.config.ts'), 'utf8')
  if (!config.includes(`appId: '${STABLE_ID}'`)) fail('capacitor.config.ts no conserva el appId estable de referencia.')
}

function aapt2() {
  const dir = join(sdk, 'build-tools')
  const versions = existsSync(dir) ? readdirSync(dir).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : []
  const latest = versions.at(-1)
  if (!latest) fail(`No hay build-tools en ${dir}.`)
  return join(dir, latest, 'aapt2')
}

function inspectApk() {
  if (!existsSync(apkPath)) fail(`No existe ${apkPath}. Ejecuta antes npm run android:dev:build.`)
  const result = run(aapt2(), ['dump', 'badging', apkPath])
  if (result.status !== 0) fail(`aapt2 falló: ${result.stderr}`)
  const badging = parseBadging(result.stdout)
  try {
    assertDevApk(badging)
  } catch (error) {
    fail(error.message)
  }
  return badging
}

function device() {
  const result = adb(['devices'])
  try {
    return selectDevice(parseDevices(result.stdout), process.env.ANDROID_SERIAL)
  } catch (error) {
    return fail(error.message)
  }
}

function packageTimes(serial, packageName) {
  const out = adb(adbArgs(serial, 'shell', 'dumpsys', 'package', packageName)).stdout
  const pick = (key) => out.match(new RegExp(`${key}=(.+)`))?.[1]?.trim() ?? null
  return { installed: out.includes(`Package [${packageName}]`), firstInstallTime: pick('firstInstallTime'), lastUpdateTime: pick('lastUpdateTime'), versionName: pick('versionName') }
}

function status() {
  assertDevCheckout()
  const serial = device()
  console.log(`Dispositivo: ${serial}`)
  for (const id of [STABLE_ID, DEV_ID]) console.log(id, JSON.stringify(packageTimes(serial, id)))
  console.log(existsSync(apkPath) ? `APK DEV: ${JSON.stringify(inspectApk())}` : 'APK DEV: sin compilar')
}

function build(env = cleanEnvironment(process.env)) {
  assertDevCheckout()
  for (const [command, args] of [['npm', ['run', 'android:sync']], ['./gradlew', [':app:assembleDebug']]]) {
    const result = run(command, args, { cwd: command === './gradlew' ? join(root, 'android') : root, stdio: 'inherit', env })
    if (result.status !== 0) fail(`Falló: ${command} ${args.join(' ')}`)
  }
  const badging = inspectApk()
  console.log(`\nAPK DEV verificado: ${badging.packageName} ${badging.versionName} («${badging.label}»)`)
}

function install(confirmed) {
  assertDevCheckout()
  const badging = inspectApk()
  assertDevTarget(badging.packageName)
  const serial = device()
  const stableBefore = packageTimes(serial, STABLE_ID)
  console.log(`Plan: adb -s ${serial} install -r ${apkPath}`)
  console.log(`      destino ${badging.packageName} (${badging.versionName}); la estable queda como: ${JSON.stringify(stableBefore)}`)
  if (!confirmed) {
    console.log('\nSIMULACIÓN: no se ha instalado nada. Repite con --yes para instalar de verdad.')
    return
  }
  const result = adb(adbArgs(serial, 'install', '-r', apkPath), { stdio: 'inherit' })
  if (result.status !== 0) fail('La instalación falló. No se ha desinstalado nada. Si es INSTALL_FAILED_UPDATE_INCOMPATIBLE, revisa la firma; nunca desinstales la estable.')
  const stableAfter = packageTimes(serial, STABLE_ID)
  if (JSON.stringify(stableBefore) !== JSON.stringify(stableAfter)) fail(`ATENCIÓN: la app estable cambió durante la instalación: ${JSON.stringify(stableAfter)}`)
  console.log('Instalación DEV correcta; la app estable no ha cambiado.')
}

function restoreNormalConfig() {
  console.log('Restaurando configuración normal de Capacitor (sin server.url)...')
  run('npx', ['cap', 'sync', 'android'], { stdio: 'inherit', env: cleanEnvironment(process.env) })
}

function liveOff() {
  assertDevCheckout()
  const serial = device()
  adb(adbArgs(serial, 'reverse', '--remove', `tcp:${LIVE_PORT}`))
  restoreNormalConfig()
  console.log('Live Reload desactivado en el PC. La APK DEV instalada seguirá apuntando a localhost hasta reinstalar una compilación normal (npm run android:dev:build && npm run android:dev:install -- --yes).')
}

function live(confirmed) {
  assertDevCheckout()
  const serial = device()
  const env = liveEnvironment(process.env)
  console.log(`Live Reload: ${LIVE_URL} (solo loopback) -> adb reverse -> ${DEV_ID} en ${serial}`)
  if (!existsSync(join(root, 'dist'))) run('npm', ['run', 'build'], { stdio: 'inherit' })
  let result = run('npx', ['cap', 'sync', 'android'], { stdio: 'inherit', env })
  if (result.status !== 0) fail('cap sync falló.')
  result = run('./gradlew', [':app:assembleDebug'], { cwd: join(root, 'android'), stdio: 'inherit', env })
  if (result.status !== 0) fail('assembleDebug falló.')
  const badging = inspectApk()
  assertDevTarget(badging.packageName)
  if (!confirmed) {
    restoreNormalConfig()
    console.log('\nSIMULACIÓN: APK Live compilada y verificada, pero no instalada. Configuración normal restaurada.')
    console.log('Para instalarla y arrancar: npm run android:dev:live -- --yes')
    return
  }
  const stableBefore = packageTimes(serial, STABLE_ID)
  result = adb(adbArgs(serial, 'install', '-r', apkPath), { stdio: 'inherit' })
  if (result.status !== 0) fail('La instalación falló. No se ha desinstalado nada.')
  if (JSON.stringify(stableBefore) !== JSON.stringify(packageTimes(serial, STABLE_ID))) fail('ATENCIÓN: la app estable cambió.')
  adb(adbArgs(serial, 'reverse', `tcp:${LIVE_PORT}`, `tcp:${LIVE_PORT}`), { stdio: 'inherit' })
  adb(adbArgs(serial, 'shell', 'am', 'start', '-n', `${DEV_ID}/${MAIN_ACTIVITY}`), { stdio: 'inherit' })
  const vite = spawn('npx', viteArgs(), { cwd: root, stdio: 'inherit' })
  const cleanup = () => {
    vite.kill('SIGTERM')
    adb(adbArgs(serial, 'reverse', '--remove', `tcp:${LIVE_PORT}`))
    restoreNormalConfig()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

function logcat(flags) {
  assertDevCheckout()
  const serial = device()
  const pid = adb(adbArgs(serial, 'shell', 'pidof', DEV_ID)).stdout.trim().split(/\s+/)[0]
  if (!pid) fail(`${DEV_ID} no está en ejecución. Ábrela en la tablet y repite (solo se registra la variante DEV).`)
  const dir = join(labHome(), 'logs/android')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `dev-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)
  const args = adbArgs(serial, 'logcat', '-v', 'threadtime', `--pid=${pid}`, ...(flags.includes('--dump') ? ['-d'] : []))
  assertAdbAllowed(args)
  console.log(`Logcat de ${DEV_ID} (pid ${pid}) -> ${file}  (Ctrl+C para parar)`)
  const out = createWriteStream(file)
  const child = spawn(join(sdk, 'platform-tools/adb'), args, { stdio: ['ignore', 'pipe', 'inherit'] })
  child.stdout.on('data', (chunk) => { out.write(chunk); process.stdout.write(chunk) })
  child.on('exit', () => out.end())
  process.on('SIGINT', () => child.kill('SIGTERM'))
}

function stop() {
  assertDevCheckout()
  const pid = parseListeningPid(run('ss', ['-ltnp']).stdout || '', LIVE_PORT)
  if (pid) {
    const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8')
    if (/vite/.test(cmd) && /node/.test(cmd)) { process.kill(pid, 'SIGTERM'); console.log(`Vite detenido (pid ${pid}).`) }
    else console.log(`El puerto ${LIVE_PORT} lo usa otro proceso (pid ${pid}); no se toca.`)
  } else console.log('No hay Vite escuchando en el puerto de Live Reload.')
  liveOff()
}

function test() {
  assertDevCheckout()
  const steps = [
    ['npm', ['run', 'lint'], root], ['npm', ['test'], root], ['npm', ['run', 'test:scripts'], root],
    ['./gradlew', [':app:testDebugUnitTest'], join(root, 'android')],
  ]
  for (const [command, args, cwd] of steps) {
    console.log(`\n== ${command} ${args.join(' ')}`)
    if (run(command, args, { cwd, stdio: 'inherit' }).status !== 0) fail(`Falló: ${command} ${args.join(' ')}`)
  }
  console.log('\nTodas las pruebas locales superadas (lint, vitest, scripts, tests unitarios Android).')
}

function doctor() {
  assertDevCheckout()
  for (const [label, command, args] of [['node', 'node', ['-v']], ['java', 'java', ['-version']], ['adb', join(sdk, 'platform-tools/adb'), ['version']], ['gradle wrapper', './gradlew', ['--version']]]) {
    const r = run(command, args, { cwd: label === 'gradle wrapper' ? join(root, 'android') : root })
    console.log(`${label}: ${(r.stdout + r.stderr).split('\n').find((l) => /\d/.test(l))?.trim()}`)
  }
  console.log(`LUMI_LAB_HOME: ${labHome()} (${existsSync(labHome()) ? 'existe' : 'no existe: ejecuta npm run lab:setup en el worktree Lumi'})`)
  status()
}

const [command, ...flags] = process.argv.slice(2)
const confirmed = flags.includes('--yes')
const commands = { logcat: () => logcat(flags), stop, test, doctor, status, build: () => build(), install: () => install(confirmed), live: () => live(confirmed), 'live-off': liveOff }
if (!commands[command]) fail(`Uso: android-dev <${Object.keys(commands).join('|')}> [--yes]`)
commands[command]()
