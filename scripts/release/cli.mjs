#!/usr/bin/env node
// Pablo Tablet: automatización local, sin IA y sin operaciones implícitas de publicación.
// Node.js >=22. Requiere Git, gh y npm; Android SDK/JDK para las validaciones nativas.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, copyFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const REPOSITORY = 'Pablo-hg/Pablo-Tablet'
const CERTIFICATE = '7a706549c89f27d3560fad8ffb7127d395c3830d18f403463d65d9e2fb6af346'
const OPTIONS = new Set(['--dry-run', '--commits', '--issues', '--notes'])

export function semverParts(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? '')) {
    throw new Error(`Versión inválida: ${version}. Utiliza X.Y.Z, sin v.`)
  }
  return version.split('.').map(Number)
}
export function compareVersions(left, right) {
  const a = semverParts(left); const b = semverParts(right)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return Math.sign(a[i] - b[i])
  return 0
}
export function nextPatchVersion(versions) {
  if (!versions.length) return '0.1.0'
  const latest = [...new Set(versions)].sort(compareVersions).at(-1)
  const [major, minor, patch] = semverParts(latest)
  return `${major}.${minor}.${patch + 1}`
}
export function parseSelection(value, maximum) {
  if (!Number.isInteger(maximum) || maximum < 1) throw new Error('No hay commits candidatos para seleccionar.')
  const selected = new Set()
  for (const part of (value ?? '').split(',').map(item => item.trim()).filter(Boolean)) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/)
    if (!match) throw new Error('Selecciona por número, por ejemplo: 1,3-5.')
    const start = Number(match[1]); const end = Number(match[2] ?? match[1])
    if (start < 1 || end < start || end > maximum) throw new Error(`Selección fuera de rango: ${part}.`)
    for (let index = start; index <= end; index++) selected.add(index - 1)
  }
  if (!selected.size) throw new Error('Debes seleccionar al menos un commit de forma explícita.')
  return [...selected].sort((left, right) => left - right)
}
export function issueNumbersFromText(text) {
  return [...new Set([...String(text ?? '').matchAll(/#([1-9]\d*)/g)].map(match => match[1]))]
}
export function draftReleaseNotes(issueData) {
  const bullets = issueData.map(issue => issue.title
    .replace(/^(?:feat|fix|docs|chore|refactor|test)(?:\([^)]*\))?:\s*/i, '')
    .replace(/\s*\(#\d+\)\s*$/i, '')
    .trim())
    .filter(Boolean)
    .map(title => `- ${title[0].toUpperCase()}${title.slice(1)}${/[.!?]$/.test(title) ? '' : '.'}`)
  return `## Novedades\n\n${bullets.join('\n')}\n`
}
export function validateNotesText(value) {
  const text = String(value ?? '').trim()
  if (text.length < 25) throw new Error('Las novedades están vacías o son demasiado breves.')
  if (text.includes('Describe aquí una mejora') || text.includes('Explica aquí una corrección')) {
    throw new Error('Las novedades aún contienen texto de ejemplo. Redáctalas antes de crear la rama.')
  }
  if (/#\d+/.test(text)) throw new Error('Las novedades son para usuarios y no deben contener números de Issue.')
  if (/^(?:[-*]\s*)?(?:feat|fix|docs|chore|refactor|test)(?:\([^)]*\))?:/im.test(text)) {
    throw new Error('Las novedades no deben copiar mensajes técnicos de commit. Escríbelas para el usuario.')
  }
  return `${text}\n`
}
export function validateIssueRecord(record, expectedNumber) {
  if (record?.pull_request) throw new Error(`#${expectedNumber} es un Pull Request, no un Issue.`)
  if (Number(record?.number) !== Number(expectedNumber) || !record?.title) {
    throw new Error(`No se ha podido validar el Issue #${expectedNumber}.`)
  }
  return {
    number: record.number,
    title: record.title,
    state: String(record.state ?? '').toUpperCase(),
    url: record.html_url,
  }
}
export function parseIssues(value) {
  const values = (value ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!values.length || values.some(v => !/^[1-9]\d*$/.test(v))) {
    throw new Error('Indica los Issues reales como --issues 12,15 (sin #).')
  }
  return [...new Set(values)]
}
export function parseCommits(value) {
  const values = (value ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!values.length || values.some(v => !/^[a-f\d]{7,40}$/i.test(v))) {
    throw new Error('Indica los SHA aprobados como --commits abc1234,def5678.')
  }
  return [...new Set(values)]
}
export function parseFlags(args) {
  const result = { dryRun: false, commits: '', issues: '', notes: '' }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!OPTIONS.has(arg)) throw new Error(`Opción desconocida: ${arg}`)
    if (arg === '--dry-run') result.dryRun = true
    else {
      const name = arg.slice(2)
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Falta el valor de ${arg}`)
      result[name] = args[++i]
    }
  }
  return result
}

function command(binary, args, { cwd = process.cwd(), capture = false, allowFailure = false } = {}) {
  const isWindowsScript = process.platform === 'win32' && (binary === 'npm' || binary.endsWith('.bat'))
  const exe = isWindowsScript && binary === 'npm' ? 'npm.cmd' : binary
  console.log(`> ${binary} ${args.join(' ')}`)
  const result = spawnSync(exe, args, {
    cwd,
    encoding: 'utf8',
    shell: isWindowsScript,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
  })
  if (result.error) throw new Error(`${binary}: ${result.error.message}`)
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${binary} ha fallado (código ${result.status}): ${(result.stderr ?? '').trim()}`)
  }
  return { ok: result.status === 0, output: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() }
}
function git(args, cwd, options = {}) { return command('git', args, { cwd, ...options }) }
function gh(args, cwd, options = {}) { return command('gh', args, { cwd, ...options }) }
function capture(binary, args, cwd) { return command(binary, args, { cwd, capture: true }).output }
function ghJson(args, cwd) { return JSON.parse(gh(args, cwd, { capture: true }).output) }
function clean(root) {
  if (git(['status', '--porcelain', '--untracked-files=normal'], root, { capture: true }).output) {
    throw new Error(`Hay cambios pendientes en ${root}. Revísalos antes de continuar.`)
  }
}
function repoRoot() {
  const root = capture('git', ['rev-parse', '--show-toplevel'], process.cwd())
  const url = capture('git', ['remote', 'get-url', 'origin'], root)
  if (!/[:/]Pablo-hg\/Pablo-Tablet(?:\.git)?$/i.test(url)) {
    throw new Error(`El remoto origin no corresponde a ${REPOSITORY}: ${url}`)
  }
  return root
}
function validateVersion(version) { semverParts(version); return `v${version}` }
function releaseWorktree(root, version) { return resolve(dirname(root), `${basename(root)}-release-${version}`) }
function fetchBranches(root) { git(['fetch', 'origin', '--prune', '--tags'], root) }
function remoteTagExists(root, tag) {
  return !!git(['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], root, { capture: true }).output
}
function remoteBranchExists(root, branch) {
  return !!git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], root, { capture: true }).output
}
function ensureNewVersion(root, version) {
  const tag = validateVersion(version)
  const remoteTags = git(['ls-remote', '--tags', 'origin'], root, { capture: true }).output
  const versions = [...remoteTags.matchAll(/refs\/tags\/v(\d+\.\d+\.\d+)(?:\^\{\})?/g)]
    .map(match => match[1])
  if (versions.some(current => compareVersions(version, current) <= 0)) {
    throw new Error(`La versión ${version} ya existe o no es posterior a los tags publicados.`)
  }
  if (remoteTagExists(root, tag)) throw new Error(`Ya existe el tag remoto ${tag}.`)
  if (git(['tag', '--list', tag], root, { capture: true }).output) throw new Error(`Ya existe el tag local ${tag}.`)
}
async function confirm(expected) {
  if (!process.stdin.isTTY) throw new Error(`Hace falta un terminal interactivo para autorizar ${expected}.`)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`Escribe exactamente «${expected}» para continuar: `)
    if (answer.trim() !== expected) throw new Error('Operación cancelada: autorización no coincidente.')
  } finally { rl.close() }
}
function showPendingCommits(root) {
  const res = git(['log', '--cherry-pick', '--right-only', '--oneline', '--no-merges', 'origin/main...origin/dev', '-25'], root, { capture: true, allowFailure: true })
  console.log('\nÚltimos commits candidatos de dev (debes seleccionar explícitamente):')
  console.log(res.ok && res.output ? res.output : 'No hay commits candidatos o faltan referencias locales; ejecuta git fetch origin main dev.')
}
function candidateCommits(root) {
  const output = git(['log', '--cherry-pick', '--right-only', '--no-merges', '--reverse',
    '--format=%H%x1f%s', 'origin/main...origin/dev'], root, { capture: true }).output
  return output.split(/\r?\n/).filter(Boolean).map(line => {
    const [sha, subject] = line.split('\x1f')
    const files = git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha], root, { capture: true })
      .output.split(/\r?\n/).filter(Boolean)
    return { sha, subject, issues: issueNumbersFromText(subject), files }
  })
}
export function findPotentialDependencies(candidates, selectedShas) {
  const selected = new Set(selectedShas)
  const result = []
  for (const [selectedIndex, commit] of candidates.entries()) {
    if (!selected.has(commit.sha)) continue
    for (const dependency of candidates.slice(0, selectedIndex)) {
      if (selected.has(dependency.sha)) continue
      const sameIssue = commit.issues?.some(issue => dependency.issues?.includes(issue)) ?? false
      const sharedFiles = commit.files?.filter(file => dependency.files?.includes(file)) ?? []
      if (sameIssue || sharedFiles.length) {
        result.push({ commit, dependency, sameIssue, sharedFiles })
      }
    }
  }
  return result
}
export function buildPullRequestBody(issues, commits) {
  return `## Incidencias incluidas\n\n${issues.map(issue => `- #${issue}`).join('\n')}\n\n` +
    `## Commits seleccionados\n\n${commits.map(sha => `- \`${sha}\``).join('\n')}\n\n` +
    '## Validación\n\n- npm ci\n- npm run lint\n- npm test -- --run\n- npm run android:sync\n' +
    '- git diff --check\n- ./gradlew lintDebug testDebugUnitTest assembleDebug\n'
}
export function simulateSelectedCommits(root, commits) {
  const sandbox = mkdtempSync(join(tmpdir(), 'pablo-release-simulation-'))
  const resolvedSandbox = resolve(sandbox)
  const resolvedTemp = resolve(tmpdir())
  if (!resolvedSandbox.startsWith(`${resolvedTemp}${sep}`)) throw new Error(`Ruta temporal inesperada: ${resolvedSandbox}`)
  try {
    git(['clone', '--quiet', '--no-hardlinks', '--no-checkout', root, sandbox], root)
    git(['fetch', '--quiet', root,
      '+refs/remotes/origin/main:refs/remotes/source/main',
      '+refs/remotes/origin/dev:refs/remotes/source/dev'], sandbox)
    git(['checkout', '--quiet', '--detach', 'refs/remotes/source/main'], sandbox)
    git(['config', 'user.name', 'Pablo Tablet Release Assistant'], sandbox)
    git(['config', 'user.email', 'release-assistant@example.invalid'], sandbox)
    for (const sha of commits) {
      const result = git(['cherry-pick', '-x', sha], sandbox, { capture: true, allowFailure: true })
      if (!result.ok) {
        throw new Error(`Conflicto al simular ${sha.slice(0, 12)} sobre main:\n${result.stderr || result.output}`)
      }
    }
    console.log('Simulación correcta: los commits elegidos se aplican sobre main en ese orden y sin incorporar otros commits.')
  } finally {
    rmSync(resolvedSandbox, { recursive: true, force: true })
  }
}
function requireWorktree(root, version) {
  const folder = releaseWorktree(root, version)
  if (!existsSync(folder)) throw new Error(`No existe el worktree esperado: ${folder}`)
  const branch = capture('git', ['branch', '--show-current'], folder)
  if (branch !== `release/${version}`) throw new Error(`Rama inesperada: ${branch}`)
  return folder
}
function notesCheck(file) {
  if (!existsSync(file)) throw new Error(`No existe el archivo de novedades: ${file}`)
  return validateNotesText(readFileSync(file, 'utf8'))
}
function preflight(root, version) {
  console.log(`Repositorio: ${root}\nRemoto: ${REPOSITORY}`)
  if (version) validateVersion(version)
  for (const binary of ['git', 'gh', 'node', 'npm']) command(binary, ['--version'], { cwd: root })
  gh(['auth', 'status'], root)
  const current = git(['status', '--short'], root, { capture: true }).output
  console.log(current ? `Cambios locales (se conservarán):\n${current}` : 'Directorio actual sin cambios pendientes.')
  console.log(`main remoto: ${capture('git', ['ls-remote', 'origin', 'refs/heads/main'], root)}`)
  if (version) {
    console.log(`Tag propuesto: v${version}; rama: release/${version}`)
    ensureNewVersion(root, version)
  }
  showPendingCommits(root)
  console.log('Consejo: ejecuta git fetch origin --prune antes de preparar una release para actualizar origin/main y origin/dev.')
  console.log('\nPreflight completado: ninguna rama, PR, etiqueta o APK creados.')
}
function ensureSDK(android) {
  const local = join(android, 'local.properties')
  if (existsSync(local)) return
  // El usuario puede tener SDK configurado únicamente en el worktree principal.
  // Copiamos la configuración local ignorada por Git en lugar de asumir ANDROID_HOME.
  const source = join(process.cwd(), 'android', 'local.properties')
  if (resolve(source) !== resolve(local) && existsSync(source)) {
    copyFileSync(source, local)
    console.log(`Se ha reutilizado la ubicación del SDK del worktree principal: ${local}`)
    return
  }
  const root = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  if (!root || !existsSync(root)) {
    throw new Error('Android SDK no localizado. Define ANDROID_HOME o ANDROID_SDK_ROOT, o crea android/local.properties (ignorado por Git).')
  }
  // Java .properties: barras directas y ':' escapados; archivo local ignorado en .gitignore.
  const sdk = resolve(root).replaceAll('\\', '/').replace(/^([A-Za-z]):/, '$1\\:')
  writeFileSync(local, `sdk.dir=${sdk}\n`, 'utf8')
  console.log(`Se ha creado ${local} (ignorado por Git).`)
}
// Capacitor regenera dos archivos Gradle. En Windows puede marcarlos como modificados
// por LF/CRLF incluso si git diff no muestra ningún cambio de contenido.
// NO restaurar cambios funcionales ni otros archivos: fallar y conservarlos para revisión.
export function restoreFormattingOnlyGeneratedFiles(root) {
  const known = ['android/app/capacitor.build.gradle', 'android/capacitor.settings.gradle']
  const status = git(['status', '--porcelain', '--untracked-files=normal'], root, { capture: true }).output
  if (!status) return
  const other = git(['status', '--porcelain', '--untracked-files=normal', '--', '.',
    ...known.map(path => `:(exclude)${path}`)], root, { capture: true }).output
  if (other) throw new Error(`Capacitor/Gradle han dejado otros archivos modificados; revisión manual necesaria:\n${other}`)
  const staged = git(['diff', '--cached', '--quiet'], root, { capture: true, allowFailure: true })
  if (!staged.ok) throw new Error('Hay modificaciones preparadas para commit: no se restaura nada.')
  const functional = git(['diff', '--ignore-space-at-eol', '--quiet', '--', ...known], root,
    { capture: true, allowFailure: true })
  if (!functional.ok) throw new Error('Los archivos generados contienen diferencias reales: no se restaura nada.')
  git(['restore', '--', ...known], root)
  clean(root)
  console.log('Restaurados exclusivamente los cambios de finales de línea de archivos Gradle generados.')
}

function validate(root) {
  clean(root)
  command('npm', ['ci'], { cwd: root })
  command('npm', ['run', 'lint'], { cwd: root })
  command('npm', ['test', '--', '--run'], { cwd: root })
  command('npm', ['run', 'android:sync'], { cwd: root })
  git(['diff', '--check'], root)
  const android = join(root, 'android')
  if (!existsSync(android)) throw new Error('No existe la carpeta android/.')
  ensureSDK(android)
  const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
  command(gradle, ['lintDebug', 'testDebugUnitTest', 'assembleDebug'], { cwd: android })
  git(['diff', '--check'], root)
  restoreFormattingOnlyGeneratedFiles(root)
  clean(root)
  console.log('Validación local completa. Únicamente se ha generado un APK debug, no una Release.')
}

// Comprueba la selección por SHA y por parche equivalente, sin decidir qué publicar.
// Debe ejecutarse tras actualizar las referencias remotas con `git fetch origin --prune`.
export function verifySelectedCommits(root, commits) {
  const eligible = new Set(git(['log', '--cherry-pick', '--right-only', '--no-merges',
    '--format=%H', 'origin/main...origin/dev'], root, { capture: true }).output.split(/\r?\n/).filter(Boolean))
  for (const sha of commits) {
    const actual = git(['rev-parse', '--verify', `${sha}^{commit}`], root, { capture: true, allowFailure: true })
    if (!actual.ok) throw new Error(`No existe el commit ${sha} en las referencias locales.`)
    const full = actual.output
    const parents = git(['rev-list', '--parents', '-n', '1', full], root, { capture: true }).output.split(/\s+/)
    if (parents.length > 2) throw new Error(`No se admite cherry-pick directo de commits de merge: ${sha}`)
    if (!git(['merge-base', '--is-ancestor', full, 'origin/dev'], root,
      { capture: true, allowFailure: true }).ok) throw new Error(`El commit ${sha} no está integrado en origin/dev.`)
    if (!eligible.has(full)) throw new Error(`El commit ${sha} no es candidato: ya está en main, hay un parche equivalente o no está en la diferencia con dev.`)
  }
}

async function prepare(root, version, opts) {
  const branch = `release/${version}`
  const folder = releaseWorktree(root, version)
  const commits = parseCommits(opts.commits)
  const issues = parseIssues(opts.issues)
  if (!opts.notes && !opts.notesText) throw new Error('Indica --notes ruta/novedades.md con texto aprobado.')
  const notesSource = opts.notes ? resolve(opts.notes) : null
  const notesText = opts.notesText ? validateNotesText(opts.notesText) : notesCheck(notesSource)
  console.log(`Versión: ${version}\nRama: ${branch}\nWorktree: ${folder}\nCommits seleccionados: ${commits.join(', ')}\nIssues: ${issues.join(', ')}\nNotas: ${notesSource ?? 'revisadas en el asistente'}`)
  // Ambas rutas comprueban los mismos requisitos antes de la primera escritura.
  // En dry-run NO hacemos fetch ni creamos commits: las referencias deben estar actualizadas.
  ensureNewVersion(root, version)
  if (existsSync(folder)) throw new Error(`Ya existe el directorio ${folder}`)
  if (remoteBranchExists(root, branch)) throw new Error(`Ya existe la rama remota ${branch}`)
  if (git(['branch', '--list', branch], root, { capture: true }).output) throw new Error(`Ya existe la rama local ${branch}`)
  verifySelectedCommits(root, commits)
  for (const issue of issues) validateIssueRecord(ghJson(['api', `repos/${REPOSITORY}/issues/${issue}`], root), issue)
  if (opts.dryRun) {
    console.log('DRY-RUN: versión, commits e Issues comprobados. No se ha creado ni modificado nada.')
    return
  }
  if (!opts.confirmed) await confirm(`PREPARAR v${version}`)
  fetchBranches(root)
  ensureNewVersion(root, version)
  if (remoteBranchExists(root, branch)) throw new Error(`Ya existe la rama remota ${branch}`)
  verifySelectedCommits(root, commits)
  git(['worktree', 'add', '-b', branch, folder, 'origin/main'], root)
  try {
    for (const sha of commits) git(['cherry-pick', '-x', sha], folder)
    const noteTarget = join(folder, '.github', 'release-notes', `v${version}.md`)
    if (existsSync(noteTarget)) throw new Error(`El archivo de novedades ya existe: ${noteTarget}`)
    mkdirSync(dirname(noteTarget), { recursive: true })
    if (notesSource) copyFileSync(notesSource, noteTarget)
    else writeFileSync(noteTarget, notesText, 'utf8')
    git(['add', '--', `.github/release-notes/v${version}.md`], folder)
    git(['diff', '--cached', '--check'], folder)
    git(['commit', '-m', `docs: novedades para v${version}`], folder)
    validate(folder)
    console.log(`Rama ${branch} preparada y validada en ${folder}. NO se ha subido ni publicado.`)
    console.log('Preparación terminada. El asistente continuará con el envío del PR.')
  } catch (error) {
    console.error(`El worktree se conserva para diagnosticar el error: ${folder}`)
    console.error('Si falló un cherry-pick: resuelve conflictos y ejecuta git cherry-pick --continue desde el worktree.')
    throw error
  }
}

function parseIssueSection(body) {
  const section = body?.match(/##\s+Incidencias incluidas\s*([\s\S]*?)(?=\n##\s|$)/i)?.[1] ?? ''
  if (!/#\d+/.test(section)) throw new Error('El PR debe incluir Issues en ## Incidencias incluidas.')
  return section
}
function prForVersion(root, version) {
  const fields = 'number,url,body,isDraft,baseRefName,headRefName,headRefOid,mergedAt,mergeCommit,statusCheckRollup,mergeStateStatus'
  const branch = `release/${version}`
  let data
  const direct = gh(['pr', 'view', branch, '--repo', REPOSITORY, '--json', fields],
    root, { capture: true, allowFailure: true })
  if (direct.ok) data = JSON.parse(direct.output)
  else {
    // GitHub puede eliminar la rama automáticamente después de fusionarla.
    const prs = ghJson(['pr', 'list', '--repo', REPOSITORY, '--state', 'all',
      '--base', 'main', '--head', branch, '--limit', '100', '--json', fields], root)
    if (prs.length !== 1) throw new Error(`No se ha encontrado un PR único para ${branch}. Compruébalo en GitHub.`)
    data = prs[0]
  }
  if (data.baseRefName !== 'main' || data.headRefName !== branch) {
    throw new Error('El PR no conecta la release esperada con main.')
  }
  parseIssueSection(data.body)
  return data
}
async function submit(root, version, opts) {
  const issues = parseIssues(opts.issues)
  const commits = opts.commits ? parseCommits(opts.commits) : []
  const folder = requireWorktree(root, version)
  notesCheck(join(folder, '.github', 'release-notes', `v${version}.md`))
  clean(folder)
  const body = buildPullRequestBody(issues, commits)
  console.log(`PR release/${version} -> main\n${body}`)
  if (opts.dryRun) { console.log('DRY-RUN: no hay push ni PR.'); return }
  if (!opts.confirmed) await confirm(`ENVIAR v${version}`)
  for (const issue of issues) validateIssueRecord(ghJson(['api', `repos/${REPOSITORY}/issues/${issue}`], folder), issue)
  git(['fetch', 'origin', 'main'], folder)
  if (!git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], folder, { capture: true, allowFailure: true }).ok) {
    throw new Error('main ha avanzado desde la preparación. Revisa y actualiza la rama release antes de abrir el PR.')
  }
  validate(folder)
  git(['push', '-u', 'origin', `release/${version}`], folder)
  const created = gh(['pr', 'create', '--repo', REPOSITORY, '--base', 'main', '--head', `release/${version}`,
    '--title', `release: Pablo Tablet ${version}`, '--body', body], folder, { capture: true })
  console.log('PR creado. Consulta sus comprobaciones antes de fusionar.')
  return created.output
}

export function validateChecks(pr) {
  if (pr.isDraft) throw new Error('El PR está en borrador.')
  const statuses = pr.statusCheckRollup ?? []
  if (!statuses.length) throw new Error('El PR todavía no tiene comprobaciones de CI.')
  const approved = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL'])
  const invalid = statuses.filter(check => !approved.has(check.conclusion ?? check.state))
  if (invalid.length) throw new Error(`Hay comprobaciones no aprobadas: ${invalid.map(v => v.name || v.context).join(', ')}`)
  const required = statuses.filter(check => check.workflowName === 'Validar pull request' || check.name === 'validate')
  if (!required.length) throw new Error('No se ha encontrado el workflow «Validar pull request».')
  if (!required.some(check => (check.conclusion ?? check.state) === 'SUCCESS')) {
    throw new Error('El workflow obligatorio «Validar pull request» no ha terminado con SUCCESS.')
  }
}
async function merge(root, version, opts) {
  const pr = prForVersion(root, version)
  if (pr.mergedAt) throw new Error('El PR ya está fusionado; usa el paso publish.')
  validateChecks(pr)
  console.log(`PR #${pr.number}: ${pr.url}\nIncidencias incluidas: ${parseIssueSection(pr.body).trim()}\nTodas las comprobaciones han terminado correctamente.`)
  if (opts.dryRun) { console.log('DRY-RUN: sin fusión.'); return }
  await confirm(`FUSIONAR v${version}`)
  const current = prForVersion(root, version)
  if (current.headRefOid !== pr.headRefOid) throw new Error('El PR ha cambiado de commits; revisa las pruebas de nuevo.')
  validateChecks(current)
  gh(['pr', 'merge', String(pr.number), '--repo', REPOSITORY, '--merge', '--match-head-commit', pr.headRefOid], root)
  const merged = prForVersion(root, version)
  if (!merged.mergedAt || !merged.mergeCommit?.oid) throw new Error('No se ha podido confirmar el commit de merge.')
  console.log(`PR fusionado con merge commit: ${merged.mergeCommit.oid}. No hay tag ni Release.`)
}

