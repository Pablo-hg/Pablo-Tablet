import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './worker.js'

const env = {
  GITHUB_TOKEN: 'github-secret',
  FEEDBACK_RELAY_KEY: 'relay-key-with-at-least-thirty-two-characters',
  GITHUB_OWNER: 'Pablo-hg',
  GITHUB_REPO: 'Pablo-Tablet',
}

const report = {
  id: 'a6fdd0c8-09a2-43ed-9fd4-b418c0be21ce',
  type: 'error',
  priority: 'high',
  title: 'La alarma no suena',
  area: 'Reloj',
  description: 'La alarma aparece, pero no reproduce sonido.',
  appVersion: '0.1.0',
  tabletModel: 'Teclast T65',
  createdAt: Date.parse('2026-10-05T12:00:00Z'),
}

function request(action, value = report, key = env.FEEDBACK_RELAY_KEY) {
  return new Request('https://feedback.example.com/report', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, report: value }),
  })
}

describe('relay de comentarios', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('crea un único Issue y devuelve el estado enviado', async () => {
    const github = vi.fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ number: 17, html_url: 'https://github.com/Pablo-hg/Pablo-Tablet/issues/17', state: 'open', labels: [{ name: 'feedback-movil' }] }), { status: 201 }))
    vi.stubGlobal('fetch', github)

    const response = await worker.fetch(request('create'), env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ issueNumber: 17, issueUrl: 'https://github.com/Pablo-hg/Pablo-Tablet/issues/17', status: 'sent' })
    expect(github).toHaveBeenCalledTimes(2)
    expect(JSON.parse(github.mock.calls[1][1].body)).toMatchObject({ labels: ['feedback-movil'] })
  })

  it('traduce las etiquetas del Issue a los cuatro estados permitidos', async () => {
    const states = [
      [{ name: 'feedback-movil' }, { name: 'visto' }, { name: 'en-desarrollo' }],
      [{ name: 'feedback-movil' }, { name: 'implementado' }],
    ]
    const github = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ number: 17, html_url: 'https://github.com/Pablo-hg/Pablo-Tablet/issues/17', state: 'open', labels: states[0] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ number: 17, html_url: 'https://github.com/Pablo-hg/Pablo-Tablet/issues/17', state: 'closed', labels: states[1] }), { status: 200 }))
    vi.stubGlobal('fetch', github)
    const trackedReport = { ...report, githubIssueNumber: 17 }

    const developing = await worker.fetch(request('status', trackedReport), env)
    await expect(developing.json()).resolves.toMatchObject({ status: 'in_progress' })
    const implemented = await worker.fetch(request('status', trackedReport), env)
    await expect(implemented.json()).resolves.toMatchObject({ status: 'implemented' })
  })

  it('rechaza una clave de envío incorrecta', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const response = await worker.fetch(request('create', report, 'incorrecta'), env)
    expect(response.status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })
})
