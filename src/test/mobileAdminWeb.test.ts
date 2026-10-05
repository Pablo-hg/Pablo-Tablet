import { fireEvent, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calendarEventTiming } from '../../public/mobile/calendarTiming.js'

describe('administración móvil', () => {
  const originalFetch = window.fetch
  const originalWebSocket = window.WebSocket

  afterEach(() => {
    Object.defineProperty(window, 'fetch', { configurable: true, value: originalFetch })
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: originalWebSocket })
    window.localStorage.clear()
  })

  it('edita y guarda los ajustes nocturnos de la tablet', async () => {
    const html = readFileSync(resolve(process.cwd(), 'public/mobile/index.html'), 'utf8')
    const script = readFileSync(resolve(process.cwd(), 'public/mobile/app.js'), 'utf8')
    document.open()
    document.write(html)
    document.close()
    const view = within(document.body)
    window.localStorage.setItem('pablo-tablet.mobile-token.v1', 'credencial-prueba')

    let savedState: Record<string, unknown> | null = null
    const dashboard = {
      calendarEvents: [
        { id: 'terminado', type: 'event', recurrence: 'none', completed: false, title: 'Evento terminado', date: '2020-01-01', endDate: '2020-01-03', startTime: '09:00', endTime: '10:00', allDay: false },
        { id: 'futuro', type: 'event', recurrence: 'none', completed: false, title: 'Evento futuro', date: '2099-01-01', endDate: '2099-01-01', startTime: '09:00', endTime: '10:00', allDay: false },
      ],
      preferences: {
        enabledPageIds: ['dashboard'],
        nightModeEnabled: true,
        nightModeStart: '22:30',
        nightModeEnd: '07:00',
        nightBrightness: 5,
        nightAlarmVolume: 30,
        nightMediaVolume: 12,
      },
    }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') savedState = JSON.parse(String(init.body)).state
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => init?.method === 'PUT' ? { updatedAt: Date.now() } : { state: dashboard, device: { name: 'Móvil de prueba' } },
      }
    })
    class WebSocketStub {
      addEventListener() {}
      close() {}
    }
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock })
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: WebSocketStub })

    Object.assign(window, { calendarEventTiming })
    window.eval(script.replace("import { calendarEventTiming } from './calendarTiming.js'", ''))
    await waitFor(() => expect(view.getByRole('button', { name: 'Ajustes' })).toBeInTheDocument())
    fireEvent.click(view.getByRole('button', { name: 'Ajustes' }))

    fireEvent.change(view.getByLabelText('Desde'), { target: { value: '21:45' } })
    fireEvent.change(view.getByLabelText('Hasta'), { target: { value: '06:30' } })
    const form = view.getByRole('button', { name: 'Guardar en la tablet' }).closest('form')!
    const brightness = form.elements.namedItem('nightBrightness') as HTMLInputElement
    brightness.value = '3'
    fireEvent.input(brightness)
    fireEvent.submit(form)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ method: 'PUT' })))
    expect(savedState).not.toBeNull()
    expect((savedState as unknown as typeof dashboard).preferences).toMatchObject({ nightModeStart: '21:45', nightModeEnd: '06:30', nightBrightness: 3, nightAlarmVolume: 30, nightMediaVolume: 12 })

    fireEvent.click(view.getByRole('button', { name: 'Calendario' }))
    const endedEvent = view.getByText('Evento terminado').closest('article')!
    const futureEvent = view.getByText('Evento futuro').closest('article')!
    expect(within(endedEvent).getByText('3 días · Finalizado')).toBeInTheDocument()
    expect(within(endedEvent).queryByRole('button', { name: 'Cambiar título' })).not.toBeInTheDocument()
    expect(within(futureEvent).getByText('1 día · Próximo')).toBeInTheDocument()
    expect(within(futureEvent).getByRole('button', { name: 'Cambiar título' })).toBeInTheDocument()
  })

  it('guarda un comentario en la cola de la tablet sin exponer credenciales de GitHub', async () => {
    const html = readFileSync(resolve(process.cwd(), 'public/mobile/index.html'), 'utf8')
    const script = readFileSync(resolve(process.cwd(), 'public/mobile/app.js'), 'utf8')
    document.open()
    document.write(html)
    document.close()
    const view = within(document.body)
    window.localStorage.setItem('pablo-tablet.mobile-token.v1', 'credencial-prueba')

    let submitted: Record<string, unknown> | null = null
    let trackedStatus: string | null = null
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      let body: Record<string, unknown>
      if (path === '/api/feedback' && init?.method === 'POST') {
        submitted = JSON.parse(String(init.body))
        body = { report: { id: 'feedback-1', ...submitted, appVersion: '0.1.0', tabletModel: 'Teclast T65', createdAt: Date.now(), status: 'pending', attempts: 0, lastError: null, githubIssueNumber: null, githubIssueUrl: null, markdown: '# Reporte' } }
      } else if (path === '/api/feedback') {
        body = { reports: trackedStatus ? [{ id: 'feedback-1', type: 'error', title: 'El reloj no suena', area: 'Inicio', createdAt: Date.now(), status: trackedStatus, githubIssueNumber: 12, lastError: null }] : [] }
      } else {
        body = { state: { preferences: {} }, device: { name: 'Móvil de prueba' } }
      }
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body }
    })
    class WebSocketStub {
      addEventListener() {}
      close() {}
    }
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetchMock })
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: WebSocketStub })

    Object.assign(window, { calendarEventTiming })
    window.eval(script.replace("import { calendarEventTiming } from './calendarTiming.js'", ''))
    await waitFor(() => expect(view.getByRole('button', { name: 'Comentarios' })).toBeInTheDocument())
    fireEvent.click(view.getByRole('button', { name: 'Comentarios' }))
    await waitFor(() => expect(view.getByRole('button', { name: 'Guardar y preparar envío' })).toBeInTheDocument())

    fireEvent.change(view.getByLabelText('Título'), { target: { value: 'El reloj no suena' } })
    fireEvent.change(view.getByLabelText('Descripción'), { target: { value: 'La alarma aparece, pero no reproduce audio.' } })
    fireEvent.click(view.getByText(/He revisado el texto/))
    fireEvent.submit(view.getByRole('button', { name: 'Guardar y preparar envío' }).closest('form')!)

    await waitFor(() => expect(submitted).not.toBeNull())
    expect(submitted).toMatchObject({ type: 'error', priority: 'normal', title: 'El reloj no suena', area: 'Inicio', privacyAccepted: true })
    expect(view.getByText('Todavía no se ha creado el Issue.')).toBeInTheDocument()
    expect(view.queryByLabelText(/Pasos para reproducir/)).not.toBeInTheDocument()
    expect(view.queryByLabelText('Resultado obtenido')).not.toBeInTheDocument()
    expect(view.queryByLabelText('Resultado esperado')).not.toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Descargar .md' })).not.toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Copiar Markdown' })).not.toBeInTheDocument()
    expect(view.queryByText('Enviado', { selector: '.feedback-progress .current' })).not.toBeInTheDocument()
    expect(JSON.stringify(submitted)).not.toMatch(/github.*token|ghp_/i)

    trackedStatus = 'implemented'
    fireEvent.click(view.getByRole('button', { name: 'Comentarios' }))
    await waitFor(() => expect(view.getByText('Implementado', { selector: '.feedback-status' })).toBeInTheDocument())
    expect(view.getByText('Implementado', { selector: '.feedback-progress .current' })).toBeInTheDocument()
  })
})
