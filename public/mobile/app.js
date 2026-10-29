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
let deferredInstallPrompt = null
let installed = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
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

const mobileEnglish = {
  'Ej. Móvil de Pablo': 'E.g. Pablo’s phone',
  'Acceso directo en tu móvil': 'Shortcut on your phone',
  'Abre Pablo Tablet desde la pantalla de inicio, sin escanear el QR cada vez.': 'Open Pablo Tablet from your home screen without scanning the QR code each time.',
  'Añadir a pantalla de inicio': 'Add to home screen',
  'Instalar Pablo Tablet': 'Install Pablo Tablet',
  'Necesitas seguir en la misma Wi-Fi que la tablet. Si cambia su dirección IP, utiliza la nueva dirección que aparece en Ajustes.': 'Stay on the same Wi-Fi as the tablet. If its IP address changes, use the new address shown in Settings.',
  'En Chrome o Brave, abre el menú ⋮ y elige «Añadir a pantalla de inicio» o «Instalar aplicación», si aparece. El navegador crea el acceso directo; esta web no puede hacerlo automáticamente.': 'In Chrome or Brave, open the ⋮ menu and choose “Add to home screen” or “Install app”, if available. Your browser creates the shortcut; this website cannot do it automatically.',
  'En Safari, pulsa Compartir y elige «Añadir a pantalla de inicio». Si no aparece, abre esta dirección en Safari.': 'In Safari, tap Share and choose “Add to Home Screen”. If unavailable, open this address in Safari.',
  'Abre el menú del navegador y busca «Instalar» o «Crear acceso directo».': 'Open your browser menu and look for “Install” or “Create shortcut”.',
  'Conectando…': 'Connecting…',
  'Actualizar': 'Refresh',
  'Nuevo dispositivo': 'New device',
  'Vincular este móvil': 'Link this phone',
  'Elige un nombre reconocible y solicita permiso. Después tendrás que aceptarlo en la pantalla de la tablet.': 'Choose a recognisable name and request access. You will then need to accept it on the tablet screen.',
  'Nombre del dispositivo': 'Device name',
  'Solicitar autorización': 'Request access',
  'Acceso protegido': 'Protected access',
  'Móvil no autorizado': 'Unauthorised phone',
  'Abre Ajustes → Administración móvil en la tablet y escanea el QR temporal.': 'Open Settings → Mobile administration on the tablet and scan the temporary QR code.',
  'Sin conexión con la tablet. La edición está bloqueada hasta reconectar.': 'No connection to the tablet. Editing is locked until it reconnects.',
  'Secciones del editor': 'Editor sections',
  'Inicio': 'Home', 'Notas': 'Notes', 'Calendario': 'Calendar', 'Reloj': 'Clock', 'Tiempo': 'Weather', 'Fotos': 'Photos', 'Panel': 'Dashboard', 'Ajustes': 'Settings', 'Comentarios': 'Feedback', 'Galería': 'Gallery',
  'Tu panel': 'Your dashboard',
  'Resumen en tiempo real de la tablet': 'Real-time tablet overview',
  'Notas activas': 'Active notes', 'Tareas pendientes': 'Pending tasks', 'Alarmas activas': 'Active alarms', 'Fotos guardadas': 'Saved photos',
  'Funcionamiento local': 'Local operation',
  'Este editor habla directamente con la tablet por la Wi‑Fi. No utiliza una nube ni una base de datos externa. Si se pierde la conexión, conserva la vista actual pero bloquea la edición hasta reconectar.': 'This editor communicates directly with the tablet over Wi-Fi. It does not use cloud storage or an external database. If the connection is lost, it keeps the current view but locks editing until it reconnects.',
  'Crear, fijar, editar y archivar': 'Create, pin, edit and archive',
  'Título': 'Title', 'Contenido': 'Content', 'Añadir nota': 'Add note', 'Sin título': 'Untitled', 'Dibujo local': 'Local drawing',
  'Este dibujo puede verse y conservarse, pero su edición se realiza en la tablet.': 'This drawing can be viewed and kept here, but it must be edited on the tablet.',
  'Editar': 'Edit', 'Desfijar': 'Unpin', 'Fijar': 'Pin', 'Archivar': 'Archive', 'Eliminar': 'Delete', 'No hay notas activas.': 'There are no active notes.',
  'Eventos y tareas locales': 'Local events and tasks', 'Tipo': 'Type', 'Evento': 'Event', 'Tarea': 'Task', 'Cumpleaños': 'Birthday', 'Fecha': 'Date', 'Hora': 'Time', 'Añadir al calendario': 'Add to calendar', 'Todo el día': 'All day',
  'Reabrir': 'Reopen', 'Completar': 'Complete', 'Cambiar título': 'Change title', 'No hay eventos todavía.': 'There are no events yet.',
  'Alarmas y temporizadores': 'Alarms and timers', 'Nombre': 'Name', 'Alarma': 'Alarm', 'Crear alarma diaria': 'Create daily alarm', 'Activa': 'Enabled', 'Desactivada': 'Disabled', 'Desactivar': 'Disable', 'Activar': 'Enable', 'No hay alarmas.': 'There are no alarms.',
  'Temporizador': 'Timer', 'Minutos': 'Minutes', 'Añadir temporizador': 'Add timer', 'se inicia desde la tablet': 'started from the tablet', 'No hay temporizadores.': 'There are no timers.',
  'Ciudades guardadas en la tablet': 'Cities saved on the tablet', 'Ciudad': 'City', 'Ej. Madrid': 'E.g. London', 'Buscar y añadir ciudad': 'Search and add city', 'Usar como principal': 'Use as primary', 'No hay ciudades configuradas.': 'No cities are configured.',
  'Visibilidad de páginas y widgets': 'Page and widget visibility', 'Páginas': 'Pages', 'Widgets de inicio': 'Home widgets',
  'El tamaño y la posición exacta de la cuadrícula 3 × 4 se ajustan mejor arrastrando los widgets directamente en la tablet.': 'The exact size and position in the 3 × 4 grid are best adjusted by dragging widgets directly on the tablet.',
  'Configura desde el móvil el modo nocturno de la tablet': 'Configure tablet night mode from your phone', 'Modo nocturno automático': 'Automatic night mode',
  'La tablet aplicará el tema oscuro, el brillo y los volúmenes indicados durante este horario.': 'The tablet will apply the dark theme, brightness and volume levels during this schedule.',
  'Horario': 'Schedule', 'Desde': 'From', 'Hasta': 'Until', 'Brillo nocturno': 'Night brightness', 'Alarmas por la noche': 'Alarms at night', 'Volumen nocturno': 'Night volume', 'Guardar en la tablet': 'Save to tablet',
  'Los ajustes diurnos se conservan y se recuperan automáticamente al terminar el horario.': 'Daytime settings are preserved and restored automatically when the schedule ends.',
  'Comentarios y mejoras': 'Feedback and improvements', 'Comunica errores, sugerencias o nuevas funciones': 'Report errors, suggestions or new features', 'Seguimiento protegido': 'Protected tracking',
  'El comentario se guarda primero en la tablet y se convierte en un GitHub Issue. Aquí podrás consultar si está enviado, visto, en desarrollo o implementado.': 'Feedback is saved on the tablet first and then converted into a GitHub Issue. You can check whether it has been sent, seen, is in progress or has been implemented.',
  'Error': 'Error', 'Mejora': 'Improvement', 'Nueva función': 'New feature', 'Importancia': 'Priority', 'Normal': 'Normal', 'Baja': 'Low', 'Alta': 'High', 'Bloqueante': 'Blocking', 'Resumen breve': 'Short summary', 'Apartado afectado': 'Affected section', 'Administración móvil': 'Mobile administration', 'Actualizaciones': 'Updates', 'Otro': 'Other', 'Descripción': 'Description',
  'Explica qué ocurre o qué te gustaría mejorar': 'Explain what happens or what you would like to improve',
  'He revisado el texto y no contiene datos personales que no quiera compartir con el desarrollador.': 'I have reviewed the text and it contains no personal data that I do not want to share with the developer.',
  'Guardar y preparar envío': 'Save and prepare submission', 'Todavía no se ha creado el Issue.': 'The Issue has not been created yet.', 'Reintentar envío': 'Retry submission', 'Enviar ahora': 'Send now', 'Actualizar estado': 'Refresh status', 'Todavía no has enviado ningún comentario desde este móvil.': 'You have not sent any feedback from this phone yet.',
  'Sube y visualiza imágenes guardadas en la tablet': 'Upload and view images saved on the tablet', 'Elegir fotografías': 'Choose photos', 'Subir a la tablet': 'Upload to tablet',
  'El límite depende del almacenamiento libre de la tablet. El borrado se realiza desde la propia tablet.': 'The limit depends on free tablet storage. Photos are deleted from the tablet itself.', 'No hay fotos guardadas.': 'There are no saved photos.',
  'Sincronización activa': 'Sync active', 'Sin conexión': 'Offline', 'No autorizado': 'Unauthorised', 'Pendiente de autorización': 'Awaiting authorisation',
  'móvil autorizado': 'authorised phone', 'Conectado · {{name}}': 'Connected · {{name}}',
  'Este móvil ya no está autorizado. Vuelve a vincularlo desde la tablet.': 'This phone is no longer authorised. Link it again from the tablet.',
  'El acceso de este móvil se ha revocado desde la tablet. Escanea un QR nuevo para volver a vincularlo.': 'Access for this phone was revoked from the tablet. Scan a new QR code to link it again.',
  'Escribe un nombre para reconocer este móvil.': 'Enter a name to identify this phone.', 'Solicitud enviada. Acéptala físicamente en la tablet.': 'Request sent. Accept it physically on the tablet.', 'Móvil vinculado correctamente': 'Phone linked successfully',
  'No se pudo completar la operación.': 'The operation could not be completed.', 'No se pudo buscar la ciudad.': 'The city could not be searched.', 'No se encontró esa ciudad.': 'That city could not be found.', 'Esa ciudad ya está añadida.': 'That city has already been added.', 'El horario nocturno no es válido.': 'The night-mode schedule is invalid.',
  '¿Eliminar esta nota?': 'Delete this note?', 'Título de la nota': 'Note title', '¿Eliminar este elemento del calendario?': 'Delete this calendar item?', '¿Eliminar esta alarma?': 'Delete this alarm?',
  'Dibujo': 'Drawing', 'Guardado localmente; falta crear el Issue': 'Saved locally; the Issue still needs to be created', 'Guardado, pero el envío ha fallado': 'Saved, but submission failed',
  'Finalizado': 'Finished', 'Vencida': 'Overdue', 'Se repite': 'Repeats', 'Próximo': 'Upcoming', 'En curso': 'In progress',
  'Datos actualizados': 'Data refreshed', 'Nota creada': 'Note created', 'Calendario actualizado': 'Calendar updated', 'Alarma creada': 'Alarm created', 'Temporizador añadido': 'Timer added', 'Ubicación añadida': 'Location added',
  'Buscando {{name}}…': 'Searching for {{name}}…', 'Subiendo {{name}}…': 'Uploading {{name}}…', 'Foto guardada en la tablet': 'Photo saved on the tablet', '{{count}} fotos guardadas en la tablet': '{{count}} photos saved on the tablet', 'Modo nocturno actualizado en la tablet': 'Night mode updated on the tablet',
  'Contenido de la nota': 'Note content', 'Los eventos finalizados son de solo lectura.': 'Finished events are read-only.',
  'Enviando solicitud a la tablet…': 'Sending request to the tablet…', 'La solicitud se ha rechazado.': 'The request was rejected.', 'La solicitud ha caducado. Genera otro QR.': 'The request has expired. Generate another QR code.',
}