async function waitForCI(root, version) {
  let pr
  console.log('\nEsperando a que GitHub registre las comprobaciones del PR...')
  for (let attempt = 0; attempt < 30; attempt++) {
    pr = prForVersion(root, version)
    if (pr.statusCheckRollup?.length) break
    await new Promise(resolveWait => setTimeout(resolveWait, 5000))
  }
  if (!pr?.statusCheckRollup?.length) throw new Error('GitHub no ha registrado comprobaciones de CI para el PR.')
  gh(['pr', 'checks', String(pr.number), '--repo', REPOSITORY, '--watch', '--fail-fast'], root)
  const checked = prForVersion(root, version)
  validateChecks(checked)
  console.log(`CI aprobado para el PR #${checked.number}.`)
  return checked
}

async function reviewNotes(rl, draft) {
  console.log('\nBorrador de novedades (sin números de Issue ni mensajes técnicos):\n')
  console.log(draft)
  const mode = (await rl.question('Escribe A para revisar este borrador o E para reemplazarlo: ')).trim().toUpperCase()
  let text = draft
  if (mode === 'E') {
    console.log('Escribe las novedades en Markdown. Termina con una línea que contenga solo un punto.')
    const lines = []
    while (true) {
      const line = await rl.question('> ')
      if (line.trim() === '.') break
      lines.push(line)
    }
    text = lines.join('\n')
  } else if (mode !== 'A') {
    throw new Error('Opción de notas no reconocida. Usa A o E.')
  }
  const checked = validateNotesText(text)
  const answer = await rl.question('Escribe exactamente «NOTAS REVISADAS» para aprobar este texto: ')
  if (answer.trim() !== 'NOTAS REVISADAS') throw new Error('Operación cancelada: las novedades no fueron aprobadas.')
  return checked
}

