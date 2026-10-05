const API_VERSION = '2026-03-10'
const MAX_BODY_BYTES = 32 * 1024
const ALLOWED_TYPES = new Set(['error', 'improvement', 'feature'])
const ALLOWED_PRIORITIES = new Set(['low', 'normal', 'high', 'blocking'])

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders() })
    if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
    if (!env.GITHUB_TOKEN || !env.FEEDBACK_RELAY_KEY || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
      return json({ error: 'El servicio no está configurado.' }, 503)
    }
    if (!authorized(request, env.FEEDBACK_RELAY_KEY)) return json({ error: 'Credencial no válida.' }, 401)
    if (env.SUBMISSION_RATE_LIMITER) {
      const rate = await env.SUBMISSION_RATE_LIMITER.limit({ key: 'pablo-tablet-feedback' })
      if (!rate.success) return json({ error: 'Demasiados intentos. Vuelve a probar en un minuto.' }, 429)
    }

    const declaredLength = Number(request.headers.get('content-length') || 0)
    if (declaredLength > MAX_BODY_BYTES) return json({ error: 'El reporte es demasiado grande.' }, 413)
    const raw = await request.text()
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ error: 'El reporte es demasiado grande.' }, 413)

    try {
      const payload = JSON.parse(raw)
      const report = validateReport(payload.report)
      if (payload.action === 'status') return await readStatus(env, report)
      if (payload.action !== 'create') return json({ error: 'Operación no válida.' }, 400)
      return await createIssue(env, report)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Solicitud no válida.' }, 400)
    }
  },
}

function authorized(request, expectedKey) {
  const authorization = request.headers.get('authorization') || ''
  return authorization === `Bearer ${expectedKey}`
}

function validateReport(value) {
  if (!value || typeof value !== 'object') throw new Error('Falta el reporte.')
  const report = {
    id: requiredText(value.id, 80, 'Identificador no válido.'),
    type: requiredText(value.type, 20, 'Tipo no válido.'),
    priority: requiredText(value.priority, 20, 'Importancia no válida.'),
    title: requiredText(value.title, 100, 'Título no válido.'),
    area: requiredText(value.area, 60, 'Apartado no válido.'),
    description: requiredText(value.description, 4000, 'Descripción no válida.'),
    appVersion: requiredText(value.appVersion, 30, 'Versión no válida.'),
    tabletModel: requiredText(value.tabletModel, 100, 'Modelo no válido.'),
    createdAt: Number(value.createdAt),
    githubIssueNumber: Number(value.githubIssueNumber || 0),
  }
  if (!ALLOWED_TYPES.has(report.type)) throw new Error('Tipo no válido.')
  if (!ALLOWED_PRIORITIES.has(report.priority)) throw new Error('Importancia no válida.')
  if (!Number.isFinite(report.createdAt) || report.createdAt <= 0) throw new Error('Fecha no válida.')
  return report
}

function requiredText(value, maximum, message) {
  const clean = String(value ?? '').trim()
  if (!clean || clean.length > maximum) throw new Error(message)
  return clean
}

async function createIssue(env, report) {
  const existing = await findExistingIssue(env, report.id)
  if (existing) return issueResponse(existing)
  const typeLabel = report.type === 'error' ? 'Error' : report.type === 'feature' ? 'Nueva función' : 'Mejora'
  const issue = await github(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title: `[${typeLabel}] ${report.title}`,
      body: issueBody(report),
      labels: ['feedback-movil'],
    }),
  })
  return issueResponse(issue)
}

async function findExistingIssue(env, reportId) {
  const issues = await github(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues?state=all&labels=feedback-movil&per_page=100`)
  const marker = `<!-- pablo-tablet-feedback:${reportId} -->`
  return issues.find((issue) => !issue.pull_request && String(issue.body || '').includes(marker)) || null
}

async function readStatus(env, report) {
  if (!Number.isInteger(report.githubIssueNumber) || report.githubIssueNumber <= 0) throw new Error('Falta el número del Issue.')
  const issue = await github(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues/${report.githubIssueNumber}`)
  return issueResponse(issue)
}

function issueResponse(issue) {
  const labels = issue.labels.map((label) => typeof label === 'string' ? label : label.name).filter(Boolean)
  const status = issue.state === 'closed' && labels.includes('implementado')
    ? 'implemented'
    : labels.includes('en-desarrollo')
      ? 'in_progress'
      : labels.includes('visto')
        ? 'seen'
        : 'sent'
  return json({ issueNumber: issue.number, issueUrl: issue.html_url, status })
}

function issueBody(report) {
  const typeLabel = report.type === 'error' ? 'Error' : report.type === 'feature' ? 'Nueva función' : 'Mejora'
  return [
    `<!-- pablo-tablet-feedback:${report.id} -->`,
    `# [${typeLabel}] ${report.title}`,
    '',
    `- Apartado: ${report.area}`,
    `- Importancia: ${report.priority}`,
    `- Versión: ${report.appVersion}`,
    `- Tablet: ${report.tabletModel}`,
    `- Fecha: ${new Date(report.createdAt).toISOString()}`,
    '',
    '## Descripción',
    '',
    report.description,
  ].join('\n')
}

async function github(env, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Pablo-Tablet-Feedback-Relay',
      'X-GitHub-Api-Version': API_VERSION,
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `GitHub respondió con HTTP ${response.status}.`)
  return body
}

function responseHeaders() {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: responseHeaders() })
}

export { issueBody, issueResponse, validateReport }
