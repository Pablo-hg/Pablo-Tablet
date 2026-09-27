import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import {
  AlarmClock,
  Archive,
  BellRing,
  CakeSlice,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  EyeOff,
  FileText,
  Images,
  Home,
  LockKeyhole,
  ListTodo,
  LogOut,
  MapPin,
  Menu,
  Minus,
  Pause,
  Play,
  Pin,
  Plus,
  RotateCcw,
  RotateCw,
  Settings,
  SunMedium,
  Sunrise,
  Trash2,
  Upload,
  Volume2,
  Wind,
  X,
} from 'lucide-react'
import {
  DASHBOARD_PAGES,
  loadDashboardState,
  saveDashboardState,
  type DashboardPageDefinition,
  type DashboardPageId,
  type Alarm,
  type AlarmWeekday,
  type CalendarEvent,
  type CalendarEventColor,
  type CalendarEventRecurrence,
  type CalendarEventReminder,
  type CalendarEventType,
  type Note,
  type NoteColor,
  type Timer,
  type StopwatchState,
  type DashboardPreferences,
  type GalleryPhoto,
  EVERY_ALARM_WEEKDAY,
} from './dashboardState'
import { DEFAULT_ALARM_SOUND, getDeviceAlarmSounds, previewAlarmSound, stopAlarmSoundPreview, type DeviceAlarmSound } from './alarmSounds'
import { snoozeAlarmNotification, snoozeCalendarEventNotification, syncAlarmNotifications, syncCalendarEventNotifications, syncReminderNotifications, syncTimerNotifications } from './reminderNotifications'
import { placeWidgets, type DashboardOrientation, type PlacedWidget } from './widgetLayout'
import { exitTabletApp } from './kioskMode'
import { applyDeviceSettings, playInteractionSound, previewDeviceVolume } from './deviceSettings'
import { deleteGalleryPhotoFile, galleryPhotoSource, pickGalleryPhotos } from './gallery'
import './App.css'

type Screen = 'home' | 'settings'
type SimulatedAlert = { title: string; body: string }
type RingingAlert = { kind: 'alarm' | 'timer' | 'calendar'; sourceId: string; title: string; subtitle: string; soundUri: string | null }
type CalendarEventPatch = Partial<Pick<CalendarEvent, 'type' | 'recurrence' | 'completed' | 'title' | 'date' | 'endDate' | 'startTime' | 'endTime' | 'allDay' | 'location' | 'notes' | 'color' | 'reminders'>>

const weekdayFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function toLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type CalendarOccurrence = { startDate: string; endDate: string }

