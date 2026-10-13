import { calendarEventTiming } from './calendarTiming.js'

const STORAGE_TOKEN = 'pablo-tablet.mobile-token.v1'
const SOCKET_RECONNECT_DELAY_MS = 1800
const SOCKET_OFFLINE_GRACE_MS = 6000
const SOCKET_HEARTBEAT_INTERVAL_MS = 8000
const SOCKET_HEARTBEAT_TIMEOUT_MS = 5000
const connectionLabel = document.querySelector('#connection-label')
const refreshButton = document.querySelector('#refresh-button')
const pairScreen = document.querySelector('#pair-screen')
const lockedScreen = document.querySelector('#locked-screen')
const lockedMessage = document.querySelector('#locked-message')
const appScreen = document.querySelector('#app-screen')
const offlineBanner = document.querySelector('#offline-banner')
const editorContent = document.querySelector('#editor-content')
const toastElement = document.querySelector('#toast')
const tabs = [...document.querySelectorAll('[data-tab]')]

let credential = localStorage.getItem(STORAGE_TOKEN)
let dashboard = null
let activeTab = 'overview'
let socket = null
let reconnectTimer = null
let offlineTimer = null
let heartbeatTimer = null
let heartbeatTimeout = null
let reloadTimer = null
let online = false
let photoUrls = []
let feedbackReports = []

const params = new URLSearchParams(location.search)
const pairingToken = params.get('pair')

function localId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
}

function toast(message) {
  toastElement.textContent = message
  toastElement.classList.remove('hidden')
  window.clearTimeout(toast.timer)
  toast.timer = window.setTimeout(() => toastElement.classList.add('hidden'), 2600)
}

function showOnly(screen) {
  pairScreen.classList.toggle('hidden', screen !== 'pair')
  lockedScreen.classList.toggle('hidden', screen !== 'locked')
  appScreen.classList.toggle('hidden', screen !== 'app')
}

function setConnection(isOnline, label) {
  online = isOnline
  connectionLabel.textContent = label
  offlineBanner.classList.toggle('hidden', isOnline)
  editorContent.querySelectorAll('button,input,textarea,select').forEach((control) => { control.disabled = !isOnline })
}

function revokeLocalAuthorization(message = 'Este móvil ya no está autorizado. Vuelve a vincularlo desde la tablet.') {
  localStorage.removeItem(STORAGE_TOKEN)
  credential = null
  disconnectSocket()
  lockedMessage.textContent = message
  showOnly('locked')
  setConnection(false, 'No autorizado')
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers ?? {})
  if (credential) headers.set('Authorization', `Bearer ${credential}`)
  if (options.body && typeof options.body === 'string') headers.set('Content-Type', 'application/json; charset=utf-8')
  const response = await fetch(path, { ...options, headers })
  if (response.status === 401) {
    revokeLocalAuthorization()
    throw new Error('Este móvil ya no está autorizado.')
  }
  const type = response.headers.get('content-type') ?? ''
  const data = type.includes('application/json') ? await response.json() : null
  if (!response.ok) throw new Error(data?.error ?? `Error ${response.status}`)
  return data
}

function normalizeState(value) {
  const state = value && typeof value === 'object' ? value : {}
  state.notes = Array.isArray(state.notes) ? state.notes : []
  state.calendarEvents = Array.isArray(state.calendarEvents) ? state.calendarEvents : []
  state.alarms = Array.isArray(state.alarms) ? state.alarms : []
  state.timers = Array.isArray(state.timers) ? state.timers : []
  state.galleryPhotos = Array.isArray(state.galleryPhotos) ? state.galleryPhotos : []
  state.weatherLocations = Array.isArray(state.weatherLocations) ? state.weatherLocations : []
  state.widgets = Array.isArray(state.widgets) ? state.widgets : []
  state.preferences = state.preferences && typeof state.preferences === 'object' ? state.preferences : {}
  state.preferences.enabledPageIds = Array.isArray(state.preferences.enabledPageIds) ? state.preferences.enabledPageIds : ['dashboard']
  state.preferences.nightModeEnabled = typeof state.preferences.nightModeEnabled === 'boolean' ? state.preferences.nightModeEnabled : true
  state.preferences.nightModeStart = validTime(state.preferences.nightModeStart) ? state.preferences.nightModeStart : '22:30'
  state.preferences.nightModeEnd = validTime(state.preferences.nightModeEnd) ? state.preferences.nightModeEnd : '07:00'
  state.preferences.nightBrightness = clampNumber(state.preferences.nightBrightness, 1, 30, 5)
  state.preferences.nightAlarmVolume = clampNumber(state.preferences.nightAlarmVolume, 0, 100, 30)
  state.preferences.nightMediaVolume = clampNumber(state.preferences.nightMediaVolume, 0, 100, 12)
  return state
}

function validTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''))
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59)
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback
}

async function loadState(silent = false) {
  try {
    const result = await api('/api/state')
    dashboard = normalizeState(result.state)
    setConnection(true, `Conectado · ${result.device?.name ?? 'móvil autorizado'}`)
    render()
    if (!silent) toast('Datos actualizados')
  } catch (error) {
    setConnection(false, 'Sin conexión')
    if (!silent) toast(error.message)
    throw error
  }
}

async function saveState(message = 'Cambio guardado') {
  if (!online || !dashboard) return
  await api('/api/state', { method: 'PUT', body: JSON.stringify({ state: dashboard }) })
  toast(message)
  render()
}

async function loadFeedback(silent = false) {
  try {
    const result = await api('/api/feedback')
    feedbackReports = Array.isArray(result.reports) ? result.reports : []
    if (activeTab === 'feedback') render()
  } catch (error) {
    if (!silent) toast(error.message)
    throw error
  }
}

function disconnectSocket() {
  window.clearTimeout(reconnectTimer)
  window.clearTimeout(offlineTimer)
  stopHeartbeat()
  const activeSocket = socket
  socket = null
  if (activeSocket) activeSocket.close()
}

function stopHeartbeat() {
  window.clearTimeout(heartbeatTimer)
  window.clearTimeout(heartbeatTimeout)
  heartbeatTimer = null
  heartbeatTimeout = null
}

function scheduleHeartbeat(activeSocket) {
  stopHeartbeat()
  heartbeatTimer = window.setTimeout(() => {
    if (socket !== activeSocket || activeSocket.readyState !== WebSocket.OPEN) return
    activeSocket.send('ping')
    heartbeatTimeout = window.setTimeout(() => {
      if (socket === activeSocket && activeSocket.readyState === WebSocket.OPEN) activeSocket.close()
    }, SOCKET_HEARTBEAT_TIMEOUT_MS)
  }, SOCKET_HEARTBEAT_INTERVAL_MS)
}

function connectSocket() {
  if (!credential) return
  window.clearTimeout(reconnectTimer)
  stopHeartbeat()
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const activeSocket = new WebSocket(`${protocol}//${location.host}/ws?token=${encodeURIComponent(credential)}`)
  socket = activeSocket
  activeSocket.addEventListener('open', () => {
    window.clearTimeout(offlineTimer)
    offlineTimer = null
    setConnection(true, 'Sincronización activa')
    scheduleHeartbeat(activeSocket)
  })
  activeSocket.addEventListener('message', (event) => {
    if (socket !== activeSocket) return
    try {
      const message = JSON.parse(event.data)
      scheduleHeartbeat(activeSocket)
      if (message.type === 'state-changed') {
        window.clearTimeout(reloadTimer)
        reloadTimer = window.setTimeout(() => void loadState(true), 180)
      } else if (message.type === 'authorization-revoked') {
        revokeLocalAuthorization('El acceso de este móvil se ha revocado desde la tablet. Escanea un QR nuevo para volver a vincularlo.')
      }
    } catch { }
  })
  activeSocket.addEventListener('close', () => {
    if (socket !== activeSocket) return
    stopHeartbeat()
    if (offlineTimer === null) {
      offlineTimer = window.setTimeout(() => {
        if (!socket || socket.readyState !== WebSocket.OPEN) setConnection(false, 'Sin conexión')
      }, SOCKET_OFFLINE_GRACE_MS)
    }
    reconnectTimer = window.setTimeout(connectSocket, SOCKET_RECONNECT_DELAY_MS)
  })
  activeSocket.addEventListener('error', () => activeSocket.close())
}

function title(title, subtitle, action = '') {
  return `<div class="section-title"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>${action}</div>`
}

function renderOverview() {
  const photos = dashboard.galleryPhotos.filter((photo) => !photo.deletedAt)
  const tasks = dashboard.calendarEvents.filter((event) => event.type === 'task' && !event.completed)
  return `${title('Tu panel', 'Resumen en tiempo real de la tablet')}
    <div class="summary-grid">
      <div class="summary-card"><strong>${dashboard.notes.filter((note) => !note.archived).length}</strong><span>Notas activas</span></div>
      <div class="summary-card"><strong>${tasks.length}</strong><span>Tareas pendientes</span></div>
      <div class="summary-card"><strong>${dashboard.alarms.filter((alarm) => alarm.enabled).length}</strong><span>Alarmas activas</span></div>
      <div class="summary-card"><strong>${photos.length}</strong><span>Fotos guardadas</span></div>
    </div>
    <div class="card"><h2>Funcionamiento local</h2><p>Este editor habla directamente con la tablet por la Wi‑Fi. No utiliza una nube ni una base de datos externa. Si se pierde la conexión, conserva la vista actual pero bloquea la edición hasta reconectar.</p></div>`
}