function language() { return dashboard?.preferences?.language === 'en' ? 'en' : 'es' }
function locale() { return language() === 'en' ? 'en-GB' : 'es-ES' }
function tr(key, values = {}) {
  const template = language() === 'en' ? (mobileEnglish[key] ?? key) : key
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), template)
}

function translateCalendarTiming(value) {
  const duration = /^(\d+) (día|días)$/.exec(value)
  if (duration && language() === 'en') return `${duration[1]} ${duration[1] === '1' ? 'day' : 'days'}`
  return tr(value)
}

function translateShell() {
  document.documentElement.lang = language()
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = tr(element.dataset.i18n) })
  document.querySelectorAll('[data-i18n-aria]').forEach((element) => { element.setAttribute('aria-label', tr(element.dataset.i18nAria)) })
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => { element.setAttribute('placeholder', tr(element.dataset.i18nPlaceholder)) })
  updateInstallButton()
}

function updateInstallButton() {
  document.querySelector('#install-button').textContent = tr(deferredInstallPrompt ? 'Instalar Pablo Tablet' : 'Añadir a pantalla de inicio')
}

function showInstallHelp() {
  const help = document.querySelector('#install-help')
  const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  help.textContent = tr(appleMobile ? 'En Safari, pulsa Compartir y elige «Añadir a pantalla de inicio». Si no aparece, abre esta dirección en Safari.' : /Android/i.test(navigator.userAgent) ? 'En Chrome o Brave, abre el menú ⋮ y elige «Añadir a pantalla de inicio» o «Instalar aplicación», si aparece. El navegador crea el acceso directo; esta web no puede hacerlo automáticamente.' : 'Abre el menú del navegador y busca «Instalar» o «Crear acceso directo».')
  help.classList.remove('hidden')
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredInstallPrompt = event
  updateInstallButton()
})
window.addEventListener('appinstalled', () => {
  installed = true
  deferredInstallPrompt = null
  document.querySelector('#install-card').classList.add('hidden')
})
document.querySelector('#install-button').addEventListener('click', async () => {
  const prompt = deferredInstallPrompt
  if (!prompt) { showInstallHelp(); return }
  deferredInstallPrompt = null
  updateInstallButton()
  try {
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') {
      installed = true
      document.querySelector('#install-card').classList.add('hidden')
    }
  } catch { showInstallHelp() }
})

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
  document.querySelector('#install-card').classList.toggle('hidden', screen !== 'app' || installed)
}