async function releaseAssistant(root, opts) {
  if (!process.stdin.isTTY) throw new Error('El asistente requiere un terminal interactivo.')
  console.log('Pablo Tablet — asistente único de publicación')
  console.log(opts.dryRun ? 'MODO DRY-RUN: no se crearán ramas, PR, tags, Releases ni APK.' : 'No se publicará nada sin confirmaciones separadas para fusionar y publicar.')
  for (const binary of ['git', 'gh', 'node', 'npm']) command(binary, ['--version'], { cwd: root })
  gh(['auth', 'status'], root)
  fetchBranches(root)
  const tags = git(['tag', '--list', 'v*.*.*'], root, { capture: true }).output
    .split(/\r?\n/).filter(Boolean).map(tag => tag.slice(1)).filter(version => {
      try { semverParts(version); return true } catch { return false }
    })
  const suggestedVersion = nextPatchVersion(tags)
  const candidates = candidateCommits(root)
  if (!candidates.length) throw new Error('No hay commits nuevos de dev que no estén ya en main por SHA o parche equivalente.')

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let version; let selectedCommits; let issues; let notes
  try {
    const versionAnswer = (await rl.question(`Siguiente versión [${suggestedVersion}]: `)).trim()
    version = versionAnswer || suggestedVersion
    ensureNewVersion(root, version)
    console.log('\nCommits candidatos de dev:')
    candidates.forEach((commit, index) => console.log(`${String(index + 1).padStart(2)}. ${commit.sha.slice(0, 10)}  ${commit.subject}`))
    const selection = parseSelection(await rl.question('\nSelecciona los commits por número (ej. 1,3-5): '), candidates.length)
    selectedCommits = selection.map(index => candidates[index])
    verifySelectedCommits(root, selectedCommits.map(commit => commit.sha))

    const suggestedIssues = [...new Set(selectedCommits.flatMap(commit => commit.issues))]
    if (suggestedIssues.length) console.log(`Issues detectados en los commits: ${suggestedIssues.join(', ')}`)
    issues = parseIssues(await rl.question('Escribe expresamente los Issues incluidos (ej. 12,15): '))
    const issueData = issues.map(issue => validateIssueRecord(
      ghJson(['api', `repos/${REPOSITORY}/issues/${issue}`], root), issue))
    issueData.forEach(issue => console.log(`#${issue.number} [${issue.state}] ${issue.title}`))

    const dependencies = findPotentialDependencies(candidates, selectedCommits.map(commit => commit.sha))
    if (dependencies.length) {
      console.log('\nPosibles dependencias omitidas (mismo Issue o archivos compartidos):')
      for (const item of dependencies) {
        const reasons = [item.sameIssue ? 'mismo Issue' : '', item.sharedFiles.length ? `archivos: ${item.sharedFiles.join(', ')}` : ''].filter(Boolean)
        console.log(`- ${item.commit.sha.slice(0, 10)} puede depender de ${item.dependency.sha.slice(0, 10)} (${reasons.join('; ')})`)
      }
      const accepted = await rl.question('Revisa la selección. Para conservarla escribe «SELECCIÓN REVISADA»: ')
      if (accepted.trim() !== 'SELECCIÓN REVISADA') throw new Error('Operación cancelada para revisar dependencias.')
    }
    simulateSelectedCommits(root, selectedCommits.map(commit => commit.sha))
    notes = await reviewNotes(rl, draftReleaseNotes(issueData))

    console.log(`\nPlan final\n- v${version}\n- Issues: ${issues.join(', ')}\n- Commits: ${selectedCommits.map(commit => commit.sha).join(', ')}\n- Rama: release/${version} desde origin/main`)
    if (opts.dryRun) {
      console.log('\nDRY-RUN COMPLETADO: selección, dependencias, conflictos, versión, Issues y notas revisados; no se ha creado ni publicado nada.')
      return
    }
    const prepareAnswer = await rl.question(`Escribe exactamente «PREPARAR v${version}» para crear y validar la rama aislada: `)
    if (prepareAnswer.trim() !== `PREPARAR v${version}`) throw new Error('Operación cancelada antes de preparar la rama.')
    const submitAnswer = await rl.question(`Después de la validación se enviará el PR. Escribe «ENVIAR v${version}»: `)
    if (submitAnswer.trim() !== `ENVIAR v${version}`) throw new Error('Operación cancelada antes de enviar el PR.')
  } finally {
    rl.close()
  }

  const commitList = selectedCommits.map(commit => commit.sha).join(',')
  const issueList = issues.join(',')
  await prepare(root, version, { commits: commitList, issues: issueList, notesText: notes, confirmed: true })
  await submit(root, version, { commits: commitList, issues: issueList, confirmed: true })
  await waitForCI(root, version)
  await merge(root, version, {})
  await publish(root, version, {})
}