function renderNotes() {
  const notes = dashboard.notes.filter((note) => !note.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned))
  return `${title('Notas', 'Crear, fijar, editar y archivar')}
    <form id="note-form" class="card form-grid">
      <label>Título<input name="title" maxlength="80" required /></label>
      <label class="full">Contenido<textarea name="content" maxlength="2000" required></textarea></label>
      <button class="primary-button full" type="submit">Añadir nota</button>
    </form>
    <div class="item-list">${notes.length ? notes.map((note) => `<article class="item"><div class="item-row"><div><strong>${note.pinned ? '📌 ' : ''}${escapeHtml(note.title || 'Sin título')}</strong><br><small>${note.type === 'drawing' ? 'Dibujo local' : new Date(note.updatedAt ?? note.createdAt).toLocaleString('es-ES')}</small></div></div><p>${note.type === 'drawing' ? 'Este dibujo puede verse y conservarse, pero su edición se realiza en la tablet.' : escapeHtml(note.content).replace(/\n/g, '<br>')}</p><div class="actions"><button data-action="edit-note" data-id="${note.id}">Editar</button><button data-action="pin-note" data-id="${note.id}">${note.pinned ? 'Desfijar' : 'Fijar'}</button><button data-action="archive-note" data-id="${note.id}">Archivar</button><button class="danger" data-action="delete-note" data-id="${note.id}">Eliminar</button></div></article>`).join('') : '<div class="empty card">No hay notas activas.</div>'}</div>`
}

function renderCalendar() {
  const events = [...dashboard.calendarEvents].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
  const today = new Date().toISOString().slice(0, 10)
  return `${title('Calendario', 'Eventos y tareas locales')}
    <form id="calendar-form" class="card form-grid">
      <label>Tipo<select name="type"><option value="event">Evento</option><option value="task">Tarea</option><option value="birthday">Cumpleaños</option></select></label>
      <label>Título<input name="title" maxlength="80" required /></label>
      <label>Fecha<input name="date" type="date" value="${today}" required /></label>
      <label>Hora<input name="time" type="time" value="09:00" required /></label>
      <button class="primary-button full" type="submit">Añadir al calendario</button>
    </form>
    <div class="item-list">${events.length ? events.map((event) => {
      const timing = calendarEventTiming(event)
      const endDate = event.endDate || event.date
      const dateRange = endDate === event.date ? event.date : `${event.date} → ${endDate}`
      return `<article class="item calendar-item ${timing.ended ? 'is-ended' : ''}"><div class="item-row"><div><strong>${event.completed ? '✓ ' : ''}${escapeHtml(event.title)}</strong><br><small>${escapeHtml(dateRange)} · ${event.allDay ? 'Todo el día' : escapeHtml(event.startTime)} · ${event.type === 'task' ? 'Tarea' : event.type === 'birthday' ? 'Cumpleaños' : 'Evento'}</small><span class="calendar-event-status ${timing.ended ? 'is-ended' : timing.status === 'Vencida' ? 'is-overdue' : ''}">${escapeHtml(timing.durationLabel)} · ${escapeHtml(timing.status)}</span></div></div><div class="actions">${event.type === 'task' ? `<button data-action="toggle-event" data-id="${event.id}">${event.completed ? 'Reabrir' : 'Completar'}</button>` : ''}${timing.ended ? '' : `<button data-action="edit-event" data-id="${event.id}">Cambiar título</button>`}<button class="danger" data-action="delete-event" data-id="${event.id}">Eliminar</button></div></article>`
    }).join('') : '<div class="empty card">No hay eventos todavía.</div>'}</div>`
}

function renderClock() {
  return `${title('Reloj', 'Alarmas y temporizadores')}
    <form id="alarm-form" class="card form-grid"><label>Nombre<input name="label" maxlength="60" value="Alarma" required /></label><label>Hora<input name="time" type="time" required /></label><button class="primary-button full" type="submit">Crear alarma diaria</button></form>
    <div class="item-list">${dashboard.alarms.map((alarm) => `<article class="item"><div class="item-row"><div><strong>${escapeHtml(alarm.time)} · ${escapeHtml(alarm.label)}</strong><br><small>${alarm.enabled ? 'Activa' : 'Desactivada'}</small></div></div><div class="actions"><button data-action="toggle-alarm" data-id="${alarm.id}">${alarm.enabled ? 'Desactivar' : 'Activar'}</button><button class="danger" data-action="delete-alarm" data-id="${alarm.id}">Eliminar</button></div></article>`).join('') || '<div class="empty card">No hay alarmas.</div>'}</div>
    <form id="timer-form" class="card form-grid"><label>Nombre<input name="label" maxlength="60" value="Temporizador" required /></label><label>Minutos<input name="minutes" type="number" min="1" max="1440" value="5" required /></label><button class="primary-button full" type="submit">Añadir temporizador</button></form>
    <div class="item-list">${dashboard.timers.map((timer) => `<article class="item"><div class="item-row"><div><strong>${escapeHtml(timer.label)}</strong><br><small>${Math.ceil(timer.durationSeconds / 60)} min · se inicia desde la tablet</small></div></div><div class="actions"><button class="danger" data-action="delete-timer" data-id="${timer.id}">Eliminar</button></div></article>`).join('') || '<div class="empty card">No hay temporizadores.</div>'}</div>`
}