function dateKeyToDayNumber(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function addDaysToDateKey(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
}

function calendarOccurrenceStart(event: CalendarEvent, index: number) {
  if (event.recurrence === 'none' || index <= 0) return event.date
  const [year, month, day] = event.date.split('-').map(Number)
  if (event.recurrence === 'daily') return addDaysToDateKey(event.date, index)
  if (event.recurrence === 'weekly') return addDaysToDateKey(event.date, index * 7)
  const targetYear = event.recurrence === 'monthly' ? year + Math.floor((month - 1 + index) / 12) : year + index
  const targetMonth = event.recurrence === 'monthly' ? ((month - 1 + index) % 12) + 1 : month
  const safeDay = Math.min(day, new Date(targetYear, targetMonth, 0).getDate())
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

function calendarOccurrenceIndexNear(event: CalendarEvent, date: string) {
  if (event.recurrence === 'none') return 0
  const dayDifference = dateKeyToDayNumber(date) - dateKeyToDayNumber(event.date)
  if (event.recurrence === 'daily') return Math.max(0, dayDifference)
  if (event.recurrence === 'weekly') return Math.max(0, Math.floor(dayDifference / 7))
  const [eventYear, eventMonth] = event.date.split('-').map(Number)
  const [dateYear, dateMonth] = date.split('-').map(Number)
  return Math.max(0, event.recurrence === 'monthly' ? (dateYear - eventYear) * 12 + dateMonth - eventMonth : dateYear - eventYear)
}

function calendarOccurrenceForDate(event: CalendarEvent, date: string): CalendarOccurrence | null {
  if (date < event.date) return null
  const durationDays = dateKeyToDayNumber(event.endDate) - dateKeyToDayNumber(event.date)
  let index = calendarOccurrenceIndexNear(event, date)
  let startDate = calendarOccurrenceStart(event, index)
  if (startDate > date && index > 0) startDate = calendarOccurrenceStart(event, --index)
  const endDate = addDaysToDateKey(startDate, durationDays)
  return date <= endDate ? { startDate, endDate } : null
}

function nextCalendarOccurrence(event: CalendarEvent, date: string): CalendarOccurrence | null {
  const activeOccurrence = calendarOccurrenceForDate(event, date)
  if (activeOccurrence) return activeOccurrence
  if (event.recurrence === 'none') return event.endDate >= date ? { startDate: event.date, endDate: event.endDate } : null
  let index = calendarOccurrenceIndexNear(event, date)
  let startDate = calendarOccurrenceStart(event, index)
  while (startDate < date) startDate = calendarOccurrenceStart(event, ++index)
  const durationDays = dateKeyToDayNumber(event.endDate) - dateKeyToDayNumber(event.date)
  return { startDate, endDate: addDaysToDateKey(startDate, durationDays) }
}

function eventForOccurrence(event: CalendarEvent, occurrence: CalendarOccurrence) {
  return { ...event, date: occurrence.startDate, endDate: occurrence.endDate }
}

function offsetDateKey(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return toLocalDateKey(value)
}

function createLocalId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [navigationVisible, setNavigationVisible] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [dashboardState, setDashboardState] = useState(loadDashboardState)
  const [activePageId, setActivePageId] = useState<DashboardPageId>('dashboard')
  const [interactionVersion, setInteractionVersion] = useState(0)
  const [interactionLocked, setInteractionLocked] = useState(false)
  const [simulatedAlert, setSimulatedAlert] = useState<SimulatedAlert | null>(null)
  const [ringingAlert, setRingingAlert] = useState<RingingAlert | null>(null)
  const [snoozeMinutes, setSnoozeMinutes] = useState(5)
  const [screensaverVisible, setScreensaverVisible] = useState(false)
  const [screensaverPhotoId, setScreensaverPhotoId] = useState<string | null>(null)
  const pointerStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const screensaverQueue = useRef<string[]>([])
  const lastScreensaverPhotoId = useRef<string | null>(null)
  const suppressClick = useRef(false)
  const deliveredSimulationIds = useRef(new Set<string>())
  const dashboardStateRef = useRef(dashboardState)

  const enabledPages = useMemo(
    () => DASHBOARD_PAGES.filter((page) => dashboardState.preferences.enabledPageIds.includes(page.id)),
    [dashboardState.preferences.enabledPageIds],
  )
  const activePageIndex = Math.max(0, enabledPages.findIndex((page) => page.id === activePageId))
  const activePage = enabledPages[activePageIndex] ?? enabledPages[0]
  const time = timeFormatter.format(now)
  const date = weekdayFormatter.format(now)
  const screensaverPhoto = dashboardState.galleryPhotos.find((photo) => photo.id === screensaverPhotoId && photo.deletedAt === null)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    saveDashboardState(dashboardState)
    dashboardStateRef.current = dashboardState
  }, [dashboardState])

  useEffect(() => {
    const purgeExpiredGalleryPhotos = () => {
      const expirationTime = Date.now() - 30 * 24 * 60 * 60 * 1_000
      const expired = dashboardStateRef.current.galleryPhotos.filter((photo) => photo.deletedAt && new Date(photo.deletedAt).getTime() <= expirationTime)
      for (const photo of expired) {
        void deleteGalleryPhotoFile(photo.uri)
          .then(() => setDashboardState((current) => ({ ...current, galleryPhotos: current.galleryPhotos.filter((item) => item.id !== photo.id) })))
          .catch((error) => console.warn('No se pudo vaciar una imagen caducada de la papelera.', error))
      }
    }
    purgeExpiredGalleryPhotos()
    const interval = window.setInterval(purgeExpiredGalleryPhotos, 6 * 60 * 60 * 1_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const { brightness, alarmVolume, mediaVolume, keepScreenAwake, screenTimeoutSeconds } = dashboardState.preferences
    const timeout = window.setTimeout(() => {
      void applyDeviceSettings(brightness, alarmVolume, mediaVolume, keepScreenAwake, screenTimeoutSeconds)
        .catch((error) => console.warn('No se pudieron aplicar los ajustes del dispositivo.', error))
    }, 80)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.preferences])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncReminderNotifications(dashboardState.notes), 600)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.notes])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncCalendarEventNotifications(dashboardState.calendarEvents), 600)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.calendarEvents])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncAlarmNotifications(dashboardState.alarms), 600)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.alarms])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncTimerNotifications(dashboardState.timers), 600)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.timers])

  const registerInteraction = useCallback(() => {
    setInteractionVersion((version) => version + 1)
  }, [])

  const showSimulatedAlert = useCallback((title: string, body: string) => {
    setScreensaverVisible(false)
    setSimulatedAlert({ title, body })
  }, [])

  const startRinging = useCallback((alert: RingingAlert) => {
    setScreensaverVisible(false)
    setRingingAlert(alert)
    setScreen('home')
    setActivePageId(alert.kind === 'calendar' ? 'calendar' : 'clock')
    setInteractionLocked(true)
    if (alert.kind !== 'calendar') {
      void previewAlarmSound(alert.soundUri, true).catch((error) => console.warn('No se pudo iniciar el sonido de aviso.', error))
      if (!Capacitor.isNativePlatform()) navigator.vibrate?.([450, 220, 450, 500])
    }
  }, [])

  const stopRinging = useCallback(() => {
    setRingingAlert(null)
    setInteractionLocked(false)
    navigator.vibrate?.(0)
    void stopAlarmSoundPreview()
  }, [])

  useEffect(() => {
    const finished = dashboardState.timers.filter((timer) => timer.endsAt && new Date(timer.endsAt).getTime() <= now.getTime())
    if (finished.length === 0) return
    const timeout = window.setTimeout(() => {
      setDashboardState((current) => ({ ...current, timers: current.timers.map((timer) => finished.some((item) => item.id === timer.id) ? { ...timer, remainingSeconds: 0, endsAt: null } : timer) }))
      const timer = finished[0]
      startRinging({ kind: 'timer', sourceId: timer.id, title: timer.label || 'Temporizador', subtitle: 'El temporizador ha terminado.', soundUri: null })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.timers, now, startRinging])

  useEffect(() => {
    const cutoff = now.getTime() - 35_000
    if (!Capacitor.isNativePlatform()) {
      const dueNote = dashboardState.notes.find((note) => !note.archived && note.reminderAt && new Date(note.reminderAt).getTime() <= now.getTime() && new Date(note.reminderAt).getTime() > cutoff && !deliveredSimulationIds.current.has(`note:${note.id}:${note.reminderAt}`))
      if (dueNote) {
        deliveredSimulationIds.current.add(`note:${dueNote.id}:${dueNote.reminderAt}`)
        showSimulatedAlert(dueNote.title || 'Recordatorio', dueNote.content || 'Tienes un recordatorio en Pablo Tablet.')
        return
      }
    }
    const currentTime = timeFormatter.format(now)
    const currentWeekday = (now.getDay() + 1) as AlarmWeekday
    const dueAlarm = dashboardState.alarms.find((alarm) => alarm.enabled && alarm.weekdays.includes(currentWeekday) && alarm.time === currentTime && !deliveredSimulationIds.current.has(`alarm:${alarm.id}:${now.toDateString()}`))
    if (dueAlarm) {
      deliveredSimulationIds.current.add(`alarm:${dueAlarm.id}:${now.toDateString()}`)
      startRinging({ kind: 'alarm', sourceId: dueAlarm.id, title: dueAlarm.label || 'Alarma', subtitle: `Sonando a las ${dueAlarm.time}`, soundUri: dueAlarm.soundUri })
    }
  }, [dashboardState.alarms, dashboardState.notes, now, showSimulatedAlert, startRinging])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const removers: (() => void)[] = []

    const showNotificationAlert = (notification: { id: number; title?: string; body?: string; extra?: Record<string, unknown> }) => {
      const kind = notification.extra?.kind
      if (kind === 'alarm') {
        const alarmId = notification.extra?.alarmId
        if (typeof alarmId !== 'string') return false
        const alarm = dashboardStateRef.current.alarms.find((item) => item.id === alarmId)
        void LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: notification.id, title: notification.title || '', body: notification.body || '' }] })
        startRinging({ kind: 'alarm', sourceId: alarmId, title: alarm?.label || notification.title || 'Alarma', subtitle: notification.body || `Alarma programada para las ${alarm?.time ?? ''}.`, soundUri: alarm?.soundUri ?? null })
        return true
      }
      if (kind === 'timer') {
        const timerId = notification.extra?.timerId
        if (typeof timerId !== 'string') return false
        const timer = dashboardStateRef.current.timers.find((item) => item.id === timerId)
        void LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: notification.id, title: notification.title || '', body: notification.body || '' }] })
        startRinging({ kind: 'timer', sourceId: timerId, title: timer?.label || notification.title || 'Temporizador', subtitle: 'El temporizador ha terminado.', soundUri: null })
        return true
      }
      if (kind === 'calendar') {
        const calendarEventId = notification.extra?.calendarEventId
        if (typeof calendarEventId !== 'string') return false
        const calendarEvent = dashboardStateRef.current.calendarEvents.find((item) => item.id === calendarEventId)
        void LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: notification.id, title: notification.title || '', body: notification.body || '' }] })
        startRinging({
          kind: 'calendar',
          sourceId: calendarEventId,
          title: calendarEvent?.title || notification.title || 'Recordatorio del calendario',
          subtitle: notification.body || (calendarEvent ? formatCalendarEventTime(calendarEvent, toLocalDateKey(new Date())) : 'Tienes un aviso del calendario.'),
          soundUri: null,
        })
        return true
      }
      return false
    }

    void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
      if (showNotificationAlert(notification)) return
      const calendarEventId = notification.extra?.calendarEventId
      if (typeof calendarEventId === 'string') {
        setDashboardState((current) => current.preferences.enabledPageIds.includes('calendar') ? current : {
          ...current,
          preferences: { ...current.preferences, enabledPageIds: [...current.preferences.enabledPageIds, 'calendar'] },
        })
        setActivePageId('calendar')
        setScreen('home')
        registerInteraction()
        return
      }
      const noteId = notification.extra?.noteId
      if (typeof noteId !== 'string') return
      setDashboardState((current) => current.preferences.enabledPageIds.includes('notes') ? current : {
        ...current,
        preferences: { ...current.preferences, enabledPageIds: [...current.preferences.enabledPageIds, 'notes'] },
      })
      window.location.hash = `note=${noteId}`
      setActivePageId('notes')
      setScreen('home')
      registerInteraction()
    }).then((listener) => { removers.push(() => listener.remove()) })

    void LocalNotifications.addListener('localNotificationReceived', (notification) => {
      showNotificationAlert(notification)
    }).then((listener) => { removers.push(() => listener.remove()) })

    return () => removers.forEach((remove) => remove())
  }, [registerInteraction, startRinging])

  useEffect(() => {
    if (!navigationVisible) return
    const timeout = window.setTimeout(
      () => setNavigationVisible(false),
      dashboardState.preferences.navigationSeconds * 1000,
    )
    return () => window.clearTimeout(timeout)
  }, [dashboardState.preferences.navigationSeconds, interactionVersion, navigationVisible])

  useEffect(() => {
    const preferences = dashboardState.preferences
    if (!preferences.screensaverEnabled || screen !== 'home' || interactionLocked || ringingAlert || simulatedAlert) {
      return
    }
    const timeout = window.setTimeout(() => {
      setNavigationVisible(false)
      setScreensaverVisible(true)
    }, preferences.screensaverDelaySeconds * 1_000)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.preferences, interactionLocked, interactionVersion, ringingAlert, screen, simulatedAlert])

  useEffect(() => {
    if (!screensaverVisible) return
    const photoIds = dashboardState.galleryPhotos
      .filter((photo) => photo.deletedAt === null)
      .map((photo) => photo.id)
    const validIds = new Set(photoIds)
    screensaverQueue.current = screensaverQueue.current.filter((id) => validIds.has(id))

    const showNextPhoto = () => {
      if (photoIds.length === 0) {
        setScreensaverPhotoId(null)
        return
      }
      if (screensaverQueue.current.length === 0) {
        const shuffled = [...photoIds]
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
          const other = Math.floor(Math.random() * (index + 1))
          ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
        }
        if (shuffled.length > 1 && shuffled[0] === lastScreensaverPhotoId.current) {
          ;[shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
        }
        screensaverQueue.current = shuffled
      }
      const nextId = screensaverQueue.current.shift() ?? null
      lastScreensaverPhotoId.current = nextId
      setScreensaverPhotoId(nextId)
    }

    showNextPhoto()
    const interval = window.setInterval(showNextPhoto, 15_000)
    return () => window.clearInterval(interval)
  }, [dashboardState.galleryPhotos, screensaverVisible])

  const moveToPage = useCallback((nextIndex: number, isManual = true) => {
    if (enabledPages.length === 0) return
    const wrappedIndex = (nextIndex + enabledPages.length) % enabledPages.length
    setInteractionLocked(false)
    setActivePageId(enabledPages[wrappedIndex].id)
    if (isManual) registerInteraction()
  }, [enabledPages, registerInteraction])

  useEffect(() => {
    const preferences = dashboardState.preferences
    if (
      screen !== 'home'
      || !preferences.rotationEnabled
      || enabledPages.length < 2
      || !activePage?.rotationEligible
      || interactionLocked
      || screensaverVisible
    ) return

    const timeout = window.setTimeout(
      () => moveToPage(activePageIndex + 1, false),
      preferences.rotationSeconds * 1000,
    )
    return () => window.clearTimeout(timeout)
  }, [
    activePage?.rotationEligible,
    activePageIndex,
    dashboardState.preferences,
    enabledPages.length,
    interactionVersion,
    interactionLocked,
    moveToPage,
    screen,
    screensaverVisible,
  ])

  const goTo = (nextScreen: Screen) => {
    setScreensaverVisible(false)
    setScreen(nextScreen)
    setNavigationVisible(false)
    setInteractionLocked(false)
    if (nextScreen === 'home') setActivePageId('dashboard')
  }

  const updatePreferences = (patch: Partial<DashboardPreferences>) => {
    if (patch.screensaverEnabled === false) setScreensaverVisible(false)
    setDashboardState((current) => ({
      ...current,
      preferences: { ...current.preferences, ...patch },
    }))
  }

  const togglePage = (pageId: DashboardPageId) => {
    if (pageId === 'dashboard') return
    setDashboardState((current) => {
      const isEnabled = current.preferences.enabledPageIds.includes(pageId)
      const nextIds = isEnabled
        ? current.preferences.enabledPageIds.filter((id) => id !== pageId)
        : DASHBOARD_PAGES
          .map((page) => page.id)
          .filter((id) => current.preferences.enabledPageIds.includes(id) || id === pageId)
      return {
        ...current,
        preferences: { ...current.preferences, enabledPageIds: nextIds },
      }
    })
  }

  const createNote = () => {
    const now = new Date().toISOString()
    const note: Note = {
      id: createLocalId(),
      title: 'Nueva nota',
      content: '',
      color: 'coral',
      pinned: false,
      reminderAt: null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    setDashboardState((current) => ({ ...current, notes: [note, ...current.notes] }))
    return note.id
  }

  const updateNote = (noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'pinned' | 'reminderAt'>>) => {
    setDashboardState((current) => ({
      ...current,
      notes: current.notes.map((note) => note.id === noteId ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note),
    }))
  }

  const archiveNote = (noteId: string) => {
    setDashboardState((current) => ({
      ...current,
      notes: current.notes.map((note) => note.id === noteId ? { ...note, archived: true, pinned: false, updatedAt: new Date().toISOString() } : note),
    }))
  }

  const restoreNote = (noteId: string) => {
    setDashboardState((current) => ({
      ...current,
      notes: current.notes.map((note) => note.id === noteId ? { ...note, archived: false, updatedAt: new Date().toISOString() } : note),
    }))
  }

  const deleteNote = (noteId: string) => {
    setDashboardState((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== noteId) }))
  }

  const createAlarm = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 5, 0, 0)
    const time = now.toTimeString().slice(0, 5)
    const alarm: Alarm = { id: createLocalId(), label: 'Alarma', time, enabled: true, weekdays: [...EVERY_ALARM_WEEKDAY], soundName: DEFAULT_ALARM_SOUND.name, soundUri: null, createdAt: new Date().toISOString() }
    setDashboardState((current) => ({ ...current, alarms: [...current.alarms, alarm] }))
    return alarm.id
  }

  const createCalendarEvent = (date: string) => {
    const event: CalendarEvent = {
      id: createLocalId(),
      type: 'event',
      recurrence: 'none',
      completed: false,
      title: 'Nuevo evento',
      date,
      endDate: date,
      startTime: '09:00',
      endTime: '10:00',
      allDay: false,
      location: '',
      notes: '',
      color: 'blue',
      reminders: [],
      createdAt: new Date().toISOString(),
    }
    setDashboardState((current) => ({ ...current, calendarEvents: [...current.calendarEvents, event] }))
    return event.id
  }

  const updateCalendarEvent = (eventId: string, patch: CalendarEventPatch) => {
    setDashboardState((current) => ({ ...current, calendarEvents: current.calendarEvents.map((event) => event.id === eventId ? { ...event, ...patch } : event) }))
  }

  const deleteCalendarEvent = (eventId: string) => {
    setDashboardState((current) => ({ ...current, calendarEvents: current.calendarEvents.filter((event) => event.id !== eventId) }))
  }

  const addGalleryPhotos = async () => {
    setInteractionLocked(true)
    try {
      const photos = await pickGalleryPhotos()
      if (photos.length > 0) {
        setDashboardState((current) => ({ ...current, galleryPhotos: [...photos, ...current.galleryPhotos] }))
      }
    } catch (error) {
      console.warn('No se pudieron añadir las imágenes.', error)
    } finally {
      setInteractionLocked(false)
      registerInteraction()
    }
  }

  const moveGalleryPhotoToTrash = (photoId: string) => {
    setDashboardState((current) => ({
      ...current,
      galleryPhotos: current.galleryPhotos.map((photo) => photo.id === photoId ? { ...photo, deletedAt: new Date().toISOString() } : photo),
    }))
  }

  const restoreGalleryPhoto = (photoId: string) => {
    setDashboardState((current) => ({
      ...current,
      galleryPhotos: current.galleryPhotos.map((photo) => photo.id === photoId ? { ...photo, deletedAt: null } : photo),
    }))
  }

  const permanentlyDeleteGalleryPhoto = async (photoId: string) => {
    const photo = dashboardStateRef.current.galleryPhotos.find((item) => item.id === photoId)
    if (!photo) return
    try {
      await deleteGalleryPhotoFile(photo.uri)
      setDashboardState((current) => ({ ...current, galleryPhotos: current.galleryPhotos.filter((item) => item.id !== photoId) }))
    } catch (error) {
      console.warn('No se pudo eliminar definitivamente la imagen.', error)
    }
  }

  const updateAlarm = (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled' | 'weekdays' | 'soundName' | 'soundUri'>>) => {
    setDashboardState((current) => ({ ...current, alarms: current.alarms.map((alarm) => alarm.id === alarmId ? { ...alarm, ...patch } : alarm) }))
  }

  const deleteAlarm = (alarmId: string) => {
    setDashboardState((current) => ({ ...current, alarms: current.alarms.filter((alarm) => alarm.id !== alarmId) }))
  }

  const createTimer = () => {
    const timer: Timer = { id: createLocalId(), label: 'Temporizador', durationSeconds: 300, remainingSeconds: 300, endsAt: null, createdAt: new Date().toISOString() }
    setDashboardState((current) => ({ ...current, timers: [...current.timers, timer] }))
    return timer.id
  }
  const updateTimer = (timerId: string, patch: Partial<Pick<Timer, 'label' | 'durationSeconds' | 'remainingSeconds' | 'endsAt'>>) => setDashboardState((current) => ({ ...current, timers: current.timers.map((timer) => timer.id === timerId ? { ...timer, ...patch } : timer) }))
  const deleteTimer = (timerId: string) => setDashboardState((current) => ({ ...current, timers: current.timers.filter((timer) => timer.id !== timerId) }))

  const toggleStopwatch = () => setDashboardState((current) => {
    const stopwatch = current.stopwatch
    if (!stopwatch.startedAt) return { ...current, stopwatch: { ...stopwatch, startedAt: new Date().toISOString() } }
    const elapsedMilliseconds = stopwatch.elapsedMilliseconds + Math.max(0, Date.now() - new Date(stopwatch.startedAt).getTime())
    return { ...current, stopwatch: { elapsedMilliseconds, startedAt: null } }
  })
  const resetStopwatch = () => setDashboardState((current) => ({ ...current, stopwatch: { elapsedMilliseconds: 0, startedAt: null } }))

  const snoozeRingingAlert = () => {
    if (!ringingAlert || ringingAlert.kind === 'timer') return
    if (ringingAlert.kind === 'alarm') {
      const alarm = dashboardStateRef.current.alarms.find((item) => item.id === ringingAlert.sourceId)
      if (alarm) void snoozeAlarmNotification(alarm, snoozeMinutes).catch((error) => console.warn('No se pudo posponer la alarma.', error))
    } else {
      const calendarEvent = dashboardStateRef.current.calendarEvents.find((item) => item.id === ringingAlert.sourceId)
      if (calendarEvent) void snoozeCalendarEventNotification(calendarEvent, snoozeMinutes).catch((error) => console.warn('No se pudo volver a programar el recordatorio.', error))
    }
    if (!Capacitor.isNativePlatform()) {
      window.setTimeout(() => startRinging({ ...ringingAlert, subtitle: `Recordatorio aplazado ${snoozeMinutes} min` }), snoozeMinutes * 60_000)
    }
    stopRinging()
  }

  const openNotes = (noteId?: string) => {
    if (!dashboardState.preferences.enabledPageIds.includes('notes')) {
      updatePreferences({
        enabledPageIds: DASHBOARD_PAGES
          .map((page) => page.id)
          .filter((id) => dashboardState.preferences.enabledPageIds.includes(id) || id === 'notes'),
      })
    }
    setActivePageId('notes')
    if (noteId) window.location.hash = `note=${noteId}`
    registerInteraction()
  }

  const openWeather = () => {
    if (!dashboardState.preferences.enabledPageIds.includes('weather')) {
      updatePreferences({
        enabledPageIds: DASHBOARD_PAGES
          .map((page) => page.id)
          .filter((id) => dashboardState.preferences.enabledPageIds.includes(id) || id === 'weather'),
      })
    }
    setActivePageId('weather')
    registerInteraction()
  }

  const openCalendar = () => {
    if (!dashboardState.preferences.enabledPageIds.includes('calendar')) {
      updatePreferences({
        enabledPageIds: DASHBOARD_PAGES
          .map((page) => page.id)
          .filter((id) => dashboardState.preferences.enabledPageIds.includes(id) || id === 'calendar'),
      })
    }
    setActivePageId('calendar')
    registerInteraction()
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return
    const target = event.target as HTMLElement
    const gestureBlocked = interactionLocked || target.closest('input, textarea, select, [data-swipe-block], .page-indicators, .navigation-reveal, .bottom-navigation')
    if (gestureBlocked) {
      pointerStart.current = null
      return
    }

    pointerStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    registerInteraction()
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return
    if (!pointerStart.current || pointerStart.current.pointerId !== event.pointerId || screen !== 'home') return
    const deltaX = event.clientX - pointerStart.current.x
    const deltaY = event.clientY - pointerStart.current.y
    pointerStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
    moveToPage(activePageIndex + (deltaX < 0 ? 1 : -1))
  }

  const handleClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      event.preventDefault()
      event.stopPropagation()
      suppressClick.current = false
      return
    }
    const target = event.target as HTMLElement
    if (dashboardState.preferences.interactionSoundsEnabled && target.closest('button, select') && !target.closest('.settings-range-row')) {
      void playInteractionSound(dashboardState.preferences.mediaVolume)
    }
  }

  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (screen !== 'home') return
    const target = event.target as HTMLElement
    if (target.closest('.page-indicators, .navigation-reveal, .bottom-navigation')) return
    registerInteraction()
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    if (pointerStart.current?.pointerId !== event.pointerId) return
    pointerStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    const isNoteTextarea = Boolean(target.closest('.note-editor textarea'))
    const gestureBlocked = (!isNoteTextarea && interactionLocked)
      || target.closest('input, select, [data-swipe-block], .page-indicators, .navigation-reveal, .bottom-navigation')
      || (!isNoteTextarea && target.closest('textarea'))
    if (gestureBlocked) {
      touchStart.current = null
      return
    }
    const touch = event.changedTouches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
    registerInteraction()
  }

  const handleTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    if (!touchStart.current || screen !== 'home') return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStart.current.x
    const deltaY = touch.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setInteractionLocked(false)
    moveToPage(activePageIndex + (deltaX < 0 ? 1 : -1))
  }

  return (
    <main
      className={`tablet-shell ${navigationVisible ? 'has-navigation' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touchStart.current = null }}
      onClickCapture={handleClickCapture}
      onClick={handleClick}
    >
      <div className="wallpaper" aria-hidden="true">
        <span className="orb orb-one" />
        <span className="orb orb-two" />
        <span className="grid-glow" />
      </div>

      <section className="tablet-content" aria-label="Pablo Tablet">
        {screen === 'home' && activePage ? (
          <DashboardPage
            key={activePage.id}
            page={activePage}
            now={now}
            time={time}
            date={date}
            widgets={dashboardState.widgets}
            notes={dashboardState.notes}
            calendarEvents={dashboardState.calendarEvents}
            galleryPhotos={dashboardState.galleryPhotos}
            hideCompletedCalendarTasks={dashboardState.preferences.hideCompletedCalendarTasks}
            alarms={dashboardState.alarms}
            timers={dashboardState.timers}
            stopwatch={dashboardState.stopwatch}
            onCreateNote={createNote}
            onUpdateNote={updateNote}
            onArchiveNote={archiveNote}
            onRestoreNote={restoreNote}
            onDeleteNote={deleteNote}
            onCreateCalendarEvent={createCalendarEvent}
            onUpdateCalendarEvent={updateCalendarEvent}
            onDeleteCalendarEvent={deleteCalendarEvent}
            onAddGalleryPhotos={() => void addGalleryPhotos()}
            onMoveGalleryPhotoToTrash={moveGalleryPhotoToTrash}
            onRestoreGalleryPhoto={restoreGalleryPhoto}
            onPermanentlyDeleteGalleryPhoto={(photoId) => void permanentlyDeleteGalleryPhoto(photoId)}
            onHideCompletedCalendarTasksChange={(hideCompletedCalendarTasks) => updatePreferences({ hideCompletedCalendarTasks })}
            onCreateAlarm={createAlarm}
            onUpdateAlarm={updateAlarm}
            onDeleteAlarm={deleteAlarm}
            onPreviewNotification={showSimulatedAlert}
            onCreateTimer={createTimer}
            onUpdateTimer={updateTimer}
            onDeleteTimer={deleteTimer}
            onToggleStopwatch={toggleStopwatch}
            onResetStopwatch={resetStopwatch}
            onOpenNotes={openNotes}
            onOpenWeather={openWeather}
            onOpenCalendar={openCalendar}
            onEditingChange={(isEditing) => {
              setInteractionLocked(isEditing)
            }}
          />
        ) : (
          <SettingsScreen
            preferences={dashboardState.preferences}
            onBack={() => goTo('home')}
            onPreferencesChange={updatePreferences}
            onTogglePage={togglePage}
          />
        )}
      </section>

      {simulatedAlert ? <div className="simulated-alert" role="alert"><BellRing size={21} /><div><strong>{simulatedAlert.title}</strong><p>{simulatedAlert.body}</p><small>Simulación web de aviso local</small></div><button type="button" onClick={() => setSimulatedAlert(null)} aria-label="Cerrar aviso"><X size={18} /></button></div> : null}
      {ringingAlert ? <RingingAlertOverlay alert={ringingAlert} snoozeMinutes={snoozeMinutes} onSnoozeMinutesChange={setSnoozeMinutes} onSnooze={snoozeRingingAlert} onStop={stopRinging} /> : null}
      {screensaverVisible ? <GalleryScreensaver photo={screensaverPhoto} now={now} time={time} date={date} calendarEvents={dashboardState.calendarEvents} onDismiss={() => { setScreensaverVisible(false); registerInteraction() }} /> : null}

      {screen === 'home' && enabledPages.length > 1 ? (
        <nav className="page-indicators" aria-label="Páginas del dashboard">
          {enabledPages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              className={index === activePageIndex ? 'is-active' : ''}
              aria-label={`Ir a ${page.label}`}
              aria-current={index === activePageIndex ? 'page' : undefined}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => moveToPage(index)}
            />
          ))}
        </nav>
      ) : null}

      <button
        className="navigation-reveal"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          setNavigationVisible((visible) => !visible)
          setInteractionVersion((version) => version + 1)
        }}
        aria-label={navigationVisible ? 'Ocultar navegación' : 'Mostrar navegación'}
      >
        {navigationVisible ? <X size={20} /> : <Menu size={20} />}
      </button>

      <nav className={`bottom-navigation ${navigationVisible ? 'is-visible' : ''}`} aria-label="Navegación principal">
        <button
          type="button"
          className={screen === 'home' ? 'is-active' : ''}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => goTo('home')}
        >
          <Home size={21} strokeWidth={2.25} />
          <span>Inicio</span>
        </button>
        <button
          type="button"
          className={screen === 'settings' ? 'is-active' : ''}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => goTo('settings')}
        >
          <Settings size={21} strokeWidth={2.25} />
          <span>Ajustes</span>
        </button>
      </nav>
    </main>
  )
}

function DashboardPage({
  page,
  now,
  time,
  date,
  widgets,
  notes,
  calendarEvents,
  galleryPhotos,
  hideCompletedCalendarTasks,
  alarms,
  timers,
  stopwatch,
  onCreateNote,
  onUpdateNote,
  onArchiveNote,
  onRestoreNote,
  onDeleteNote,
  onCreateCalendarEvent,
  onUpdateCalendarEvent,
  onDeleteCalendarEvent,
  onAddGalleryPhotos,
  onMoveGalleryPhotoToTrash,
  onRestoreGalleryPhoto,
  onPermanentlyDeleteGalleryPhoto,
  onHideCompletedCalendarTasksChange,
  onCreateAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  onCreateTimer,
  onUpdateTimer,
  onDeleteTimer,
  onToggleStopwatch,
  onResetStopwatch,
  onPreviewNotification,
  onOpenNotes,
  onOpenWeather,
  onOpenCalendar,
  onEditingChange,
}: {
  page: DashboardPageDefinition
  now: Date
  time: string
  date: string
  widgets: import('./widgetLayout').DashboardWidget[]
  notes: Note[]
  calendarEvents: CalendarEvent[]
  galleryPhotos: GalleryPhoto[]
  hideCompletedCalendarTasks: boolean
  alarms: Alarm[]
  timers: Timer[]
  stopwatch: StopwatchState
  onCreateNote: () => string
  onUpdateNote: (noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'pinned' | 'reminderAt'>>) => void
  onArchiveNote: (noteId: string) => void
  onRestoreNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onCreateCalendarEvent: (date: string) => string
  onUpdateCalendarEvent: (eventId: string, patch: CalendarEventPatch) => void
  onDeleteCalendarEvent: (eventId: string) => void
  onAddGalleryPhotos: () => void
  onMoveGalleryPhotoToTrash: (photoId: string) => void
  onRestoreGalleryPhoto: (photoId: string) => void
  onPermanentlyDeleteGalleryPhoto: (photoId: string) => void
  onHideCompletedCalendarTasksChange: (hidden: boolean) => void
  onCreateAlarm: () => string
  onUpdateAlarm: (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled' | 'weekdays' | 'soundName' | 'soundUri'>>) => void
  onDeleteAlarm: (alarmId: string) => void
  onCreateTimer: () => string
  onUpdateTimer: (timerId: string, patch: Partial<Pick<Timer, 'label' | 'durationSeconds' | 'remainingSeconds' | 'endsAt'>>) => void
  onDeleteTimer: (timerId: string) => void
  onToggleStopwatch: () => void
  onResetStopwatch: () => void
  onPreviewNotification: (title: string, body: string) => void
  onOpenNotes: (noteId?: string) => void
  onOpenWeather: () => void
  onOpenCalendar: () => void
  onEditingChange: (isEditing: boolean) => void
}) {
  if (page.id === 'clock') return <ClockPage time={time} date={date} now={now} alarms={alarms} timers={timers} stopwatch={stopwatch} onCreateAlarm={onCreateAlarm} onUpdateAlarm={onUpdateAlarm} onDeleteAlarm={onDeleteAlarm} onCreateTimer={onCreateTimer} onUpdateTimer={onUpdateTimer} onDeleteTimer={onDeleteTimer} onToggleStopwatch={onToggleStopwatch} onResetStopwatch={onResetStopwatch} onPreviewNotification={onPreviewNotification} />
  if (page.id === 'calendar') return <CalendarPage now={now} events={calendarEvents} hideCompletedTasks={hideCompletedCalendarTasks} onHideCompletedTasksChange={onHideCompletedCalendarTasksChange} onCreate={onCreateCalendarEvent} onUpdate={onUpdateCalendarEvent} onDelete={onDeleteCalendarEvent} onEditingChange={onEditingChange} />
  if (page.id === 'gallery') return <GalleryPage photos={galleryPhotos} onAddPhotos={onAddGalleryPhotos} onMoveToTrash={onMoveGalleryPhotoToTrash} onRestore={onRestoreGalleryPhoto} onPermanentlyDelete={onPermanentlyDeleteGalleryPhoto} onEditingChange={onEditingChange} />
  if (page.id === 'weather') return <WeatherPage />
  if (page.id === 'notes') return <NotesPage notes={notes} onCreateNote={onCreateNote} onUpdateNote={onUpdateNote} onArchiveNote={onArchiveNote} onRestoreNote={onRestoreNote} onDeleteNote={onDeleteNote} onPreviewNotification={onPreviewNotification} onEditingChange={onEditingChange} />
  return <GridDashboard now={now} time={time} date={date} widgets={widgets} notes={notes} calendarEvents={calendarEvents} onOpenNotes={onOpenNotes} onOpenWeather={onOpenWeather} onOpenCalendar={onOpenCalendar} />
}

function PageHeader({ pageLabel }: { pageLabel: string }) {
  return (
    <header className="dashboard-header compact-header">
      <div>
        <p className="eyebrow">Pablo Tablet</p>
        <p className="welcome">{pageLabel}</p>
      </div>
      <div className="status-pill" aria-label="Estado de la tablet">
        <LockKeyhole size={14} />
        <span>Modo hogar</span>
      </div>
    </header>
  )
}

function GalleryScreensaver({ photo, now, time, date, calendarEvents, onDismiss }: { photo: GalleryPhoto | undefined; now: Date; time: string; date: string; calendarEvents: CalendarEvent[]; onDismiss: () => void }) {
  const upcomingEvents = getUpcomingCalendarEvents(calendarEvents, now, time)
  const dismiss = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onDismiss()
  }
  return <div className={`gallery-screensaver ${photo ? 'has-photo' : 'is-empty'}`} role="button" tabIndex={0} aria-label="Cerrar salvapantallas" onPointerDown={dismiss} onClick={(event) => { event.preventDefault(); event.stopPropagation() }}>
    {photo ? <img key={photo.id} src={galleryPhotoSource(photo.uri)} alt="" /> : null}
    <div className="gallery-screensaver-shade" />
    <div className="gallery-screensaver-clock"><time>{time}</time><span>{date}</span>{photo ? <small>{photo.name}</small> : <small>Añade fotos desde la Galería</small>}</div>
    <aside className="gallery-screensaver-agenda" aria-label="Próximos eventos">
      <header><CalendarDays size={20} /><span>Próximos eventos</span></header>
      {upcomingEvents.length > 0
        ? upcomingEvents.map((event) => <div key={event.id} className={`event-${event.color} kind-${event.type}`}><i /><span><strong><CalendarEventTypeMark type={event.type} />{event.title || 'Evento'}</strong><small>{formatCalendarEventTime(event, toLocalDateKey(now))}</small></span></div>)
        : <p>No hay eventos próximos</p>}
    </aside>
  </div>
}

function GalleryPage({ photos, onAddPhotos, onMoveToTrash, onRestore, onPermanentlyDelete, onEditingChange }: { photos: GalleryPhoto[]; onAddPhotos: () => void; onMoveToTrash: (photoId: string) => void; onRestore: (photoId: string) => void; onPermanentlyDelete: (photoId: string) => void; onEditingChange: (isEditing: boolean) => void }) {
  const [showTrash, setShowTrash] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false)
  const activePhotos = photos.filter((photo) => photo.deletedAt === null)
  const deletedPhotos = photos.filter((photo) => photo.deletedAt !== null)
  const visiblePhotos = showTrash ? deletedPhotos : activePhotos
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId)

  useEffect(() => {
    onEditingChange(selectedPhotoId !== null)
    return () => onEditingChange(false)
  }, [onEditingChange, selectedPhotoId])

  const closeViewer = () => {
    setSelectedPhotoId(null)
    setConfirmPermanentDelete(false)
  }

  return <div className="fullscreen-page gallery-page page-enter">
    <PageHeader pageLabel="Galería" />
    <section className="gallery-panel">
      <header className="gallery-toolbar">
        <div><p className="eyebrow">Fotos locales</p><h1>{showTrash ? 'Papelera' : 'Mis fotos'}</h1><span>{showTrash ? `${deletedPhotos.length} eliminadas` : `${activePhotos.length} en esta tablet`}</span></div>
        <div className="gallery-actions">
          <button type="button" className={showTrash ? 'is-active' : ''} onClick={() => { setShowTrash((value) => !value); closeViewer() }}><Trash2 size={18} />{showTrash ? 'Volver a fotos' : `Papelera${deletedPhotos.length ? ` · ${deletedPhotos.length}` : ''}`}</button>
          {!showTrash ? <button type="button" className="gallery-add-button" onClick={onAddPhotos}><Upload size={19} />Añadir fotos</button> : null}
        </div>
      </header>

      {visiblePhotos.length > 0 ? <div className="gallery-grid">
        {visiblePhotos.map((photo) => <button key={photo.id} type="button" className="gallery-thumbnail" onClick={() => setSelectedPhotoId(photo.id)} aria-label={`Abrir ${photo.name}`}>
          <img src={galleryPhotoSource(photo.uri)} alt={photo.name} loading="lazy" />
          <span>{photo.name}</span>
        </button>)}
      </div> : <div className="gallery-empty">
        <span><Images size={46} strokeWidth={1.35} /></span>
        <h2>{showTrash ? 'La papelera está vacía' : 'Añade tus primeras fotos'}</h2>
        <p>{showTrash ? 'Las fotos que elimines se conservarán aquí durante 30 días.' : 'Selecciona una o varias imágenes guardadas en la tablet.'}</p>
        {!showTrash ? <button type="button" onClick={onAddPhotos}><Upload size={18} />Elegir fotos</button> : null}
      </div>}
    </section>

    {selectedPhoto ? <div className="gallery-viewer" data-swipe-block role="dialog" aria-modal="true" aria-label={selectedPhoto.name}>
      <button type="button" className="gallery-viewer-close" onClick={closeViewer} aria-label="Cerrar foto"><X size={25} /></button>
      <img src={galleryPhotoSource(selectedPhoto.uri)} alt={selectedPhoto.name} />
      <footer>
        <div><strong>{selectedPhoto.name}</strong><span>{new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(selectedPhoto.createdAt))}</span></div>
        {selectedPhoto.deletedAt ? <div className="gallery-viewer-actions">
          <button type="button" onClick={() => { onRestore(selectedPhoto.id); closeViewer() }}><RotateCcw size={18} />Restaurar</button>
          {confirmPermanentDelete
            ? <span className="gallery-delete-confirm"><small>Esta acción no se puede deshacer</small><button type="button" onClick={() => setConfirmPermanentDelete(false)}>Cancelar</button><button type="button" className="is-danger" onClick={() => { onPermanentlyDelete(selectedPhoto.id); closeViewer() }}>Eliminar</button></span>
            : <button type="button" className="is-danger" onClick={() => setConfirmPermanentDelete(true)}><Trash2 size={18} />Eliminar definitivamente</button>}
        </div> : <div className="gallery-viewer-actions"><button type="button" className="is-danger" onClick={() => { onMoveToTrash(selectedPhoto.id); closeViewer() }}><Trash2 size={18} />Mover a la papelera</button></div>}
      </footer>
    </div> : null}
  </div>
}

function useDashboardOrientation(): DashboardOrientation {
  const getOrientation = () => window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'
  const [orientation, setOrientation] = useState<DashboardOrientation>(getOrientation)

  useEffect(() => {
    const updateOrientation = () => setOrientation(getOrientation())
    window.addEventListener('resize', updateOrientation)
    return () => window.removeEventListener('resize', updateOrientation)
  }, [])

  return orientation
}

function GridDashboard({ now, time, date, widgets, notes, calendarEvents, onOpenNotes, onOpenWeather, onOpenCalendar }: { now: Date; time: string; date: string; widgets: import('./widgetLayout').DashboardWidget[]; notes: Note[]; calendarEvents: CalendarEvent[]; onOpenNotes: (noteId?: string) => void; onOpenWeather: () => void; onOpenCalendar: () => void }) {
  const orientation = useDashboardOrientation()
  const placedWidgets = useMemo(() => placeWidgets(widgets, orientation), [orientation, widgets])
  const featuredNote = notes
    .filter((note) => !note.archived)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))[0]
  const upcomingEvents = getUpcomingCalendarEvents(calendarEvents, now, time)
  return (
    <div className="dashboard-page page-enter">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Pablo Tablet</p>
          <p className="welcome">Buenos días, Pablo</p>
        </div>
        <div className="status-pill" aria-label="Estado de la tablet">
          <LockKeyhole size={14} />
          <span>Modo hogar</span>
        </div>
      </header>
      <div className={`dashboard-grid is-${orientation}`}>
        {placedWidgets.length > 0
          ? placedWidgets.map((widget) => <DashboardWidgetCard key={widget.id} widget={widget} now={now} time={time} date={date} featuredNote={featuredNote} calendarEvents={calendarEvents} upcomingEvents={upcomingEvents} onOpenNotes={onOpenNotes} onOpenWeather={onOpenWeather} onOpenCalendar={onOpenCalendar} />)
          : <DashboardEmptyState time={time} date={date} />}
      </div>
    </div>
  )
}

function DashboardEmptyState({ time, date }: { time: string; date: string }) {
  return <section className="dashboard-empty-state">
    <p>Panel sin módulos</p>
    <time>{time}</time>
    <span>{date}</span>
    <small>Configura los widgets desde el móvil vinculado.</small>
  </section>
}

function DashboardWidgetCard({ widget, now, time, date, featuredNote, calendarEvents, upcomingEvents, onOpenNotes, onOpenWeather, onOpenCalendar }: { widget: PlacedWidget; now: Date; time: string; date: string; featuredNote: Note | undefined; calendarEvents: CalendarEvent[]; upcomingEvents: CalendarEvent[]; onOpenNotes: (noteId?: string) => void; onOpenWeather: () => void; onOpenCalendar: () => void }) {
  const style = {
    gridColumn: `${widget.layout.x + 1} / span ${widget.layout.width}`,
    gridRow: `${widget.layout.y + 1} / span ${widget.layout.height}`,
  } satisfies CSSProperties

  if (widget.id === 'clock') return <article className={`clock-card widget-card ${widget.layout.width === 1 ? 'is-compact-widget' : ''}`} style={style}>
    <div className="widget-label"><span>Ahora</span><span className="live-dot">En directo</span></div>
    <time className="time">{time}</time>
    <p className="date">{date}</p>
    <div className="morning-line"><SunMedium size={18} /><span>Que tengas un día estupendo</span></div>
  </article>

  if (widget.id === 'weather') {
    if (widget.layout.width > 1) return <button type="button" className="weather-card weather-wide-widget widget-card interactive-card" style={style} onClick={onOpenWeather}>
      <div className="weather-wide-current"><div className="weather-icon"><CloudSun size={38} strokeWidth={1.5} /></div><div><p className="temperature">22°</p><p className="weather-copy">Parcialmente nublado</p><span><MapPin size={13} />Madrid</span></div></div>
      <div className="weather-widget-hours">
        <span><small>Ahora</small><CloudSun size={21} /><strong>22°</strong></span>
        <span><small>19:00</small><CloudSun size={21} /><strong>21°</strong></span>
        <span><small>20:00</small><Cloud size={21} /><strong>20°</strong></span>
        <span><small>21:00</small><CloudRain size={21} /><strong>19°</strong></span>
      </div>
    </button>
    if (widget.layout.height > 1) return <button type="button" className="weather-card weather-tall-widget widget-card interactive-card" style={style} onClick={onOpenWeather}>
      <div className="weather-tall-current"><div className="weather-icon"><CloudSun size={42} strokeWidth={1.45} /></div><div><p className="temperature">22°</p><p className="weather-copy">Parcialmente nublado</p><span><MapPin size={13} />Madrid</span></div></div>
      <div className="weather-tall-stats"><span><Droplets size={17} /><small>Humedad</small><strong>58%</strong></span><span><Wind size={17} /><small>Viento</small><strong>11 km/h</strong></span></div>
      <div className="weather-tall-hours"><p>Próximas horas</p><span><small>19:00</small><CloudSun size={20} /><strong>21°</strong></span><span><small>20:00</small><Cloud size={20} /><strong>20°</strong></span><span><small>21:00</small><CloudRain size={20} /><strong>19°</strong></span></div>
    </button>
    return <button type="button" className={`weather-card widget-card interactive-card ${widget.layout.height === 1 ? 'is-compact-widget' : ''}`} style={style} onClick={onOpenWeather}>
      <div className="weather-icon"><CloudSun size={38} strokeWidth={1.5} /></div>
      <div><p className="temperature">22°</p><p className="weather-copy">Parcialmente nublado</p></div>
      <span className="location">Casa</span>
    </button>
  }

  if (widget.id === 'notes') return <button type="button" className={`note-card widget-card interactive-card ${featuredNote ? `note-${featuredNote.color}` : ''}`} style={style} onClick={() => onOpenNotes(featuredNote?.id)}>
    <div className="widget-heading">
      <div className="heading-icon coral"><Check size={18} /></div>
      <div><p className="widget-title">Nota rápida</p><p className="widget-subtitle">Guardada en esta tablet</p></div>
    </div>
    <p className={`note-content ${featuredNote?.content ? '' : 'is-placeholder'}`}>{featuredNote?.content || 'Toca aquí para escribir una nota o recordatorio.'}</p>
    <div className="note-footer"><span>{featuredNote ? (featuredNote.pinned ? 'Fijada' : 'Editada') : 'Sin contenido'}</span><ChevronRight size={17} /></div>
  </button>

  const firstWeekday = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthCells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1
    if (day < 1 || day > daysInMonth) return null
    const value = new Date(now.getFullYear(), now.getMonth(), day)
    const key = toLocalDateKey(value)
    const events = calendarEvents.flatMap((event) => {
      const occurrence = calendarOccurrenceForDate(event, key)
      return occurrence ? [eventForOccurrence(event, occurrence)] : []
    })
    return { key, day, events }
  })

  return <button type="button" className="agenda-card calendar-widget widget-card interactive-card" style={style} onClick={onOpenCalendar}>
    <div className="calendar-widget-header">
      <div className="widget-heading"><div className="heading-icon blue"><CalendarDays size={18} /></div><div><p className="widget-title">Calendario</p><p className="widget-subtitle">{new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(now)}</p></div></div>
      <span>Ver calendario <ChevronRight size={17} /></span>
    </div>
    <div className="calendar-widget-body">
      <section className="calendar-widget-month">
        <div className="calendar-widget-weekdays">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-widget-month-grid">{monthCells.map((cell, index) => cell
          ? <span key={cell.key} className={cell.key === toLocalDateKey(now) ? 'is-today' : ''}><strong>{cell.day}</strong>{cell.events.slice(0, 1).map((event) => <small key={event.id} className={`event-${event.color} ${event.completed ? 'is-completed' : ''} ${isCalendarEventPast(event, now) ? 'is-past' : ''}`}>{event.title || 'Evento'}</small>)}</span>
          : <i key={`empty-${index}`} />)}</div>
      </section>
      <aside className="calendar-widget-agenda">
        <p>Próximos eventos</p>
        {upcomingEvents.length > 0 ? upcomingEvents.map((event) => <span key={event.id} className={`calendar-event-line event-${event.color} kind-${event.type}`}><i /><b><CalendarEventTypeMark type={event.type} />{event.title}</b><time>{formatCalendarEventTime(event, toLocalDateKey(now))}</time></span>) : <span className="calendar-widget-empty"><Compass size={19} />Sin eventos próximos</span>}
      </aside>
    </div>
  </button>
}

function getUpcomingCalendarEvents(calendarEvents: CalendarEvent[], now: Date, time: string, limit = 3) {
  const todayKey = toLocalDateKey(now)
  return calendarEvents
    .filter((event) => event.type !== 'task' || !event.completed)
    .map((event) => {
      let occurrence = nextCalendarOccurrence(event, todayKey)
      if (occurrence?.endDate === todayKey && !event.allDay && event.endTime < time && event.recurrence !== 'none') occurrence = nextCalendarOccurrence(event, addDaysToDateKey(todayKey, 1))
      if (!occurrence || (occurrence.endDate === todayKey && !event.allDay && event.endTime < time)) return null
      return eventForOccurrence(event, occurrence)
    })
    .filter((event): event is CalendarEvent => event !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, limit)
}

function isCalendarEventPast(event: CalendarEvent, now: Date) {
  const todayKey = toLocalDateKey(now)
  if (event.endDate < todayKey) return true
  if (event.endDate > todayKey || event.allDay) return false
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return event.endTime <= currentTime
}

function formatCalendarEventTime(event: CalendarEvent, todayKey?: string) {
  const shortDate = (date: string) => date === todayKey ? 'Hoy' : new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
  if (event.date !== event.endDate) {
    const range = `${shortDate(event.date)} → ${shortDate(event.endDate)}`
    return event.allDay ? range : `${range} · ${event.startTime}–${event.endTime}`
  }
  return event.allDay ? `${shortDate(event.date)} · Todo el día` : `${shortDate(event.date)} · ${event.startTime}`
}

function formatCalendarEventTimeForDay(event: CalendarEvent, selectedDate: string) {
  if (event.allDay) return 'Todo el día'
  if (event.date === event.endDate) return `${event.startTime}–${event.endTime}`
  if (selectedDate === event.date) return `${event.startTime} · Inicio`
  if (selectedDate === event.endDate) return `${event.endTime} · Fin`
  return 'En curso'
}

const calendarMonthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
const calendarDayFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

const CALENDAR_EVENT_TYPES: { value: CalendarEventType; label: string }[] = [
  { value: 'event', label: 'Evento' },
  { value: 'task', label: 'Tarea' },
  { value: 'birthday', label: 'Cumpleaños' },
]

const CALENDAR_RECURRENCES: { value: CalendarEventRecurrence; label: string }[] = [
  { value: 'none', label: 'No repetir' },
  { value: 'daily', label: 'Cada día' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'monthly', label: 'Cada mes' },
  { value: 'yearly', label: 'Cada año' },
]

function CalendarEventTypeMark({ type, size = 14 }: { type: CalendarEventType; size?: number }) {
  const label = CALENDAR_EVENT_TYPES.find((option) => option.value === type)?.label ?? 'Evento'
  const Icon = type === 'task' ? ListTodo : type === 'birthday' ? CakeSlice : CalendarDays
  return <span className={`calendar-type-mark kind-${type}`} title={label} aria-label={label}><Icon size={size} strokeWidth={2.2} /></span>
}

function CalendarPage({ now, events, hideCompletedTasks, onHideCompletedTasksChange, onCreate, onUpdate, onDelete, onEditingChange }: { now: Date; events: CalendarEvent[]; hideCompletedTasks: boolean; onHideCompletedTasksChange: (hidden: boolean) => void; onCreate: (date: string) => string; onUpdate: (eventId: string, patch: CalendarEventPatch) => void; onDelete: (eventId: string) => void; onEditingChange: (isEditing: boolean) => void }) {
  const todayKey = toLocalDateKey(now)
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const editingEvent = events.find((event) => event.id === editingEventId)
  const firstWeekday = (visibleMonth.getDay() + 6) % 7
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const monthCells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1
    return day >= 1 && day <= daysInMonth ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day) : null
  })
  const visibleEvents = hideCompletedTasks ? events.filter((event) => event.type !== 'task' || !event.completed) : events
  const selectedEvents = visibleEvents.flatMap((event) => {
    const occurrence = calendarOccurrenceForDate(event, selectedDate)
    return occurrence ? [eventForOccurrence(event, occurrence)] : []
  }).filter((event) => !hideCompletedTasks || !isCalendarEventPast(event, now))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.localeCompare(b.startTime))
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const upcomingEvents = getUpcomingCalendarEvents(visibleEvents, now, currentTime, 5)

  const changeMonth = (offset: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1)
    setVisibleMonth(next)
    setSelectedDate(toLocalDateKey(next))
  }

  const goToToday = () => {
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(todayKey)
  }

  const openEditor = (eventId: string) => {
    setEditingEventId(eventId)
    onEditingChange(true)
  }
  const closeEditor = () => {
    setEditingEventId(null)
    onEditingChange(false)
  }
  const createEvent = () => openEditor(onCreate(selectedDate))

  return <div className="fullscreen-page calendar-page page-enter">
    <PageHeader pageLabel="Calendario" />
    <div className="calendar-layout">
      <section className="calendar-month-panel">
        <header className="calendar-toolbar">
          <div><p className="eyebrow">Calendario local</p><h1>{calendarMonthFormatter.format(visibleMonth)}</h1></div>
          <div><button type="button" className={`calendar-hide-completed ${hideCompletedTasks ? 'is-active' : ''}`} onClick={() => onHideCompletedTasksChange(!hideCompletedTasks)} aria-pressed={hideCompletedTasks}><EyeOff size={17} /><span>{hideCompletedTasks ? 'Finalizados ocultos' : 'Ocultar finalizados'}</span></button><button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={20} /></button><button type="button" className="calendar-today-button" onClick={goToToday}>Hoy</button><button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente"><ChevronRight size={20} /></button></div>
        </header>
        <div className="calendar-weekdays">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-month-grid">{monthCells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} className="calendar-empty-day" />
          const key = toLocalDateKey(day)
          const dayEvents = visibleEvents.flatMap((event) => {
            const occurrence = calendarOccurrenceForDate(event, key)
            return occurrence ? [eventForOccurrence(event, occurrence)] : []
          }).filter((event) => !hideCompletedTasks || !isCalendarEventPast(event, now))
          return <button key={key} type="button" className={`${key === selectedDate ? 'is-selected' : ''} ${key === todayKey ? 'is-today' : ''}`} onClick={() => setSelectedDate(key)}><strong>{day.getDate()}</strong>{dayEvents.length > 0 ? <span className="calendar-cell-events">{dayEvents.slice(0, 2).map((event) => <span key={event.id} className={`event-${event.color} kind-${event.type} ${event.completed ? 'is-completed' : ''} ${isCalendarEventPast(event, now) ? 'is-past' : ''}`}><CalendarEventTypeMark type={event.type} size={10} /><span>{event.title || 'Evento'}</span>{event.recurrence !== 'none' ? <RotateCw className="calendar-recurrence-mark" size={9} /> : null}</span>)}</span> : null}</button>
        })}</div>
      </section>
      <div className="calendar-side-column">
        <aside className="calendar-day-panel">
          <header><div><p className="eyebrow">Agenda del día</p><h2>{calendarDayFormatter.format(new Date(`${selectedDate}T12:00:00`))}</h2></div><button type="button" className="primary-action" onClick={createEvent}><Plus size={18} />Nuevo</button></header>
          <div className="calendar-day-events">{selectedEvents.length > 0 ? selectedEvents.map((event) => {
            const isPast = isCalendarEventPast(event, now)
            return <button key={event.id} type="button" className={`calendar-day-event event-${event.color} kind-${event.type} ${event.completed ? 'is-completed' : ''} ${isPast ? 'is-past' : ''}`} onClick={() => openEditor(event.id)}><span className="calendar-event-time">{formatCalendarEventTimeForDay(event, selectedDate)}</span><span><strong><CalendarEventTypeMark type={event.type} />{event.title || 'Evento'}{event.recurrence !== 'none' ? <RotateCw className="calendar-recurrence-mark" size={12} /> : null}</strong><small>{event.completed ? 'Tarea completada' : isPast ? `Finalizado · ${formatCalendarEventTime(event)}` : event.location || event.notes || (event.date !== event.endDate ? `${formatCalendarEventTime(event)}` : 'Sin detalles')}</small></span><ChevronRight size={18} /></button>
          }) : <div className="calendar-day-empty"><CalendarDays size={27} /><strong>Este día está libre</strong><span>Añade una cita o recordatorio.</span><button type="button" onClick={createEvent}><Plus size={17} />Crear evento</button></div>}</div>
        </aside>
        <aside className="calendar-upcoming-panel">
          <header><div><p className="eyebrow">Tu agenda</p><h2>Próximos eventos</h2></div><CalendarDays size={21} /></header>
          <div className="calendar-upcoming-list">{upcomingEvents.length > 0 ? upcomingEvents.map((event) => <button key={event.id} type="button" className={`calendar-upcoming-event event-${event.color} kind-${event.type} ${event.completed ? 'is-completed' : ''}`} onClick={() => openEditor(event.id)}><i /><span><strong><CalendarEventTypeMark type={event.type} />{event.title || 'Evento'}{event.recurrence !== 'none' ? <RotateCw className="calendar-recurrence-mark" size={12} /> : null}</strong><small>{event.completed ? `Completada · ${formatCalendarEventTime(event, todayKey)}` : formatCalendarEventTime(event, todayKey)}</small></span><ChevronRight size={17} /></button>) : <div className="calendar-upcoming-empty"><span>No hay próximos eventos.</span></div>}</div>
        </aside>
      </div>
    </div>
    {editingEvent ? <CalendarEventEditor event={editingEvent} onUpdate={onUpdate} onDelete={() => { onDelete(editingEvent.id); closeEditor() }} onClose={closeEditor} /> : null}
  </div>
}

function CalendarEventEditor({ event, onUpdate, onDelete, onClose }: { event: CalendarEvent; onUpdate: (eventId: string, patch: CalendarEventPatch) => void; onDelete: () => void; onClose: () => void }) {
  const [remindersOpen, setRemindersOpen] = useState(false)
  const [startYear, startMonth, startDay] = event.date.split('-').map(Number)
  const [endYear, endMonth, endDay] = event.endDate.split('-').map(Number)
  const years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 1 + index)
  const months = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2026, index, 1)) }))
  const times = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)
  const makeDate = (nextYear: number, nextMonth: number, nextDay: number) => {
    const safeDay = Math.min(nextDay, new Date(nextYear, nextMonth, 0).getDate())
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
  }
  const updateStartDate = (nextYear: number, nextMonth: number, nextDay: number) => {
    const date = makeDate(nextYear, nextMonth, nextDay)
    if (date > event.endDate) {
      onUpdate(event.id, { date, endDate: date, endTime: event.startTime })
      return
    }
    onUpdate(event.id, date === event.endDate && event.startTime > event.endTime ? { date, endTime: event.startTime } : { date })
  }
  const updateEndDate = (nextYear: number, nextMonth: number, nextDay: number) => {
    const chosenEndDate = makeDate(nextYear, nextMonth, nextDay)
    const endDate = chosenEndDate < event.date ? event.date : chosenEndDate
    onUpdate(event.id, endDate === event.date && event.endTime < event.startTime ? { endDate, endTime: event.startTime } : { endDate })
  }
  const updateStartTime = (startTime: string) => {
    onUpdate(event.id, event.date === event.endDate && startTime > event.endTime ? { startTime, endTime: startTime } : { startTime })
  }
  const updateEndTime = (endTime: string) => {
    onUpdate(event.id, { endTime: event.date === event.endDate && endTime < event.startTime ? event.startTime : endTime })
  }

  const dateFields = (kind: 'start' | 'end') => {
    const isStart = kind === 'start'
    const year = isStart ? startYear : endYear
    const month = isStart ? startMonth : endMonth
    const day = isStart ? startDay : endDay
    const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => index + 1)
    const updateDate = isStart ? updateStartDate : updateEndDate
    const time = isStart ? event.startTime : event.endTime
    return <div className="calendar-boundary">
      <span className="calendar-boundary-label">{isStart ? 'Empieza' : 'Termina'}</span>
      <div className={`calendar-boundary-fields ${event.allDay ? 'is-all-day' : ''}`}>
        <label><span>Día</span><select value={day} onChange={(change) => updateDate(year, month, Number(change.target.value))}>{days.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Mes</span><select value={month} onChange={(change) => updateDate(year, Number(change.target.value), day)}>{months.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}</select></label>
        <label><span>Año</span><select value={year} onChange={(change) => updateDate(Number(change.target.value), month, day)}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        {!event.allDay ? <label><span>Hora</span><select value={time} onChange={(change) => isStart ? updateStartTime(change.target.value) : updateEndTime(change.target.value)}>{times.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
      </div>
    </div>
  }

  if (remindersOpen) return <CalendarRemindersEditor event={event} onUpdate={onUpdate} onClose={() => setRemindersOpen(false)} />

  return <div className="alarm-editor-backdrop calendar-editor-backdrop" role="dialog" aria-modal="true" aria-label="Editar evento">
    <section className="alarm-editor calendar-event-editor">
      <header className="alarm-editor-header"><div><p className="eyebrow">Calendario local</p><h2>Configurar evento</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
      <label className="calendar-title-field"><span>Título</span><input value={event.title} maxLength={80} onChange={(change) => onUpdate(event.id, { title: change.target.value })} /></label>
      <div className="calendar-type-field"><span>Tipo</span><div className="calendar-type-options">{CALENDAR_EVENT_TYPES.map((option) => <button key={option.value} type="button" className={`calendar-type-option kind-${option.value} ${event.type === option.value ? 'is-selected' : ''}`} aria-pressed={event.type === option.value} onClick={() => onUpdate(event.id, { type: option.value, completed: option.value === 'task' ? event.completed : false, recurrence: option.value === 'birthday' && event.recurrence === 'none' ? 'yearly' : event.recurrence })}><CalendarEventTypeMark type={option.value} size={17} />{option.label}</button>)}</div></div>
      <div className="calendar-recurrence-field"><span>Repetición</span><div className="calendar-recurrence-options">{CALENDAR_RECURRENCES.map((option) => <button key={option.value} type="button" className={event.recurrence === option.value ? 'is-selected' : ''} aria-pressed={event.recurrence === option.value} onClick={() => onUpdate(event.id, { recurrence: option.value })}>{option.value !== 'none' ? <RotateCw size={14} /> : null}{option.label}</button>)}</div></div>
      <div className={`calendar-event-switches ${event.type === 'task' ? 'has-task' : ''}`}>
        {event.type === 'task' ? <button type="button" className={`calendar-task-status ${event.completed ? 'is-completed' : ''}`} role="switch" aria-checked={event.completed} onClick={() => onUpdate(event.id, { completed: !event.completed })}><span><Check size={18} />{event.completed ? 'Tarea completada' : 'Marcar como completada'}</span><span className={`toggle ${event.completed ? 'is-on' : ''}`}><span /></span></button> : null}
        <button type="button" className="calendar-all-day" role="switch" aria-checked={event.allDay} onClick={() => onUpdate(event.id, { allDay: !event.allDay })}><span><CalendarDays size={18} />Todo el día</span><span className={`toggle ${event.allDay ? 'is-on' : ''}`}><span /></span></button>
      </div>
      <div className="calendar-event-boundaries">{dateFields('start')}{dateFields('end')}</div>
      <div className="calendar-event-details">
        <label className="calendar-location-field"><span>Lugar</span><input value={event.location} maxLength={100} placeholder="Añadir ubicación" onChange={(change) => onUpdate(event.id, { location: change.target.value })} /></label>
        <label className="calendar-notes-field"><span>Notas</span><textarea value={event.notes} maxLength={500} placeholder="Añadir detalles" onChange={(change) => onUpdate(event.id, { notes: change.target.value })} /></label>
        <button type="button" className="calendar-reminders-summary" onClick={() => setRemindersOpen(true)}><span><BellRing size={18} /><span><strong>Recordatorios</strong><small>{event.reminders.length === 0 ? 'Sin avisos' : `${event.reminders.length} ${event.reminders.length === 1 ? 'aviso configurado' : 'avisos configurados'}`}</small></span></span><ChevronRight size={18} /></button>
        <div className="calendar-color-field"><span>Color</span><div>{(['blue', 'mint', 'coral', 'sun'] as CalendarEventColor[]).map((color) => <button key={color} type="button" className={`calendar-color event-${color} ${event.color === color ? 'is-selected' : ''}`} onClick={() => onUpdate(event.id, { color })} aria-label={`Usar color ${color}`} />)}</div></div>
      </div>
      <footer className="alarm-editor-footer"><button type="button" className="text-action danger alarm-delete" onClick={onDelete}><Trash2 size={16} />Eliminar</button><button type="button" className="alarm-done" onClick={onClose}>Hecho</button></footer>
    </section>
  </div>
}

function CalendarRemindersEditor({ event, onUpdate, onClose }: { event: CalendarEvent; onUpdate: (eventId: string, patch: CalendarEventPatch) => void; onClose: () => void }) {
  const years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 1 + index)
  const months = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2026, index, 1)) }))
  const times = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)
  const sortedReminders = [...event.reminders].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))

  const updateReminders = (reminders: CalendarEventReminder[]) => onUpdate(event.id, { reminders })
  const addReminder = (date: string, time = event.startTime, allowDuplicate = false) => {
    if (!allowDuplicate && event.reminders.some((reminder) => reminder.date === date && reminder.time === time)) return
    updateReminders([...event.reminders, { id: createLocalId(), date, time }])
  }
  const updateReminder = (reminderId: string, patch: Partial<Pick<CalendarEventReminder, 'date' | 'time'>>) => {
    updateReminders(event.reminders.map((reminder) => reminder.id === reminderId ? { ...reminder, ...patch } : reminder))
  }
  const removeReminder = (reminderId: string) => updateReminders(event.reminders.filter((reminder) => reminder.id !== reminderId))
  const updateReminderDate = (reminder: CalendarEventReminder, nextYear: number, nextMonth: number, nextDay: number) => {
    const safeDay = Math.min(nextDay, new Date(nextYear, nextMonth, 0).getDate())
    updateReminder(reminder.id, { date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}` })
  }

  return <div className="alarm-editor-backdrop calendar-editor-backdrop" role="dialog" aria-modal="true" aria-label="Recordatorios del evento">
    <section className="alarm-editor calendar-reminders-editor">
      <header className="alarm-editor-header"><div><p className="eyebrow">{event.title || 'Evento'}</p><h2>Recordatorios</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label="Volver al evento"><X size={20} /></button></header>
      <p className="calendar-reminders-help">Puedes añadir todos los avisos que necesites y elegir la fecha y hora exactas.</p>
      <div className="calendar-reminder-presets"><button type="button" onClick={() => addReminder(offsetDateKey(event.date, -7))}><Plus size={16} />1 semana antes</button><button type="button" onClick={() => addReminder(offsetDateKey(event.date, -1))}><Plus size={16} />1 día antes</button><button type="button" onClick={() => addReminder(event.date, event.startTime, true)}><Plus size={16} />Personalizado</button></div>
      <div className="calendar-reminders-list">{sortedReminders.length > 0 ? sortedReminders.map((reminder) => {
        const [year, month, day] = reminder.date.split('-').map(Number)
        const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => index + 1)
        return <div key={reminder.id} className="calendar-reminder-row">
          <label><span>Día</span><select value={day} onChange={(change) => updateReminderDate(reminder, year, month, Number(change.target.value))}>{days.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Mes</span><select value={month} onChange={(change) => updateReminderDate(reminder, year, Number(change.target.value), day)}>{months.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}</select></label>
          <label><span>Año</span><select value={year} onChange={(change) => updateReminderDate(reminder, Number(change.target.value), month, day)}>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Hora</span><select value={reminder.time} onChange={(change) => updateReminder(reminder.id, { time: change.target.value })}>{times.map((value) => <option key={value}>{value}</option>)}</select></label>
          <button type="button" className="calendar-reminder-delete" onClick={() => removeReminder(reminder.id)} aria-label="Eliminar recordatorio"><Trash2 size={17} /></button>
        </div>
      }) : <div className="calendar-reminders-empty"><BellRing size={27} /><strong>Sin recordatorios</strong><span>Añade uno con los botones superiores.</span></div>}</div>
      <footer className="alarm-editor-footer"><span className="calendar-reminder-count">{event.reminders.length} {event.reminders.length === 1 ? 'recordatorio' : 'recordatorios'}</span><button type="button" className="alarm-done" onClick={onClose}>Hecho</button></footer>
    </section>
  </div>
}

