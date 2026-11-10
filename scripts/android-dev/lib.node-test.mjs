import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEV_ID, STABLE_ID, assertAdbAllowed, assertDevApk, assertDevTarget, cleanEnvironment, liveEnvironment,
  labHome, parseListeningPid, parseBadging, parseDevices, selectDevice, viteArgs,
} from './lib.mjs'

const badging = (pkg, extra = '') => `package: name='${pkg}' versionCode='1' versionName='0.2.0-dev'\napplication-label:'Pablo Tablet DEV'\n${extra}`

test('acepta solo el APK DEV debuggable', () => {
  assert.doesNotThrow(() => assertDevApk(parseBadging(badging(DEV_ID, 'application-debuggable\n'))))
})

test('rechaza un APK con el identificador estable', () => {
  assert.throws(() => assertDevApk(parseBadging(badging(STABLE_ID, 'application-debuggable\n'))), /ESTABLE/)
})

test('rechaza APK no debuggable, sin sufijo -dev o con nombre distinto', () => {
  assert.throws(() => assertDevApk(parseBadging(badging(DEV_ID))), /debuggable/)
  const sinSufijo = badging(DEV_ID, 'application-debuggable\n').replace('0.2.0-dev', '0.2.0')
  assert.throws(() => assertDevApk(parseBadging(sinSufijo)), /-dev/)
  const otroNombre = badging(DEV_ID, 'application-debuggable\n').replace('Pablo Tablet DEV', 'Pablo Tablet')
  assert.throws(() => assertDevApk(parseBadging(otroNombre)), /nombre/)
})

test('assertDevTarget bloquea cualquier otro paquete', () => {
  assert.doesNotThrow(() => assertDevTarget(DEV_ID))
  assert.throws(() => assertDevTarget(STABLE_ID))
})

test('selectDevice exige uno solo o ANDROID_SERIAL', () => {
  const out = 'List of devices attached\nAAA\tdevice usb:1\nBBB\tunauthorized\n'
  assert.equal(selectDevice(parseDevices(out)), 'AAA')
  assert.throws(() => selectDevice(parseDevices('List of devices attached\n')), /ningún/)
  assert.throws(() => selectDevice(parseDevices('List of devices attached\nA\tdevice\nB\tdevice\n')), /varios/)
  assert.throws(() => selectDevice(parseDevices(out), 'BBB'), /unauthorized/)
})

test('lista blanca de adb: sin uninstall, pm clear ni install sin -r', () => {
  assert.throws(() => assertAdbAllowed(['-s', 'A', 'uninstall', STABLE_ID]))
  assert.throws(() => assertAdbAllowed(['-s', 'A', 'shell', 'pm', 'clear', STABLE_ID]))
  assert.throws(() => assertAdbAllowed(['-s', 'A', 'install', 'x.apk']))
  assert.throws(() => assertAdbAllowed(['restore', 'x']))
  assert.doesNotThrow(() => assertAdbAllowed(['-s', 'A', 'install', '-r', 'x.apk']))
  assert.doesNotThrow(() => assertAdbAllowed(['-s', 'A', 'reverse', 'tcp:5173', 'tcp:5173']))
})

test('Live Reload usa solo loopback y el entorno se limpia', () => {
  assert.deepEqual(viteArgs().slice(0, 3), ['vite', '--host', '127.0.0.1'])
  assert.ok(viteArgs().includes('--strictPort'))
  const env = liveEnvironment({ A: '1' })
  assert.equal(env.PABLO_DEV_LIVE_URL, 'http://localhost:5173')
  assert.deepEqual(cleanEnvironment(env), { A: '1' })
})

test('logcat permitido; labHome fuera del repositorio; pid de puerto', () => {
  assert.doesNotThrow(() => assertAdbAllowed(['-s', 'A', 'logcat', '-d']))
  assert.equal(labHome({ HOME: '/home/x' }), '/home/x/pablo-tablet-lab')
  assert.equal(labHome({ HOME: '/home/x', LUMI_LAB_HOME: '/data/lab' }), '/data/lab')
  const ss = 'LISTEN 0 511 127.0.0.1:5173 0.0.0.0:* users:(("node",pid=4242,fd=20))'
  assert.equal(parseListeningPid(ss, 5173), 4242)
  assert.equal(parseListeningPid(ss, 9999), null)
})