function renderWeather() {
  const locations = dashboard.weatherLocations
  return `${title('Tiempo', 'Ciudades guardadas en la tablet')}
    <form id="weather-form" class="card form-grid"><label class="full">Ciudad<input name="name" maxlength="100" minlength="2" placeholder="Ej. Madrid" autocomplete="off" required /></label><button class="primary-button full" type="submit">Buscar y añadir ciudad</button></form>
    <div class="item-list">${locations.map((location) => `<article class="item"><div class="item-row"><div><strong>${location.id === dashboard.homeWeatherLocationId ? '⌂ ' : ''}${escapeHtml(location.name)}</strong><br><small>${escapeHtml([location.region, location.country].filter(Boolean).join(', '))} · ${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}</small></div></div><div class="actions"><button data-action="home-weather" data-id="${location.id}">Usar como principal</button><button class="danger" data-action="delete-weather" data-id="${location.id}">Eliminar</button></div></article>`).join('') || '<div class="empty card">No hay ciudades configuradas.</div>'}</div>`
}

function renderLayout() {
  const pages = [{ id: 'calendar', name: 'Calendario' }, { id: 'clock', name: 'Reloj' }, { id: 'weather', name: 'Tiempo' }, { id: 'notes', name: 'Notas' }, { id: 'gallery', name: 'Galería' }]
  return `${title('Panel', 'Visibilidad de páginas y widgets')}
    <div class="card item-list"><h2>Páginas</h2>${pages.map((page) => `<label class="toggle"><input type="checkbox" data-action="toggle-page" data-id="${page.id}" ${dashboard.preferences.enabledPageIds.includes(page.id) ? 'checked' : ''} />${page.name}</label>`).join('')}</div>
    <div class="card item-list"><h2>Widgets de inicio</h2>${dashboard.widgets.map((widget) => `<label class="toggle"><input type="checkbox" data-action="toggle-widget" data-id="${widget.id}" ${widget.visible !== false ? 'checked' : ''} />${escapeHtml(widget.title ?? widget.id)}</label>`).join('')}</div>
    <div class="card"><p>El tamaño y la posición exacta de la cuadrícula 3 × 4 se ajustan mejor arrastrando los widgets directamente en la tablet.</p></div>`
}

function renderSettings() {
  const preferences = dashboard.preferences
  return `${title('Ajustes', 'Configura desde el móvil el modo nocturno de la tablet')}
    <form id="night-settings-form" class="card night-settings-form">
      <label class="mobile-switch"><span><strong>Modo nocturno automático</strong><small>La tablet aplicará el tema oscuro, el brillo y los volúmenes indicados durante este horario.</small></span><input name="nightModeEnabled" type="checkbox" ${preferences.nightModeEnabled ? 'checked' : ''} /></label>
      <fieldset ${preferences.nightModeEnabled ? '' : 'disabled'}>
        <legend>Horario</legend>
        <div class="night-time-grid">
          <label>Desde<input name="nightModeStart" type="time" value="${escapeHtml(preferences.nightModeStart)}" required /></label>
          <label>Hasta<input name="nightModeEnd" type="time" value="${escapeHtml(preferences.nightModeEnd)}" required /></label>
        </div>
        <label class="range-setting"><span><strong>Brillo nocturno</strong><output id="night-brightness-output">${preferences.nightBrightness}%</output></span><input name="nightBrightness" type="range" min="1" max="30" step="1" value="${preferences.nightBrightness}" data-output="night-brightness-output" /></label>
        <label class="range-setting"><span><strong>Alarmas por la noche</strong><output id="night-alarm-output">${preferences.nightAlarmVolume}%</output></span><input name="nightAlarmVolume" type="range" min="0" max="100" step="1" value="${preferences.nightAlarmVolume}" data-output="night-alarm-output" /></label>
        <label class="range-setting"><span><strong>Volumen nocturno</strong><output id="night-media-output">${preferences.nightMediaVolume}%</output></span><input name="nightMediaVolume" type="range" min="0" max="100" step="1" value="${preferences.nightMediaVolume}" data-output="night-media-output" /></label>
      </fieldset>
      <button class="primary-button" type="submit">Guardar en la tablet</button>
      <small class="muted">Los ajustes diurnos se conservan y se recuperan automáticamente al terminar el horario.</small>
    </form>`
}