function setConnection(isOnline, label) {
  online = isOnline
  connectionLabel.textContent = label
  offlineBanner.classList.toggle('hidden', isOnline)
  editorContent.querySelectorAll('button,input,textarea,select').forEach((control) => { control.disabled = !isOnline })
}

function revokeLocalAuthorization(message = tr('Este móvil ya no está autorizado. Vuelve a vincularlo desde la tablet.')) {
  localStorage.removeItem(STORAGE_TOKEN)
  credential = null
  disconnectSocket()
  lockedMessage.textContent = message
  showOnly('locked')
  setConnection(false, tr('No autorizado'))
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers ?? {})
  if (credential) headers.set('Authorization', `Bearer ${credential}`)
  if (options.body && typeof options.body === 'string') headers.set('Content-Type', 'application/json; charset=utf-8')
  const response = await fetch(path, { ...options, headers })
  if (response.status === 401) {
    revokeLocalAuthorization()
    throw new Error(tr('Este móvil ya no está autorizado. Vuelve a vincularlo desde la tablet.'))
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
    setConnection(true, tr('Conectado · {{name}}', { name: result.device?.name ?? tr('móvil autorizado') }))
    render()
    if (!silent) toast(tr('Datos actualizados'))
  } catch (error) {
    setConnection(false, tr('Sin conexión'))
    if (!silent) toast(error.message)
    throw error
  }
}

async function saveState(message = language() === 'en' ? 'Change saved' : 'Cambio guardado') {
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
    setConnection(true, tr('Sincronización activa'))
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
        revokeLocalAuthorization(tr('El acceso de este móvil se ha revocado desde la tablet. Escanea un QR nuevo para volver a vincularlo.'))
      }
    } catch { }
  })
  activeSocket.addEventListener('close', () => {
    if (socket !== activeSocket) return
    stopHeartbeat()
    if (offlineTimer === null) {
      offlineTimer = window.setTimeout(() => {
        if (!socket || socket.readyState !== WebSocket.OPEN) setConnection(false, tr('Sin conexión'))
      }, SOCKET_OFFLINE_GRACE_MS)
    }
    reconnectTimer = window.setTimeout(connectSocket, SOCKET_RECONNECT_DELAY_MS)
  })
  activeSocket.addEventListener('error', () => activeSocket.close())
}

