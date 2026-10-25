import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPullRequestBody,
  compareVersions,
  draftReleaseNotes,
  findPotentialDependencies,
  issueNumbersFromText,
  nextPatchVersion,
  parseCommits,
  parseFlags,
  parseIssues,
  parseSelection,
  semverParts,
  simulateSelectedCommits,
  validateIssueRecord,
  validateNotesText,
} from './cli.mjs'

test('comparación semver numérica', () => {
  assert.equal(compareVersions('0.4.10', '0.4.9'), 1)
  assert.equal(compareVersions('0.4.4', '0.4.4'), 0)
  assert.equal(compareVersions('0.4.3', '0.4.4'), -1)
})
test('rechaza versiones con v y ceros no canónicos', () => {
  for (const v of ['v0.4.5', '0.04.5', '1.2', 'a.b.c', '1.2.3.4']) {
    assert.throws(() => semverParts(v))
  }
})
test('requiere Issue(s) reales y sin duplicados', () => {
  assert.deepEqual(parseIssues('12,15,12'), ['12', '15'])
  for (const value of ['', '0', '#1', '1,abc']) assert.throws(() => parseIssues(value))
})
test('commits explícitos en formato hexadecimal', () => {
  assert.deepEqual(parseCommits('abcdef1,abc123456,abcdef1'), ['abcdef1', 'abc123456'])
  for (const value of ['', 'no-es-sha', 'abc']) assert.throws(() => parseCommits(value))
})
test('dry-run y validación de parámetros', () => {
  assert.deepEqual(parseFlags(['--issues', '1', '--dry-run']).dryRun, true)
  assert.throws(() => parseFlags(['--desconocido']))
  assert.throws(() => parseFlags(['--notes']))
})
test('propone el siguiente parche a partir del tag mayor', () => {
  assert.equal(nextPatchVersion(['0.4.9', '0.4.10', '0.3.99']), '0.4.11')
  assert.equal(nextPatchVersion([]), '0.1.0')
})
test('selección explícita acepta listas y rangos sin duplicados', () => {
  assert.deepEqual(parseSelection('1,3-5,3', 5), [0, 2, 3, 4])
  for (const value of ['', '0', '2-1', '6', 'todo']) assert.throws(() => parseSelection(value, 5))
})
test('extrae Issues y genera notas de usuario revisables', () => {
  assert.deepEqual(issueNumbersFromText('feat: algo (#62) y #15 y #62'), ['62', '15'])
  const notes = draftReleaseNotes([{ title: 'feat(release): simplificar la publicación (#62)' }])
  assert.match(notes, /Simplificar la publicación\./)
  assert.doesNotMatch(notes, /#62|feat/)
  assert.equal(validateNotesText(notes), notes)
  assert.throws(() => validateNotesText('## Novedades\n\n- fix: copiar commit #62'), /Issue/)
})
test('señala posibles dependencias omitidas sin añadirlas', () => {
  const candidates = [
    { sha: 'a', issues: ['1'], files: ['src/a.ts'] },
    { sha: 'b', issues: ['1'], files: ['src/b.ts'] },
    { sha: 'c', issues: ['2'], files: ['src/a.ts'] },
  ]
  const warnings = findPotentialDependencies(candidates, ['c'])
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].dependency.sha, 'a')
  assert.deepEqual(warnings[0].sharedFiles, ['src/a.ts'])
})
test('el PR registra Issues y SHA seleccionados', () => {
  const body = buildPullRequestBody(['12', '15'], ['abcdef1234567'])
  assert.match(body, /## Incidencias incluidas[\s\S]*#12[\s\S]*#15/)
  assert.match(body, /## Commits seleccionados[\s\S]*abcdef1234567/)
})
test('rechaza números que pertenecen a Pull Requests', () => {
  assert.throws(() => validateIssueRecord({ number: 48, title: 'PR', pull_request: {} }, '48'), /Pull Request/)
  assert.deepEqual(validateIssueRecord({ number: 62, title: 'Automatizar', state: 'open', html_url: 'https://example.test/62' }, '62'), {
    number: 62, title: 'Automatizar', state: 'OPEN', url: 'https://example.test/62',
  })
})

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { restoreFormattingOnlyGeneratedFiles, verifySelectedCommits } from './cli.mjs'

function sandboxRepo() {
  const root = mkdtempSync(join(tmpdir(), 'pablo-release-tests-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  git('init', '-q')
  git('config', 'user.name', 'Release Tests')
  git('config', 'user.email', 'release-tests@example.invalid')
  git('config', 'core.autocrlf', 'false')
  mkdirSync(join(root, 'android', 'app'), { recursive: true })
  writeFileSync(join(root, 'android', 'app', 'capacitor.build.gradle'), 'def abc = 1\n')
  writeFileSync(join(root, 'android', 'capacitor.settings.gradle'), 'include ":app"\n')
  writeFileSync(join(root, 'main.txt'), 'base\n')
  git('add', '.')
  git('commit', '-qm', 'base')
  return { root, git }
}

test('restaura únicamente cambios LF/CRLF en archivos generados de Capacitor', () => {
  const { root, git } = sandboxRepo()
  const generated = join(root, 'android', 'app', 'capacitor.build.gradle')
  writeFileSync(generated, 'def abc = 1\r\n')
  assert.match(git('status', '--short'), /capacitor.build.gradle/)
  restoreFormattingOnlyGeneratedFiles(root)
  assert.equal(git('status', '--short'), '')
  assert.equal(readFileSync(generated, 'utf8'), 'def abc = 1\n')
})

test('no borra cambios funcionales en ficheros generados', () => {
  const { root, git } = sandboxRepo()
  const generated = join(root, 'android', 'app', 'capacitor.build.gradle')
  writeFileSync(generated, 'def abc = 999\n')
  assert.throws(() => restoreFormattingOnlyGeneratedFiles(root), /diferencias reales/)
  assert.equal(readFileSync(generated, 'utf8'), 'def abc = 999\n')
  assert.match(git('status', '--short'), /capacitor.build.gradle/)
})

test('no borra otros archivos modificados o nuevos', () => {
  const { root, git } = sandboxRepo()
  const generated = join(root, 'android', 'app', 'capacitor.build.gradle')
  writeFileSync(generated, 'def abc = 1\r\n')
  writeFileSync(join(root, 'notes.txt'), 'NO ELIMINAR\n')
  assert.throws(() => restoreFormattingOnlyGeneratedFiles(root), /otros archivos modificados/)
  assert.equal(readFileSync(join(root, 'notes.txt'), 'utf8'), 'NO ELIMINAR\n')
  assert.match(git('status', '--short'), /notes.txt/)
})

test('rechaza commits con parche equivalente ya integrado en main', () => {
  const { root, git } = sandboxRepo()
  git('branch', '-M', 'main')
  git('branch', 'dev')
  git('switch', '-q', 'dev')
  writeFileSync(join(root, 'new.txt'), 'feature X\n')
  git('add', 'new.txt')
  git('commit', '-qm', 'feature X')
  const original = git('rev-parse', 'HEAD')
  git('switch', '-q', 'main')
  // Replica el cambio con otro SHA como ocurriría con un cherry-pick no idéntico.
  writeFileSync(join(root, 'new.txt'), 'feature X\n')
  git('add', 'new.txt')
  git('commit', '-qm', 'otra descripción')
  git('branch', 'origin/main', 'main')
  git('branch', 'origin/dev', 'dev')
  assert.throws(() => verifySelectedCommits(root, [original]), /no es candidato/)
})

test('acepta commit de dev con parche realmente nuevo', () => {
  const { root, git } = sandboxRepo()
  git('branch', '-M', 'main')
  git('branch', 'origin/main')
  git('branch', 'dev')
  git('switch', '-q', 'dev')
  writeFileSync(join(root, 'new.txt'), 'feature X\n')
  git('add', 'new.txt')
  git('commit', '-qm', 'feature X')
  const newCommit = git('rev-parse', 'HEAD')
  git('branch', 'origin/dev')
  assert.doesNotThrow(() => verifySelectedCommits(root, [newCommit]))
})

test('simula la selección en aislamiento y detecta conflictos con main', () => {
  const { root, git } = sandboxRepo()
  git('branch', '-M', 'main')
  const base = git('rev-parse', 'HEAD')
  writeFileSync(join(root, 'shared.txt'), 'main\n')
  git('add', 'shared.txt')
  git('commit', '-qm', 'main cambia shared')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  git('switch', '-q', '-c', 'dev', base)
  writeFileSync(join(root, 'shared.txt'), 'dev\n')
  git('add', 'shared.txt')
  git('commit', '-qm', 'dev cambia shared')
  const selected = git('rev-parse', 'HEAD')
  git('update-ref', 'refs/remotes/origin/dev', 'HEAD')
  assert.throws(() => simulateSelectedCommits(root, [selected]), /Conflicto al simular/)
})

import { validateChecks } from './cli.mjs'

test('exige CI obligatorio aprobado, no skip ni pending', () => {
  const pr = { isDraft: false, statusCheckRollup: [
    { name: 'validate', workflowName: 'Validar pull request', conclusion: 'SUCCESS' },
    { name: 'test', conclusion: 'SUCCESS' },
  ] }
  assert.doesNotThrow(() => validateChecks(pr))
  assert.throws(() => validateChecks({ ...pr, statusCheckRollup: [{ name: 'validate', conclusion: 'SKIPPED' }] }), /no ha terminado con SUCCESS/)
  assert.throws(() => validateChecks({ ...pr, statusCheckRollup: [{ name: 'validate', state: 'PENDING' }] }), /no aprobadas/)
  assert.throws(() => validateChecks({ ...pr, isDraft: true }), /borrador/)
})