function feedbackLabel(type) {
  return type === 'error' ? 'Error' : type === 'feature' ? 'Nueva función' : 'Mejora'
}

function feedbackStatus(report) {
  if (report.status === 'sent') return 'Enviado al desarrollador'
  if (report.status === 'seen') return 'Visto por el desarrollador'
  if (report.status === 'in_progress') return 'En desarrollo'
  if (report.status === 'implemented') return 'Implementado'
  return ''
}

function feedbackProgress(report) {
  const steps = [
    ['sent', 'Enviado'],
    ['seen', 'Visto'],
    ['in_progress', 'En desarrollo'],
    ['implemented', 'Implementado'],
  ]
  const current = steps.findIndex(([status]) => status === report.status)
  return `<div class="feedback-progress" aria-label="Progreso del comentario">${steps.map(([status, label], index) => `<span class="${index < current ? 'done' : index === current ? 'current' : ''}" title="${status}">${label}</span>`).join('')}</div>`
}

function renderFeedback() {
  return `${title('Comentarios y mejoras', 'Comunica errores, sugerencias o nuevas funciones')}
    <div class="card feedback-notice"><strong>Seguimiento protegido</strong><p>El comentario se guarda primero en la tablet y se convierte en un GitHub Issue. Aquí podrás consultar si está enviado, visto, en desarrollo o implementado.</p></div>
    <form id="feedback-form" class="card form-grid">
      <label>Tipo<select name="type" required><option value="error">Error</option><option value="improvement">Mejora</option><option value="feature">Nueva función</option></select></label>
      <label>Importancia<select name="priority" required><option value="normal">Normal</option><option value="low">Baja</option><option value="high">Alta</option><option value="blocking">Bloqueante</option></select></label>
      <label class="full">Título<input name="title" maxlength="100" placeholder="Resumen breve" required /></label>
      <label class="full">Apartado afectado<select name="area" required><option>Inicio</option><option>Calendario</option><option>Reloj</option><option>Tiempo</option><option>Notas</option><option>Galería</option><option>Ajustes</option><option>Administración móvil</option><option>Actualizaciones</option><option>Otro</option></select></label>
      <label class="full">Descripción<textarea name="description" maxlength="4000" placeholder="Explica qué ocurre o qué te gustaría mejorar" required></textarea></label>
      <label class="privacy-check full"><input name="privacyAccepted" type="checkbox" required /><span>He revisado el texto y no contiene datos personales que no quiera compartir con el desarrollador.</span></label>
      <button class="primary-button full" type="submit">Guardar y preparar envío</button>
    </form>
    <div class="item-list">${feedbackReports.length ? feedbackReports.map((report) => { const statusLabel = feedbackStatus(report); return `<article class="item feedback-item"><div class="item-row"><div><strong>[${feedbackLabel(report.type)}] ${escapeHtml(report.title)}</strong><br><small>${escapeHtml(report.area)} · ${new Date(report.createdAt).toLocaleString('es-ES')}</small>${statusLabel ? `<span class="feedback-status status-${escapeHtml(report.status)}">${escapeHtml(statusLabel)}</span>` : ''}</div></div>${feedbackProgress(report)}${report.status === 'pending' ? '<p class="delivery-message">Todavía no se ha creado el Issue.</p>' : ''}${report.lastError ? `<p class="delivery-message error">${escapeHtml(report.lastError)}</p>` : ''}<div class="actions">${report.status === 'pending' || report.status === 'failed' ? `<button data-action="retry-feedback" data-id="${report.id}">${report.status === 'failed' ? 'Reintentar envío' : 'Enviar ahora'}</button>` : ''}${report.githubIssueNumber && report.status !== 'implemented' ? `<button data-action="refresh-feedback" data-id="${report.id}">Actualizar estado</button>` : ''}</div></article>` }).join('') : '<div class="empty card">Todavía no has enviado ningún comentario desde este móvil.</div>'}</div>`
}

async function loadPhoto(photo, container) {
  try {
    const response = await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, { headers: { Authorization: `Bearer ${credential}` } })
    if (!response.ok) throw new Error()
    const url = URL.createObjectURL(await response.blob())
    photoUrls.push(url)
    const image = container.querySelector(`[data-photo-id="${CSS.escape(photo.id)}"]`)
    if (image) image.src = url
  } catch { }
}