function title(title, subtitle, action = '') {
  return `<div class="section-title"><div><h1>${escapeHtml(tr(title))}</h1><p>${escapeHtml(tr(subtitle))}</p></div>${action}</div>`
}

function renderOverview() {
  const photos = dashboard.galleryPhotos.filter((photo) => !photo.deletedAt)
  const tasks = dashboard.calendarEvents.filter((event) => event.type === 'task' && !event.completed)
  return `${title('Tu panel', 'Resumen en tiempo real de la tablet')}
    <div class="summary-grid">
      <div class="summary-card"><strong>${dashboard.notes.filter((note) => !note.archived).length}</strong><span>${tr('Notas activas')}</span></div>
      <div class="summary-card"><strong>${tasks.length}</strong><span>${tr('Tareas pendientes')}</span></div>
      <div class="summary-card"><strong>${dashboard.alarms.filter((alarm) => alarm.enabled).length}</strong><span>${tr('Alarmas activas')}</span></div>
      <div class="summary-card"><strong>${photos.length}</strong><span>${tr('Fotos guardadas')}</span></div>
    </div>
    <div class="card"><h2>${tr('Funcionamiento local')}</h2><p>${tr('Este editor habla directamente con la tablet por la Wi‑Fi. No utiliza una nube ni una base de datos externa. Si se pierde la conexión, conserva la vista actual pero bloquea la edición hasta reconectar.')}</p></div>`
}

function renderNotes() {
  const notes = dashboard.notes.filter((note) => !note.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned))
  return `${title('Notas', 'Crear, fijar, editar y archivar')}
    <form id="note-form" class="card form-grid">
      <label>${tr('Título')}<input name="title" maxlength="80" required /></label>
      <label class="full">${tr('Contenido')}<textarea name="content" maxlength="2000" required></textarea></label>
      <button class="primary-button full" type="submit">${tr('Añadir nota')}</button>
    </form>
    <div class="item-list">${notes.length ? notes.map((note) => `<article class="item"><div class="item-row"><div><strong>${note.pinned ? '📌 ' : ''}${escapeHtml(note.title || tr('Sin título'))}</strong><br><small>${note.type === 'drawing' ? tr('Dibujo local') : new Date(note.updatedAt ?? note.createdAt).toLocaleString(locale())}</small></div></div><p>${note.type === 'drawing' ? tr('Este dibujo puede verse y conservarse, pero su edición se realiza en la tablet.') : escapeHtml(note.content).replace(/\n/g, '<br>')}</p><div class="actions"><button data-action="edit-note" data-id="${note.id}">${tr('Editar')}</button><button data-action="pin-note" data-id="${note.id}">${tr(note.pinned ? 'Desfijar' : 'Fijar')}</button><button data-action="archive-note" data-id="${note.id}">${tr('Archivar')}</button><button class="danger" data-action="delete-note" data-id="${note.id}">${tr('Eliminar')}</button></div></article>`).join('') : `<div class="empty card">${tr('No hay notas activas.')}</div>`}</div>`
}

function renderCalendar() {
  const events = [...dashboard.calendarEvents].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
  const today = new Date().toISOString().slice(0, 10)
  return `${title('Calendario', 'Eventos y tareas locales')}
    <form id="calendar-form" class="card form-grid">
      <label>${tr('Tipo')}<select name="type"><option value="event">${tr('Evento')}</option><option value="task">${tr('Tarea')}</option><option value="birthday">${tr('Cumpleaños')}</option></select></label>
      <label>${tr('Título')}<input name="title" maxlength="80" required /></label>
      <label>${tr('Fecha')}<input name="date" type="date" value="${today}" required /></label>
      <label>${tr('Hora')}<input name="time" type="time" value="09:00" required /></label>
      <button class="primary-button full" type="submit">${tr('Añadir al calendario')}</button>
    </form>
    <div class="item-list">${events.length ? events.map((event) => {
      const timing = calendarEventTiming(event)
      const endDate = event.endDate || event.date
      const dateRange = endDate === event.date ? event.date : `${event.date} → ${endDate}`
      return `<article class="item calendar-item ${timing.ended ? 'is-ended' : ''}"><div class="item-row"><div><strong>${event.completed ? '✓ ' : ''}${escapeHtml(event.title)}</strong><br><small>${escapeHtml(dateRange)} · ${event.allDay ? tr('Todo el día') : escapeHtml(event.startTime)} · ${tr(event.type === 'task' ? 'Tarea' : event.type === 'birthday' ? 'Cumpleaños' : 'Evento')}</small><span class="calendar-event-status ${timing.ended ? 'is-ended' : timing.status === 'Vencida' ? 'is-overdue' : ''}">${escapeHtml(translateCalendarTiming(timing.durationLabel))} · ${escapeHtml(translateCalendarTiming(timing.status))}</span></div></div><div class="actions">${event.type === 'task' ? `<button data-action="toggle-event" data-id="${event.id}">${tr(event.completed ? 'Reabrir' : 'Completar')}</button>` : ''}${timing.ended ? '' : `<button data-action="edit-event" data-id="${event.id}">${tr('Cambiar título')}</button>`}<button class="danger" data-action="delete-event" data-id="${event.id}">${tr('Eliminar')}</button></div></article>`
    }).join('') : `<div class="empty card">${tr('No hay eventos todavía.')}</div>`}</div>`
}

