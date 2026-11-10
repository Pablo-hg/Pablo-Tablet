// Lógica pura de las protecciones de Pablo Tablet DEV. Sin efectos secundarios: se prueba sin dispositivo.
export const STABLE_ID = 'com.pablohorcajada.tablet'
export const DEV_ID = 'com.pablohorcajada.tablet.debug'
export const DEV_LABEL = 'Pablo Tablet DEV'
export const MAIN_ACTIVITY = 'com.pablohorcajada.tablet.MainActivity'
export const LIVE_PORT = 5173
export const LIVE_URL = `http://localhost:${LIVE_PORT}`

export function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[0])
    .map(([serial, state]) => ({ serial, state }))
}

// Exige un único destino en estado "device". Con varios dispositivos hay que fijar ANDROID_SERIAL.
export function selectDevice(devices, requestedSerial) {
  const ready = devices.filter((d) => d.state === 'device')
  if (requestedSerial) {
    const match = devices.find((d) => d.serial === requestedSerial)
    if (!match) throw new Error(`ANDROID_SERIAL=${requestedSerial} no aparece en adb devices.`)
    if (match.state !== 'device') throw new Error(`El dispositivo ${requestedSerial} está en estado ${match.state}.`)
    return match.serial
  }
  if (ready.length === 0) throw new Error('No hay ningún dispositivo Android en estado "device".')
  if (ready.length > 1) throw new Error('Hay varios dispositivos conectados: define ANDROID_SERIAL para elegir uno.')
  return ready[0].serial
}

export function parseBadging(output) {
  const pkg = output.match(/^package: name='([^']+)' versionCode='([^']*)' versionName='([^']*)'/m)
  if (!pkg) throw new Error('No se pudo leer el paquete del APK (aapt2 dump badging).')
  const label = output.match(/^application-label:'([^']*)'/m)
  const debuggable = /^application-debuggable/m.test(output)
  return { packageName: pkg[1], versionCode: pkg[2], versionName: pkg[3], label: label ? label[1] : null, debuggable }
}

// Un APK solo puede instalarse con el comando DEV si es inequívocamente la variante DEV.
export function assertDevApk(badging) {
  const problems = []
  if (badging.packageName === STABLE_ID) problems.push(`el paquete es el identificador ESTABLE (${STABLE_ID})`)
  else if (badging.packageName !== DEV_ID) problems.push(`paquete inesperado: ${badging.packageName}`)
  if (!badging.debuggable) problems.push('el APK no es debuggable')
  if (badging.label !== DEV_LABEL) problems.push(`nombre visible inesperado: ${badging.label}`)
  if (!String(badging.versionName).endsWith('-dev')) problems.push(`versionName sin sufijo -dev: ${badging.versionName}`)
  if (problems.length) throw new Error(`APK rechazado, no se instala: ${problems.join('; ')}.`)
}

export function assertDevTarget(packageName) {
  if (packageName !== DEV_ID) throw new Error(`Destino rechazado: ${packageName}. Solo se permite ${DEV_ID}.`)
}

// Valores que se inyectan solo mientras dura el Live Reload (ver capacitor.config.ts).
export function liveEnvironment(base = {}) {
  return { ...base, PABLO_ANDROID_VARIANT: 'dev', PABLO_DEV_LIVE_URL: LIVE_URL }
}

export function cleanEnvironment(base = {}) {
  const copy = { ...base }
  delete copy.PABLO_ANDROID_VARIANT
  delete copy.PABLO_DEV_LIVE_URL
  return copy
}

// Destino del servidor Vite: solo loopback. Nunca 0.0.0.0 ni la IP de la Wi-Fi.
export function viteArgs() {
  return ['vite', '--host', '127.0.0.1', '--port', String(LIVE_PORT), '--strictPort']
}

// Carpeta local de laboratorio, fuera del repositorio (modelos, audios, logs, informes, APK).
export function labHome(env = process.env) {
  return env.LUMI_LAB_HOME || `${env.HOME}/pablo-tablet-lab`
}

// pid de ss -ltnp "users:((\"node\",pid=123,fd=20))" para el puerto indicado
export function parseListeningPid(ssOutput, port) {
  const line = ssOutput.split('\n').find((l) => l.includes(`:${port} `) || l.includes(`:${port}\t`))
  return line?.match(/pid=(\d+)/)?.[1] ? Number(line.match(/pid=(\d+)/)[1]) : null
}

export function adbArgs(serial, ...rest) {
  if (!serial) throw new Error('adb sin serial explícito: operación rechazada.')
  return ['-s', serial, ...rest]
}

// Lista blanca de subcomandos adb que usan los scripts. Nada de uninstall, pm clear, restore ni push a /data.
const ALLOWED_ADB = new Set(['devices', 'install', 'reverse', 'shell', 'exec-out', 'logcat'])
const FORBIDDEN_SHELL = /\b(pm\s+(clear|uninstall)|rm\s|bmgr)\b/
export function assertAdbAllowed(args) {
  const rest = args[0] === '-s' ? args.slice(2) : args
  const command = rest[0]
  if (!ALLOWED_ADB.has(command)) throw new Error(`Subcomando adb no permitido: ${command}`)
  if (command === 'shell' && FORBIDDEN_SHELL.test(rest.slice(1).join(' '))) throw new Error('Comando shell no permitido.')
  if (command === 'install' && !rest.includes('-r')) throw new Error('adb install debe usar -r (reemplazo sin borrar datos).')
}

// Detecta las APK anteriores que Gradle haya dejado en outputs/ tras un build fallido.
export function assertDevApkVersion(badging, baseVersion) {
  const expected = `${baseVersion}-dev`
  if (badging.versionName !== expected) {
    throw new Error(`APK DEV obsoleta: ${badging.versionName}; versión esperada: ${expected}`)
  }
}

export function assertBuildReceipt(receipt, badging, sha256) {
  if (!receipt || receipt.packageName !== badging.packageName || receipt.versionName !== badging.versionName || receipt.sha256 !== sha256) {
    throw new Error('No coincide la firma de integridad del último build correcto')
  }
}