function renderPhotos() {
  const photos = dashboard.galleryPhotos.filter((photo) => !photo.deletedAt)
  const html = `${title('Fotos', 'Sube y visualiza imágenes guardadas en la tablet')}
    <form id="photo-form" class="upload-box"><label>Elegir fotografías<input name="photos" type="file" accept="image/*" multiple required /></label><button class="primary-button" type="submit">Subir a la tablet</button><small class="muted">El límite depende del almacenamiento libre de la tablet. El borrado se realiza desde la propia tablet.</small></form>
    <div class="photo-grid">${photos.map((photo) => `<figure class="photo"><img data-photo-id="${photo.id}" alt="${escapeHtml(photo.name)}" /><span>${escapeHtml(photo.name)}</span></figure>`).join('') || '<div class="empty card">No hay fotos guardadas.</div>'}</div>`
  window.setTimeout(() => photos.forEach((photo) => void loadPhoto(photo, editorContent)), 0)
  return html
}

function render() {
  if (!dashboard) return
  photoUrls.forEach((url) => URL.revokeObjectURL(url))
  photoUrls = []
  const views = { overview: renderOverview, notes: renderNotes, calendar: renderCalendar, clock: renderClock, weather: renderWeather, photos: renderPhotos, layout: renderLayout, settings: renderSettings, feedback: renderFeedback }
  editorContent.innerHTML = (views[activeTab] ?? views.overview)()
  setConnection(online, online ? 'Sincronización activa' : 'Sin conexión')
}

async function handleSubmit(event) {
  event.preventDefault()
  if (!online || !dashboard) return
  const form = event.target
  const data = new FormData(form)
  if (form.id === 'note-form') {
    const now = new Date().toISOString()
    dashboard.notes.push({ id: localId(), type: 'text', title: data.get('title'), content: data.get('content'), drawing: [], drawingPosition: 'below', drawingVisible: true, color: 'violet', pinned: false, reminderAt: null, archived: false, createdAt: now, updatedAt: now })
    await saveState('Nota creada')
  } else if (form.id === 'calendar-form') {
    const type = data.get('type')
    const date = data.get('date')
    const time = data.get('time')
    dashboard.calendarEvents.push({ id: localId(), type, recurrence: type === 'birthday' ? 'yearly' : 'none', completed: false, title: data.get('title'), date, endDate: date, startTime: time, endTime: time, allDay: false, location: '', notes: '', color: 'blue', reminders: [], createdAt: new Date().toISOString() })
    await saveState('Calendario actualizado')
  } else if (form.id === 'alarm-form') {
    dashboard.alarms.push({ id: localId(), label: data.get('label'), time: data.get('time'), enabled: true, weekdays: [1,2,3,4,5,6,7], soundName: 'Sonido predeterminado', soundUri: null, createdAt: new Date().toISOString() })
    await saveState('Alarma creada')
  } else if (form.id === 'timer-form') {
    const durationSeconds = Number(data.get('minutes')) * 60
    dashboard.timers.push({ id: localId(), label: data.get('label'), durationSeconds, remainingSeconds: durationSeconds, endsAt: null, createdAt: new Date().toISOString() })
    await saveState('Temporizador añadido')
  } else if (form.id === 'weather-form') {
    const city = String(data.get('name') ?? '').trim()
    toast(`Buscando ${city}…`)
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name', city)
    url.searchParams.set('count', '1')
    url.searchParams.set('language', 'es')
    url.searchParams.set('format', 'json')
    const response = await fetch(url)
    if (!response.ok) throw new Error('No se pudo buscar la ciudad.')
    const result = (await response.json()).results?.[0]
    if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) throw new Error('No se encontró esa ciudad.')
    const resultId = result.id ?? `${result.latitude}-${result.longitude}`
    const location = { id: `open-meteo-${resultId}`, name: result.name, region: result.admin1 ?? '', country: result.country ?? '', latitude: result.latitude, longitude: result.longitude, timezone: result.timezone ?? 'auto' }
    if (dashboard.weatherLocations.some((item) => item.id === location.id)) throw new Error('Esa ciudad ya está añadida.')
    dashboard.weatherLocations.push(location)
    if (!dashboard.homeWeatherLocationId) dashboard.homeWeatherLocationId = location.id
    if (!dashboard.selectedWeatherLocationId) dashboard.selectedWeatherLocationId = location.id
    await saveState('Ubicación añadida')
  } else if (form.id === 'photo-form') {
    const files = [...form.querySelector('[name="photos"]').files]
    for (const file of files) {
      toast(`Subiendo ${file.name}…`)
      await api('/api/photos', { method: 'POST', headers: { 'Content-Type': file.type || 'image/jpeg', 'X-File-Name': encodeURIComponent(file.name) }, body: file })
    }
    await loadState(true)
    toast(files.length === 1 ? 'Foto guardada en la tablet' : `${files.length} fotos guardadas en la tablet`)
  } else if (form.id === 'night-settings-form') {
    const start = form.elements.nightModeStart.value
    const end = form.elements.nightModeEnd.value
    if (!validTime(start) || !validTime(end)) throw new Error('El horario nocturno no es válido.')
    Object.assign(dashboard.preferences, {
      nightModeEnabled: form.elements.nightModeEnabled.checked,
      nightModeStart: start,
      nightModeEnd: end,
      nightBrightness: clampNumber(form.elements.nightBrightness.value, 1, 30, 5),
      nightAlarmVolume: clampNumber(form.elements.nightAlarmVolume.value, 0, 100, 30),
      nightMediaVolume: clampNumber(form.elements.nightMediaVolume.value, 0, 100, 12),
    })
    await saveState('Modo nocturno actualizado en la tablet')
  } else if (form.id === 'feedback-form') {
    const payload = {
      type: data.get('type'),
      priority: data.get('priority'),
      title: data.get('title'),
      area: data.get('area'),
      description: data.get('description'),
      privacyAccepted: data.get('privacyAccepted') === 'on',
    }
    const result = await api('/api/feedback', { method: 'POST', body: JSON.stringify(payload) })
    feedbackReports.unshift(result.report)
    form.reset()
    render()
    toast(result.report.status === 'sent' ? `Issue enviado · #${result.report.githubIssueNumber}` : result.report.status === 'failed' ? 'Guardado, pero el envío ha fallado' : 'Guardado localmente; falta crear el Issue')
  }
}