function renderClock() {
  return `${title('Reloj', 'Alarmas y temporizadores')}
    <form id="alarm-form" class="card form-grid"><label>${tr('Nombre')}<input name="label" maxlength="60" value="${tr('Alarma')}" required /></label><label>${tr('Hora')}<input name="time" type="time" required /></label><button class="primary-button full" type="submit">${tr('Crear alarma diaria')}</button></form>
    <div class="item-list">${dashboard.alarms.map((alarm) => `<article class="item"><div class="item-row"><div><strong>${escapeHtml(alarm.time)} · ${escapeHtml(alarm.label)}</strong><br><small>${tr(alarm.enabled ? 'Activa' : 'Desactivada')}</small></div></div><div class="actions"><button data-action="toggle-alarm" data-id="${alarm.id}">${tr(alarm.enabled ? 'Desactivar' : 'Activar')}</button><button class="danger" data-action="delete-alarm" data-id="${alarm.id}">${tr('Eliminar')}</button></div></article>`).join('') || `<div class="empty card">${tr('No hay alarmas.')}</div>`}</div>
    <form id="timer-form" class="card form-grid"><label>${tr('Nombre')}<input name="label" maxlength="60" value="${tr('Temporizador')}" required /></label><label>${tr('Minutos')}<input name="minutes" type="number" min="1" max="1440" value="5" required /></label><button class="primary-button full" type="submit">${tr('Añadir temporizador')}</button></form>
    <div class="item-list">${dashboard.timers.map((timer) => `<article class="item"><div class="item-row"><div><strong>${escapeHtml(timer.label)}</strong><br><small>${Math.ceil(timer.durationSeconds / 60)} min · ${tr('se inicia desde la tablet')}</small></div></div><div class="actions"><button class="danger" data-action="delete-timer" data-id="${timer.id}">${tr('Eliminar')}</button></div></article>`).join('') || `<div class="empty card">${tr('No hay temporizadores.')}</div>`}</div>`
}

function renderWeather() {
  const locations = dashboard.weatherLocations
  return `${title('Tiempo', 'Ciudades guardadas en la tablet')}
    <form id="weather-form" class="card form-grid"><label class="full">${tr('Ciudad')}<input name="name" maxlength="100" minlength="2" placeholder="${tr('Ej. Madrid')}" autocomplete="off" required /></label><button class="primary-button full" type="submit">${tr('Buscar y añadir ciudad')}</button></form>
    <div class="item-list">${locations.map((location) => `<article class="item"><div class="item-row"><div><strong>${location.id === dashboard.homeWeatherLocationId ? '⌂ ' : ''}${escapeHtml(location.name)}</strong><br><small>${escapeHtml([location.region, location.country].filter(Boolean).join(', '))} · ${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}</small></div></div><div class="actions"><button data-action="home-weather" data-id="${location.id}">${tr('Usar como principal')}</button><button class="danger" data-action="delete-weather" data-id="${location.id}">${tr('Eliminar')}</button></div></article>`).join('') || `<div class="empty card">${tr('No hay ciudades configuradas.')}</div>`}</div>`
}

function renderLayout() {
  const pages = [{ id: 'calendar', name: 'Calendario' }, { id: 'clock', name: 'Reloj' }, { id: 'weather', name: 'Tiempo' }, { id: 'notes', name: 'Notas' }, { id: 'gallery', name: 'Galería' }]
  return `${title('Panel', 'Visibilidad de páginas y widgets')}
    <div class="card item-list"><h2>${tr('Páginas')}</h2>${pages.map((page) => `<label class="toggle"><input type="checkbox" data-action="toggle-page" data-id="${page.id}" ${dashboard.preferences.enabledPageIds.includes(page.id) ? 'checked' : ''} />${tr(page.name)}</label>`).join('')}</div>
    <div class="card item-list"><h2>${tr('Widgets de inicio')}</h2>${dashboard.widgets.map((widget) => `<label class="toggle"><input type="checkbox" data-action="toggle-widget" data-id="${widget.id}" ${widget.visible !== false ? 'checked' : ''} />${escapeHtml(tr(widget.title ?? widget.id))}</label>`).join('')}</div>
    <div class="card"><p>${tr('El tamaño y la posición exacta de la cuadrícula 3 × 4 se ajustan mejor arrastrando los widgets directamente en la tablet.')}</p></div>`
}

