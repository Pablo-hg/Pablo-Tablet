import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkProjectVersion, setProjectVersion } from './project-version.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pablo-version-'))
  mkdirSync(join(root, 'android'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'pablo-tablet', version: '0.5.2' }, null, 2) + '\n')
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({
    name: 'pablo-tablet', version: '0.5.2', lockfileVersion: 3,
    packages: { '': { name: 'pablo-tablet', version: '0.5.2' } },
  }, null, 2) + '\n')
  writeFileSync(join(root, 'android', 'gradle.properties'), 'android.useAndroidX=true\nappVersionName=0.5.2\n')
  return root
}

test('la base 0.5.2 produce la versión Dev 0.5.2-dev sin editar gradle', () => {
  assert.equal(checkProjectVersion(fixture()), '0.5.2')
})

test('preparar una release actualiza npm, lockfile y Android de forma coherente', () => {
  const root = fixture()
  assert.equal(setProjectVersion(root, '0.5.3'), '0.5.3')
  assert.equal(checkProjectVersion(root, '0.5.3'), '0.5.3')
  assert.match(readFileSync(join(root, 'android', 'gradle.properties'), 'utf8'), /appVersionName=0\.5\.3/)
})

test('detecta divergencias en lugar de publicar silenciosamente una versión errónea', () => {
  const root = fixture()
  const path = join(root, 'package-lock.json')
  const lock = JSON.parse(readFileSync(path, 'utf8'))
  lock.packages[''].version = '0.2.0'
  writeFileSync(path, JSON.stringify(lock))
  assert.throws(() => checkProjectVersion(root), /lockRoot/)
})

test('rechaza versiones inválidas y falta de configuración', () => {
  const root = fixture()
  assert.throws(() => setProjectVersion(root, 'v0.5.3'), /inválida/)
  writeFileSync(join(root, 'android', 'gradle.properties'), 'android.useAndroidX=true\n')
  assert.throws(() => checkProjectVersion(root), /appVersionName/)
})