async function handleAction(event) {
  const control = event.target.closest('[data-action]')
  if (!control || !online || !dashboard) return
  const action = control.dataset.action
  const id = control.dataset.id
  if (action === 'retry-feedback' || action === 'refresh-feedback') {
    const operation = action === 'retry-feedback' ? 'retry' : 'refresh'
    const result = await api(`/api/feedback/${encodeURIComponent(id)}/${operation}`, { method: 'POST' })
    feedbackReports = feedbackReports.map((item) => item.id === id ? result.report : item)
    render()
    toast(`Se ha cambiado el estado de tu comentario a «${feedbackStatus(result.report)}».`)
    return
  } else if (action === 'edit-note') {
    const note = dashboard.notes.find((item) => item.id === id)
    if (!note || note.type === 'drawing') return
    const title = prompt('Título de la nota', note.title)
    if (title === null) return
    const content = prompt('Contenido de la nota', note.content)
    if (content === null) return
    Object.assign(note, { title: title.slice(0,80), content: content.slice(0,2000), updatedAt: new Date().toISOString() })
  } else if (action === 'pin-note') {
    const note = dashboard.notes.find((item) => item.id === id); if (note) { note.pinned = !note.pinned; note.updatedAt = new Date().toISOString() }
  } else if (action === 'archive-note') {
    const note = dashboard.notes.find((item) => item.id === id); if (note) { note.archived = true; note.updatedAt = new Date().toISOString() }
  } else if (action === 'delete-note') {
    if (!confirm('¿Eliminar esta nota?')) return
    dashboard.notes = dashboard.notes.filter((item) => item.id !== id)
  } else if (action === 'toggle-event') {
    const item = dashboard.calendarEvents.find((eventItem) => eventItem.id === id); if (item) item.completed = !item.completed
  } else if (action === 'edit-event') {
    const item = dashboard.calendarEvents.find((eventItem) => eventItem.id === id); if (!item) return
    if (calendarEventTiming(item).ended) { toast('Los eventos finalizados son de solo lectura.'); return }
    const value = prompt('Título', item.title); if (value === null) return; item.title = value.slice(0,80)
  } else if (action === 'delete-event') {
    if (!confirm('¿Eliminar este elemento del calendario?')) return
    dashboard.calendarEvents = dashboard.calendarEvents.filter((item) => item.id !== id)
  } else if (action === 'toggle-alarm') {
    const alarm = dashboard.alarms.find((item) => item.id === id); if (alarm) alarm.enabled = !alarm.enabled
  } else if (action === 'delete-alarm') {
    if (!confirm('¿Eliminar esta alarma?')) return
    dashboard.alarms = dashboard.alarms.filter((item) => item.id !== id)
  } else if (action === 'delete-timer') {
    dashboard.timers = dashboard.timers.filter((item) => item.id !== id)
  } else if (action === 'home-weather') {
    dashboard.homeWeatherLocationId = id; dashboard.selectedWeatherLocationId = id
  } else if (action === 'delete-weather') {
    dashboard.weatherLocations = dashboard.weatherLocations.filter((item) => item.id !== id)
    if (dashboard.homeWeatherLocationId === id) dashboard.homeWeatherLocationId = dashboard.weatherLocations[0]?.id ?? null
    if (dashboard.selectedWeatherLocationId === id) dashboard.selectedWeatherLocationId = dashboard.homeWeatherLocationId
  } else if (action === 'toggle-page') {
    const enabled = new Set(dashboard.preferences.enabledPageIds)
    if (control.checked) enabled.add(id)
    else enabled.delete(id)
    enabled.add('dashboard')
    dashboard.preferences.enabledPageIds = [...enabled]
  } else if (action === 'toggle-widget') {
    const widget = dashboard.widgets.find((item) => item.id === id); if (widget) widget.visible = control.checked
  } else return
  await saveState()
}