function renderSettings() {
  const preferences = dashboard.preferences
  return `${title('Ajustes', 'Configura desde el móvil el modo nocturno de la tablet')}
    <form id="night-settings-form" class="card night-settings-form">
      <label class="mobile-switch"><span><strong>${tr('Modo nocturno automático')}</strong><small>${tr('La tablet aplicará el tema oscuro, el brillo y los volúmenes indicados durante este horario.')}</small></span><input name="nightModeEnabled" type="checkbox" ${preferences.nightModeEnabled ? 'checked' : ''} /></label>
      <fieldset ${preferences.nightModeEnabled ? '' : 'disabled'}>
        <legend>${tr('Horario')}</legend>
        <div class="night-time-grid">
          <label>${tr('Desde')}<input name="nightModeStart" type="time" value="${escapeHtml(preferences.nightModeStart)}" required /></label>
          <label>${tr('Hasta')}<input name="nightModeEnd" type="time" value="${escapeHtml(preferences.nightModeEnd)}" required /></label>
        </div>
        <label class="range-setting"><span><strong>${tr('Brillo nocturno')}</strong><output id="night-brightness-output">${preferences.nightBrightness}%</output></span><input name="nightBrightness" type="range" min="1" max="30" step="1" value="${preferences.nightBrightness}" data-output="night-brightness-output" /></label>
        <label class="range-setting"><span><strong>${tr('Alarmas por la noche')}</strong><output id="night-alarm-output">${preferences.nightAlarmVolume}%</output></span><input name="nightAlarmVolume" type="range" min="0" max="100" step="1" value="${preferences.nightAlarmVolume}" data-output="night-alarm-output" /></label>
        <label class="range-setting"><span><strong>${tr('Volumen nocturno')}</strong><output id="night-media-output">${preferences.nightMediaVolume}%</output></span><input name="nightMediaVolume" type="range" min="0" max="100" step="1" value="${preferences.nightMediaVolume}" data-output="night-media-output" /></label>
      </fieldset>
      <button class="primary-button" type="submit">${tr('Guardar en la tablet')}</button>
      <small class="muted">${tr('Los ajustes diurnos se conservan y se recuperan automáticamente al terminar el horario.')}</small>
    </form>`
}

function feedbackLabel(type) {
  return tr(type === 'error' ? 'Error' : type === 'feature' ? 'Nueva función' : 'Mejora')
}

function feedbackStatus(report) {
  if (report.status === 'sent') return language() === 'en' ? 'Sent to developer' : 'Enviado al desarrollador'
  if (report.status === 'seen') return language() === 'en' ? 'Seen by developer' : 'Visto por el desarrollador'
  if (report.status === 'in_progress') return language() === 'en' ? 'In progress' : 'En desarrollo'
  if (report.status === 'implemented') return language() === 'en' ? 'Implemented' : 'Implementado'
  return ''
}

function feedbackProgress(report) {
  const steps = [
    ['sent', language() === 'en' ? 'Sent' : 'Enviado'],
    ['seen', language() === 'en' ? 'Seen' : 'Visto'],
    ['in_progress', language() === 'en' ? 'In progress' : 'En desarrollo'],
    ['implemented', language() === 'en' ? 'Implemented' : 'Implementado'],
  ]
  const current = steps.findIndex(([status]) => status === report.status)
  return `<div class="feedback-progress" aria-label="${language() === 'en' ? 'Feedback progress' : 'Progreso del comentario'}">${steps.map(([status, label], index) => `<span class="${index < current ? 'done' : index === current ? 'current' : ''}" title="${status}">${label}</span>`).join('')}</div>`
}