async function pollWorkflow(root, tag, sha) {
  console.log('Buscando ejecución de Publicar actualización Android...')
  for (let i = 0; i < 36; i++) {
    const runs = ghJson(['run', 'list', '--repo', REPOSITORY, '--workflow', 'android-release.yml',
      '--event', 'push', '--limit', '50', '--json', 'databaseId,headSha,headBranch,status,conclusion'], root)
    const match = runs.find(run => run.headSha === sha && run.headBranch === tag)
    if (match) {
      gh(['run', 'watch', String(match.databaseId), '--repo', REPOSITORY, '--exit-status'], root)
      return
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 5000))
  }
  throw new Error('No se ha encontrado el workflow del tag. Comprueba GitHub Actions manualmente.')
}

async function publish(root, version, opts) {
  const tag = `v${version}`
  const pr = prForVersion(root, version)
  if (!pr.mergedAt || !pr.mergeCommit?.oid) throw new Error('El PR aún no está fusionado con un merge commit.')
  const sha = pr.mergeCommit.oid
  const remoteMain = capture('git', ['ls-remote', 'origin', 'refs/heads/main'], root).split(/\s+/)[0]
  if (remoteMain !== sha) throw new Error(`main ha avanzado. Ahora ${remoteMain}; merge aprobado ${sha}. Publicación bloqueada.`)
  ensureNewVersion(root, version)
  console.log(`PR: ${pr.url}\nIncidencias incluidas: ${parseIssueSection(pr.body).trim()}\nTag: ${tag}\nCommit exacto: ${sha}\nmain remoto: ${remoteMain}`)
  if (opts.dryRun) { console.log('DRY-RUN: no se ha creado ni enviado un tag.'); return }
  await confirm(`PUBLICAR ${tag}`)
  const stillMain = capture('git', ['ls-remote', 'origin', 'refs/heads/main'], root).split(/\s+/)[0]
  if (stillMain !== sha) throw new Error('main ha cambiado durante la confirmación; publicación bloqueada.')
  git(['fetch', 'origin', 'main', '--tags'], root)
  const notePath = `.github/release-notes/${tag}.md`
  const note = git(['show', `${sha}:${notePath}`], root, { capture: true, allowFailure: true })
  if (!note.ok || note.output.trim().length < 25) throw new Error(`No existen novedades válidas en ${notePath} del merge.`)
  ensureNewVersion(root, version)
  git(['tag', '-a', tag, sha, '-m', `Pablo Tablet ${version}`], root)
  if (capture('git', ['ls-remote', 'origin', 'refs/heads/main'], root).split(/\s+/)[0] !== sha) {
    throw new Error('main ha cambiado antes del push del tag; se conserva únicamente la etiqueta LOCAL para revisión.')
  }
  git(['push', 'origin', `refs/tags/${tag}`], root)
  console.log(`Tag ${tag} enviado; la compilación y firma se realizan únicamente en GitHub Actions.`)
  await pollWorkflow(root, tag, sha)
  await verify(root, version)
}