async function beginPairing() {
  const button = document.querySelector('#pair-button')
  const message = document.querySelector('#pair-message')
  const name = document.querySelector('#device-name').value.trim()
  if (!name) { message.textContent = 'Escribe un nombre para reconocer este móvil.'; return }
  button.disabled = true
  message.textContent = 'Enviando solicitud a la tablet…'
  try {
    const result = await fetch('/api/pair/request', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ pairingToken, deviceName: name, userAgent: navigator.userAgent }) })
    const body = await result.json()
    if (!result.ok) throw new Error(body.error)
    message.textContent = 'Solicitud enviada. Acéptala físicamente en la tablet.'
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/pair/request/${encodeURIComponent(body.requestId)}?pairingToken=${encodeURIComponent(pairingToken)}`)
        const status = await response.json()
        if (!response.ok) throw new Error(status.error)
        if (status.status === 'approved' && status.credential) {
          window.clearInterval(poll)
          credential = status.credential
          localStorage.setItem(STORAGE_TOKEN, credential)
          history.replaceState({}, '', '/')
          showOnly('app')
          await loadState(true)
          connectSocket()
          toast('Móvil vinculado correctamente')
        } else if (status.status === 'rejected' || status.status === 'expired') {
          window.clearInterval(poll)
          button.disabled = false
          message.textContent = status.status === 'rejected' ? 'La solicitud se ha rechazado.' : 'La solicitud ha caducado. Genera otro QR.'
        }
      } catch (error) {
        window.clearInterval(poll)
        button.disabled = false
        message.textContent = error.message
      }
    }, 1200)
  } catch (error) {
    button.disabled = false
    message.textContent = error.message
  }
}

tabs.forEach((tab) => tab.addEventListener('click', () => {
  activeTab = tab.dataset.tab
  tabs.forEach((candidate) => candidate.classList.toggle('active', candidate === tab))
  render()
  if (activeTab === 'feedback') void loadFeedback(true).catch(() => {})
}))
editorContent.addEventListener('submit', (event) => void handleSubmit(event).catch((error) => toast(error instanceof Error ? error.message : 'No se pudo completar la operación.')))
editorContent.addEventListener('click', (event) => void handleAction(event).catch((error) => toast(error instanceof Error ? error.message : 'No se pudo completar la operación.')))
editorContent.addEventListener('change', (event) => void handleAction(event).catch((error) => toast(error instanceof Error ? error.message : 'No se pudo completar la operación.')))
editorContent.addEventListener('input', (event) => {
  const outputId = event.target.dataset?.output
  if (!outputId) return
  const output = document.getElementById(outputId)
  if (output) output.textContent = `${event.target.value}%`
})
editorContent.addEventListener('change', (event) => {
  if (event.target.name !== 'nightModeEnabled') return
  const fieldset = event.target.form?.querySelector('fieldset')
  if (fieldset) fieldset.disabled = !event.target.checked
})
refreshButton.addEventListener('click', () => {
  if (!credential) { location.reload(); return }
  void loadState().then(() => activeTab === 'feedback' ? loadFeedback(true) : undefined).catch(() => {})
})
document.querySelector('#pair-button').addEventListener('click', () => void beginPairing())

async function boot() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') void navigator.serviceWorker.register('/sw.js?v=11').catch(() => {})
  if (!credential && pairingToken) {
    const platform = /Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone/iPad' : 'Móvil'
    document.querySelector('#device-name').value = `${navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Navegador'} en ${platform}`
    showOnly('pair')
    setConnection(false, 'Pendiente de autorización')
    return
  }
  if (!credential) {
    showOnly('locked')
    setConnection(false, 'No autorizado')
    return
  }
  showOnly('app')
  try {
    await loadState(true)
    connectSocket()
  } catch { }
}

void boot()