function WeatherPage() {
  const hourlyForecast = [
    { time: 'Ahora', temperature: '22°', icon: <CloudSun size={25} /> },
    { time: '19:00', temperature: '21°', icon: <CloudSun size={25} /> },
    { time: '20:00', temperature: '20°', icon: <Cloud size={25} /> },
    { time: '21:00', temperature: '19°', icon: <Cloud size={25} /> },
    { time: '22:00', temperature: '18°', icon: <CloudRain size={25} /> },
  ]
  const dailyForecast = [
    { day: 'Hoy', range: '24° / 16°', detail: 'Parcialmente nublado', icon: <CloudSun size={25} /> },
    { day: 'Jueves', range: '23° / 15°', detail: 'Soleado', icon: <SunMedium size={25} /> },
    { day: 'Viernes', range: '20° / 14°', detail: 'Lluvia débil', icon: <CloudRain size={25} /> },
    { day: 'Sábado', range: '22° / 14°', detail: 'Nubes y claros', icon: <CloudSun size={25} /> },
  ]

  return (
    <div className="fullscreen-page weather-page page-enter">
      <PageHeader pageLabel="Tiempo" />
      <div className="weather-layout">
        <section className="weather-current-panel">
          <div className="weather-page-heading">
            <span><MapPin size={16} />Madrid</span>
            <small>Datos de demostración</small>
          </div>
          <div className="weather-current-main">
            <div className="weather-current-icon"><CloudSun size={72} strokeWidth={1.35} /></div>
            <div><strong>22°</strong><p>Parcialmente nublado</p><span>Sensación térmica de 22°</span></div>
          </div>
          <div className="weather-stats">
            <div><Droplets size={19} /><span>Humedad<strong>58%</strong></span></div>
            <div><Wind size={19} /><span>Viento<strong>11 km/h</strong></span></div>
            <div><Sunrise size={19} /><span>Amanecer<strong>07:54</strong></span></div>
          </div>
          <div className="hourly-forecast" aria-label="Previsión por horas">
            {hourlyForecast.map((forecast) => (
              <div key={forecast.time}>
                <span>{forecast.time}</span>
                {forecast.icon}
                <strong>{forecast.temperature}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="weather-forecast-panel">
          <div className="forecast-heading"><span>Próximos días</span><small>Máx. / mín.</small></div>
          <div className="daily-forecast">
            {dailyForecast.map((forecast) => (
              <div key={forecast.day} className="daily-forecast-row">
                <span className="daily-icon">{forecast.icon}</span>
                <span className="daily-copy"><strong>{forecast.day}</strong><small>{forecast.detail}</small></span>
                <strong>{forecast.range}</strong>
              </div>
            ))}
          </div>
          <p className="weather-source-note">La conexión con una API meteorológica y la gestión de ciudades se incorporarán en la siguiente fase del módulo.</p>
        </section>
      </div>
    </div>
  )
}

function ClockPage({
  now,
  time,
  date,
  alarms,
  timers,
  stopwatch,
  onCreateAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  onCreateTimer,
  onUpdateTimer,
  onDeleteTimer,
  onToggleStopwatch,
  onResetStopwatch,
  onPreviewNotification,
}: {
  now: Date
  time: string
  date: string
  alarms: Alarm[]
  timers: Timer[]
  stopwatch: StopwatchState
  onCreateAlarm: () => string
  onUpdateAlarm: (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled' | 'weekdays' | 'soundName' | 'soundUri'>>) => void
  onDeleteAlarm: (alarmId: string) => void
  onCreateTimer: () => string
  onUpdateTimer: (timerId: string, patch: Partial<Pick<Timer, 'label' | 'durationSeconds' | 'remainingSeconds' | 'endsAt'>>) => void
  onDeleteTimer: (timerId: string) => void
  onToggleStopwatch: () => void
  onResetStopwatch: () => void
  onPreviewNotification: (title: string, body: string) => void
}) {
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null)
  const [editingTimerId, setEditingTimerId] = useState<string | null>(null)
  const [utilityMode, setUtilityMode] = useState<'timers' | 'stopwatch'>('timers')
  const [alarmSounds, setAlarmSounds] = useState<DeviceAlarmSound[]>([DEFAULT_ALARM_SOUND])
  const editingAlarm = alarms.find((alarm) => alarm.id === editingAlarmId)
  const editingTimer = timers.find((timer) => timer.id === editingTimerId)

  useEffect(() => {
    let active = true
    void getDeviceAlarmSounds()
      .then((sounds) => { if (active) setAlarmSounds(sounds) })
      .catch((error) => console.warn('No se pudieron cargar los sonidos de alarma.', error))
    return () => {
      active = false
      void stopAlarmSoundPreview()
    }
  }, [])

  const closeAlarmEditor = () => {
    void stopAlarmSoundPreview()
    setEditingAlarmId(null)
  }

  const createAndEditAlarm = () => setEditingAlarmId(onCreateAlarm())
  const createAndEditTimer = () => {
    setUtilityMode('timers')
    setEditingTimerId(onCreateTimer())
  }

  return (
    <div className="fullscreen-page clock-page page-enter">
      <PageHeader pageLabel="Reloj" />
      <div className="clock-workspace">
        <section className="focus-clock" aria-label="Reloj a pantalla completa">
          <span className="focus-clock-kicker">Ahora</span>
          <time>{time}</time>
          <p>{date}</p>
        </section>
        <div className="clock-management">
          <section className="alarm-panel" aria-labelledby="alarms-title">
            <div className="alarm-panel-heading"><div><p className="eyebrow">Programación semanal</p><h1 id="alarms-title">Alarmas</h1></div><button type="button" className="text-action is-active" onClick={createAndEditAlarm}><Plus size={16} />Nueva alarma</button></div>
            {alarms.length > 0 ? <div className="alarm-list">{[...alarms].sort((a, b) => a.time.localeCompare(b.time)).map((alarm) => <div key={alarm.id} className={`alarm-row ${alarm.enabled ? '' : 'is-disabled'}`}><button type="button" className="alarm-summary" onClick={() => setEditingAlarmId(alarm.id)} aria-label={`Configurar ${alarm.label}`}><strong>{alarm.time}</strong><span><b>{alarm.label || 'Alarma'}</b><small>{formatAlarmWeekdays(alarm.weekdays)} · {alarm.soundName}</small></span><ChevronRight size={17} /></button><button type="button" className={`alarm-toggle ${alarm.enabled ? 'is-on' : ''}`} role="switch" aria-label={`Activar ${alarm.label}`} aria-checked={alarm.enabled} onClick={() => onUpdateAlarm(alarm.id, { enabled: !alarm.enabled })}><span /></button></div>)}</div> : <div className="alarm-empty"><AlarmClock size={22} /><span>No hay alarmas configuradas.</span></div>}
          </section>
          <section className="timer-panel" aria-labelledby="timers-title">
            <div className="utility-heading"><div className="utility-tabs" role="tablist"><button type="button" role="tab" aria-selected={utilityMode === 'timers'} className={utilityMode === 'timers' ? 'is-active' : ''} onClick={() => setUtilityMode('timers')}>Temporizadores</button><button type="button" role="tab" aria-selected={utilityMode === 'stopwatch'} className={utilityMode === 'stopwatch' ? 'is-active' : ''} onClick={() => setUtilityMode('stopwatch')}>Cronómetro</button></div>{utilityMode === 'timers' ? <button type="button" className="text-action is-active" onClick={createAndEditTimer}><Plus size={16} />Nuevo</button> : null}</div>
            {utilityMode === 'timers' ? (timers.length > 0 ? <div className="timer-list">{timers.map((timer) => {
              const remaining = timer.endsAt ? Math.max(0, Math.ceil((new Date(timer.endsAt).getTime() - now.getTime()) / 1000)) : timer.remainingSeconds
              const running = Boolean(timer.endsAt)
              return <div key={timer.id} className="timer-row"><button type="button" className="timer-summary" onClick={() => setEditingTimerId(timer.id)}><span>{timer.label}</span><strong>{formatCountdown(remaining)}</strong></button><button type="button" className="text-action" onClick={() => running ? onUpdateTimer(timer.id, { remainingSeconds: remaining, endsAt: null }) : onUpdateTimer(timer.id, { endsAt: new Date(now.getTime() + remaining * 1000).toISOString() })}>{running ? 'Pausar' : 'Iniciar'}</button><button type="button" className="text-action" onClick={() => onUpdateTimer(timer.id, { remainingSeconds: timer.durationSeconds, endsAt: null })}>Reiniciar</button><button type="button" className="text-action danger" onClick={() => onDeleteTimer(timer.id)} aria-label={`Eliminar ${timer.label}`}><Trash2 size={16} /></button></div>
            })}</div> : <div className="alarm-empty"><Clock3 size={22} /><span>No hay temporizadores activos.</span></div>) : <StopwatchPanel stopwatch={stopwatch} now={now} onToggle={onToggleStopwatch} onReset={onResetStopwatch} />}
          </section>
        </div>
      </div>
      {editingAlarm ? <AlarmEditor alarm={editingAlarm} sounds={alarmSounds} onUpdate={onUpdateAlarm} onDelete={() => { onDeleteAlarm(editingAlarm.id); closeAlarmEditor() }} onClose={closeAlarmEditor} onPreviewNotification={onPreviewNotification} /> : null}
      {editingTimer ? <TimerEditor timer={editingTimer} onUpdate={onUpdateTimer} onDelete={() => { onDeleteTimer(editingTimer.id); setEditingTimerId(null) }} onClose={() => setEditingTimerId(null)} /> : null}
    </div>
  )
}

const ALARM_WEEKDAYS: { value: AlarmWeekday; short: string; label: string }[] = [
  { value: 2, short: 'L', label: 'Lunes' },
  { value: 3, short: 'M', label: 'Martes' },
  { value: 4, short: 'X', label: 'Miércoles' },
  { value: 5, short: 'J', label: 'Jueves' },
  { value: 6, short: 'V', label: 'Viernes' },
  { value: 7, short: 'S', label: 'Sábado' },
  { value: 1, short: 'D', label: 'Domingo' },
]

function formatAlarmWeekdays(days: AlarmWeekday[]) {
  if (days.length === 7) return 'Todos los días'
  if (days.length === 5 && [2, 3, 4, 5, 6].every((day) => days.includes(day as AlarmWeekday))) return 'Entre semana'
  if (days.length === 2 && days.includes(1) && days.includes(7)) return 'Fin de semana'
  return ALARM_WEEKDAYS.filter((day) => days.includes(day.value)).map((day) => day.short).join(', ')
}

function AlarmTimeStepper({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [hour, minute] = value.split(':').map(Number)
  const change = (part: 'hour' | 'minute', delta: number) => {
    const nextHour = part === 'hour' ? (hour + delta + 24) % 24 : hour
    const nextMinute = part === 'minute' ? (minute + delta + 60) % 60 : minute
    onChange(`${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`)
  }
  return <div className="alarm-time-field"><span>Hora</span><div className="alarm-time-stepper"><div><button type="button" onClick={() => change('hour', 1)} aria-label="Subir hora"><Plus size={16} /></button><strong>{String(hour).padStart(2, '0')}</strong><small>hora</small><button type="button" onClick={() => change('hour', -1)} aria-label="Bajar hora"><Minus size={16} /></button></div><b>:</b><div><button type="button" onClick={() => change('minute', 1)} aria-label="Subir minutos"><Plus size={16} /></button><strong>{String(minute).padStart(2, '0')}</strong><small>min</small><button type="button" onClick={() => change('minute', -1)} aria-label="Bajar minutos"><Minus size={16} /></button></div></div></div>
}

function AlarmEditor({ alarm, sounds, onUpdate, onDelete, onClose, onPreviewNotification }: { alarm: Alarm; sounds: DeviceAlarmSound[]; onUpdate: (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled' | 'weekdays' | 'soundName' | 'soundUri'>>) => void; onDelete: () => void; onClose: () => void; onPreviewNotification: (title: string, body: string) => void }) {
  const toggleWeekday = (weekday: AlarmWeekday) => {
    const isSelected = alarm.weekdays.includes(weekday)
    if (isSelected && alarm.weekdays.length === 1) return
    onUpdate(alarm.id, { weekdays: isSelected ? alarm.weekdays.filter((day) => day !== weekday) : [...alarm.weekdays, weekday].sort((a, b) => a - b) })
  }

  const previewSound = async () => {
    try {
      const playedNatively = await previewAlarmSound(alarm.soundUri)
      if (!playedNatively) onPreviewNotification(alarm.label || 'Alarma', `Sonido: ${alarm.soundName}`)
    } catch (error) {
      console.warn('No se pudo reproducir el sonido de alarma.', error)
    }
  }

  return <div className="alarm-editor-backdrop" role="presentation" data-swipe-block>
    <section className="alarm-editor" role="dialog" aria-modal="true" aria-labelledby="alarm-editor-title">
      <div className="alarm-editor-header"><div><p className="eyebrow">Configurar alarma</p><h2 id="alarm-editor-title">{alarm.label || 'Alarma'}</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label="Cerrar configuración"><X size={21} /></button></div>
      <div className="alarm-editor-grid">
        <AlarmTimeStepper value={alarm.time} onChange={(time) => onUpdate(alarm.id, { time })} />
        <label className="alarm-name-field"><span>Nombre</span><input value={alarm.label} maxLength={60} onChange={(event) => onUpdate(alarm.id, { label: event.target.value })} /></label>
        <fieldset className="weekday-picker"><legend>Repetir</legend><div>{ALARM_WEEKDAYS.map((weekday) => <button key={weekday.value} type="button" className={alarm.weekdays.includes(weekday.value) ? 'is-selected' : ''} onClick={() => toggleWeekday(weekday.value)} aria-pressed={alarm.weekdays.includes(weekday.value)} aria-label={weekday.label}>{weekday.short}</button>)}</div></fieldset>
        <div className="alarm-sound-field"><label><span>Sonido</span><select value={alarm.soundUri ?? ''} onChange={(event) => { const sound = sounds.find((item) => item.uri === event.target.value) ?? DEFAULT_ALARM_SOUND; onUpdate(alarm.id, { soundName: sound.name, soundUri: sound.uri || null }) }}>{sounds.map((sound) => <option key={sound.uri || 'default'} value={sound.uri}>{sound.name}</option>)}</select></label><button type="button" className="sound-preview" onClick={previewSound}><Volume2 size={18} />Probar</button></div>
      </div>
      <div className="alarm-editor-footer"><button type="button" className="text-action danger alarm-delete" onClick={onDelete}><Trash2 size={16} />Eliminar</button><label className="alarm-enabled"><span>Alarma activa</span><button type="button" className={`alarm-toggle ${alarm.enabled ? 'is-on' : ''}`} role="switch" aria-checked={alarm.enabled} onClick={() => onUpdate(alarm.id, { enabled: !alarm.enabled })}><span /></button></label><button type="button" className="alarm-done" onClick={onClose}>Hecho</button></div>
    </section>
  </div>
}

function TimerEditor({ timer, onUpdate, onDelete, onClose }: { timer: Timer; onUpdate: (timerId: string, patch: Partial<Pick<Timer, 'label' | 'durationSeconds' | 'remainingSeconds' | 'endsAt'>>) => void; onDelete: () => void; onClose: () => void }) {
  const setMinutes = (minutes: number) => {
    const safeMinutes = Math.max(1, Math.min(1440, Math.round(minutes || 1)))
    const seconds = safeMinutes * 60
    onUpdate(timer.id, { durationSeconds: seconds, remainingSeconds: seconds, endsAt: null })
  }
  return <div className="alarm-editor-backdrop" role="presentation" data-swipe-block>
    <section className="alarm-editor timer-editor" role="dialog" aria-modal="true" aria-labelledby="timer-editor-title">
      <div className="alarm-editor-header"><div><p className="eyebrow">Configurar temporizador</p><h2 id="timer-editor-title">{timer.label}</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label="Cerrar configuración"><X size={21} /></button></div>
      <label className="timer-name-field"><span>Nombre</span><input value={timer.label} maxLength={60} onChange={(event) => onUpdate(timer.id, { label: event.target.value })} /></label>
      <fieldset className="timer-presets"><legend>Duración rápida</legend><div>{[1, 5, 10, 15].map((minutes) => <button key={minutes} type="button" className={timer.durationSeconds === minutes * 60 ? 'is-selected' : ''} onClick={() => setMinutes(minutes)}>{minutes} min</button>)}</div></fieldset>
      <label className="custom-duration"><span>Otra duración</span><span><input type="number" inputMode="numeric" min="1" max="1440" value={Math.max(1, Math.round(timer.durationSeconds / 60))} onChange={(event) => setMinutes(Number(event.target.value))} /> minutos</span></label>
      <div className="alarm-editor-footer"><button type="button" className="text-action danger alarm-delete" onClick={onDelete}><Trash2 size={16} />Eliminar</button><button type="button" className="alarm-done" onClick={onClose}>Hecho</button></div>
    </section>
  </div>
}

function StopwatchPanel({ stopwatch, now, onToggle, onReset }: { stopwatch: StopwatchState; now: Date; onToggle: () => void; onReset: () => void }) {
  const elapsed = stopwatch.elapsedMilliseconds + (stopwatch.startedAt ? Math.max(0, now.getTime() - new Date(stopwatch.startedAt).getTime()) : 0)
  return <div className="stopwatch-panel"><Clock3 size={26} /><strong>{formatStopwatch(elapsed)}</strong><div><button type="button" className="text-action is-active" onClick={onToggle}>{stopwatch.startedAt ? <Pause size={16} /> : <Play size={16} />}{stopwatch.startedAt ? 'Pausar' : 'Iniciar'}</button><button type="button" className="text-action" onClick={onReset}><RotateCcw size={16} />Reiniciar</button></div></div>
}

function RingingAlertOverlay({ alert, snoozeMinutes, onSnoozeMinutesChange, onSnooze, onStop }: { alert: RingingAlert; snoozeMinutes: number; onSnoozeMinutesChange: (minutes: number) => void; onSnooze: () => void; onStop: () => void }) {
  return <div className="ringing-alert-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="ringing-alert-title" data-swipe-block>
    <section className={`ringing-alert-card ${alert.kind === 'calendar' ? 'is-calendar-reminder' : ''}`}>
      <div className="ringing-bell">{alert.kind === 'calendar' ? <CalendarDays size={46} /> : <BellRing size={46} />}</div>
      <p className="eyebrow">{alert.kind === 'alarm' ? 'Alarma' : alert.kind === 'timer' ? 'Temporizador' : 'Recordatorio del calendario'}</p>
      <h2 id="ringing-alert-title">{alert.title}</h2>
      <p>{alert.subtitle}</p>
      <div className="ringing-actions">{alert.kind !== 'timer' ? <div className="snooze-action"><select value={snoozeMinutes} onChange={(event) => onSnoozeMinutesChange(Number(event.target.value))} aria-label="Minutos para volver a recordar">{[1, 5, 10, 15].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}</select><button type="button" onClick={onSnooze}>{alert.kind === 'calendar' ? 'Volver a recordar' : 'Posponer'}</button></div> : null}<button type="button" className="stop-ringing" onClick={onStop}>{alert.kind === 'calendar' ? 'Aceptar' : 'Detener'}</button></div>
    </section>
  </div>
}

function formatCountdown(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatStopwatch(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function NotesPage({
  notes,
  onCreateNote,
  onUpdateNote,
  onArchiveNote,
  onRestoreNote,
  onDeleteNote,
  onPreviewNotification,
  onEditingChange,
}: {
  notes: Note[]
  onCreateNote: () => string
  onUpdateNote: (noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'pinned' | 'reminderAt'>>) => void
  onArchiveNote: (noteId: string) => void
  onRestoreNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onPreviewNotification: (title: string, body: string) => void
  onEditingChange: (isEditing: boolean) => void
}) {
  const [showArchived, setShowArchived] = useState(false)
  const visibleNotes = useMemo(
    () => notes.filter((note) => !note.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
    [notes],
  )
  const archivedNotes = useMemo(() => notes.filter((note) => note.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [notes])
  const notesForView = showArchived ? archivedNotes : visibleNotes
  const hashNoteId = window.location.hash.startsWith('#note=') ? window.location.hash.slice(6) : null
  const [selectedId, setSelectedId] = useState<string | null>(hashNoteId)
  const selectedNote = notesForView.find((note) => note.id === selectedId) ?? notesForView[0]

  const createAndSelect = () => {
    const noteId = onCreateNote()
    setSelectedId(noteId)
  }

  return (
    <div className="fullscreen-page page-enter">
      <PageHeader pageLabel="Nota rápida" />
      <section className="notes-workspace" aria-label="Notas locales">
        <aside className="notes-sidebar">
          <div className="notes-sidebar-header"><div><h1>{showArchived ? 'Archivo' : 'Mis notas'}</h1><p>{showArchived ? `${archivedNotes.length} archivadas` : `${visibleNotes.length} guardadas en esta tablet`}</p></div>{!showArchived ? <button type="button" className="icon-button" onClick={createAndSelect} aria-label="Crear una nota"><Plus size={20} /></button> : null}</div>
          <div className="note-filter" role="tablist" aria-label="Filtrar notas"><button type="button" className={!showArchived ? 'is-active' : ''} onClick={() => { setShowArchived(false); setSelectedId(null) }} role="tab" aria-selected={!showArchived}>Activas</button><button type="button" className={showArchived ? 'is-active' : ''} onClick={() => { setShowArchived(true); setSelectedId(null) }} role="tab" aria-selected={showArchived}>Archivo</button></div>
          <div className="note-list">
            {notesForView.map((note) => <button key={note.id} type="button" className={`note-list-item note-${note.color} ${selectedNote?.id === note.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(note.id)}><span className="note-list-color" /><span><strong>{note.title || 'Sin título'}</strong><small>{note.content || 'Sin contenido'}</small></span>{note.pinned ? <Pin size={14} /> : null}</button>)}
            {notesForView.length === 0 ? <div className="notes-empty"><FileText size={24} /><p>{showArchived ? 'No hay notas archivadas.' : 'Aún no hay notas.'}</p>{!showArchived ? <button type="button" onClick={createAndSelect}>Crear la primera</button> : null}</div> : null}
          </div>
        </aside>
        {selectedNote ? <NoteEditor note={selectedNote} readOnly={showArchived} onUpdate={onUpdateNote} onArchive={() => { onArchiveNote(selectedNote.id); setSelectedId(null) }} onRestore={() => { onRestoreNote(selectedNote.id); setShowArchived(false); setSelectedId(selectedNote.id) }} onDelete={() => { if (window.confirm('¿Eliminar esta nota de forma permanente?')) { onDeleteNote(selectedNote.id); setSelectedId(null) } }} onPreviewNotification={onPreviewNotification} onEditingChange={onEditingChange} /> : <div className="notes-editor-placeholder"><FileText size={32} /><h2>{showArchived ? 'Archivo vacío' : 'Tu espacio de notas'}</h2><p>{showArchived ? 'Las notas archivadas aparecerán aquí.' : 'Crea una nota para guardar ideas y recordatorios locales.'}</p>{!showArchived ? <button type="button" onClick={createAndSelect}>Nueva nota</button> : null}</div>}
      </section>
    </div>
  )
}

function NoteEditor({ note, readOnly, onUpdate, onArchive, onRestore, onDelete, onPreviewNotification, onEditingChange }: { note: Note; readOnly: boolean; onUpdate: (noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'pinned' | 'reminderAt'>>) => void; onArchive: () => void; onRestore: () => void; onDelete: () => void; onPreviewNotification: (title: string, body: string) => void; onEditingChange: (isEditing: boolean) => void }) {
  const colors: NoteColor[] = ['coral', 'violet', 'mint', 'sun']
  return (
    <div className="note-editor">
      <div className="note-editor-actions">
        <div className="note-colors" aria-label="Color de la nota">{colors.map((color) => <button key={color} type="button" disabled={readOnly} className={`color-dot ${color} ${note.color === color ? 'is-active' : ''}`} onClick={() => onUpdate(note.id, { color })} aria-label={`Usar color ${color}`} />)}</div>
        {!readOnly ? <button type="button" className={`text-action ${note.pinned ? 'is-active' : ''}`} onClick={() => onUpdate(note.id, { pinned: !note.pinned })}><Pin size={16} />{note.pinned ? 'Fijada' : 'Fijar'}</button> : null}
        <div className="editor-destructive-actions">{readOnly ? <button type="button" className="text-action" onClick={onRestore}><RotateCcw size={16} />Restaurar</button> : <button type="button" className="text-action" onClick={onArchive}><Archive size={16} />Archivar</button>}<button type="button" className="text-action danger" onClick={onDelete} aria-label="Eliminar nota"><Trash2 size={16} /></button></div>
      </div>
      <input className="note-title-input" value={note.title} maxLength={80} readOnly={readOnly} onChange={(event) => onUpdate(note.id, { title: event.target.value })} onFocus={() => onEditingChange(true)} onBlur={() => onEditingChange(false)} placeholder="Título de la nota" aria-label="Título de la nota" />
      <textarea value={note.content} maxLength={2000} readOnly={readOnly} onChange={(event) => onUpdate(note.id, { content: event.target.value })} onFocus={() => onEditingChange(true)} onBlur={() => onEditingChange(false)} placeholder="Escribe una nota o recordatorio…" aria-label="Contenido de la nota" />
      <div className="note-editor-footer">{readOnly ? <span>Nota archivada</span> : <span className="reminder-controls"><label>Recordatorio<input type="datetime-local" value={note.reminderAt ?? ''} onChange={(event) => onUpdate(note.id, { reminderAt: event.target.value || null })} /></label><button type="button" className="text-action" onClick={() => onPreviewNotification(note.title || 'Recordatorio', note.content || 'Tienes un recordatorio en Pablo Tablet.')}><BellRing size={15} />Probar aviso</button></span>}<span>{note.content.length}/2000 · Guardado local</span></div>
    </div>
  )
}

function SettingsScreen({
  preferences,
  onBack,
  onPreferencesChange,
  onTogglePage,
}: {
  preferences: DashboardPreferences
  onBack: () => void
  onPreferencesChange: (patch: Partial<DashboardPreferences>) => void
  onTogglePage: (pageId: DashboardPageId) => void
}) {
  return (
    <div className="settings-page page-enter">
      <header className="settings-header">
        <div><p className="eyebrow">Pablo Tablet</p><h1>Ajustes</h1></div>
        <button type="button" className="back-button" onClick={onBack}>Volver al inicio</button>
      </header>

      <section className="settings-section" aria-labelledby="dashboard-settings-title">
        <div className="section-heading">
          <div><p className="eyebrow">Dashboard</p><h2 id="dashboard-settings-title">Páginas y rotación</h2></div>
          <RotateCw size={22} />
        </div>
        <SettingToggle
          icon={preferences.rotationEnabled ? <Play size={20} /> : <Pause size={20} />}
          title="Rotación automática"
          detail="Cambia entre las páginas activas y reinicia el contador al tocar la pantalla."
          checked={preferences.rotationEnabled}
          onChange={(rotationEnabled) => onPreferencesChange({ rotationEnabled })}
        />
        <SettingsSelect
          label="Intervalo de rotación"
          value={preferences.rotationSeconds}
          options={[15, 30, 60]}
          suffix="s"
          onChange={(rotationSeconds) => onPreferencesChange({ rotationSeconds })}
        />
        <SettingsSelect
          label="Ocultar navegación tras"
          value={preferences.navigationSeconds}
          options={[3, 5, 8]}
          suffix="s"
          onChange={(navigationSeconds) => onPreferencesChange({ navigationSeconds })}
        />
        <div className="page-toggle-list">
          {DASHBOARD_PAGES.filter((page) => page.id !== 'dashboard').map((page) => (
            <SettingToggle
              key={page.id}
              icon={page.id === 'clock' ? <Clock3 size={20} /> : page.id === 'calendar' ? <CalendarDays size={20} /> : page.id === 'gallery' ? <Images size={20} /> : page.id === 'weather' ? <CloudSun size={20} /> : <FileText size={20} />}
              title={`Página ${page.label}`}
              detail="Página fullscreen incluida en el swipe y en la rotación."
              checked={preferences.enabledPageIds.includes(page.id)}
              onChange={() => onTogglePage(page.id)}
            />
          ))}
        </div>
      </section>

      <section className="settings-list device-settings" aria-label="Ajustes del dispositivo">
        <div className="device-settings-heading"><p className="eyebrow">Dispositivo</p><h2>Pantalla y sonido</h2></div>
        <SettingsRange
          icon={<SunMedium size={20} />}
          label="Brillo"
          value={preferences.brightness}
          minimum={10}
          onChange={(brightness) => onPreferencesChange({ brightness })}
        />
        <SettingsRange
          icon={<Volume2 size={20} />}
          label="Volumen de alarmas"
          value={preferences.alarmVolume}
          minimum={0}
          onChange={(alarmVolume) => {
            onPreferencesChange({ alarmVolume })
            void previewDeviceVolume('alarm', alarmVolume)
          }}
        />
        <SettingsRange
          icon={<Volume2 size={20} />}
          label="Volumen general"
          value={preferences.mediaVolume}
          minimum={0}
          onChange={(mediaVolume) => {
            onPreferencesChange({ mediaVolume })
            void playInteractionSound(mediaVolume)
          }}
        />
        <SettingToggle
          icon={<Volume2 size={20} />}
          title="Sonido al interactuar"
          detail="Reproduce un toque breve al pulsar controles."
          checked={preferences.interactionSoundsEnabled}
          onChange={(interactionSoundsEnabled) => {
            onPreferencesChange({ interactionSoundsEnabled })
            if (interactionSoundsEnabled) void playInteractionSound(preferences.mediaVolume)
          }}
        />
        <SettingToggle
          icon={<Images size={20} />}
          title="Salvapantallas de fotos"
          detail="Muestra las fotos elegidas cuando la tablet queda inactiva."
          checked={preferences.screensaverEnabled}
          onChange={(screensaverEnabled) => onPreferencesChange({ screensaverEnabled })}
        />
        {preferences.screensaverEnabled ? <ScreensaverDelaySelect value={preferences.screensaverDelaySeconds} onChange={(screensaverDelaySeconds) => onPreferencesChange({ screensaverDelaySeconds })} /> : null}
        <SettingToggle
          icon={<SunMedium size={20} />}
          title="Pantalla siempre encendida"
          detail="Evita que la tablet se suspenda mientras Pablo Tablet está abierta."
          checked={preferences.keepScreenAwake}
          onChange={(keepScreenAwake) => onPreferencesChange({ keepScreenAwake })}
        />
        {!preferences.keepScreenAwake ? <ScreenTimeoutSelect value={preferences.screenTimeoutSeconds} onChange={(screenTimeoutSeconds) => onPreferencesChange({ screenTimeoutSeconds })} /> : null}
        <button type="button" className="settings-row exit-app-row" onClick={() => void exitTabletApp()}>
          <span className="settings-icon"><LogOut size={20} /></span>
          <span className="settings-copy"><strong>Salir de la app</strong><small>Desbloquear Android y cerrar Pablo Tablet</small></span>
        </button>
      </section>
    </div>
  )
}

function SettingToggle({
  icon,
  title,
  detail,
  checked,
  onChange,
}: {
  icon: ReactNode
  title: string
  detail: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button type="button" className="settings-row toggle-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="settings-icon">{icon}</span>
      <span className="settings-copy"><strong>{title}</strong><small>{detail}</small></span>
      <span className={`toggle ${checked ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
    </button>
  )
}

function SettingsSelect({
  label,
  value,
  options,
  suffix,
  onChange,
}: {
  label: string
  value: number
  options: number[]
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label className="settings-select-row">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((option) => <option key={option} value={option}>{option}{suffix}</option>)}
      </select>
    </label>
  )
}

function SettingsRange({ icon, label, value, minimum, onChange }: { icon: ReactNode; label: string; value: number; minimum: number; onChange: (value: number) => void }) {
  return (
    <label className="settings-row settings-range-row">
      <span className="settings-icon">{icon}</span>
      <span className="settings-range-content">
        <span><strong>{label}</strong><output>{value}%</output></span>
        <input type="range" min={minimum} max="100" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      </span>
    </label>
  )
}

function ScreenTimeoutSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const options = [
    { value: 30, label: '30 segundos' },
    { value: 60, label: '1 minuto' },
    { value: 120, label: '2 minutos' },
    { value: 300, label: '5 minutos' },
    { value: 600, label: '10 minutos' },
  ]
  return (
    <label className="settings-row timeout-select-row">
      <span className="settings-copy"><strong>Apagar pantalla tras</strong><small>Tiempo sin interacción antes de bloquearse.</small></span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function ScreensaverDelaySelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const options = [
    { value: 30, label: '30 segundos' },
    { value: 60, label: '1 minuto' },
    { value: 180, label: '3 minutos' },
    { value: 300, label: '5 minutos' },
    { value: 600, label: '10 minutos' },
  ]
  return (
    <label className="settings-row timeout-select-row">
      <span className="settings-copy"><strong>Activar tras</strong><small>Tiempo sin tocar la pantalla.</small></span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

export default App