async function sha256File(path) {
  const { createReadStream } = await import('node:fs')
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(path)) digest.update(chunk)
  return digest.digest('hex')
}
async function verify(root, version) {
  const tag = `v${version}`
  const prefix = `Pablo-Tablet-${version}.apk`
  const expectedNames = [prefix, `${prefix}.sha256`, `${prefix}.metadata.txt`, 'Pablo-Tablet-update.json']
  const release = ghJson(['release', 'view', tag, '--repo', REPOSITORY, '--json', 'tagName,assets'], root)
  if (release.tagName !== tag) throw new Error('La versión publicada no coincide con el tag.')
  const names = release.assets.map(asset => asset.name)
  const missing = expectedNames.filter(name => !names.includes(name))
  if (missing.length) throw new Error(`Faltan archivos en la Release: ${missing.join(', ')}`)
  const folder = mkdtempSync(join(tmpdir(), `pablo-tablet-${tag}-`))
  console.log(`Descargando los 4 artefactos oficiales en ${folder}`)
  gh(['release', 'download', tag, '--repo', REPOSITORY, '--dir', folder], root)
  for (const name of expectedNames) if (!existsSync(join(folder, name))) throw new Error(`Falta ${name} tras descargar.`)
  const hash = await sha256File(join(folder, prefix))
  const shaFile = readFileSync(join(folder, `${prefix}.sha256`), 'utf8')
  if (shaFile.trim().split(/\s+/)[0].toLowerCase() !== hash) throw new Error('SHA-256 del APK no coincide con el .sha256.')
  const metadata = readFileSync(join(folder, `${prefix}.metadata.txt`), 'utf8')
  const required = [`artifact=${prefix}`, 'package=com.pablohorcajada.tablet', `versionName=${version}`,
    `certificateSha256=${CERTIFICATE}`, `apkSha256=${hash}`]
  for (const line of required) if (!metadata.includes(line)) throw new Error(`Metadata inválida: falta ${line}`)
  const codeMatch = metadata.match(/^versionCode=(\d+)$/m)
  if (!codeMatch || Number(codeMatch[1]) < 1003) throw new Error('versionCode inválido en metadata.')
  const manifest = JSON.parse(readFileSync(join(folder, 'Pablo-Tablet-update.json'), 'utf8'))
  if (manifest.schemaVersion !== 2 || manifest.versionName !== version || manifest.assetName !== prefix ||
      manifest.sha256 !== hash || manifest.assetSize !== statSync(join(folder, prefix)).size ||
      manifest.downloadUrl !== `https://github.com/${REPOSITORY}/releases/download/${tag}/${prefix}` ||
      !manifest.releaseHistory?.some(item => item.versionName === version && item.releaseNotes?.trim())) {
    throw new Error('Manifiesto incorrecto: versión, APK, huella, URL, tamaño o novedades no coinciden.')
  }
  const shaRemote = capture('git', ['ls-remote', 'origin', 'refs/heads/main'], root).split(/\s+/)[0]
  const tagRemote = capture('git', ['ls-remote', 'origin', `refs/tags/${tag}^{}`], root).split(/\s+/)[0]
  if (shaRemote !== tagRemote) throw new Error('main y la etiqueta publicada no apuntan al mismo commit.')
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  const verifier = join(root, 'scripts', 'verify-android-release.mjs')
  if (sdkRoot && existsSync(verifier)) {
    const localMetadata = join(folder, 'verificacion-local.metadata.txt')
    command('node', [verifier, '--apk', join(folder, prefix),
      '--expected-package', 'com.pablohorcajada.tablet', '--expected-version', version,
      '--expected-certificate-sha256', CERTIFICATE, '--minimum-version-code', '1003',
      '--output', localMetadata], { cwd: root })
    console.log('Firma criptográfica verificada de nuevo con Android SDK.')
  } else {
    console.log('Aviso: comprobados los metadatos de firma publicados; verificación criptográfica ejecutada por GitHub Actions, no repetida localmente por falta de Android SDK.')
  }
  console.log(`VERIFICACIÓN CORRECTA: ${tag}; APK ${hash}; versionCode ${codeMatch[1]}; firma oficial ${CERTIFICATE}`)
  console.log('Estado: publicado y verificado en GitHub. Instalación y validación física PENDIENTES.')
}