function renderFeedback() {
  return `${title('Comentarios y mejoras', 'Comunica errores, sugerencias o nuevas funciones')}
    <div class="card feedback-notice"><strong>${tr('Seguimiento protegido')}</strong><p>${tr('El comentario se guarda primero en la tablet y se convierte en un GitHub Issue. Aquí podrás consultar si está enviado, visto, en desarrollo o implementado.')}</p></div>
    <form id="feedback-form" class="card form-grid">
      <label>${tr('Tipo')}<select name="type" required><option value="error">${tr('Error')}</option><option value="improvement">${tr('Mejora')}</option><option value="feature">${tr('Nueva función')}</option></select></label>
      <label>${tr('Importancia')}<select name="priority" required><option value="normal">${tr('Normal')}</option><option value="low">${tr('Baja')}</option><option value="high">${tr('Alta')}</option><option value="blocking">${tr('Bloqueante')}</option></select></label>
      <label class="full">${tr('Título')}<input name="title" maxlength="100" placeholder="${tr('Resumen breve')}" required /></label>
      <label class="full">${tr('Apartado afectado')}<select name="area" required>${['Inicio', 'Calendario', 'Reloj', 'Tiempo', 'Notas', 'Galería', 'Ajustes', 'Administración móvil', 'Actualizaciones', 'Otro'].map((area) => `<option value="${area}">${tr(area)}</option>`).join('')}</select></label>
      <label class="full">${tr('Descripción')}<textarea name="description" maxlength="4000" placeholder="${tr('Explica qué ocurre o qué te gustaría mejorar')}" required></textarea></label>
      <label class="privacy-check full"><input name="privacyAccepted" type="checkbox" required /><span>${tr('He revisado el texto y no contiene datos personales que no quiera compartir con el desarrollador.')}</span></label>
      <button class="primary-button full" type="submit">${tr('Guardar y preparar envío')}</button>
    </form>
    <div class="item-list">${feedbackReports.length ? feedbackReports.map((report) => { const statusLabel = feedbackStatus(report); return `<article class="item feedback-item"><div class="item-row"><div><strong>[${feedbackLabel(report.type)}] ${escapeHtml(report.title)}</strong><br><small>${escapeHtml(report.area)} · ${new Date(report.createdAt).toLocaleString(locale())}</small>${statusLabel ? `<span class="feedback-status status-${escapeHtml(report.status)}">${escapeHtml(statusLabel)}</span>` : ''}</div></div>${feedbackProgress(report)}${report.status === 'pending' ? `<p class="delivery-message">${tr('Todavía no se ha creado el Issue.')}</p>` : ''}${report.lastError ? `<p class="delivery-message error">${escapeHtml(report.lastError)}</p>` : ''}<div class="actions">${report.status === 'pending' || report.status === 'failed' ? `<button data-action="retry-feedback" data-id="${report.id}">${tr(report.status === 'failed' ? 'Reintentar envío' : 'Enviar ahora')}</button>` : ''}${report.githubIssueNumber && report.status !== 'implemented' ? `<button data-action="refresh-feedback" data-id="${report.id}">${tr('Actualizar estado')}</button>` : ''}</div></article>` }).join('') : `<div class="empty card">${tr('Todavía no has enviado ningún comentario desde este móvil.')}</div>`}</div>`
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
    <form id="photo-form" class="upload-box"><label>${tr('Elegir fotografías')}<input name="photos" type="file" accept="image/*" multiple required /></label><button class="primary-button" type="submit">${tr('Subir a la tablet')}</button><small class="muted">${tr('El límite depende del almacenamiento libre de la tablet. El borrado se realiza desde la propia tablet.')}</small></form>
    <div class="photo-grid">${photos.map((photo) => `<figure class="photo"><img data-photo-id="${photo.id}" alt="${escapeHtml(photo.name)}" /><span>${escapeHtml(photo.name)}</span></figure>`).join('') || `<div class="empty card">${tr('No hay fotos guardadas.')}</div>`}</div>`
  window.setTimeout(() => photos.forEach((photo) => void loadPhoto(photo, editorContent)), 0)
  return html
}

function render() {
  if (!dashboard) return
  translateShell()
  photoUrls.forEach((url) => URL.revokeObjectURL(url))
  photoUrls = []
  const views = { overview: renderOverview, notes: renderNotes, calendar: renderCalendar, clock: renderClock, weather: renderWeather, photos: renderPhotos, layout: renderLayout, settings: renderSettings, feedback: renderFeedback }
  editorContent.innerHTML = (views[activeTab] ?? views.overview)()
  setConnection(online, tr(online ? 'Sincronización activa' : 'Sin conexión'))
}

async function handleSubmit(event) {
  event.preventDefault()
  if (!online || !dashboard) return
  const form = event.target
  const data = new FormData(form)
  if (form.id === 'note-form') {
    const now = new Date().toISOString()
    dashboard.notes.push({ id: localId(), type: 'text', title: data.get('title'), content: data.get('content'), drawing: [], drawingPosition: 'below', drawingVisible: true, color: 'violet', pinned: false, reminderAt: null, archived: false, createdAt: now, updatedAt: now })
    await saveState(tr('Nota creada'))
  } else if (form.id === 'calendar-form') {
    const type = data.get('type')
    const date = data.get('date')
    const time = data.get('time')
    dashboard.calendarEvents.push({ id: localId(), type, recurrence: type === 'birthday' ? 'yearly' : 'none', completed: false, title: data.get('title'), date, endDate: date, startTime: time, endTime: time, allDay: false, location: '', notes: '', color: 'blue', reminders: [], createdAt: new Date().toISOString() })
    await saveState(tr('Calendario actualizado'))
  } else if (form.id === 'alarm-form') {
    dashboard.alarms.push({ id: localId(), label: data.get('label'), time: data.get('time'), enabled: true, weekdays: [1,2,3,4,5,6,7], soundName: 'Sonido predeterminado', soundUri: null, createdAt: new Date().toISOString() })
    await saveState(tr('Alarma creada'))
  } else if (form.id === 'timer-form') {
    const durationSeconds = Number(data.get('minutes')) * 60
    dashboard.timers.push({ id: localId(), label: data.get('label'), durationSeconds, remainingSeconds: durationSeconds, endsAt: null, createdAt: new Date().toISOString() })
    await saveState(tr('Temporizador añadido'))
  } else if (form.id === 'weather-form') {
    const city = String(data.get('name') ?? '').trim()
    toast(tr('Buscando {{name}}…', { name: city }))
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name', city)
    url.searchParams.set('count', '1')
    url.searchParams.set('language', language())
    url.searchParams.set('format', 'json')
    const response = await fetch(url)
    if (!response.ok) throw new Error(tr('No se pudo buscar la ciudad.'))
    const result = (await response.json()).results?.[0]
    if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) throw new Error(tr('No se encontró esa ciudad.'))
    const resultId = result.id ?? `${result.latitude}-${result.longitude}`
    const location = { id: `open-meteo-${resultId}`, name: result.name, region: result.admin1 ?? '', country: result.country ?? '', latitude: result.latitude, longitude: result.longitude, timezone: result.timezone ?? 'auto' }
    if (dashboard.weatherLocations.some((item) => item.id === location.id)) throw new Error(tr('Esa ciudad ya está añadida.'))
    dashboard.weatherLocations.push(location)
    if (!dashboard.homeWeatherLocationId) dashboard.homeWeatherLocationId = location.id
    if (!dashboard.selectedWeatherLocationId) dashboard.selectedWeatherLocationId = location.id
    await saveState(tr('Ubicación añadida'))
  } else if (form.id === 'photo-form') {
    const files = [...form.querySelector('[name="photos"]').files]
    for (const file of files) {
      toast(tr('Subiendo {{name}}…', { name: file.name }))
      await api('/api/photos', { method: 'POST', headers: { 'Content-Type': file.type || 'image/jpeg', 'X-File-Name': encodeURIComponent(file.name) }, body: file })
    }
    await loadState(true)
    toast(files.length === 1 ? tr('Foto guardada en la tablet') : tr('{{count}} fotos guardadas en la tablet', { count: files.length }))
  } else if (form.id === 'night-settings-form') {
    const start = form.elements.nightModeStart.value
    const end = form.elements.nightModeEnd.value
    if (!validTime(start) || !validTime(end)) throw new Error(tr('El horario nocturno no es válido.'))
    Object.assign(dashboard.preferences, {
      nightModeEnabled: form.elements.nightModeEnabled.checked,
      nightModeStart: start,
      nightModeEnd: end,
      nightBrightness: clampNumber(form.elements.nightBrightness.value, 1, 30, 5),
      nightAlarmVolume: clampNumber(form.elements.nightAlarmVolume.value, 0, 100, 30),
      nightMediaVolume: clampNumber(form.elements.nightMediaVolume.value, 0, 100, 12),
    })
    await saveState(tr('Modo nocturno actualizado en la tablet'))
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
    toast(result.report.status === 'sent' ? `${language() === 'en' ? 'Issue sent' : 'Issue enviado'} · #${result.report.githubIssueNumber}` : tr(result.report.status === 'failed' ? 'Guardado, pero el envío ha fallado' : 'Guardado localmente; falta crear el Issue'))
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
    toast(language() === 'en' ? `Your feedback status changed to “${feedbackStatus(result.report)}”.` : `Se ha cambiado el estado de tu comentario a «${feedbackStatus(result.report)}».`)
    return
  } else if (action === 'edit-note') {
    const note = dashboard.notes.find((item) => item.id === id)
    if (!note || note.type === 'drawing') return
    const title = prompt(tr('Título de la nota'), note.title)
    if (title === null) return
    const content = prompt(tr('Contenido de la nota'), note.content)
    if (content === null) return
    Object.assign(note, { title: title.slice(0,80), content: content.slice(0,2000), updatedAt: new Date().toISOString() })
  } else if (action === 'pin-note') {
    const note = dashboard.notes.find((item) => item.id === id); if (note) { note.pinned = !note.pinned; note.updatedAt = new Date().toISOString() }
  } else if (action === 'archive-note') {
    const note = dashboard.notes.find((item) => item.id === id); if (note) { note.archived = true; note.updatedAt = new Date().toISOString() }
  } else if (action === 'delete-note') {
    if (!confirm(tr('¿Eliminar esta nota?'))) return
    dashboard.notes = dashboard.notes.filter((item) => item.id !== id)
  } else if (action === 'toggle-event') {
    const item = dashboard.calendarEvents.find((eventItem) => eventItem.id === id); if (item) item.completed = !item.completed
  } else if (action === 'edit-event') {
    const item = dashboard.calendarEvents.find((eventItem) => eventItem.id === id); if (!item) return
    if (calendarEventTiming(item).ended) { toast(tr('Los eventos finalizados son de solo lectura.')); return }
    const value = prompt(tr('Título'), item.title); if (value === null) return; item.title = value.slice(0,80)
  } else if (action === 'delete-event') {
    if (!confirm(tr('¿Eliminar este elemento del calendario?'))) return
    dashboard.calendarEvents = dashboard.calendarEvents.filter((item) => item.id !== id)
  } else if (action === 'toggle-alarm') {
    const alarm = dashboard.alarms.find((item) => item.id === id); if (alarm) alarm.enabled = !alarm.enabled
  } else if (action === 'delete-alarm') {
    if (!confirm(tr('¿Eliminar esta alarma?'))) return
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
  if (!name) { message.textContent = tr('Escribe un nombre para reconocer este móvil.'); return }
  button.disabled = true
  message.textContent = tr('Enviando solicitud a la tablet…')
  try {
    const result = await fetch('/api/pair/request', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ pairingToken, deviceName: name, userAgent: navigator.userAgent }) })
    const body = await result.json()
    if (!result.ok) throw new Error(body.error)
    message.textContent = tr('Solicitud enviada. Acéptala físicamente en la tablet.')
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
          toast(tr('Móvil vinculado correctamente'))
        } else if (status.status === 'rejected' || status.status === 'expired') {
          window.clearInterval(poll)
          button.disabled = false
          message.textContent = tr(status.status === 'rejected' ? 'La solicitud se ha rechazado.' : 'La solicitud ha caducado. Genera otro QR.')
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
editorContent.addEventListener('submit', (event) => void handleSubmit(event).catch((error) => toast(error instanceof Error ? error.message : tr('No se pudo completar la operación.'))))
editorContent.addEventListener('click', (event) => void handleAction(event).catch((error) => toast(error instanceof Error ? error.message : tr('No se pudo completar la operación.'))))
editorContent.addEventListener('change', (event) => void handleAction(event).catch((error) => toast(error instanceof Error ? error.message : tr('No se pudo completar la operación.'))))
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
  if ('serviceWorker' in navigator && location.protocol === 'https:') void navigator.serviceWorker.register('/sw.js?v=13').catch(() => {})
  if (!credential && pairingToken) {
    showOnly('pair')
    setConnection(false, tr('Pendiente de autorización'))
    return
  }
  if (!credential) {
    showOnly('locked')
    setConnection(false, tr('No autorizado'))
    return
  }
  showOnly('app')
  try {
    await loadState(true)
    connectSocket()
  } catch { }
}

void boot()