const USAGE = `
Pablo Tablet — asistente único de publicación (Node.js 22+)

  npm run release
  npm run release -- --dry-run

El asistente propone la siguiente versión, obliga a elegir commits e Issues, comprueba
conflictos y posibles dependencias, revisa las notas, crea el PR, espera al CI y exige
confirmaciones independientes FUSIONAR y PUBLICAR. --dry-run no crea ni publica nada.
`

async function main() {
  const args = process.argv.slice(2)
  const action = args[0] ?? 'wizard'
  if (['help', '--help', '-h'].includes(action)) { console.log(USAGE); return }
  if (action === 'wizard') {
    const opts = parseFlags(args.slice(1))
    if (opts.commits || opts.issues || opts.notes) throw new Error('El asistente solicita commits, Issues y notas de forma interactiva.')
    return releaseAssistant(repoRoot(), opts)
  }
  const [, version, ...rest] = args
  const valid = new Set(['check', 'prepare', 'validate', 'submit', 'merge', 'publish', 'verify'])
  if (!valid.has(action)) throw new Error(`Acción inválida: ${action}\n${USAGE}`)
  validateVersion(version)
  const opts = parseFlags(rest)
  if (opts.dryRun && ['validate', 'verify'].includes(action)) {
    throw new Error(`--dry-run no se admite con ${action}; utiliza check para una comprobación de solo lectura.`)
  }
  const root = repoRoot()
  if (action === 'check') return preflight(root, version)
  if (action === 'prepare') return prepare(root, version, opts)
  if (action === 'validate') return validate(requireWorktree(root, version))
  if (action === 'submit') return submit(root, version, opts)
  if (action === 'merge') return merge(root, version, opts)
  if (action === 'publish') return publish(root, version, opts)
  if (action === 'verify') return verify(root, version)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`\nERROR: ${error.message}`); process.exitCode = 1 })
}
