import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useTranslation } from 'react-i18next'
import {
  AlarmClock,
  Archive,
  BellRing,
  CakeSlice,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  EyeOff,
  Eraser,
  FileText,
  GripVertical,
  Images,
  Home,
  ListTodo,
  MapPin,
  Minus,
  Pause,
  Pencil,
  Play,
  Pin,
  Plus,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Search,
  Sparkles,
  Snowflake,
  Star,
  SunMedium,
  Sunrise,
  Sunset,
  Trash2,
  Undo2,
  Upload,
  Volume2,
  Wind,
  X,
} from 'lucide-react'
import {
  DASHBOARD_PAGES,
  loadDashboardState,
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
  type NoteType,
  type NoteDrawingPoint,
  type NoteDrawingStroke,
  type Timer,
  type StopwatchState,
  type DashboardPreferences,
  type GalleryPhoto,
  EVERY_ALARM_WEEKDAY,
} from './dashboardState'
import type { AssistantCommand } from './assistant/contracts'
import { executeAssistantCommand } from './assistant/executor'
import { DEFAULT_ALARM_SOUND, getDeviceAlarmSounds, previewAlarmSound, stopAlarmSoundPreview, type DeviceAlarmSound } from './alarmSounds'
import { snoozeAlarmNotification, snoozeCalendarEventNotification } from './reminderNotifications'
import { arrangeWidgets, DASHBOARD_COLUMNS, DASHBOARD_ROWS, DEFAULT_WIDGETS, placeWidgets, resizeWidgets, type DashboardOrientation, type DashboardWidgetId, type PlacedWidget, type WidgetPosition } from './widgetLayout'
import { playInteractionSound } from './deviceSettings'
import { shouldPlayInteractionSoundOnClick } from './interactionSoundEvents'
import { deleteGalleryPhotoFile, galleryPhotoSource, pickGalleryPhotos } from './gallery'
import { compactCalendarOutbox, createCalendarOutboxEntry } from './calendarSync/repository'
import { applyCalendarSync } from './calendarSync/repository'
import { calendarRelay } from './calendarSync/relayClient'
import { readCalendarConnectionToken, removeCalendarConnectionToken, writeCalendarConnectionToken } from './calendarSync/secretVault'
import { CalendarConnectionsPanel } from './calendarSync/CalendarConnectionsPanel'
import type { CalendarAccount, SyncedCalendar } from './calendarSync/contracts'
import { searchWeatherLocations, weatherDescription, type WeatherForecast, type WeatherLocation } from './weather'
import { addDaysToDateKey, calendarOccurrenceForDate, eventForOccurrence, nextCalendarOccurrence, offsetDateKey, toLocalDateKey } from './calendarRecurrence'
import { formatCountdown, pauseTimer, resetTimer, startTimer, timerHasFinished, timerRemainingSeconds } from './timerLogic'
import { isNightModeActive } from './nightMode'
import { useDashboardPersistence } from './hooks/useDashboardPersistence'
import { useDeviceEffects } from './hooks/useDeviceEffects'
import { useNotesKeyboardViewport } from './hooks/useNotesKeyboardViewport'
import { useWeatherForecasts } from './hooks/useWeatherForecasts'
import { AppNavigation, type AppScreen } from './app/AppNavigation'
import { AppShell } from './app/AppShell'
import { SettingsPage } from './pages/SettingsPage'
import { AssistantPage } from './pages/AssistantPage'
import { PageHeader } from './components/PageHeader'
import { nativeCalendarEventsForYears } from './nativeCalendarDates'
import { activeLocale, setAppLanguage, tx } from './i18n'
import { setNativeAppLanguage } from './nativeLocale'
import './App.css'
import './themes.css'

type SimulatedAlert = { title: string; body: string }
type RingingAlert = { kind: 'alarm' | 'timer' | 'calendar'; sourceId: string; title: string; subtitle: string; soundUri: string | null }
type CalendarEventPatch = Partial<Pick<CalendarEvent, 'type' | 'recurrence' | 'completed' | 'title' | 'date' | 'endDate' | 'startTime' | 'endTime' | 'allDay' | 'location' | 'notes' | 'color' | 'reminders'>>
type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'drawing' | 'color' | 'pinned' | 'reminderAt'>>
type WidgetResizeDirection = 'left' | 'right' | 'top' | 'bottom'

function safeWidgetPosition(widgetId: DashboardWidgetId, orientation: DashboardOrientation): WidgetPosition {
  const fallback = DEFAULT_WIDGETS.find((widget) => widget.id === widgetId)?.layouts[orientation] ?? { x: 0, y: 0, width: 1, height: 1 }
  if (orientation === 'portrait' && widgetId === 'agenda') return { x: 0, y: 0, width: 3, height: 2 }
  return { ...fallback }
}

function createLocalId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function App() {
  useTranslation()
  const [screen, setScreen] = useState<AppScreen>('home')
  const [now, setNow] = useState(() => new Date())
  const [dashboardState, setDashboardState] = useState(loadDashboardState)
  const [activePageId, setActivePageId] = useState<DashboardPageId>('dashboard')
  const [calendarInitialDate, setCalendarInitialDate] = useState<string | null>(null)
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
  const calendarSyncInFlight = useRef(new Set<string>())
  const dashboardStateRef = useRef(dashboardState)
  const dashboardReady = useDashboardPersistence({ state: dashboardState, stateRef: dashboardStateRef, setState: setDashboardState })

  const enabledPages = useMemo(
    () => DASHBOARD_PAGES.filter((page) => dashboardState.preferences.enabledPageIds.includes(page.id)),
    [dashboardState.preferences.enabledPageIds],
  )
  const activePageIndex = Math.max(0, enabledPages.findIndex((page) => page.id === activePageId))
  const activePage = enabledPages[activePageIndex] ?? enabledPages[0]
  const activeNavigationIndex = screen === 'settings' ? enabledPages.length : activePageIndex
  const locale = activeLocale(dashboardState.preferences.language)
  const weekdayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }), [locale])
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }), [locale])
  const time = timeFormatter.format(now)
  const date = weekdayFormatter.format(now)
  const currentYear = now.getFullYear()
  const calendarEvents = useMemo(
    () => [...dashboardState.calendarEvents, ...nativeCalendarEventsForYears([currentYear, currentYear + 1], dashboardState.preferences.language)],
    [dashboardState.calendarEvents, currentYear, dashboardState.preferences.language],
  )
  const screensaverPhoto = dashboardState.galleryPhotos.find((photo) => photo.id === screensaverPhotoId && photo.deletedAt === null)
  const homeWeatherLocation = dashboardState.weatherLocations.find((location) => location.id === dashboardState.homeWeatherLocationId) ?? dashboardState.weatherLocations[0] ?? null
  const selectedWeatherLocation = dashboardState.weatherLocations.find((location) => location.id === dashboardState.selectedWeatherLocationId) ?? homeWeatherLocation
  const { forecasts: weatherForecasts, loading: weatherLoading, errors: weatherErrors, refresh: refreshWeather } = useWeatherForecasts(homeWeatherLocation, selectedWeatherLocation)
  const nightModeActive = isNightModeActive(now, dashboardState.preferences)
  useDeviceEffects(dashboardState, nightModeActive, dashboardReady)
  const activeThemeId = nightModeActive && dashboardState.preferences.themeId === 'original'
    ? 'amoled'
    : dashboardState.preferences.themeId
  const activeMediaVolume = nightModeActive ? dashboardState.preferences.nightMediaVolume : dashboardState.preferences.mediaVolume

  useEffect(() => {
    void setAppLanguage(dashboardState.preferences.language)
    void setNativeAppLanguage(dashboardState.preferences.language).catch((error) => console.warn('No se pudo aplicar el idioma en Android.', error))
  }, [dashboardState.preferences.language])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(interval)
  }, [])

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
    if (!dashboardReady) return
    const finished = dashboardState.timers.filter((timer) => timerHasFinished(timer, now))
    if (finished.length === 0) return
    const timeout = window.setTimeout(() => {
      setDashboardState((current) => ({ ...current, timers: current.timers.map((timer) => finished.some((item) => item.id === timer.id) ? { ...timer, remainingSeconds: 0, endsAt: null } : timer) }))
      const timer = finished[0]
      startRinging({ kind: 'timer', sourceId: timer.id, title: timer.label || 'Temporizador', subtitle: 'El temporizador ha terminado.', soundUri: null })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.timers, now, startRinging, dashboardReady])

  useEffect(() => {
    if (!dashboardReady) return
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
  }, [dashboardState.alarms, dashboardState.notes, now, showSimulatedAlert, startRinging, timeFormatter, dashboardReady])

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !dashboardReady) return
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
  }, [registerInteraction, startRinging, dashboardReady])

  useEffect(() => {
    const preferences = dashboardState.preferences
    if (!preferences.screensaverEnabled || screen !== 'home' || interactionLocked || ringingAlert || simulatedAlert) {
      return
    }
    const timeout = window.setTimeout(() => {
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

  const moveToPage = useCallback((nextIndex: number) => {
    if (enabledPages.length === 0) return
    const wrappedIndex = (nextIndex + enabledPages.length) % enabledPages.length
    setInteractionLocked(false)
    setActivePageId(enabledPages[wrappedIndex].id)
    registerInteraction()
  }, [enabledPages, registerInteraction])

  const moveToNavigationPage = useCallback((nextIndex: number) => {
    const navigationPageCount = enabledPages.length + 1
    const wrappedIndex = (nextIndex + navigationPageCount) % navigationPageCount
    setInteractionLocked(false)
    if (wrappedIndex === enabledPages.length) {
      setScreen('settings')
    } else {
      setScreen('home')
      setActivePageId(enabledPages[wrappedIndex].id)
    }
    registerInteraction()
  }, [enabledPages, registerInteraction])

  const goTo = (nextScreen: AppScreen) => {
    setScreensaverVisible(false)
    setScreen(nextScreen)
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

  const createNote = (type: NoteType = 'text') => {
    const now = new Date().toISOString()
    const note: Note = {
      id: createLocalId(),
      type,
      title: tx(type === 'drawing' ? 'Nuevo dibujo' : type === 'list' ? 'Nueva lista' : 'Nueva nota'),
      content: '',
      drawing: [],
      drawingPosition: 'below',
      drawingVisible: true,
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

  const updateNote = (noteId: string, patch: NotePatch) => {
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

  const updateWidgetLayout = (widgetId: DashboardWidgetId, orientation: DashboardOrientation, patch: Partial<WidgetPosition>) => {
    setDashboardState((current) => {
      const widget = current.widgets.find((item) => item.id === widgetId)
      if (!widget) return current
      const preferred = { ...widget.layouts[orientation], ...patch }
      const isResize = patch.width !== undefined || patch.height !== undefined
      const arranged = isResize
        ? resizeWidgets(current.widgets, orientation, widgetId, preferred)
        : arrangeWidgets(current.widgets, orientation, widgetId, preferred)
      return arranged ? { ...current, widgets: arranged } : current
    })
  }

  const addWeatherLocation = (location: WeatherLocation) => {
    setDashboardState((current) => {
      const existing = current.weatherLocations.find((item) => item.id === location.id)
      if (existing) return { ...current, selectedWeatherLocationId: existing.id }
      const isFirstLocation = current.weatherLocations.length === 0
      return {
        ...current,
        weatherLocations: [...current.weatherLocations, location],
        homeWeatherLocationId: isFirstLocation ? location.id : current.homeWeatherLocationId,
        selectedWeatherLocationId: location.id,
      }
    })
  }

  const removeWeatherLocation = (locationId: string) => {
    setDashboardState((current) => {
      const remaining = current.weatherLocations.filter((location) => location.id !== locationId)
      const nextHomeId = current.homeWeatherLocationId === locationId
        ? remaining[0]?.id ?? null
        : current.homeWeatherLocationId
      const nextSelectedId = current.selectedWeatherLocationId === locationId
        ? nextHomeId ?? remaining[0]?.id ?? null
        : current.selectedWeatherLocationId
      return {
        ...current,
        weatherLocations: remaining,
        homeWeatherLocationId: nextHomeId,
        selectedWeatherLocationId: nextSelectedId,
      }
    })
  }

  const setHomeWeatherLocation = (locationId: string) => {
    setDashboardState((current) => current.weatherLocations.some((location) => location.id === locationId)
      ? { ...current, homeWeatherLocationId: locationId }
      : current)
  }

  const selectWeatherLocation = (locationId: string) => {
    setDashboardState((current) => current.weatherLocations.some((location) => location.id === locationId)
      ? { ...current, selectedWeatherLocationId: locationId }
      : current)
  }

  const createCalendarEvent = (date: string) => {
    const createdAt = new Date().toISOString()
    const event: CalendarEvent = {
      id: createLocalId(),
      source: 'local',
      accountId: null,
      calendarId: null,
      externalId: null,
      externalVersion: null,
      syncStatus: 'local',
      type: 'event',
      recurrence: 'none',
      completed: false,
      title: 'Nuevo evento',
      date,
      endDate: date,
      startTime: '09:00',
      endTime: '10:00',
      allDay: false,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
      location: '',
      notes: '',
      color: 'sun',
      reminders: [],
      createdAt,
      updatedAt: createdAt,
    }
    setDashboardState((current) => ({ ...current, calendarEvents: [...current.calendarEvents, event] }))
    return event.id
  }

  const updateCalendarEvent = (eventId: string, patch: CalendarEventPatch) => {
    setDashboardState((current) => {
      const previous = current.calendarEvents.find((event) => event.id === eventId)
      if (!previous) return current
      const updated: CalendarEvent = {
        ...previous,
        ...patch,
        updatedAt: new Date().toISOString(),
        syncStatus: previous.source === 'local' ? 'local' : previous.syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
      }
      const entry = createCalendarOutboxEntry(updated, previous.externalId ? 'update' : 'create', createLocalId)
      return {
        ...current,
        calendarEvents: current.calendarEvents.map((event) => event.id === eventId ? updated : event),
        calendarOutbox: entry ? compactCalendarOutbox(current.calendarOutbox, entry) : current.calendarOutbox,
      }
    })
  }

  const setCalendarEventDestination = (eventId: string, syncedCalendarId: string | null) => {
    setDashboardState((current) => {
      const previous = current.calendarEvents.find((event) => event.id === eventId)
      if (!previous || (previous.source !== 'local' && previous.syncStatus !== 'pending-create')) return current
      const withoutPreviousCreate = current.calendarOutbox.filter((entry) => entry.eventId !== eventId)
      if (syncedCalendarId === null) {
        const localEvent: CalendarEvent = { ...previous, source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local', updatedAt: new Date().toISOString() }
        return { ...current, calendarEvents: current.calendarEvents.map((event) => event.id === eventId ? localEvent : event), calendarOutbox: withoutPreviousCreate }
      }
      const calendar = current.externalCalendars.find((item) => item.id === syncedCalendarId && !item.readOnly)
      const account = calendar ? current.calendarAccounts.find((item) => item.id === calendar.accountId && item.enabled) : null
      if (!calendar || !account) return current
      const externalEvent: CalendarEvent = { ...previous, source: calendar.provider, accountId: calendar.accountId, calendarId: calendar.remoteId, externalId: null, externalVersion: null, syncStatus: 'pending-create', color: calendar.color, updatedAt: new Date().toISOString() }
      const entry = createCalendarOutboxEntry(externalEvent, 'create', createLocalId)
      return { ...current, calendarEvents: current.calendarEvents.map((event) => event.id === eventId ? externalEvent : event), calendarOutbox: entry ? [...withoutPreviousCreate, entry] : withoutPreviousCreate }
    })
  }

  const deleteCalendarEvent = (eventId: string) => {
    setDashboardState((current) => {
      const event = current.calendarEvents.find((item) => item.id === eventId)
      const entry = event ? createCalendarOutboxEntry(event, 'delete', createLocalId) : null
      return {
        ...current,
        calendarEvents: current.calendarEvents.filter((item) => item.id !== eventId),
        calendarOutbox: entry ? compactCalendarOutbox(current.calendarOutbox, entry) : current.calendarOutbox,
      }
    })
  }

  const syncCalendarAccount = useCallback(async (accountId: string, connectionToken?: string) => {
    if (calendarSyncInFlight.current.has(accountId)) return
    const snapshot = dashboardStateRef.current
    const account = snapshot.calendarAccounts.find((item) => item.id === accountId)
    if (!account) return
    calendarSyncInFlight.current.add(accountId)
    setDashboardState((current) => ({ ...current, calendarAccounts: current.calendarAccounts.map((item) => item.id === accountId ? { ...item, status: 'syncing', error: null } : item) }))
    try {
      const token = connectionToken ?? await readCalendarConnectionToken(accountId)
      if (!token) throw new Error(tx('La credencial de conexión no está disponible. Vuelve a conectar la cuenta.'))
      const result = await calendarRelay.synchronize(account, token, snapshot.calendarOutbox.filter((entry) => entry.accountId === accountId))
      setDashboardState((current) => {
        const liveAccount = current.calendarAccounts.find((item) => item.id === accountId)
        if (!liveAccount) return current
        const applied = applyCalendarSync(current.calendarEvents, current.externalCalendars, current.calendarOutbox, liveAccount, result)
        return { ...current, calendarEvents: applied.events, externalCalendars: applied.calendars, calendarOutbox: applied.outbox, calendarAccounts: current.calendarAccounts.map((item) => item.id === accountId ? applied.account : item) }
      })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : tx('No se pudo sincronizar el calendario.')
      const requiresAuthorization = /autoriza|credencial|401|403/i.test(message)
      setDashboardState((current) => ({ ...current, calendarAccounts: current.calendarAccounts.map((item) => item.id === accountId ? { ...item, status: requiresAuthorization ? 'reauthorize' : navigator.onLine ? 'error' : 'offline', error: message } : item) }))
    } finally {
      calendarSyncInFlight.current.delete(accountId)
    }
  }, [])

  const connectCalendarAccount = useCallback(async (account: CalendarAccount, token: string) => {
    await writeCalendarConnectionToken(account.id, token)
    setDashboardState((current) => ({ ...current, calendarAccounts: [...current.calendarAccounts.filter((item) => item.provider !== account.provider), { ...account, status: 'syncing' }] }))
    try {
      const snapshot = dashboardStateRef.current
      const result = await calendarRelay.synchronize(account, token, snapshot.calendarOutbox.filter((entry) => entry.accountId === account.id))
      setDashboardState((current) => {
        const applied = applyCalendarSync(current.calendarEvents, current.externalCalendars, current.calendarOutbox, account, result)
        return { ...current, calendarEvents: applied.events, externalCalendars: applied.calendars, calendarOutbox: applied.outbox, calendarAccounts: [...current.calendarAccounts.filter((item) => item.provider !== account.provider), applied.account] }
      })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : tx('No se pudo realizar la primera sincronización.')
      setDashboardState((current) => ({ ...current, calendarAccounts: current.calendarAccounts.map((item) => item.id === account.id ? { ...item, status: 'error', error: message } : item) }))
    }
  }, [])

  const disconnectCalendarAccount = useCallback(async (accountId: string) => {
    const account = dashboardStateRef.current.calendarAccounts.find((item) => item.id === accountId)
    if (!account) return
    const token = await readCalendarConnectionToken(accountId)
    try {
      if (token) await calendarRelay.disconnect(account, token)
    } catch (error) {
      console.warn('No se pudo revocar la conexión remota; se eliminará de esta tablet.', error)
    }
    await removeCalendarConnectionToken(accountId)
    setDashboardState((current) => ({
      ...current,
      calendarAccounts: current.calendarAccounts.filter((item) => item.id !== accountId),
      externalCalendars: current.externalCalendars.filter((calendar) => calendar.accountId !== accountId),
      calendarEvents: current.calendarEvents.filter((event) => event.accountId !== accountId),
      calendarOutbox: current.calendarOutbox.filter((entry) => entry.accountId !== accountId),
    }))
  }, [])

  const calendarAccountIds = dashboardState.calendarAccounts.map((account) => account.id).sort().join('|')
  useEffect(() => {
    if (!calendarAccountIds) return
    const synchronize = () => {
      if (!navigator.onLine) return
      for (const accountId of calendarAccountIds.split('|')) void syncCalendarAccount(accountId)
    }
    const synchronizeWhenVisible = () => { if (document.visibilityState === 'visible') synchronize() }
    const initial = window.setTimeout(synchronize, 1200)
    const interval = window.setInterval(synchronize, 15 * 60_000)
    window.addEventListener('online', synchronize)
    document.addEventListener('visibilitychange', synchronizeWhenVisible)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
      window.removeEventListener('online', synchronize)
      document.removeEventListener('visibilitychange', synchronizeWhenVisible)
    }
  }, [calendarAccountIds, syncCalendarAccount])

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

  const moveGalleryPhotosToTrash = (photoIds: string[]) => {
    const selectedIds = new Set(photoIds)
    const deletedAt = new Date().toISOString()
    setDashboardState((current) => ({
      ...current,
      galleryPhotos: current.galleryPhotos.map((photo) => selectedIds.has(photo.id) ? { ...photo, deletedAt } : photo),
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

  const openCalendar = (date?: string) => {
    if (!dashboardState.preferences.enabledPageIds.includes('calendar')) {
      updatePreferences({
        enabledPageIds: DASHBOARD_PAGES
          .map((page) => page.id)
          .filter((id) => dashboardState.preferences.enabledPageIds.includes(id) || id === 'calendar'),
      })
    }
    setCalendarInitialDate(date ?? null)
    setActivePageId('calendar')
    registerInteraction()
  }

  const openAssistant = () => {
    if (!dashboardState.preferences.enabledPageIds.includes('assistant')) {
      updatePreferences({
        enabledPageIds: DASHBOARD_PAGES
          .map((page) => page.id)
          .filter((id) => dashboardState.preferences.enabledPageIds.includes(id) || id === 'assistant'),
      })
    }
    setActivePageId('assistant')
    registerInteraction()
  }

  const openDashboardPage = (pageId: DashboardPageId) => {
    if (!dashboardState.preferences.enabledPageIds.includes(pageId)) {
      updatePreferences({
        enabledPageIds: DASHBOARD_PAGES
          .map((page) => page.id)
          .filter((id) => dashboardState.preferences.enabledPageIds.includes(id) || id === pageId),
      })
    }
    setActivePageId(pageId)
    registerInteraction()
  }

  const setWidgetVisible = (widgetId: DashboardWidgetId, visible: boolean) => {
    setDashboardState((current) => {
      let widgets = current.widgets.map((widget) => widget.id === widgetId ? { ...widget, visible } : widget)
      if (!visible) return { ...current, widgets }

      for (const orientation of ['landscape', 'portrait'] as const) {
        const target = widgets.find((widget) => widget.id === widgetId)
        if (!target) return current
        const arranged = arrangeWidgets(widgets, orientation, widgetId, target.layouts[orientation])
        if (arranged) {
          widgets = arranged
          continue
        }

        const safeWidgets = widgets.map((widget) => ({
          ...widget,
          layouts: { ...widget.layouts, [orientation]: safeWidgetPosition(widget.id, orientation) },
        }))
        const safeTarget = safeWidgets.find((widget) => widget.id === widgetId)
        widgets = safeTarget
          ? arrangeWidgets(safeWidgets, orientation, widgetId, safeTarget.layouts[orientation]) ?? safeWidgets
          : safeWidgets
      }
      return { ...current, widgets }
    })
  }

  const executeAssistant = async (command: AssistantCommand) => {
    const current = dashboardStateRef.current
    const homeLocation = current.weatherLocations.find((location) => location.id === current.homeWeatherLocationId) ?? current.weatherLocations[0] ?? null
    const result = executeAssistantCommand(current, command, {
      now: new Date(),
      homeWeatherLocation: homeLocation,
      homeWeatherForecast: homeLocation ? weatherForecasts[homeLocation.id] ?? null : null,
      createId: createLocalId,
    })
    if (result.state !== current) {
      dashboardStateRef.current = result.state
      setDashboardState(result.state)
    }
    return result
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return
    const target = event.target as HTMLElement
    const swipeSurfaceButton = target.closest('[data-page-swipe-surface]') && target.closest('button')
    const interactiveTarget = target.closest('button, a, input, textarea, select, [role="button"]')
    const gestureBlocked = interactionLocked
      || target.closest('[data-swipe-block], .page-indicators')
      || (interactiveTarget && !swipeSurfaceButton)
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
    if (!pointerStart.current || pointerStart.current.pointerId !== event.pointerId) return
    const deltaX = event.clientX - pointerStart.current.x
    const deltaY = event.clientY - pointerStart.current.y
    pointerStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
    moveToNavigationPage(activeNavigationIndex + (deltaX < 0 ? 1 : -1))
  }

  const handleClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      event.preventDefault()
      event.stopPropagation()
      suppressClick.current = false
      return
    }
    // Los selectores nativos de Android ya reproducen su propio sonido al elegir.
    // No añadir otro clic manual al abrir/cerrar su menú.
    if (dashboardState.preferences.interactionSoundsEnabled && shouldPlayInteractionSoundOnClick(event.target)) {
      void playInteractionSound(activeMediaVolume)
    }
  }

  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (screen !== 'home') return
    const target = event.target as HTMLElement
    if (target.closest('.page-indicators')) return
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
    const swipeSurfaceButton = target.closest('[data-page-swipe-surface]') && target.closest('button')
    const interactiveTarget = target.closest('button, a, input, select, [role="button"]')
    const gestureBlocked = (!isNoteTextarea && interactionLocked)
      || target.closest('[data-swipe-block], .page-indicators')
      || (interactiveTarget && !swipeSurfaceButton)
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
    if (!touchStart.current) return
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
    moveToNavigationPage(activeNavigationIndex + (deltaX < 0 ? 1 : -1))
  }

  if (!dashboardReady) {
    return <main className="tablet-shell" data-theme={activeThemeId} aria-busy="true">
      <section className="tablet-content" aria-label="Pablo Tablet">
        <p role="status">{tx('Recuperando los datos guardados…')}</p>
      </section>
    </main>
  }

  return (
    <AppShell
      themeId={activeThemeId}
      nightModeActive={nightModeActive}
      pageNavigationStyle={dashboardState.preferences.pageNavigationStyle}
      pageNavigationPosition={dashboardState.preferences.pageNavigationPosition}
      showPageNavigationLabels={dashboardState.preferences.showPageNavigationLabels}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touchStart.current = null }}
      onClickCapture={handleClickCapture}
      onClick={handleClick}
    >
      <section className={`tablet-content ${screen === 'settings' ? 'is-settings' : ''} ${screen === 'home' && activePage?.id === 'calendar' ? 'is-calendar' : ''}`} aria-label="Pablo Tablet">
        {screen === 'home' && activePage?.id === 'assistant' ? (
          <AssistantPage
            enabled={dashboardState.preferences.assistantEnabled}
            voiceEnabled={dashboardState.preferences.assistantVoiceEnabled}
            readAloud={dashboardState.preferences.assistantReadAloud}
            now={now}
            onExecute={executeAssistant}
            onOpenPage={openDashboardPage}
            onEditingChange={setInteractionLocked}
          />
        ) : screen === 'home' && activePage ? (
          <DashboardPage
            key={activePage.id}
            page={activePage}
            now={now}
            time={time}
            date={date}
            widgets={dashboardState.widgets}
            notes={dashboardState.notes}
            calendarEvents={calendarEvents}
            calendarAccounts={dashboardState.calendarAccounts}
            externalCalendars={dashboardState.externalCalendars}
            galleryPhotos={dashboardState.galleryPhotos}
            weatherLocations={dashboardState.weatherLocations}
            homeWeatherLocationId={dashboardState.homeWeatherLocationId}
            selectedWeatherLocationId={dashboardState.selectedWeatherLocationId}
            weatherForecasts={weatherForecasts}
            weatherLoading={weatherLoading}
            weatherErrors={weatherErrors}
            hideCompletedCalendarTasks={dashboardState.preferences.hideCompletedCalendarTasks}
            showUpcomingCalendarHolidays={dashboardState.preferences.showUpcomingCalendarHolidays}
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
            onSetCalendarEventDestination={setCalendarEventDestination}
            onConnectCalendarAccount={connectCalendarAccount}
            onSyncCalendarAccount={syncCalendarAccount}
            onDisconnectCalendarAccount={disconnectCalendarAccount}
            onAddGalleryPhotos={() => void addGalleryPhotos()}
            onMoveGalleryPhotoToTrash={moveGalleryPhotoToTrash}
            onMoveGalleryPhotosToTrash={moveGalleryPhotosToTrash}
            onRestoreGalleryPhoto={restoreGalleryPhoto}
            onPermanentlyDeleteGalleryPhoto={(photoId) => void permanentlyDeleteGalleryPhoto(photoId)}
            onAddWeatherLocation={addWeatherLocation}
            onRemoveWeatherLocation={removeWeatherLocation}
            onSetHomeWeatherLocation={setHomeWeatherLocation}
            onSelectWeatherLocation={selectWeatherLocation}
            onRefreshWeather={(location) => void refreshWeather(location)}
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
            calendarInitialDate={calendarInitialDate}
            onOpenAssistant={openAssistant}
            onChangeWidgetLayout={updateWidgetLayout}
            onEditingChange={setInteractionLocked}
          />
        ) : (
          <SettingsPage
            preferences={dashboardState.preferences}
            widgets={dashboardState.widgets}
            onBack={() => goTo('home')}
            onPreferencesChange={updatePreferences}
            onTogglePage={togglePage}
            onWidgetVisibilityChange={setWidgetVisible}
            nightModeActive={nightModeActive}
          />
        )}
      </section>

      {simulatedAlert ? <div className="simulated-alert" role="alert"><BellRing size={21} /><div><strong>{simulatedAlert.title}</strong><p>{simulatedAlert.body}</p><small>{tx('Simulación web de aviso local')}</small></div><button type="button" onClick={() => setSimulatedAlert(null)} aria-label={tx('Cerrar aviso')}><X size={18} /></button></div> : null}
      {ringingAlert ? <RingingAlertOverlay alert={ringingAlert} snoozeMinutes={snoozeMinutes} onSnoozeMinutesChange={setSnoozeMinutes} onSnooze={snoozeRingingAlert} onStop={stopRinging} /> : null}
      {screensaverVisible ? <GalleryScreensaver photo={screensaverPhoto} now={now} time={time} date={date} calendarEvents={calendarEvents} calendars={dashboardState.externalCalendars} onDismiss={() => { setScreensaverVisible(false); registerInteraction() }} /> : null}

      <AppNavigation
        screen={screen}
        enabledPages={enabledPages}
        activePageIndex={activePageIndex}
        pageNavigationStyle={dashboardState.preferences.pageNavigationStyle}
        pageNavigationPosition={dashboardState.preferences.pageNavigationPosition}
        showPageNavigationLabels={dashboardState.preferences.showPageNavigationLabels}
        onMoveToPage={(index) => {
          if (screen === 'settings') {
            setScreen('home')
          }
          moveToPage(index)
        }}
        onGoSettings={() => goTo('settings')}
      />
    </AppShell>
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
  calendarAccounts,
  externalCalendars,
  galleryPhotos,
  weatherLocations,
  homeWeatherLocationId,
  selectedWeatherLocationId,
  weatherForecasts,
  weatherLoading,
  weatherErrors,
  hideCompletedCalendarTasks,
  showUpcomingCalendarHolidays,
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
  onSetCalendarEventDestination,
  onConnectCalendarAccount,
  onSyncCalendarAccount,
  onDisconnectCalendarAccount,
  onAddGalleryPhotos,
  onMoveGalleryPhotoToTrash,
  onMoveGalleryPhotosToTrash,
  onRestoreGalleryPhoto,
  onPermanentlyDeleteGalleryPhoto,
  onAddWeatherLocation,
  onRemoveWeatherLocation,
  onSetHomeWeatherLocation,
  onSelectWeatherLocation,
  onRefreshWeather,
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
  calendarInitialDate,
  onOpenAssistant,
  onChangeWidgetLayout,
  onEditingChange,
}: {
  page: DashboardPageDefinition
  now: Date
  time: string
  date: string
  widgets: import('./widgetLayout').DashboardWidget[]
  notes: Note[]
  calendarEvents: CalendarEvent[]
  calendarAccounts: CalendarAccount[]
  externalCalendars: SyncedCalendar[]
  galleryPhotos: GalleryPhoto[]
  weatherLocations: WeatherLocation[]
  homeWeatherLocationId: string | null
  selectedWeatherLocationId: string | null
  weatherForecasts: Record<string, WeatherForecast>
  weatherLoading: Record<string, boolean>
  weatherErrors: Record<string, string>
  hideCompletedCalendarTasks: boolean
  showUpcomingCalendarHolidays: boolean
  alarms: Alarm[]
  timers: Timer[]
  stopwatch: StopwatchState
  onCreateNote: (type: NoteType) => string
  onUpdateNote: (noteId: string, patch: NotePatch) => void
  onArchiveNote: (noteId: string) => void
  onRestoreNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onCreateCalendarEvent: (date: string) => string
  onUpdateCalendarEvent: (eventId: string, patch: CalendarEventPatch) => void
  onDeleteCalendarEvent: (eventId: string) => void
  onSetCalendarEventDestination: (eventId: string, calendarId: string | null) => void
  onConnectCalendarAccount: (account: CalendarAccount, token: string) => Promise<void>
  onSyncCalendarAccount: (accountId: string) => Promise<void>
  onDisconnectCalendarAccount: (accountId: string) => Promise<void>
  onAddGalleryPhotos: () => void
  onMoveGalleryPhotoToTrash: (photoId: string) => void
  onMoveGalleryPhotosToTrash: (photoIds: string[]) => void
  onRestoreGalleryPhoto: (photoId: string) => void
  onPermanentlyDeleteGalleryPhoto: (photoId: string) => void
  onAddWeatherLocation: (location: WeatherLocation) => void
  onRemoveWeatherLocation: (locationId: string) => void
  onSetHomeWeatherLocation: (locationId: string) => void
  onSelectWeatherLocation: (locationId: string) => void
  onRefreshWeather: (location: WeatherLocation) => void
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
  onOpenCalendar: (date?: string) => void
  calendarInitialDate: string | null
  onOpenAssistant: () => void
  onChangeWidgetLayout: (widgetId: DashboardWidgetId, orientation: DashboardOrientation, patch: Partial<WidgetPosition>) => void
  onEditingChange: (isEditing: boolean) => void
}) {
  if (page.id === 'clock') return <ClockPage time={time} date={date} now={now} alarms={alarms} timers={timers} stopwatch={stopwatch} onCreateAlarm={onCreateAlarm} onUpdateAlarm={onUpdateAlarm} onDeleteAlarm={onDeleteAlarm} onCreateTimer={onCreateTimer} onUpdateTimer={onUpdateTimer} onDeleteTimer={onDeleteTimer} onToggleStopwatch={onToggleStopwatch} onResetStopwatch={onResetStopwatch} onPreviewNotification={onPreviewNotification} />
  if (page.id === 'calendar') return <CalendarPage now={now} initialDate={calendarInitialDate} events={calendarEvents} accounts={calendarAccounts} calendars={externalCalendars} hideCompletedTasks={hideCompletedCalendarTasks} onHideCompletedTasksChange={onHideCompletedCalendarTasksChange} onCreate={onCreateCalendarEvent} onUpdate={onUpdateCalendarEvent} onDelete={onDeleteCalendarEvent} onSetDestination={onSetCalendarEventDestination} onConnected={onConnectCalendarAccount} onSync={onSyncCalendarAccount} onDisconnect={onDisconnectCalendarAccount} onEditingChange={onEditingChange} />
  if (page.id === 'gallery') return <GalleryPage photos={galleryPhotos} onAddPhotos={onAddGalleryPhotos} onMoveToTrash={onMoveGalleryPhotoToTrash} onMoveSelectionToTrash={onMoveGalleryPhotosToTrash} onRestore={onRestoreGalleryPhoto} onPermanentlyDelete={onPermanentlyDeleteGalleryPhoto} onEditingChange={onEditingChange} />
  if (page.id === 'weather') return <WeatherPage locations={weatherLocations} homeLocationId={homeWeatherLocationId} selectedLocationId={selectedWeatherLocationId} forecasts={weatherForecasts} loading={weatherLoading} errors={weatherErrors} onAddLocation={onAddWeatherLocation} onRemoveLocation={onRemoveWeatherLocation} onSetHomeLocation={onSetHomeWeatherLocation} onSelectLocation={onSelectWeatherLocation} onRefresh={onRefreshWeather} onEditingChange={onEditingChange} />
  if (page.id === 'notes') return <NotesPage notes={notes} onCreateNote={onCreateNote} onUpdateNote={onUpdateNote} onArchiveNote={onArchiveNote} onRestoreNote={onRestoreNote} onDeleteNote={onDeleteNote} onPreviewNotification={onPreviewNotification} onEditingChange={onEditingChange} />
  return <GridDashboard now={now} time={time} date={date} widgets={widgets} notes={notes} calendarEvents={calendarEvents} calendars={externalCalendars} showUpcomingCalendarHolidays={showUpcomingCalendarHolidays} homeWeatherLocation={weatherLocations.find((location) => location.id === homeWeatherLocationId) ?? weatherLocations[0] ?? null} homeWeatherForecast={weatherForecasts[homeWeatherLocationId ?? weatherLocations[0]?.id ?? ''] ?? null} weatherLoading={Boolean(weatherLoading[homeWeatherLocationId ?? weatherLocations[0]?.id ?? ''])} onOpenNotes={onOpenNotes} onOpenWeather={onOpenWeather} onOpenCalendar={onOpenCalendar} onOpenAssistant={onOpenAssistant} onChangeWidgetLayout={onChangeWidgetLayout} onEditingChange={onEditingChange} />
}

function GalleryScreensaver({ photo, now, time, date, calendarEvents, calendars, onDismiss }: { photo: GalleryPhoto | undefined; now: Date; time: string; date: string; calendarEvents: CalendarEvent[]; calendars: SyncedCalendar[]; onDismiss: () => void }) {
  const upcomingEvents = getUpcomingCalendarEvents(calendarEvents, now, time, 3, calendars)
  const dismiss = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onDismiss()
  }
  return <div className={`gallery-screensaver ${photo ? 'has-photo' : 'is-empty'}`} role="button" tabIndex={0} aria-label={tx('Cerrar salvapantallas')} onPointerDown={dismiss} onClick={(event) => { event.preventDefault(); event.stopPropagation() }}>
    {photo ? <img key={photo.id} src={galleryPhotoSource(photo.uri)} alt="" /> : null}
    <div className="gallery-screensaver-shade" />
    <div className="gallery-screensaver-clock"><time>{time}</time><span>{date}</span>{photo ? null : <small>{tx('Añade fotos desde la Galería')}</small>}</div>
    <aside className="gallery-screensaver-agenda" aria-label={tx('Próximos eventos')}>
      <header><CalendarDays size={20} /><span>{tx('Próximos eventos')}</span></header>
      {upcomingEvents.length > 0
        ? upcomingEvents.map((event) => <div key={event.id} className={`event-${event.color} kind-${event.type} ${nativeCalendarClass(event)}`}><i /><span><strong><CalendarEventTypeMark type={event.type} source={event.source} />{event.title || tx('Evento')}</strong><small>{formatCalendarEventTime(event, toLocalDateKey(now))}</small></span></div>)
        : <p>{tx('No hay eventos próximos')}</p>}
    </aside>
  </div>
}

function GalleryPage({ photos, onAddPhotos, onMoveToTrash, onMoveSelectionToTrash, onRestore, onPermanentlyDelete, onEditingChange }: { photos: GalleryPhoto[]; onAddPhotos: () => void; onMoveToTrash: (photoId: string) => void; onMoveSelectionToTrash: (photoIds: string[]) => void; onRestore: (photoId: string) => void; onPermanentlyDelete: (photoId: string) => void; onEditingChange: (isEditing: boolean) => void }) {
  const [showTrash, setShowTrash] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => new Set())
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false)
  const [confirmSelectionDelete, setConfirmSelectionDelete] = useState(false)
  const photoHoldTimer = useRef<number | null>(null)
  const photoHoldGesture = useRef<{ photoId: string; pointerId: number; x: number; y: number } | null>(null)
  const suppressPhotoClick = useRef(false)
  const activePhotos = photos.filter((photo) => photo.deletedAt === null)
  const deletedPhotos = photos.filter((photo) => photo.deletedAt !== null)
  const visiblePhotos = showTrash ? deletedPhotos : activePhotos
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId)

  useEffect(() => {
    onEditingChange(selectedPhotoId !== null || selectionMode)
    return () => {
      if (photoHoldTimer.current !== null) window.clearTimeout(photoHoldTimer.current)
      onEditingChange(false)
    }
  }, [onEditingChange, selectedPhotoId, selectionMode])

  const closeViewer = () => {
    setSelectedPhotoId(null)
    setConfirmPermanentDelete(false)
  }

  const clearPhotoHold = () => {
    if (photoHoldTimer.current !== null) window.clearTimeout(photoHoldTimer.current)
    photoHoldTimer.current = null
    photoHoldGesture.current = null
  }

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((current) => {
      const next = new Set(current)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  const handlePhotoPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, photoId: string) => {
    if (event.button !== 0) return
    clearPhotoHold()
    photoHoldGesture.current = { photoId, pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    photoHoldTimer.current = window.setTimeout(() => {
      if (photoHoldGesture.current?.photoId !== photoId) return
      suppressPhotoClick.current = true
      setSelectionMode(true)
      setSelectedPhotoIds((current) => new Set(current).add(photoId))
      clearPhotoHold()
    }, 550)
  }

  const handlePhotoPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = photoHoldGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 12) clearPhotoHold()
  }

  const handlePhotoClick = (event: ReactMouseEvent<HTMLButtonElement>, photoId: string) => {
    if (suppressPhotoClick.current) {
      suppressPhotoClick.current = false
      event.preventDefault()
      return
    }
    if (selectionMode) {
      togglePhotoSelection(photoId)
      return
    }
    setSelectedPhotoId(photoId)
  }

  const deleteSelectedPhotos = () => {
    if (showTrash || selectedPhotoIds.size === 0) return
    onMoveSelectionToTrash([...selectedPhotoIds])
    setSelectedPhotoIds(new Set())
    setSelectionMode(false)
  }

  const restoreSelectedPhotos = () => {
    if (!showTrash || selectedPhotoIds.size === 0) return
    selectedPhotoIds.forEach(onRestore)
    setSelectedPhotoIds(new Set())
    setSelectionMode(false)
  }

  const permanentlyDeleteSelectedPhotos = () => {
    if (!showTrash || selectedPhotoIds.size === 0) return
    selectedPhotoIds.forEach(onPermanentlyDelete)
    setConfirmSelectionDelete(false)
    setSelectedPhotoIds(new Set())
    setSelectionMode(false)
  }

  const allVisiblePhotosSelected = visiblePhotos.length > 0 && selectedPhotoIds.size === visiblePhotos.length

  return <div className="fullscreen-page gallery-page page-enter">
    <PageHeader pageLabel="Galería" />
    <section className="gallery-panel">
      <header className="gallery-toolbar">
        <div><p className="eyebrow">{tx('Fotos locales')}</p><h1>{tx(selectionMode ? 'Seleccionar fotos' : showTrash ? 'Papelera' : 'Mis fotos')}</h1><span>{selectionMode ? tx(selectedPhotoIds.size === 1 ? '{{count}} seleccionada' : '{{count}} seleccionadas', { count: selectedPhotoIds.size }) : showTrash ? tx('{{count}} eliminadas', { count: deletedPhotos.length }) : tx('{{count}} en esta tablet', { count: activePhotos.length })}</span></div>
        <div className="gallery-actions">
          {selectionMode ? <>
            <button type="button" onClick={() => { setSelectedPhotoIds(allVisiblePhotosSelected ? new Set() : new Set(visiblePhotos.map((photo) => photo.id))); setConfirmSelectionDelete(false) }}><Check size={18} />{tx(allVisiblePhotosSelected ? 'Deseleccionar todas' : 'Seleccionar todas')}</button>
            <button type="button" onClick={() => { setSelectedPhotoIds(new Set()); setSelectionMode(false); setConfirmSelectionDelete(false) }}><X size={18} />{tx('Cancelar')}</button>
            {showTrash ? <>
              <button type="button" disabled={selectedPhotoIds.size === 0} onClick={restoreSelectedPhotos}><RotateCcw size={18} />{allVisiblePhotosSelected ? tx('Restaurar todas') : tx('Restaurar {{count}}', { count: selectedPhotoIds.size })}</button>
              {confirmSelectionDelete
                ? <span className="gallery-delete-confirm"><small>{tx('No se puede deshacer')}</small><button type="button" onClick={() => setConfirmSelectionDelete(false)}>{tx('Cancelar borrado')}</button><button type="button" className="is-danger" onClick={permanentlyDeleteSelectedPhotos}>{tx('Eliminar {{count}}', { count: selectedPhotoIds.size })}</button></span>
                : <button type="button" className="gallery-delete-selection" disabled={selectedPhotoIds.size === 0} onClick={() => setConfirmSelectionDelete(true)}><Trash2 size={18} />{allVisiblePhotosSelected ? tx('Eliminar todas definitivamente') : tx('Eliminar {{count}} definitivamente', { count: selectedPhotoIds.size })}</button>}
            </> : <button type="button" className="gallery-delete-selection" disabled={selectedPhotoIds.size === 0} onClick={deleteSelectedPhotos}><Trash2 size={18} />{allVisiblePhotosSelected ? tx('Mover todas a papelera') : tx('Mover {{count}} a papelera', { count: selectedPhotoIds.size })}</button>}
          </> : <>
            <button type="button" className={showTrash ? 'is-active' : ''} onClick={() => { setShowTrash((value) => !value); setSelectedPhotoIds(new Set()); setSelectionMode(false); setConfirmSelectionDelete(false); closeViewer() }}><Trash2 size={18} />{showTrash ? tx('Volver a fotos') : deletedPhotos.length ? tx('Papelera · {{count}}', { count: deletedPhotos.length }) : tx('Papelera')}</button>
            {visiblePhotos.length > 0 ? <button type="button" onClick={() => setSelectionMode(true)}><Check size={18} />{tx('Seleccionar')}</button> : null}
            {!showTrash ? <button type="button" className="gallery-add-button" onClick={onAddPhotos}><Upload size={19} />{tx('Añadir fotos')}</button> : null}
          </>}
        </div>
      </header>

      {visiblePhotos.length > 0 ? <div className="gallery-grid">
        {visiblePhotos.map((photo) => <button key={photo.id} type="button" className={`gallery-thumbnail ${selectedPhotoIds.has(photo.id) ? 'is-selected' : ''}`} onPointerDown={(event) => handlePhotoPointerDown(event, photo.id)} onPointerMove={handlePhotoPointerMove} onPointerUp={clearPhotoHold} onPointerCancel={clearPhotoHold} onContextMenu={(event) => event.preventDefault()} onClick={(event) => handlePhotoClick(event, photo.id)} aria-label={selectionMode ? tx(selectedPhotoIds.has(photo.id) ? 'Deseleccionar {{name}}' : 'Seleccionar {{name}}', { name: photo.name }) : tx('Abrir {{name}}', { name: photo.name })} aria-pressed={selectionMode ? selectedPhotoIds.has(photo.id) : undefined}>
          <img src={galleryPhotoSource(photo.uri)} alt={photo.name} loading="lazy" draggable={false} />
          <span>{photo.name}</span>
          {selectionMode ? <i className="gallery-selection-mark" aria-hidden="true">{selectedPhotoIds.has(photo.id) ? <Check size={18} strokeWidth={3} /> : null}</i> : null}
        </button>)}
      </div> : <div className="gallery-empty">
        <span><Images size={46} strokeWidth={1.35} /></span>
        <h2>{tx(showTrash ? 'La papelera está vacía' : 'Añade tus primeras fotos')}</h2>
        <p>{tx(showTrash ? 'Las fotos que elimines se conservarán aquí durante 30 días.' : 'Selecciona una o varias imágenes guardadas en la tablet.')}</p>
        {!showTrash ? <button type="button" onClick={onAddPhotos}><Upload size={18} />{tx('Elegir fotos')}</button> : null}
      </div>}
    </section>

    {selectedPhoto ? <div className="gallery-viewer" data-swipe-block role="dialog" aria-modal="true" aria-label={selectedPhoto.name}>
      <button type="button" className="gallery-viewer-close" onClick={closeViewer} aria-label={tx('Cerrar foto')}><X size={25} /></button>
      <img src={galleryPhotoSource(selectedPhoto.uri)} alt={selectedPhoto.name} />
      <footer>
        <div><strong>{selectedPhoto.name}</strong><span>{new Intl.DateTimeFormat(activeLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(selectedPhoto.createdAt))}</span></div>
        {selectedPhoto.deletedAt ? <div className="gallery-viewer-actions">
          <button type="button" onClick={() => { onRestore(selectedPhoto.id); closeViewer() }}><RotateCcw size={18} />{tx('Restaurar')}</button>
          {confirmPermanentDelete
            ? <span className="gallery-delete-confirm"><small>{tx('Esta acción no se puede deshacer')}</small><button type="button" onClick={() => setConfirmPermanentDelete(false)}>{tx('Cancelar')}</button><button type="button" className="is-danger" onClick={() => { onPermanentlyDelete(selectedPhoto.id); closeViewer() }}>{tx('Eliminar')}</button></span>
            : <button type="button" className="is-danger" onClick={() => setConfirmPermanentDelete(true)}><Trash2 size={18} />{tx('Eliminar definitivamente')}</button>}
        </div> : <div className="gallery-viewer-actions"><button type="button" className="is-danger" onClick={() => { onMoveToTrash(selectedPhoto.id); closeViewer() }}><Trash2 size={18} />{tx('Mover a la papelera')}</button></div>}
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

function resizeWidgetFromEdge(initial: WidgetPosition, direction: WidgetResizeDirection, cellDelta: number, columns: number, rows: number): WidgetPosition {
  if (direction === 'left') {
    const delta = Math.max(Math.max(-initial.x, initial.width - columns), Math.min(initial.width - 1, cellDelta))
    return { ...initial, x: initial.x + delta, width: initial.width - delta }
  }
  if (direction === 'right') {
    const delta = Math.max(-(initial.width - 1), Math.min(Math.min(columns - initial.width, columns - initial.x - initial.width), cellDelta))
    return { ...initial, width: initial.width + delta }
  }
  if (direction === 'top') {
    const delta = Math.max(Math.max(-initial.y, initial.height - rows), Math.min(initial.height - 1, cellDelta))
    return { ...initial, y: initial.y + delta, height: initial.height - delta }
  }
  const delta = Math.max(-(initial.height - 1), Math.min(rows - initial.y - initial.height, cellDelta))
  return { ...initial, height: initial.height + delta }
}

function GridDashboard({ now, time, date, widgets, notes, calendarEvents, calendars, showUpcomingCalendarHolidays, homeWeatherLocation, homeWeatherForecast, weatherLoading, onOpenNotes, onOpenWeather, onOpenCalendar, onOpenAssistant, onChangeWidgetLayout, onEditingChange }: { now: Date; time: string; date: string; widgets: import('./widgetLayout').DashboardWidget[]; notes: Note[]; calendarEvents: CalendarEvent[]; calendars: SyncedCalendar[]; showUpcomingCalendarHolidays: boolean; homeWeatherLocation: WeatherLocation | null; homeWeatherForecast: WeatherForecast | null; weatherLoading: boolean; onOpenNotes: (noteId?: string) => void; onOpenWeather: () => void; onOpenCalendar: (date?: string) => void; onOpenAssistant: () => void; onChangeWidgetLayout: (widgetId: DashboardWidgetId, orientation: DashboardOrientation, patch: Partial<WidgetPosition>) => void; onEditingChange: (isEditing: boolean) => void }) {
  const orientation = useDashboardOrientation()
  const [isEditing, setIsEditing] = useState(false)
  const [selectedWidgetId, setSelectedWidgetId] = useState<DashboardWidgetId | null>(null)
  const [holdingWidgetId, setHoldingWidgetId] = useState<DashboardWidgetId | null>(null)
  const [dragPreview, setDragPreview] = useState<{ widgetId: DashboardWidgetId; x: number; y: number } | null>(null)
  const [resizePreview, setResizePreview] = useState<{ widgetId: DashboardWidgetId; position: WidgetPosition } | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const holdTimer = useRef<number | null>(null)
  const holdGesture = useRef<{ widgetId: DashboardWidgetId; pointerId: number; x: number; y: number } | null>(null)
  const dragGesture = useRef<{ widgetId: DashboardWidgetId; pointerId: number; startX: number; startY: number; initialLeft: number; initialTop: number; gridLeft: number; gridTop: number; columnStep: number; rowStep: number } | null>(null)
  const resizeGesture = useRef<{ widgetId: DashboardWidgetId; pointerId: number; direction: WidgetResizeDirection; startX: number; startY: number; initial: WidgetPosition; columnStep: number; rowStep: number; preview: WidgetPosition } | null>(null)
  const suppressWidgetActivation = useRef(false)
  const onEditingChangeRef = useRef(onEditingChange)
  const placedWidgets = useMemo(() => placeWidgets(widgets, orientation), [orientation, widgets])
  const displayedWidgets = useMemo(() => placedWidgets.map((widget) => resizePreview?.widgetId === widget.id ? { ...widget, layout: resizePreview.position } : widget), [placedWidgets, resizePreview])
  const visibleDashboardNotes = notes
    .filter((note) => !note.archived)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  const upcomingEvents = getUpcomingCalendarEvents(calendarEvents, now, time, 6, calendars)
  const upcomingHolidays = getUpcomingCalendarHolidays(calendarEvents, now, time, 3, calendars)

  const cancelWidgetHold = useCallback(() => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
    holdGesture.current = null
    setHoldingWidgetId(null)
  }, [])

  useEffect(() => {
    onEditingChangeRef.current = onEditingChange
  }, [onEditingChange])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const gesture = holdGesture.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 14) cancelWidgetHold()
    }
    const handlePointerEnd = (event: PointerEvent) => {
      if (holdGesture.current?.pointerId === event.pointerId) cancelWidgetHold()
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
      cancelWidgetHold()
      onEditingChangeRef.current(false)
    }
  }, [cancelWidgetHold])

  const startWidgetHold = (widgetId: DashboardWidgetId, event: ReactPointerEvent<HTMLDivElement>) => {
    if (isEditing || event.button !== 0) return
    cancelWidgetHold()
    holdGesture.current = { widgetId, pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setHoldingWidgetId(widgetId)
    holdTimer.current = window.setTimeout(() => {
      if (holdGesture.current?.widgetId !== widgetId) return
      holdTimer.current = null
      holdGesture.current = null
      setHoldingWidgetId(null)
      suppressWidgetActivation.current = true
      setSelectedWidgetId(widgetId)
      setIsEditing(true)
      onEditingChangeRef.current(true)
      if ('vibrate' in navigator) navigator.vibrate(35)
    }, 1_000)
  }

  const finishEditing = () => {
    cancelWidgetHold()
    dragGesture.current = null
    resizeGesture.current = null
    setDragPreview(null)
    setResizePreview(null)
    setSelectedWidgetId(null)
    setIsEditing(false)
    onEditingChangeRef.current(false)
  }

  const activateWidget = (action?: () => void) => {
    if (isEditing || suppressWidgetActivation.current) {
      suppressWidgetActivation.current = false
      return
    }
    action?.()
  }

  const canExpandWidget = (widget: PlacedWidget, direction: WidgetResizeDirection) => {
    const delta = direction === 'left' || direction === 'top' ? -1 : 1
    const candidate = resizeWidgetFromEdge(widget.layout, direction, delta, DASHBOARD_COLUMNS[orientation], DASHBOARD_ROWS[orientation])
    const changed = candidate.x !== widget.layout.x || candidate.y !== widget.layout.y || candidate.width !== widget.layout.width || candidate.height !== widget.layout.height
    return changed && resizeWidgets(widgets, orientation, widget.id, candidate) !== null
  }

  const canShrinkWidget = (widget: PlacedWidget, direction: WidgetResizeDirection) => direction === 'left' || direction === 'right'
    ? widget.layout.width > 1
    : widget.layout.height > 1

  const startWidgetResize = (widget: PlacedWidget, direction: WidgetResizeDirection, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isEditing || event.button !== 0) return
    const grid = gridRef.current
    if (!grid) return
    event.preventDefault()
    event.stopPropagation()
    const gridRect = grid.getBoundingClientRect()
    const styles = window.getComputedStyle(grid)
    const columnGap = Number.parseFloat(styles.columnGap) || 0
    const rowGap = Number.parseFloat(styles.rowGap) || columnGap
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0
    const rows = DASHBOARD_ROWS[orientation]
    const columns = DASHBOARD_COLUMNS[orientation]
    resizeGesture.current = {
      widgetId: widget.id,
      pointerId: event.pointerId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      initial: { ...widget.layout },
      columnStep: (gridRect.width - paddingLeft - paddingRight - columnGap * (columns - 1)) / columns + columnGap,
      rowStep: (gridRect.height - rowGap * (rows - 1)) / rows + rowGap,
      preview: { ...widget.layout },
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizePreview({ widgetId: widget.id, position: { ...widget.layout } })
  }

  const moveWidgetResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = resizeGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const pixelDelta = gesture.direction === 'left' || gesture.direction === 'right'
      ? event.clientX - gesture.startX
      : event.clientY - gesture.startY
    const step = gesture.direction === 'left' || gesture.direction === 'right' ? gesture.columnStep : gesture.rowStep
    let cellDelta = Math.round(pixelDelta / step)
    let candidate = resizeWidgetFromEdge(gesture.initial, gesture.direction, cellDelta, DASHBOARD_COLUMNS[orientation], DASHBOARD_ROWS[orientation])
    while (cellDelta !== 0 && resizeWidgets(widgets, orientation, gesture.widgetId, candidate) === null) {
      cellDelta += cellDelta > 0 ? -1 : 1
      candidate = resizeWidgetFromEdge(gesture.initial, gesture.direction, cellDelta, DASHBOARD_COLUMNS[orientation], DASHBOARD_ROWS[orientation])
    }
    if (resizeWidgets(widgets, orientation, gesture.widgetId, candidate) === null) candidate = gesture.initial
    gesture.preview = candidate
    setResizePreview({ widgetId: gesture.widgetId, position: candidate })
  }

  const finishWidgetResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = resizeGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const finalPosition = gesture.preview
    resizeGesture.current = null
    setResizePreview(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (finalPosition.x !== gesture.initial.x || finalPosition.y !== gesture.initial.y || finalPosition.width !== gesture.initial.width || finalPosition.height !== gesture.initial.height) {
      onChangeWidgetLayout(gesture.widgetId, orientation, finalPosition)
      if ('vibrate' in navigator) navigator.vibrate(18)
    }
  }

  const startWidgetDrag = (widget: PlacedWidget, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isEditing || event.button !== 0 || (event.target as HTMLElement).closest('.widget-resize-handle, .widget-size-indicator')) return
    const grid = gridRef.current
    if (!grid) return
    event.preventDefault()
    event.stopPropagation()
    setSelectedWidgetId(widget.id)
    const shell = event.currentTarget
    const shellRect = shell.getBoundingClientRect()
    const gridRect = grid.getBoundingClientRect()
    const styles = window.getComputedStyle(grid)
    const columnGap = Number.parseFloat(styles.columnGap) || 0
    const rowGap = Number.parseFloat(styles.rowGap) || columnGap
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0
    const rows = DASHBOARD_ROWS[orientation]
    const columns = DASHBOARD_COLUMNS[orientation]
    dragGesture.current = {
      widgetId: widget.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialLeft: shellRect.left,
      initialTop: shellRect.top + grid.scrollTop,
      gridLeft: gridRect.left + paddingLeft,
      gridTop: gridRect.top + paddingTop,
      columnStep: (gridRect.width - paddingLeft - paddingRight - columnGap * (columns - 1)) / columns + columnGap,
      rowStep: (gridRect.height - rowGap * (rows - 1)) / rows + rowGap,
    }
    shell.setPointerCapture(event.pointerId)
    setDragPreview({ widgetId: widget.id, x: 0, y: 0 })
  }

  const moveWidgetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = dragGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.preventDefault()
    setDragPreview({ widgetId: gesture.widgetId, x: event.clientX - gesture.startX, y: event.clientY - gesture.startY })
  }

  const finishWidgetDrag = (widget: PlacedWidget, event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = dragGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY
    const x = Math.max(0, Math.min(DASHBOARD_COLUMNS[orientation] - widget.layout.width, Math.round((gesture.initialLeft + deltaX - gesture.gridLeft) / gesture.columnStep)))
    const y = Math.max(0, Math.min(DASHBOARD_ROWS[orientation] - widget.layout.height, Math.round((gesture.initialTop + deltaY - gesture.gridTop) / gesture.rowStep)))
    dragGesture.current = null
    setDragPreview(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    onChangeWidgetLayout(widget.id, orientation, { x, y })
  }

  return (
    <div className={`dashboard-page page-enter ${isEditing ? 'is-editing-widgets' : ''}`}>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Pablo Tablet</p>
          <p className="welcome">{tx('Buenos días, Pablo')}</p>
        </div>
      </header>
      {isEditing ? <div className="widget-editor-banner" data-swipe-block><span>{tx('Arrastra para mover · arrastra los bordes para ajustar')}</span><button type="button" onClick={finishEditing}><Check size={17} />{tx('Listo')}</button></div> : null}
      <div ref={gridRef} className={`dashboard-grid is-${orientation}`}>
        {displayedWidgets.length > 0
          ? displayedWidgets.map((widget) => <DashboardWidgetCard key={widget.id} widget={widget} now={now} time={time} date={date} notes={visibleDashboardNotes} calendarEvents={calendarEvents} upcomingEvents={upcomingEvents} upcomingHolidays={upcomingHolidays} showUpcomingCalendarHolidays={showUpcomingCalendarHolidays} homeWeatherLocation={homeWeatherLocation} homeWeatherForecast={homeWeatherForecast} weatherLoading={weatherLoading} isEditing={isEditing} showResizeHandles={selectedWidgetId === widget.id} isHolding={holdingWidgetId === widget.id} dragOffset={dragPreview?.widgetId === widget.id ? dragPreview : null} onHoldStart={startWidgetHold} onDragStart={startWidgetDrag} onDragMove={moveWidgetDrag} onDragEnd={finishWidgetDrag} onResizeStart={startWidgetResize} onResizeMove={moveWidgetResize} onResizeEnd={finishWidgetResize} canExpand={(direction) => canExpandWidget(widget, direction)} canShrink={(direction) => canShrinkWidget(widget, direction)} onActivate={activateWidget} onOpenNotes={onOpenNotes} onOpenWeather={onOpenWeather} onOpenCalendar={onOpenCalendar} onOpenAssistant={onOpenAssistant} />)
          : <DashboardEmptyState time={time} date={date} />}
      </div>
    </div>
  )
}

function DashboardEmptyState({ time, date }: { time: string; date: string }) {
  return <section className="dashboard-empty-state">
    <p>{tx('Panel sin módulos')}</p>
    <time>{time}</time>
    <span>{date}</span>
    <small>{tx('Activa al menos un widget desde Ajustes.')}</small>
  </section>
}

function DashboardWidgetFrame({ widget, style, isEditing, showResizeHandles, isHolding, dragOffset, onHoldStart, onDragStart, onDragMove, onDragEnd, onResizeStart, onResizeMove, onResizeEnd, canExpand, canShrink, children }: { widget: PlacedWidget; style: CSSProperties; isEditing: boolean; showResizeHandles: boolean; isHolding: boolean; dragOffset: { x: number; y: number } | null; onHoldStart: (widgetId: DashboardWidgetId, event: ReactPointerEvent<HTMLDivElement>) => void; onDragStart: (widget: PlacedWidget, event: ReactPointerEvent<HTMLDivElement>) => void; onDragMove: (event: ReactPointerEvent<HTMLDivElement>) => void; onDragEnd: (widget: PlacedWidget, event: ReactPointerEvent<HTMLDivElement>) => void; onResizeStart: (widget: PlacedWidget, direction: WidgetResizeDirection, event: ReactPointerEvent<HTMLButtonElement>) => void; onResizeMove: (event: ReactPointerEvent<HTMLButtonElement>) => void; onResizeEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void; canExpand: (direction: WidgetResizeDirection) => boolean; canShrink: (direction: WidgetResizeDirection) => boolean; children: ReactNode }) {
  const widgetNames: Record<DashboardWidgetId, string> = { clock: 'Reloj', weather: 'Tiempo', notes: 'Notas', agenda: 'Calendario', assistant: 'Asistente' }
  const resizeDirections: WidgetResizeDirection[] = ['left', 'right', 'top', 'bottom']
  const arrows: Record<WidgetResizeDirection, string> = { left: '←', right: '→', top: '↑', bottom: '↓' }
  const directionNames: Record<WidgetResizeDirection, string> = { left: 'izquierdo', right: 'derecho', top: 'superior', bottom: 'inferior' }

  return <div
    className={`dashboard-widget-shell widget-size-${widget.layout.width}x${widget.layout.height} ${isEditing ? 'is-editing' : ''} ${isHolding ? 'is-holding' : ''} ${dragOffset ? 'is-dragging' : ''}`}
    data-widget-id={widget.id}
    data-widget-size={`${widget.layout.width}x${widget.layout.height}`}
    style={{ ...style, transform: dragOffset ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` : undefined, zIndex: dragOffset ? 10 : undefined }}
    onPointerDown={(event) => isEditing ? onDragStart(widget, event) : onHoldStart(widget.id, event)}
    onPointerMove={onDragMove}
    onPointerUp={(event) => onDragEnd(widget, event)}
    onPointerCancel={(event) => onDragEnd(widget, event)}
    onContextMenu={(event) => event.preventDefault()}
  >
    {children}
    {isHolding ? <span className="widget-hold-hint">{tx('Mantén pulsado…')}</span> : null}
    {isEditing ? <>
      <span className="widget-size-indicator" data-swipe-block><strong>{widgetNames[widget.id]}</strong><small>{widget.layout.width} × {widget.layout.height}</small></span>
      {showResizeHandles ? resizeDirections.map((direction) => {
        const expands = canExpand(direction)
        if (!expands && !canShrink(direction)) return null
        return <button
          key={direction}
          type="button"
          className={`widget-resize-handle is-${direction} ${expands ? 'can-expand' : 'shrink-only'}`}
          data-swipe-block
          aria-label={`Ajustar borde ${directionNames[direction]} de ${widgetNames[widget.id]}`}
          onPointerDown={(event) => onResizeStart(widget, direction, event)}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          onClick={(event) => event.preventDefault()}
        ><span aria-hidden="true">{expands ? arrows[direction] : '•'}</span></button>
      }) : null}
    </> : null}
  </div>
}

function DashboardWidgetCard({ widget, now, time, date, notes, calendarEvents, upcomingEvents, upcomingHolidays, showUpcomingCalendarHolidays, homeWeatherLocation, homeWeatherForecast, weatherLoading, isEditing, showResizeHandles, isHolding, dragOffset, onHoldStart, onDragStart, onDragMove, onDragEnd, onResizeStart, onResizeMove, onResizeEnd, canExpand, canShrink, onActivate, onOpenNotes, onOpenWeather, onOpenCalendar, onOpenAssistant }: {
  widget: PlacedWidget
  now: Date
  time: string
  date: string
  notes: Note[]
  calendarEvents: CalendarEvent[]
  upcomingEvents: CalendarEvent[]
  upcomingHolidays: CalendarEvent[]
  showUpcomingCalendarHolidays: boolean
  homeWeatherLocation: WeatherLocation | null
  homeWeatherForecast: WeatherForecast | null
  weatherLoading: boolean
  isEditing: boolean
  showResizeHandles: boolean
  isHolding: boolean
  dragOffset: { x: number; y: number } | null
  onHoldStart: (widgetId: DashboardWidgetId, event: ReactPointerEvent<HTMLDivElement>) => void
  onDragStart: (widget: PlacedWidget, event: ReactPointerEvent<HTMLDivElement>) => void
  onDragMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onDragEnd: (widget: PlacedWidget, event: ReactPointerEvent<HTMLDivElement>) => void
  onResizeStart: (widget: PlacedWidget, direction: WidgetResizeDirection, event: ReactPointerEvent<HTMLButtonElement>) => void
  onResizeMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onResizeEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void
  canExpand: (direction: WidgetResizeDirection) => boolean
  canShrink: (direction: WidgetResizeDirection) => boolean
  onActivate: (action?: () => void) => void
  onOpenNotes: (noteId?: string) => void
  onOpenWeather: () => void
  onOpenCalendar: (date?: string) => void
  onOpenAssistant: () => void
}) {
  const style = {
    gridColumn: `${widget.layout.x + 1} / span ${widget.layout.width}`,
    gridRow: `${widget.layout.y + 1} / span ${widget.layout.height}`,
  } satisfies CSSProperties
  const sizeKey = `${widget.layout.width}x${widget.layout.height}`
  const area = widget.layout.width * widget.layout.height
  const frameProps = { widget, style, isEditing, showResizeHandles, isHolding, dragOffset, onHoldStart, onDragStart, onDragMove, onDragEnd, onResizeStart, onResizeMove, onResizeEnd, canExpand, canShrink }

  if (widget.id === 'assistant') return <DashboardWidgetFrame {...frameProps}><button type="button" className="assistant-widget widget-card interactive-card" onClick={() => onActivate(onOpenAssistant)}>
    <span className="assistant-widget-icon"><Sparkles size={area >= 3 ? 34 : 25} /></span>
    <span><strong>{tx('Asistente')}</strong><small>{tx(area >= 2 ? 'Consulta tu día o prepara una acción con voz o texto.' : 'Voz y texto')}</small></span>
    <ChevronRight size={18} />
  </button></DashboardWidgetFrame>

  if (widget.id === 'clock') return <DashboardWidgetFrame {...frameProps}><article className="clock-card responsive-clock-widget widget-card">
    <div className="widget-label"><span>{tx('Ahora')}</span></div>
    <time className="time">{time}{area > 1 ? <small>:{String(now.getSeconds()).padStart(2, '0')}</small> : null}</time>
    <p className="date">{date}</p>
    {widget.layout.height >= 2 && area >= 4 ? <div className="clock-details"><span><SunMedium size={20} />{tx('Que tengas un día estupendo')}</span><strong>{new Intl.DateTimeFormat(activeLocale(), { weekday: 'long' }).format(now)}</strong></div> : null}
    {widget.layout.height >= 2 && area >= 6 ? <div className="clock-day-progress"><span style={{ width: `${Math.round(((now.getHours() * 60 + now.getMinutes()) / 1440) * 100)}%` }} /></div> : null}
  </article></DashboardWidgetFrame>

  if (widget.id === 'weather') {
    const hourCount: Record<string, number> = { '1x1': 0, '1x2': 3, '1x3': 3, '1x4': 6, '2x1': 0, '2x2': 4, '2x3': 6, '2x4': 6, '3x1': 0, '3x2': 6, '3x3': 6, '3x4': 6, '4x1': 0, '4x2': 6, '4x3': 6, '4x4': 6 }
    const forecastCount: Record<string, number> = { '1x1': 0, '1x2': 0, '1x3': 3, '1x4': 5, '2x1': 0, '2x2': 3, '2x3': 4, '2x4': 5, '3x1': 0, '3x2': 4, '3x3': 5, '3x4': 5, '4x1': 0, '4x2': 5, '4x3': 5, '4x4': 5 }
    if (!homeWeatherLocation) return <DashboardWidgetFrame {...frameProps}><button type="button" className="weather-card responsive-weather-widget weather-widget-empty widget-card interactive-card" onClick={() => onActivate(onOpenWeather)}><div className="weather-icon"><MapPin size={36} /></div><div><strong>{tx('Configura el tiempo')}</strong><span>{tx('Añade una ubicación y márcala como Casa.')}</span></div></button></DashboardWidgetFrame>
    if (!homeWeatherForecast) return <DashboardWidgetFrame {...frameProps}><button type="button" className="weather-card responsive-weather-widget weather-widget-empty widget-card interactive-card" onClick={() => onActivate(onOpenWeather)}><div className="weather-icon"><RefreshCw className={weatherLoading ? 'is-spinning' : ''} size={34} /></div><div><strong>{homeWeatherLocation.name}</strong><span>{tx(weatherLoading ? 'Actualizando la previsión…' : 'Toca para volver a intentarlo.')}</span></div></button></DashboardWidgetFrame>
    const weatherHours = homeWeatherForecast.hourly
    const forecast = homeWeatherForecast.daily
    return <DashboardWidgetFrame {...frameProps}><button type="button" className="weather-card responsive-weather-widget widget-card interactive-card" onClick={() => onActivate(onOpenWeather)}>
      <div className="weather-current"><div className="weather-icon"><WeatherIcon code={homeWeatherForecast.current.weatherCode} size={area >= 4 ? 46 : 36} /></div><div><p className="temperature">{Math.round(homeWeatherForecast.current.temperature)}°</p><p className="weather-copy">{weatherDescription(homeWeatherForecast.current.weatherCode)}</p><span><Home size={13} />{homeWeatherLocation.name}</span></div></div>
      <div className="weather-stats"><span><Droplets size={17} /><small>{tx('Humedad')}</small><strong>{Math.round(homeWeatherForecast.current.humidity)}%</strong></span><span><Wind size={17} /><small>{tx('Viento')}</small><strong>{Math.round(homeWeatherForecast.current.windSpeed)} km/h</strong></span><span><Sunrise size={17} /><small>{tx('Amanecer')}</small><strong>{formatWeatherHour(homeWeatherForecast.daily[0]?.sunrise ?? '')}</strong></span><span><Sunset size={17} /><small>{tx('Anochecer')}</small><strong>{formatWeatherHour(homeWeatherForecast.daily[0]?.sunset ?? '')}</strong></span></div>
      {(hourCount[sizeKey] ?? 0) > 0 ? <div className="weather-hours"><p>{tx('Próximas horas')}</p>{weatherHours.slice(0, hourCount[sizeKey]).map((hour, index) => <span key={hour.time}><small>{index === 0 ? tx('Ahora') : formatWeatherHour(hour.time)}</small><WeatherIcon code={hour.weatherCode} size={20} /><strong>{Math.round(hour.temperature)}°</strong></span>)}</div> : null}
      {(forecastCount[sizeKey] ?? 0) > 0 ? <div className="weather-forecast"><p>{tx('Próximos días')}</p>{forecast.slice(0, forecastCount[sizeKey]).map((day, index) => <span key={day.date}><b>{index === 0 ? tx('Hoy') : formatWeatherDay(day.date, true)}</b><WeatherIcon code={day.weatherCode} size={18} /><strong>{Math.round(day.temperatureMax)}°</strong><small>{Math.round(day.temperatureMin)}°</small></span>)}</div> : null}
    </button></DashboardWidgetFrame>
  }

  if (widget.id === 'notes') {
    const noteCount: Record<string, number> = { '1x1': 1, '1x2': 3, '1x3': 4, '1x4': 5, '2x1': 3, '2x2': 4, '2x3': 6, '2x4': 8, '3x1': 4, '3x2': 6, '3x3': 8, '3x4': 10, '4x1': 4, '4x2': 8, '4x3': 10, '4x4': 12 }
    const pinnedNotes = notes.filter((note) => note.pinned)
    const visibleNotes = [...(pinnedNotes.length > 0 ? pinnedNotes : notes)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, noteCount[sizeKey] ?? 1)
    const featuredNote = visibleNotes[0]
    return <DashboardWidgetFrame {...frameProps}><button type="button" className={`note-card responsive-note-widget widget-card interactive-card ${featuredNote ? `note-${featuredNote.color}` : ''}`} onClick={() => onActivate(() => onOpenNotes(featuredNote?.id))}>
    <div className="widget-heading">
      <div className="heading-icon coral"><Check size={18} /></div>
      <div><p className="widget-title">{tx('Notas')}</p><p className="widget-subtitle">{notes.length ? tx('{{count}} notas guardadas en esta tablet', { count: notes.length }) : tx('Sin notas todavía')}</p></div>
    </div>
    {visibleNotes.length > 0 ? <div className="note-preview-list">{visibleNotes.map((note, index) => <span key={note.id} className={`note-preview note-${note.color} ${note.type === 'drawing' && note.pinned ? 'has-drawing-preview' : ''}`}><i /><span><strong>{note.title || tx('Sin título')}</strong>{note.type === 'drawing' && note.pinned ? <NoteDrawingPreview drawing={note.drawing} /> : <small>{note.type === 'drawing' ? tx('Dibujo') : note.type === 'list' ? tx('{{checked}}/{{count}} marcados', { checked: parseNoteList(note.content).filter((item) => item.checked).length, count: parseNoteList(note.content).length }) : (note.content || tx('Texto'))}</small>}</span>{index === 0 && note.pinned && note.type === 'drawing' ? <Pin className="note-preview-pin" size={14} /> : null}</span>)}</div> : <p className="note-content is-placeholder">{tx('Toca aquí para crear una nota de texto, una lista o un dibujo.')}</p>}
    <div className="note-footer"><span>{featuredNote ? tx(featuredNote.pinned ? 'Fijada' : 'Editada') : tx('Sin contenido')}</span><ChevronRight size={17} /></div>
    </button></DashboardWidgetFrame>
  }

  const firstWeekday = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7
  const dayCount: Record<string, number> = { '1x1': 7, '1x2': 14, '1x3': 21, '1x4': 42, '2x1': 7, '2x2': 28, '2x3': 42, '2x4': 42, '3x1': 7, '3x2': 35, '3x3': 42, '3x4': 42, '4x1': 7, '4x2': 42, '4x3': 42, '4x4': 42 }
  const visibleDayCount = dayCount[sizeKey] ?? 7
  const showWholeMonth = visibleDayCount === 42
  const calendarStart = showWholeMonth
    ? new Date(now.getFullYear(), now.getMonth(), 1 - firstWeekday)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const monthCells = Array.from({ length: visibleDayCount }, (_, index) => {
    const value = new Date(calendarStart)
    value.setDate(calendarStart.getDate() + index)
    const key = toLocalDateKey(value)
    const events = calendarEvents.flatMap((event) => {
      const occurrence = calendarOccurrenceForDate(event, key)
      return occurrence ? [eventForOccurrence(event, occurrence)] : []
    })
    return { key, day: value.getDate(), muted: value.getMonth() !== now.getMonth(), events }
  })
  const agendaCount: Record<string, number> = { '1x1': 0, '1x2': 2, '1x3': 3, '1x4': 4, '2x1': 0, '2x2': 2, '2x3': 3, '2x4': 5, '3x1': 0, '3x2': 3, '3x3': 5, '3x4': 6, '4x1': 0, '4x2': 4, '4x3': 6, '4x4': 6 }
  const showHolidaySection = showUpcomingCalendarHolidays && area >= 6 && upcomingHolidays.length > 0
  const visibleAgendaCount = showHolidaySection ? Math.max(1, (agendaCount[sizeKey] ?? 0) - 1) : agendaCount[sizeKey] ?? 0
  const calendarSubtitle = visibleDayCount === 7
    ? tx('Esta semana')
    : showWholeMonth
    ? new Intl.DateTimeFormat(activeLocale(), { month: 'long', year: 'numeric' }).format(now)
    : tx('{{count}} días desde hoy', { count: visibleDayCount })

  return <DashboardWidgetFrame {...frameProps}><article className="agenda-card calendar-widget responsive-calendar-widget widget-card">
    <button type="button" className="calendar-widget-header calendar-widget-open" onPointerDown={(event) => event.stopPropagation()} onClick={() => onActivate(() => onOpenCalendar())}>
      <div className="widget-heading"><div className="heading-icon blue"><CalendarDays size={18} /></div><div><p className="widget-title">{tx('Calendario')}</p><p className="widget-subtitle">{calendarSubtitle}</p></div></div>
      <span>{tx('Ver calendario')} <ChevronRight size={17} /></span>
    </button>
    <div className="calendar-widget-body">
      <section className="calendar-widget-month">
        <div className="calendar-widget-weekdays">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-widget-month-grid">{monthCells.map((cell) => <button key={cell.key} type="button" aria-label={tx('Abrir {{name}}', { name: formatCalendarDay(new Date(`${cell.key}T12:00:00`)) })} className={`${cell.key === toLocalDateKey(now) ? 'is-today' : ''} ${cell.muted ? 'is-muted' : ''}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onActivate(() => onOpenCalendar(cell.key))}><strong>{cell.day}</strong>{summarizeCalendarCellEvents(cell.events, cell.key).slice(0, area >= 6 ? 2 : 1).map((event) => <small key={event.id} className={`event-${event.color} ${nativeCalendarClass(event)} ${event.completed ? 'is-completed' : ''} ${event.source !== 'native' && isCalendarEventPast(event, now) ? 'is-past' : ''}`}>{event.title || tx('Evento')}</small>)}</button>)}</div>
      </section>
      {(agendaCount[sizeKey] ?? 0) > 0 ? <aside className={`calendar-widget-agenda ${showHolidaySection ? 'has-holidays' : ''}`}>
        <div className="calendar-widget-upcoming"><p>{tx('Próximos eventos')}</p>{upcomingEvents.length > 0 ? upcomingEvents.slice(0, visibleAgendaCount).map((event) => <button type="button" key={event.id} className={`calendar-event-line event-${event.color} kind-${event.type} ${nativeCalendarClass(event)}`} onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()} onClick={() => onActivate(() => onOpenCalendar(event.date))}><i /><span className="calendar-event-copy"><b><CalendarEventTypeMark type={event.type} source={event.source} /><span>{event.title || tx('Evento')}</span></b><time>{formatCalendarEventTime(event, toLocalDateKey(now))}</time></span></button>) : <span className="calendar-widget-empty"><Compass size={19} />{tx('Sin eventos próximos')}</span>}</div>
        {showHolidaySection ? <div className="calendar-widget-holidays"><p><Sparkles size={12} />{tx('Próximos festivos')}</p>{upcomingHolidays.slice(0, 2).map((event) => <button type="button" key={event.id} className={`calendar-event-line is-holiday event-${event.color} ${nativeCalendarClass(event)}`} onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()} onClick={() => onActivate(() => onOpenCalendar(event.date))}><i /><span className="calendar-event-copy"><b><Sparkles size={13} /><span>{event.title || tx('Festivo')}</span></b><time>{formatCalendarEventTime(event, toLocalDateKey(now))}</time></span></button>)}</div> : null}
      </aside> : null}
    </div>
  </article></DashboardWidgetFrame>
}

const HOLIDAY_CALENDAR_PATTERN = /(holiday|holidays|festiv|festivo|festivos|bank[ _-]?holiday|feiertag|f[eé]ri[eé])/i

function isCalendarHoliday(event: CalendarEvent, calendars: SyncedCalendar[] = []) {
  if (event.source === 'native') return true
  if (event.isHoliday) return true
  if (!event.allDay || event.source === 'local' || !event.accountId || !event.calendarId) return false
  const calendar = calendars.find((candidate) => candidate.provider === event.source && candidate.accountId === event.accountId && candidate.remoteId === event.calendarId)
  return Boolean(calendar && HOLIDAY_CALENDAR_PATTERN.test(`${calendar.name} ${calendar.remoteId}`))
}

function getUpcomingCalendarItems(calendarEvents: CalendarEvent[], now: Date, time: string, limit: number, calendars: SyncedCalendar[], holidaysOnly: boolean) {
  const todayKey = toLocalDateKey(now)
  return calendarEvents
    .filter((event) => event.type !== 'task' || !event.completed)
    .filter((event) => isCalendarHoliday(event, calendars) === holidaysOnly)
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

function getUpcomingCalendarEvents(calendarEvents: CalendarEvent[], now: Date, time: string, limit = 3, calendars: SyncedCalendar[] = []) {
  return getUpcomingCalendarItems(calendarEvents, now, time, limit, calendars, false)
}

function getUpcomingCalendarHolidays(calendarEvents: CalendarEvent[], now: Date, time: string, limit = 3, calendars: SyncedCalendar[] = []) {
  return getUpcomingCalendarItems(calendarEvents, now, time, limit, calendars, true)
}

function isCalendarEventPast(event: CalendarEvent, now: Date) {
  const todayKey = toLocalDateKey(now)
  if (event.endDate < todayKey) return true
  if (event.endDate > todayKey || event.allDay) return false
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return event.endTime <= currentTime
}

function formatCalendarEventTime(event: CalendarEvent, todayKey?: string) {
  const shortDate = (date: string) => date === todayKey ? tx('Hoy') : new Intl.DateTimeFormat(activeLocale(), { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
  if (event.date !== event.endDate) {
    const range = `${shortDate(event.date)} → ${shortDate(event.endDate)}`
    return event.allDay ? range : `${range} · ${event.startTime}–${event.endTime}`
  }
  return event.allDay ? `${shortDate(event.date)} · ${tx('Todo el día')}` : `${shortDate(event.date)} · ${event.startTime}`
}

function formatCalendarEventTimeForDay(event: CalendarEvent, selectedDate: string) {
  if (event.allDay) return tx('Todo el día')
  if (event.date === event.endDate) return `${event.startTime}–${event.endTime}`
  if (selectedDate === event.date) return `${event.startTime} · ${tx('Comienzo')}`
  if (selectedDate === event.endDate) return `${event.endTime} · ${tx('Fin')}`
  return tx('En curso')
}

const formatCalendarMonth = (date: Date) => new Intl.DateTimeFormat(activeLocale(), { month: 'long', year: 'numeric' }).format(date)
const formatCalendarDay = (date: Date) => new Intl.DateTimeFormat(activeLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
const formatCalendarDayColumn = (date: Date) => new Intl.DateTimeFormat(activeLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
const CALENDAR_HOUR_HEIGHT = 64

function calendarTimeMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function calendarTimelineStyle(event: CalendarEvent, date: string): CSSProperties {
  const startMinutes = event.date < date ? 0 : calendarTimeMinutes(event.startTime)
  const endMinutes = event.endDate > date ? 24 * 60 : calendarTimeMinutes(event.endTime)
  const durationMinutes = Math.max(30, endMinutes - startMinutes)
  return {
    top: `${(startMinutes / 60) * CALENDAR_HOUR_HEIGHT}px`,
    height: `${Math.max(36, (durationMinutes / 60) * CALENDAR_HOUR_HEIGHT)}px`,
  }
}

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

function CalendarEventTypeMark({ type, source, size = 14 }: { type: CalendarEventType; source?: CalendarEvent['source']; size?: number }) {
  if (source === 'native') return <span className="calendar-type-mark kind-native" title={tx('Calendario de la tablet')} aria-label={tx('Calendario de la tablet')}><Sparkles size={size} strokeWidth={2.2} /></span>
  const label = CALENDAR_EVENT_TYPES.find((option) => option.value === type)?.label ?? 'Evento'
  const Icon = type === 'task' ? ListTodo : type === 'birthday' ? CakeSlice : CalendarDays
  return <span className={`calendar-type-mark kind-${type}`} title={tx(label as import('./i18n/translations').TranslationKey)} aria-label={tx(label as import('./i18n/translations').TranslationKey)}><Icon size={size} strokeWidth={2.2} /></span>
}

function nativeCalendarClass(event: CalendarEvent) {
  return event.source === 'native' ? `is-native native-${event.nativeCategory ?? 'observance'}` : ''
}

function summarizeCalendarCellEvents(events: CalendarEvent[], date: string) {
  const pendingTasks = events.filter((event) => event.type === 'task' && !event.completed)
  if (pendingTasks.length === 0) return events
  const taskSummary: CalendarEvent = {
    ...pendingTasks[0],
    id: `task-summary:${date}`,
    title: tx(pendingTasks.length === 1 ? '{{count}} tarea' : '{{count}} tareas', { count: pendingTasks.length }),
  }
  return [taskSummary, ...events.filter((event) => event.type !== 'task')]
}

function CalendarPage({ now, initialDate, events, accounts, calendars, hideCompletedTasks, onHideCompletedTasksChange, onCreate, onUpdate, onDelete, onSetDestination, onConnected, onSync, onDisconnect, onEditingChange }: { now: Date; initialDate: string | null; events: CalendarEvent[]; accounts: CalendarAccount[]; calendars: SyncedCalendar[]; hideCompletedTasks: boolean; onHideCompletedTasksChange: (hidden: boolean) => void; onCreate: (date: string) => string; onUpdate: (eventId: string, patch: CalendarEventPatch) => void; onDelete: (eventId: string) => void; onSetDestination: (eventId: string, calendarId: string | null) => void; onConnected: (account: CalendarAccount, token: string) => Promise<void>; onSync: (accountId: string) => Promise<void>; onDisconnect: (accountId: string) => Promise<void>; onEditingChange: (isEditing: boolean) => void }) {
  const todayKey = toLocalDateKey(now)
  const initialDateKey = initialDate ?? todayKey
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const value = new Date(`${initialDateKey}T12:00:00`)
    return new Date(value.getFullYear(), value.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(initialDateKey)
  const [calendarView, setCalendarView] = useState<'month' | 'day'>(initialDate ? 'day' : 'month')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const dayViewScrollRef = useRef<HTMLDivElement>(null)
  const visibleYear = visibleMonth.getFullYear()
  const pageEvents = useMemo(
    () => [...events.filter((event) => event.source !== 'native'), ...nativeCalendarEventsForYears([visibleYear - 1, visibleYear, visibleYear + 1])],
    [events, visibleYear],
  )
  const editingEvent = pageEvents.find((event) => event.id === editingEventId)
  const firstWeekday = (visibleMonth.getDay() + 6) % 7
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const monthCells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1
    return day >= 1 && day <= daysInMonth ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day) : null
  })
  const visibleCalendarIds = new Set(calendars.map((calendar) => `${calendar.provider}:${calendar.accountId}:${calendar.remoteId}`))
  const sourceVisibleEvents = pageEvents.filter((event) => event.source === 'local' || event.source === 'native' || (event.calendarId !== null && event.accountId !== null && visibleCalendarIds.has(`${event.source}:${event.accountId}:${event.calendarId}`)))
  const visibleEvents = hideCompletedTasks ? sourceVisibleEvents.filter((event) => event.type !== 'task' || !event.completed) : sourceVisibleEvents
  const selectedEvents = visibleEvents.flatMap((event) => {
    const occurrence = calendarOccurrenceForDate(event, selectedDate)
    return occurrence ? [eventForOccurrence(event, occurrence)] : []
  }).filter((event) => !hideCompletedTasks || !isCalendarEventPast(event, now))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.localeCompare(b.startTime))
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const currentHour = now.getHours()
  const upcomingEvents = getUpcomingCalendarEvents(visibleEvents, now, currentTime, 5, calendars)
  const currentMonthKey = todayKey.slice(0, 7)
  const dayViewDates = [-1, 0, 1].map((offset) => addDaysToDateKey(selectedDate, offset))
  const dayViewEvents = dayViewDates.map((date) => visibleEvents.flatMap((event) => {
    const occurrence = calendarOccurrenceForDate(event, date)
    return occurrence ? [eventForOccurrence(event, occurrence)] : []
  }).filter((event) => !hideCompletedTasks || !isCalendarEventPast(event, now))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.localeCompare(b.startTime)))
  const calendarHours = Array.from({ length: 24 }, (_, hour) => hour)

  useEffect(() => {
    if (calendarView !== 'day') return
    const animationFrame = window.requestAnimationFrame(() => {
      const initialHour = selectedDate === todayKey ? Math.max(0, currentHour - 2) : 7
      if (dayViewScrollRef.current) dayViewScrollRef.current.scrollTop = initialHour * CALENDAR_HOUR_HEIGHT
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [calendarView, currentHour, selectedDate, todayKey])

  const changeMonth = (offset: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1)
    setVisibleMonth(next)
    setSelectedDate(toLocalDateKey(next))
  }

  const goToToday = () => {
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(todayKey)
  }

  const showDay = (date: string) => {
    const value = new Date(`${date}T12:00:00`)
    setSelectedDate(date)
    setVisibleMonth(new Date(value.getFullYear(), value.getMonth(), 1))
    setCalendarView('day')
  }

  const changeDay = (offset: number) => showDay(addDaysToDateKey(selectedDate, offset))

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
    {calendarView === 'day' ? <section className="calendar-three-day-panel">
      <header className="calendar-three-day-toolbar">
        <button type="button" className="calendar-back-to-month" onClick={() => setCalendarView('month')}><ChevronLeft size={18} />{tx('Volver al mes')}</button>
        <div className="calendar-three-day-title"><p className="eyebrow">{tx('Vista por horas')}</p><h1>{formatCalendarDay(new Date(`${selectedDate}T12:00:00`))}</h1></div>
        <div className="calendar-three-day-actions">
          <button type="button" onClick={() => changeDay(-1)} aria-label={tx('Día anterior')}><ChevronLeft size={19} /></button>
          <button type="button" className="calendar-today-button" onClick={() => showDay(todayKey)}>{tx('Hoy')}</button>
          <button type="button" onClick={() => changeDay(1)} aria-label={tx('Día siguiente')}><ChevronRight size={19} /></button>
          <button type="button" className="btn btn-primary primary-action" onClick={createEvent}><Plus size={18} />{tx('Nuevo')}</button>
        </div>
      </header>
      <div className="calendar-three-day-viewport" aria-label={tx('Agenda por horas del {{start}} al {{end}}', { start: dayViewDates[0], end: dayViewDates[2] })}>
        <div className="calendar-three-day-date-row">
          <span className="calendar-time-corner" aria-hidden="true" />
          {dayViewDates.map((date) => <button key={date} type="button" className={`${date === selectedDate ? 'is-selected' : ''} ${date === todayKey ? 'is-today' : ''}`} onClick={() => showDay(date)}><span>{formatCalendarDayColumn(new Date(`${date}T12:00:00`))}</span>{date === todayKey ? <small>{tx('Hoy')}</small> : null}</button>)}
        </div>
        <div className="calendar-three-day-all-day" aria-label={tx('Eventos de todo el día')}>
          <span className="calendar-time-corner">{tx('Todo el día')}</span>
          {dayViewDates.map((date, columnIndex) => <div key={date}>{dayViewEvents[columnIndex].filter((event) => event.allDay).map((event) => {
            const holiday = isCalendarHoliday(event, calendars)
            return <button key={event.id} type="button" disabled={event.source === 'native' || holiday} className={`calendar-timeline-all-day event-${event.color} ${holiday ? 'is-holiday' : ''} ${nativeCalendarClass(event)}`} onClick={() => openEditor(event.id)}>{holiday ? <Sparkles size={12} /> : <CalendarEventTypeMark type={event.type} source={event.source} size={12} />}<span>{event.title || tx('Evento de todo el día')}</span>{holiday ? <small>{tx('Festivo')}</small> : null}</button>
          })}</div>)}
        </div>
        <div ref={dayViewScrollRef} className="calendar-three-day-scroll">
          <div className="calendar-three-day-grid">
            <div className="calendar-time-axis">{calendarHours.map((hour) => <time key={hour}>{String(hour).padStart(2, '0')}:00</time>)}</div>
            {dayViewDates.map((date, columnIndex) => <div key={date} className={`calendar-timeline-column ${date === selectedDate ? 'is-selected' : ''} ${date === todayKey ? 'is-today' : ''}`} aria-label={formatCalendarDay(new Date(`${date}T12:00:00`))}>
              {calendarHours.map((hour) => <span key={hour} className="calendar-hour-cell" />)}
              {dayViewEvents[columnIndex].filter((event) => !event.allDay).map((event) => <button key={event.id} type="button" disabled={event.source === 'native'} style={calendarTimelineStyle(event, date)} className={`calendar-timeline-event event-${event.color} kind-${event.type} ${nativeCalendarClass(event)} ${event.completed ? 'is-completed' : ''}`} onClick={() => openEditor(event.id)}><strong><CalendarEventTypeMark type={event.type} source={event.source} size={12} /><span>{event.title || tx('Evento')}</span></strong><small>{formatCalendarEventTimeForDay(event, date)}{event.location ? ` · ${event.location}` : event.notes ? ` · ${event.notes}` : ''}</small></button>)}
            </div>)}
          </div>
        </div>
      </div>
    </section> : <div className="calendar-layout">
      <section className="calendar-month-panel" data-page-swipe-surface>
        <header className="calendar-toolbar">
          <div><p className="eyebrow">{tx('Agenda unificada')}</p><h1>{formatCalendarMonth(visibleMonth)}</h1></div>
          <div><button type="button" className={`calendar-hide-completed ${hideCompletedTasks ? 'is-active' : ''}`} onClick={() => onHideCompletedTasksChange(!hideCompletedTasks)} aria-pressed={hideCompletedTasks}><EyeOff size={17} /><span>{tx('Ocultar finalizados')}</span></button><button type="button" onClick={() => changeMonth(-1)} aria-label={tx('Mes anterior')}><ChevronLeft size={20} /></button><button type="button" className="calendar-today-button" onClick={goToToday}>{tx('Hoy')}</button><button type="button" onClick={() => changeMonth(1)} aria-label={tx('Mes siguiente')}><ChevronRight size={20} /></button></div>
        </header>
        <div className="calendar-weekdays">{Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(activeLocale(), { weekday: 'short' }).format(new Date(2026, 0, 5 + index)).replace('.', '')).map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-month-grid">{monthCells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} className="calendar-empty-day" />
          const key = toLocalDateKey(day)
          const dayEvents = visibleEvents.flatMap((event) => {
            const occurrence = calendarOccurrenceForDate(event, key)
            return occurrence ? [eventForOccurrence(event, occurrence)] : []
          }).filter((event) => !hideCompletedTasks || !isCalendarEventPast(event, now))
          const displayedEvents = summarizeCalendarCellEvents(dayEvents, key)
          return <button key={key} type="button" className={`${key === selectedDate ? 'is-selected' : ''} ${key === todayKey ? 'is-today' : ''}`} onClick={() => showDay(key)}><strong>{day.getDate()}</strong>{displayedEvents.length > 0 ? <span className="calendar-cell-events">{displayedEvents.slice(0, 2).map((event) => <span key={event.id} className={`event-${event.color} kind-${event.type} ${nativeCalendarClass(event)} ${event.completed ? 'is-completed' : ''} ${event.source !== 'native' && isCalendarEventPast(event, now) ? 'is-past' : ''}`}><CalendarEventTypeMark type={event.type} source={event.source} size={10} /><span>{event.title || tx('Evento')}</span>{event.recurrence !== 'none' ? <RotateCw className="calendar-recurrence-mark" size={9} /> : null}</span>)}</span> : null}</button>
        })}</div>
      </section>
      <div className="calendar-side-column">
        <aside className="calendar-day-panel">
          <header><div><p className="eyebrow">{tx('Agenda del día')}</p><h2>{formatCalendarDay(new Date(`${selectedDate}T12:00:00`))}</h2></div><button type="button" className="btn btn-primary primary-action" onClick={createEvent}><Plus size={18} />{tx('Nuevo')}</button></header>
          <div className="calendar-day-events">{selectedEvents.length > 0 ? selectedEvents.map((event) => {
            const isPast = isCalendarEventPast(event, now)
            return <button key={event.id} type="button" disabled={event.source === 'native'} className={`calendar-day-event event-${event.color} kind-${event.type} ${nativeCalendarClass(event)} ${event.completed ? 'is-completed' : ''} ${event.source !== 'native' && isPast ? 'is-past' : ''}`} onClick={() => openEditor(event.id)}><span className="calendar-event-time">{formatCalendarEventTimeForDay(event, selectedDate)}</span><span><strong><CalendarEventTypeMark type={event.type} source={event.source} />{event.title || tx('Evento')}{event.recurrence !== 'none' ? <RotateCw className="calendar-recurrence-mark" size={12} /> : null}</strong><small>{event.source === 'native' ? event.notes : event.completed ? tx('Tarea completada') : isPast ? tx('Finalizado · {{time}}', { time: formatCalendarEventTime(event) }) : event.location || event.notes || (event.date !== event.endDate ? `${formatCalendarEventTime(event)}` : tx('Sin detalles'))}</small></span>{event.source !== 'native' ? <ChevronRight size={18} /> : null}</button>
          }) : <div className="calendar-day-empty"><CalendarDays size={27} /><strong>{tx('Este día está libre')}</strong><span>{tx('Añade una cita o recordatorio.')}</span><button type="button" onClick={createEvent}><Plus size={17} />{tx('Crear evento')}</button></div>}</div>
        </aside>
        <aside className="calendar-upcoming-panel">
          <header><div><p className="eyebrow">{tx('Tu agenda')}</p><h2>{tx('Próximos eventos')}</h2></div><CalendarDays size={21} /></header>
          <div className="calendar-upcoming-list">{upcomingEvents.length > 0 ? upcomingEvents.map((event, index) => {
            const eventMonthKey = event.date.slice(0, 7)
            const previousMonthKey = index === 0 ? currentMonthKey : upcomingEvents[index - 1].date.slice(0, 7)
            const showMonthSeparator = eventMonthKey !== previousMonthKey
            return <Fragment key={event.id}>{showMonthSeparator ? <div className="calendar-upcoming-month"><span>{formatCalendarMonth(new Date(`${eventMonthKey}-01T12:00:00`))}</span></div> : null}<button type="button" disabled={event.source === 'native'} className={`calendar-upcoming-event event-${event.color} kind-${event.type} ${nativeCalendarClass(event)} ${event.completed ? 'is-completed' : ''}`} onClick={() => openEditor(event.id)}><i /><span><strong><CalendarEventTypeMark type={event.type} source={event.source} />{event.title || tx('Evento')}{event.recurrence !== 'none' ? <RotateCw className="calendar-recurrence-mark" size={12} /> : null}</strong><small>{event.source === 'native' ? event.notes : event.completed ? tx('Completada · {{time}}', { time: formatCalendarEventTime(event, todayKey) }) : formatCalendarEventTime(event, todayKey)}</small></span>{event.source !== 'native' ? <ChevronRight size={17} /> : null}</button></Fragment>
          }) : <div className="calendar-upcoming-empty"><span>{tx('No hay próximos eventos.')}</span></div>}</div>
        </aside>
        <CalendarConnectionsPanel accounts={accounts} onConnected={onConnected} onSync={onSync} onDisconnect={onDisconnect} />
      </div>
    </div>}
    {editingEvent ? <CalendarEventEditor event={editingEvent} calendars={calendars} onUpdate={onUpdate} onSetDestination={onSetDestination} onDelete={() => { onDelete(editingEvent.id); closeEditor() }} onClose={closeEditor} /> : null}
  </div>
}

function CalendarEventEditor({ event, calendars, onUpdate, onSetDestination, onDelete, onClose }: { event: CalendarEvent; calendars: SyncedCalendar[]; onUpdate: (eventId: string, patch: CalendarEventPatch) => void; onSetDestination: (eventId: string, calendarId: string | null) => void; onDelete: () => void; onClose: () => void }) {
  const [remindersOpen, setRemindersOpen] = useState(false)
  const [startYear, startMonth, startDay] = event.date.split('-').map(Number)
  const [endYear, endMonth, endDay] = event.endDate.split('-').map(Number)
  const years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 1 + index)
  const months = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Intl.DateTimeFormat(activeLocale(), { month: 'long' }).format(new Date(2026, index, 1)) }))
  const times = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)
  const writableCalendars = calendars.filter((calendar) => !calendar.readOnly)
  const selectedCalendar = calendars.find((calendar) => calendar.provider === event.source && calendar.accountId === event.accountId && calendar.remoteId === event.calendarId)
  const canChangeDestination = event.source === 'local' || event.syncStatus === 'pending-create'
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
      <span className="calendar-boundary-label">{tx(isStart ? 'Empieza' : 'Termina')}</span>
      <div className={`calendar-boundary-fields ${event.allDay ? 'is-all-day' : ''}`}>
        <label><span>{tx('Día')}</span><select value={day} onChange={(change) => updateDate(year, month, Number(change.target.value))}>{days.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>{tx('Mes')}</span><select value={month} onChange={(change) => updateDate(year, Number(change.target.value), day)}>{months.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}</select></label>
        <label><span>{tx('Año')}</span><select value={year} onChange={(change) => updateDate(Number(change.target.value), month, day)}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        {!event.allDay ? <label><span>{tx('Hora')}</span><select value={time} onChange={(change) => isStart ? updateStartTime(change.target.value) : updateEndTime(change.target.value)}>{times.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
      </div>
    </div>
  }

  if (remindersOpen) return <CalendarRemindersEditor event={event} onUpdate={onUpdate} onClose={() => setRemindersOpen(false)} />

  return <div className="alarm-editor-backdrop calendar-editor-backdrop" role="dialog" aria-modal="true" aria-label={tx('Editar evento')}>
    <section className="alarm-editor calendar-event-editor">
      <header className="alarm-editor-header"><div><p className="eyebrow">{event.source === 'local' ? tx('Calendario local') : event.source === 'google' ? 'Google Calendar' : 'Outlook'}</p><h2>{tx('Configurar evento')}</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label={tx('Cerrar')}><X size={20} /></button></header>
      <label className="calendar-destination-field"><span>{tx('Guardar en')}</span><select value={event.source === 'local' ? 'local' : selectedCalendar?.id ?? 'local'} disabled={!canChangeDestination} onChange={(change) => onSetDestination(event.id, change.target.value === 'local' ? null : change.target.value)}><option value="local">{tx('Calendario local')}</option>{writableCalendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name} · {calendar.provider === 'google' ? 'Google' : 'Outlook'}</option>)}</select>{!canChangeDestination ? <small>{tx('Los eventos ya sincronizados conservan su calendario de origen.')}</small> : null}</label>
      <label className="calendar-title-field"><span>{tx('Título')}</span><input value={event.title} maxLength={80} onChange={(change) => onUpdate(event.id, { title: change.target.value })} /></label>
      <div className="calendar-type-field"><span>{tx('Tipo')}</span><div className="calendar-type-options">{CALENDAR_EVENT_TYPES.map((option) => <button key={option.value} type="button" className={`calendar-type-option kind-${option.value} ${event.type === option.value ? 'is-selected' : ''}`} aria-pressed={event.type === option.value} onClick={() => onUpdate(event.id, { type: option.value, completed: option.value === 'task' ? event.completed : false, recurrence: option.value === 'birthday' && event.recurrence === 'none' ? 'yearly' : event.recurrence })}><CalendarEventTypeMark type={option.value} size={17} />{tx(option.label as import('./i18n/translations').TranslationKey)}</button>)}</div></div>
      <div className="calendar-recurrence-field"><span>{tx('Repetición')}</span><div className="calendar-recurrence-options">{CALENDAR_RECURRENCES.map((option) => <button key={option.value} type="button" className={event.recurrence === option.value ? 'is-selected' : ''} aria-pressed={event.recurrence === option.value} onClick={() => onUpdate(event.id, { recurrence: option.value })}>{option.value !== 'none' ? <RotateCw size={14} /> : null}{tx(option.label as import('./i18n/translations').TranslationKey)}</button>)}</div></div>
      <div className={`calendar-event-switches ${event.type === 'task' ? 'has-task' : ''}`}>
        {event.type === 'task' ? <button type="button" className={`calendar-task-status ${event.completed ? 'is-completed' : ''}`} role="switch" aria-checked={event.completed} onClick={() => onUpdate(event.id, { completed: !event.completed })}><span><Check size={18} />{tx(event.completed ? 'Tarea completada' : 'Marcar como completada')}</span><span className={`toggle ${event.completed ? 'is-on' : ''}`}><span /></span></button> : null}
        <button type="button" className="calendar-all-day" role="switch" aria-checked={event.allDay} onClick={() => onUpdate(event.id, { allDay: !event.allDay })}><span><CalendarDays size={18} />{tx('Todo el día')}</span><span className={`toggle ${event.allDay ? 'is-on' : ''}`}><span /></span></button>
      </div>
      <div className="calendar-event-boundaries">{dateFields('start')}{dateFields('end')}</div>
      <div className="calendar-event-details">
        <label className="calendar-location-field"><span>{tx('Lugar')}</span><input value={event.location} maxLength={100} placeholder={tx('Añadir ubicación')} onChange={(change) => onUpdate(event.id, { location: change.target.value })} /></label>
        <label className="calendar-notes-field"><span>{tx('Notas')}</span><textarea value={event.notes} maxLength={500} placeholder={tx('Añadir detalles')} onChange={(change) => onUpdate(event.id, { notes: change.target.value })} /></label>
        <button type="button" className="calendar-reminders-summary" onClick={() => setRemindersOpen(true)}><span><BellRing size={18} /><span><strong>{tx('Recordatorios')}</strong><small>{event.reminders.length === 0 ? tx('Sin avisos') : tx(event.reminders.length === 1 ? '{{count}} aviso configurado' : '{{count}} avisos configurados', { count: event.reminders.length })}</small></span></span><ChevronRight size={18} /></button>
        <div className="calendar-color-field"><span>{tx('Color')}</span><div>{(['blue', 'mint', 'coral', 'sun'] as CalendarEventColor[]).map((color) => <button key={color} type="button" className={`calendar-color event-${color} ${event.color === color ? 'is-selected' : ''}`} onClick={() => onUpdate(event.id, { color })} aria-label={tx('Usar color {{color}}', { color })} />)}</div></div>
      </div>
      <footer className="alarm-editor-footer"><button type="button" className="text-action danger alarm-delete" onClick={onDelete}><Trash2 size={16} />{tx('Eliminar')}</button><button type="button" className="alarm-done" onClick={onClose}>{tx('Hecho')}</button></footer>
    </section>
  </div>
}

function CalendarRemindersEditor({ event, onUpdate, onClose }: { event: CalendarEvent; onUpdate: (eventId: string, patch: CalendarEventPatch) => void; onClose: () => void }) {
  const years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 1 + index)
  const months = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Intl.DateTimeFormat(activeLocale(), { month: 'long' }).format(new Date(2026, index, 1)) }))
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

  return <div className="alarm-editor-backdrop calendar-editor-backdrop" role="dialog" aria-modal="true" aria-label={tx('Recordatorios del evento')}>
    <section className="alarm-editor calendar-reminders-editor">
      <header className="alarm-editor-header"><div><p className="eyebrow">{event.title || tx('Evento')}</p><h2>{tx('Recordatorios')}</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label={tx('Volver al evento')}><X size={20} /></button></header>
      <p className="calendar-reminders-help">{tx('Puedes añadir todos los avisos que necesites y elegir la fecha y hora exactas.')}</p>
      <div className="calendar-reminder-presets"><button type="button" onClick={() => addReminder(offsetDateKey(event.date, -7))}><Plus size={16} />{tx('1 semana antes')}</button><button type="button" onClick={() => addReminder(offsetDateKey(event.date, -1))}><Plus size={16} />{tx('1 día antes')}</button><button type="button" onClick={() => addReminder(event.date, event.startTime, true)}><Plus size={16} />{tx('Personalizado')}</button></div>
      <div className="calendar-reminders-list">{sortedReminders.length > 0 ? sortedReminders.map((reminder) => {
        const [year, month, day] = reminder.date.split('-').map(Number)
        const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => index + 1)
        return <div key={reminder.id} className="calendar-reminder-row">
          <label><span>{tx('Día')}</span><select value={day} onChange={(change) => updateReminderDate(reminder, year, month, Number(change.target.value))}>{days.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>{tx('Mes')}</span><select value={month} onChange={(change) => updateReminderDate(reminder, year, Number(change.target.value), day)}>{months.map((value) => <option key={value.value} value={value.value}>{value.label}</option>)}</select></label>
          <label><span>{tx('Año')}</span><select value={year} onChange={(change) => updateReminderDate(reminder, Number(change.target.value), month, day)}>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>{tx('Hora')}</span><select value={reminder.time} onChange={(change) => updateReminder(reminder.id, { time: change.target.value })}>{times.map((value) => <option key={value}>{value}</option>)}</select></label>
          <button type="button" className="calendar-reminder-delete" onClick={() => removeReminder(reminder.id)} aria-label={tx('Eliminar recordatorio')}><Trash2 size={17} /></button>
        </div>
      }) : <div className="calendar-reminders-empty"><BellRing size={27} /><strong>{tx('Sin recordatorios')}</strong><span>{tx('Añade uno con los botones superiores.')}</span></div>}</div>
      <footer className="alarm-editor-footer"><span className="calendar-reminder-count">{tx(event.reminders.length === 1 ? '{{count}} recordatorio' : '{{count}} recordatorios', { count: event.reminders.length })}</span><button type="button" className="alarm-done" onClick={onClose}>{tx('Hecho')}</button></footer>
    </section>
  </div>
}

function formatWeatherHour(value: string) {
  return value.includes('T') ? value.slice(value.indexOf('T') + 1, value.indexOf('T') + 6) : value
}

function formatWeatherDay(value: string, short = false) {
  return new Intl.DateTimeFormat(activeLocale(), { weekday: short ? 'short' : 'long' }).format(new Date(`${value}T12:00:00`)).replace('.', '')
}

function WeatherIcon({ code, size }: { code: number; size: number }) {
  if (code === 0) return <SunMedium size={size} strokeWidth={1.55} />
  if (code === 1 || code === 2) return <CloudSun size={size} strokeWidth={1.55} />
  if (code === 3 || code === 45 || code === 48) return <Cloud size={size} strokeWidth={1.55} />
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <Snowflake size={size} strokeWidth={1.55} />
  if (code >= 95) return <CloudLightning size={size} strokeWidth={1.55} />
  return <CloudRain size={size} strokeWidth={1.55} />
}

function WeatherPage({ locations, homeLocationId, selectedLocationId, forecasts, loading, errors, onAddLocation, onRemoveLocation, onSetHomeLocation, onSelectLocation, onRefresh, onEditingChange }: {
  locations: WeatherLocation[]
  homeLocationId: string | null
  selectedLocationId: string | null
  forecasts: Record<string, WeatherForecast>
  loading: Record<string, boolean>
  errors: Record<string, string>
  onAddLocation: (location: WeatherLocation) => void
  onRemoveLocation: (locationId: string) => void
  onSetHomeLocation: (locationId: string) => void
  onSelectLocation: (locationId: string) => void
  onRefresh: (location: WeatherLocation) => void
  onEditingChange: (isEditing: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WeatherLocation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? locations.find((location) => location.id === homeLocationId) ?? locations[0] ?? null
  const forecast = selectedLocation ? forecasts[selectedLocation.id] : null
  const isLoading = selectedLocation ? Boolean(loading[selectedLocation.id]) : false
  const forecastError = selectedLocation ? errors[selectedLocation.id] : ''

  useEffect(() => {
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 2) return
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsSearching(true)
      setSearchError('')
      try {
        setResults(await searchWeatherLocations(normalizedQuery, controller.signal))
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setSearchError(error instanceof Error ? error.message : tx('No se pudo buscar la ubicación.'))
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [query])

  const addLocation = (location: WeatherLocation) => {
    onAddLocation(location)
    setQuery('')
    setResults([])
    onEditingChange(false)
  }

  return (
    <div className="fullscreen-page weather-page page-enter">
      <PageHeader pageLabel="Tiempo" />
      <section className="weather-location-manager" data-swipe-block>
        <div className="weather-location-toolbar">
          {locations.length > 3 && selectedLocation ? <div className="weather-location-selector">
            <MapPin size={16} />
            <select value={selectedLocation.id} onChange={(event) => onSelectLocation(event.target.value)} aria-label={tx('Elegir ubicación guardada')}>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.id === homeLocationId ? ` · ${tx('Casa')}` : ''}</option>)}
            </select>
            {selectedLocation.id !== homeLocationId ? <button type="button" className="weather-selector-action" onClick={() => onSetHomeLocation(selectedLocation.id)} aria-label={tx('Establecer {{name}} como Casa', { name: selectedLocation.name })} title={tx('Establecer como Casa')}><Star size={15} /></button> : <span className="weather-home-badge"><Home size={12} />{tx('Casa')}</span>}
            <button type="button" className="weather-selector-action is-danger" onClick={() => onRemoveLocation(selectedLocation.id)} aria-label={tx('Eliminar {{name}}', { name: selectedLocation.name })} title={tx('Eliminar ubicación')}><X size={15} /></button>
          </div> : <div className="weather-saved-locations">
            {locations.map((location) => <div key={location.id} className={`weather-location-chip ${selectedLocation?.id === location.id ? 'is-active' : ''}`}>
              <button type="button" onClick={() => onSelectLocation(location.id)}><MapPin size={14} /><span>{location.name}</span>{location.id === homeLocationId ? <small><Home size={11} />{tx('Casa')}</small> : null}</button>
              {location.id !== homeLocationId ? <button type="button" className="weather-chip-action" onClick={() => onSetHomeLocation(location.id)} aria-label={tx('Establecer {{name}} como Casa', { name: location.name })} title={tx('Establecer como Casa')}><Star size={14} /></button> : null}
              <button type="button" className="weather-chip-action is-danger" onClick={() => onRemoveLocation(location.id)} aria-label={tx('Eliminar {{name}}', { name: location.name })} title={tx('Eliminar ubicación')}><X size={14} /></button>
            </div>)}
          </div>}
          <div className="weather-location-search">
            <Search size={17} />
            <input value={query} maxLength={100} placeholder={tx('Añadir ciudad o código postal')} aria-label={tx('Buscar una ubicación')} onFocus={() => onEditingChange(true)} onBlur={() => onEditingChange(false)} onChange={(event) => { const value = event.target.value; setQuery(value); if (value.trim().length < 2) { setResults([]); setSearchError(''); setIsSearching(false) } }} />
            {isSearching ? <RefreshCw className="is-spinning" size={16} /> : null}
          </div>
        </div>
        {query.trim().length >= 2 ? <div className="weather-search-results">
          {searchError ? <p className="weather-inline-error">{searchError}</p> : null}
          {!isSearching && !searchError && results.length === 0 ? <p>{tx('No hay coincidencias.')}</p> : null}
          {results.map((location) => <button key={location.id} type="button" onClick={() => addLocation(location)}><MapPin size={16} /><span><strong>{location.name}</strong><small>{[location.region, location.country].filter(Boolean).join(', ')}</small></span><Plus size={17} /></button>)}
        </div> : null}
      </section>

      {!selectedLocation ? <section className="weather-empty-state"><div className="weather-icon"><MapPin size={42} /></div><h2>{tx('Añade tu primera ubicación')}</h2><p>{tx('Busca una ciudad arriba. La primera se guardará automáticamente como Casa.')}</p></section> : null}
      {selectedLocation && !forecast ? <section className="weather-empty-state"><div className="weather-icon"><RefreshCw className={isLoading ? 'is-spinning' : ''} size={42} /></div><h2>{isLoading ? tx('Consultando el tiempo en {{name}}', { name: selectedLocation.name }) : tx('No se pudo cargar la previsión')}</h2><p>{forecastError || tx('Comprueba la conexión y vuelve a intentarlo.')}</p>{!isLoading ? <button type="button" onClick={() => onRefresh(selectedLocation)}><RefreshCw size={17} />{tx('Reintentar')}</button> : null}</section> : null}
      {selectedLocation && forecast ? <div className="weather-layout">
        <section className="weather-current-panel">
          <div className="weather-page-heading">
            <span>{selectedLocation.id === homeLocationId ? <Home size={16} /> : <MapPin size={16} />}{selectedLocation.name}</span>
            <button type="button" className="weather-refresh" disabled={isLoading} onClick={() => onRefresh(selectedLocation)}><RefreshCw className={isLoading ? 'is-spinning' : ''} size={15} />{tx(isLoading ? 'Actualizando' : 'Actualizar')}</button>
          </div>
          {forecastError ? <p className="weather-inline-error">{forecastError} {tx('Mostrando la última previsión guardada.')}</p> : null}
          <div className="weather-current-main">
            <div className="weather-current-icon"><WeatherIcon code={forecast.current.weatherCode} size={72} /></div>
            <div><strong>{Math.round(forecast.current.temperature)}°</strong><p>{weatherDescription(forecast.current.weatherCode)}</p><span>{tx('Sensación térmica de {{temperature}}°', { temperature: Math.round(forecast.current.apparentTemperature) })}</span></div>
          </div>
          <div className="weather-stats">
            <div><Droplets size={19} /><span>{tx('Humedad')}<strong>{Math.round(forecast.current.humidity)}%</strong></span></div>
            <div><Wind size={19} /><span>{tx('Viento')}<strong>{Math.round(forecast.current.windSpeed)} km/h</strong></span></div>
            <div><Sunrise size={19} /><span>{tx('Amanecer')}<strong>{formatWeatherHour(forecast.daily[0]?.sunrise ?? '')}</strong></span></div>
            <div><Sunset size={19} /><span>{tx('Anochecer')}<strong>{formatWeatherHour(forecast.daily[0]?.sunset ?? '')}</strong></span></div>
          </div>
          <div className="hourly-forecast" aria-label={tx('Previsión por horas')}>
            {forecast.hourly.slice(0, 6).map((hour, index) => <div key={hour.time}><span>{index === 0 ? tx('Ahora') : formatWeatherHour(hour.time)}</span><WeatherIcon code={hour.weatherCode} size={25} /><strong>{Math.round(hour.temperature)}°</strong><small>{tx('{{value}}% lluvia', { value: Math.round(hour.precipitationProbability) })}</small></div>)}
          </div>
        </section>
        <section className="weather-forecast-panel">
          <div className="forecast-heading"><span>{tx('Próximos días')}</span><small>{tx('Máx. / mín.')}</small></div>
          <div className="daily-forecast">
            {forecast.daily.map((day, index) => <div key={day.date} className="daily-forecast-row"><span className="daily-icon"><WeatherIcon code={day.weatherCode} size={25} /></span><span className="daily-copy"><strong>{index === 0 ? tx('Hoy') : formatWeatherDay(day.date)}</strong><small>{weatherDescription(day.weatherCode)} · {tx('{{value}}% lluvia', { value: Math.round(day.precipitationProbability) })}</small></span><strong>{Math.round(day.temperatureMax)}° / {Math.round(day.temperatureMin)}°</strong></div>)}
          </div>
          <p className="weather-source-note">{tx('Datos meteorológicos de Open‑Meteo · Actualizado a las {{time}}', { time: new Intl.DateTimeFormat(activeLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(forecast.fetchedAt)) })}</p>
        </section>
      </div> : null}
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
        <section className="focus-clock" aria-label={tx('Reloj a pantalla completa')}>
          <span className="focus-clock-kicker">{tx('Ahora')}</span>
          <time>{time}</time>
          <p>{date}</p>
        </section>
        <div className="clock-management">
          <section className="alarm-panel" aria-labelledby="alarms-title">
            <div className="alarm-panel-heading"><div><p className="eyebrow">{tx('Programación semanal')}</p><h1 id="alarms-title">{tx('Alarmas')}</h1></div><button type="button" className="text-action is-active" onClick={createAndEditAlarm}><Plus size={16} />{tx('Nueva alarma')}</button></div>
            {alarms.length > 0 ? <div className="alarm-list">{[...alarms].sort((a, b) => a.time.localeCompare(b.time)).map((alarm) => <div key={alarm.id} className={`alarm-row ${alarm.enabled ? '' : 'is-disabled'}`}><button type="button" className="alarm-summary" onClick={() => setEditingAlarmId(alarm.id)} aria-label={tx('Configurar {{name}}', { name: alarm.label })}><strong>{alarm.time}</strong><span><b>{alarm.label || tx('Alarma')}</b><small>{formatAlarmWeekdays(alarm.weekdays)} · {alarm.soundName}</small></span><ChevronRight size={17} /></button><button type="button" className={`alarm-toggle ${alarm.enabled ? 'is-on' : ''}`} role="switch" aria-label={tx('Activar {{name}}', { name: alarm.label })} aria-checked={alarm.enabled} onClick={() => onUpdateAlarm(alarm.id, { enabled: !alarm.enabled })}><span /></button></div>)}</div> : <div className="alarm-empty"><AlarmClock size={22} /><span>{tx('No hay alarmas configuradas.')}</span></div>}
          </section>
          <section className="timer-panel" aria-labelledby="timers-title">
            <div className="utility-heading"><div className="utility-tabs" role="tablist"><button type="button" role="tab" aria-selected={utilityMode === 'timers'} className={utilityMode === 'timers' ? 'is-active' : ''} onClick={() => setUtilityMode('timers')}>{tx('Temporizadores')}</button><button type="button" role="tab" aria-selected={utilityMode === 'stopwatch'} className={utilityMode === 'stopwatch' ? 'is-active' : ''} onClick={() => setUtilityMode('stopwatch')}>{tx('Cronómetro')}</button></div>{utilityMode === 'timers' ? <button type="button" className="text-action is-active" onClick={createAndEditTimer}><Plus size={16} />{tx('Nuevo')}</button> : null}</div>
            {utilityMode === 'timers' ? (timers.length > 0 ? <div className="timer-list">{timers.map((timer) => {
              const remaining = timerRemainingSeconds(timer, now)
              const running = Boolean(timer.endsAt)
              return <div key={timer.id} className="timer-row"><button type="button" className="timer-summary" onClick={() => setEditingTimerId(timer.id)}><span>{timer.label}</span><strong>{formatCountdown(remaining)}</strong></button><button type="button" className="text-action" onClick={() => { const next = running ? pauseTimer(timer, now) : startTimer(timer, now); onUpdateTimer(timer.id, { remainingSeconds: next.remainingSeconds, endsAt: next.endsAt }) }}>{tx(running ? 'Pausar' : 'Iniciar')}</button><button type="button" className="text-action" onClick={() => { const next = resetTimer(timer); onUpdateTimer(timer.id, { remainingSeconds: next.remainingSeconds, endsAt: next.endsAt }) }}>{tx('Reiniciar')}</button><button type="button" className="text-action danger" onClick={() => onDeleteTimer(timer.id)} aria-label={tx('Eliminar {{name}}', { name: timer.label })}><Trash2 size={16} /></button></div>
            })}</div> : <div className="alarm-empty"><Clock3 size={22} /><span>{tx('No hay temporizadores activos.')}</span></div>) : <StopwatchPanel stopwatch={stopwatch} now={now} onToggle={onToggleStopwatch} onReset={onResetStopwatch} />}
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
  if (days.length === 7) return tx('Todos los días')
  if (days.length === 5 && [2, 3, 4, 5, 6].every((day) => days.includes(day as AlarmWeekday))) return tx('Entre semana')
  if (days.length === 2 && days.includes(1) && days.includes(7)) return tx('Fin de semana')
  return ALARM_WEEKDAYS.filter((day) => days.includes(day.value)).map((day) => tx(day.label as import('./i18n/translations').TranslationKey).slice(0, 1)).join(', ')
}

function AlarmTimeStepper({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [hour, minute] = value.split(':').map(Number)
  const change = (part: 'hour' | 'minute', delta: number) => {
    const nextHour = part === 'hour' ? (hour + delta + 24) % 24 : hour
    const nextMinute = part === 'minute' ? (minute + delta + 60) % 60 : minute
    onChange(`${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`)
  }
  return <div className="alarm-time-field"><span>{tx('Hora')}</span><div className="alarm-time-stepper"><div><button type="button" onClick={() => change('hour', 1)} aria-label={tx('Subir hora')}><Plus size={16} /></button><strong>{String(hour).padStart(2, '0')}</strong><small>{tx('hora')}</small><button type="button" onClick={() => change('hour', -1)} aria-label={tx('Bajar hora')}><Minus size={16} /></button></div><b>:</b><div><button type="button" onClick={() => change('minute', 1)} aria-label={tx('Subir minutos')}><Plus size={16} /></button><strong>{String(minute).padStart(2, '0')}</strong><small>{tx('min')}</small><button type="button" onClick={() => change('minute', -1)} aria-label={tx('Bajar minutos')}><Minus size={16} /></button></div></div></div>
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
      if (!playedNatively) onPreviewNotification(alarm.label || tx('Alarma'), tx('Sonido: {{name}}', { name: alarm.soundName }))
    } catch (error) {
      console.warn('No se pudo reproducir el sonido de alarma.', error)
    }
  }

  return <div className="alarm-editor-backdrop" role="presentation" data-swipe-block>
    <section className="alarm-editor" role="dialog" aria-modal="true" aria-labelledby="alarm-editor-title">
      <div className="alarm-editor-header"><div><p className="eyebrow">{tx('Configurar alarma')}</p><h2 id="alarm-editor-title">{alarm.label || tx('Alarma')}</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label={tx('Cerrar configuración')}><X size={21} /></button></div>
      <div className="alarm-editor-grid">
        <AlarmTimeStepper value={alarm.time} onChange={(time) => onUpdate(alarm.id, { time })} />
        <label className="alarm-name-field"><span>{tx('Nombre')}</span><input value={alarm.label} maxLength={60} onChange={(event) => onUpdate(alarm.id, { label: event.target.value })} /></label>
        <fieldset className="weekday-picker"><legend>{tx('Repetir')}</legend><div>{ALARM_WEEKDAYS.map((weekday) => <button key={weekday.value} type="button" className={alarm.weekdays.includes(weekday.value) ? 'is-selected' : ''} onClick={() => toggleWeekday(weekday.value)} aria-pressed={alarm.weekdays.includes(weekday.value)} aria-label={tx(weekday.label as import('./i18n/translations').TranslationKey)}>{tx(weekday.label as import('./i18n/translations').TranslationKey).slice(0, 1)}</button>)}</div></fieldset>
        <div className="alarm-sound-field"><label><span>{tx('Sonido')}</span><select value={alarm.soundUri ?? ''} onChange={(event) => { const sound = sounds.find((item) => item.uri === event.target.value) ?? DEFAULT_ALARM_SOUND; onUpdate(alarm.id, { soundName: sound.name, soundUri: sound.uri || null }) }}>{sounds.map((sound) => <option key={sound.uri || 'default'} value={sound.uri}>{sound.name === 'Sonido predeterminado' ? tx('Sonido predeterminado') : sound.name}</option>)}</select></label><button type="button" className="sound-preview" onClick={previewSound}><Volume2 size={18} />{tx('Probar')}</button></div>
      </div>
      <div className="alarm-editor-footer"><button type="button" className="text-action danger alarm-delete" onClick={onDelete}><Trash2 size={16} />{tx('Eliminar')}</button><label className="alarm-enabled"><span>{tx('Alarma activa')}</span><button type="button" className={`alarm-toggle ${alarm.enabled ? 'is-on' : ''}`} role="switch" aria-checked={alarm.enabled} onClick={() => onUpdate(alarm.id, { enabled: !alarm.enabled })}><span /></button></label><button type="button" className="alarm-done" onClick={onClose}>{tx('Hecho')}</button></div>
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
      <div className="alarm-editor-header"><div><p className="eyebrow">{tx('Configurar temporizador')}</p><h2 id="timer-editor-title">{timer.label}</h2></div><button type="button" className="editor-close" onClick={onClose} aria-label={tx('Cerrar configuración')}><X size={21} /></button></div>
      <label className="timer-name-field"><span>{tx('Nombre')}</span><input value={timer.label} maxLength={60} onChange={(event) => onUpdate(timer.id, { label: event.target.value })} /></label>
      <fieldset className="timer-presets"><legend>{tx('Duración rápida')}</legend><div>{[1, 5, 10, 15].map((minutes) => <button key={minutes} type="button" className={timer.durationSeconds === minutes * 60 ? 'is-selected' : ''} onClick={() => setMinutes(minutes)}>{minutes} {tx('min')}</button>)}</div></fieldset>
      <label className="custom-duration"><span>{tx('Otra duración')}</span><span><input type="number" inputMode="numeric" min="1" max="1440" value={Math.max(1, Math.round(timer.durationSeconds / 60))} onChange={(event) => setMinutes(Number(event.target.value))} /> {tx('minutos')}</span></label>
      <div className="alarm-editor-footer"><button type="button" className="text-action danger alarm-delete" onClick={onDelete}><Trash2 size={16} />{tx('Eliminar')}</button><button type="button" className="alarm-done" onClick={onClose}>{tx('Hecho')}</button></div>
    </section>
  </div>
}

function StopwatchPanel({ stopwatch, now, onToggle, onReset }: { stopwatch: StopwatchState; now: Date; onToggle: () => void; onReset: () => void }) {
  const elapsed = stopwatch.elapsedMilliseconds + (stopwatch.startedAt ? Math.max(0, now.getTime() - new Date(stopwatch.startedAt).getTime()) : 0)
  return <div className="stopwatch-panel"><Clock3 size={26} /><strong>{formatStopwatch(elapsed)}</strong><div><button type="button" className="text-action is-active" onClick={onToggle}>{stopwatch.startedAt ? <Pause size={16} /> : <Play size={16} />}{tx(stopwatch.startedAt ? 'Pausar' : 'Iniciar')}</button><button type="button" className="text-action" onClick={onReset}><RotateCcw size={16} />{tx('Reiniciar')}</button></div></div>
}

function RingingAlertOverlay({ alert, snoozeMinutes, onSnoozeMinutesChange, onSnooze, onStop }: { alert: RingingAlert; snoozeMinutes: number; onSnoozeMinutesChange: (minutes: number) => void; onSnooze: () => void; onStop: () => void }) {
  return <div className="ringing-alert-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="ringing-alert-title" data-swipe-block>
    <section className={`ringing-alert-card ${alert.kind === 'calendar' ? 'is-calendar-reminder' : ''}`}>
      <div className="ringing-bell">{alert.kind === 'calendar' ? <CalendarDays size={46} /> : <BellRing size={46} />}</div>
      <p className="eyebrow">{tx(alert.kind === 'alarm' ? 'Alarma' : alert.kind === 'timer' ? 'Temporizador' : 'Recordatorio del calendario')}</p>
      <h2 id="ringing-alert-title">{alert.title}</h2>
      <p>{alert.subtitle}</p>
      <div className="ringing-actions">{alert.kind !== 'timer' ? <div className="snooze-action"><select value={snoozeMinutes} onChange={(event) => onSnoozeMinutesChange(Number(event.target.value))} aria-label={tx('Minutos para volver a recordar')}>{[1, 5, 10, 15].map((minutes) => <option key={minutes} value={minutes}>{minutes} {tx('min')}</option>)}</select><button type="button" onClick={onSnooze}>{tx(alert.kind === 'calendar' ? 'Volver a recordar' : 'Posponer')}</button></div> : null}<button type="button" className="stop-ringing" onClick={onStop}>{tx(alert.kind === 'calendar' ? 'Aceptar' : 'Detener')}</button></div>
    </section>
  </div>
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
  onCreateNote: (type: NoteType) => string
  onUpdateNote: (noteId: string, patch: NotePatch) => void
  onArchiveNote: (noteId: string) => void
  onRestoreNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onPreviewNotification: (title: string, body: string) => void
  onEditingChange: (isEditing: boolean) => void
}) {
  const [showArchived, setShowArchived] = useState(false)
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false)
  const notesPageRef = useNotesKeyboardViewport()
  const visibleNotes = useMemo(
    () => notes.filter((note) => !note.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
    [notes],
  )
  const archivedNotes = useMemo(() => notes.filter((note) => note.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [notes])
  const notesForView = showArchived ? archivedNotes : visibleNotes
  const hashNoteId = window.location.hash.startsWith('#note=') ? window.location.hash.slice(6) : null
  const [selectedId, setSelectedId] = useState<string | null>(hashNoteId)
  const selectedNote = notesForView.find((note) => note.id === selectedId) ?? notesForView[0]

  const createAndSelect = (type: NoteType) => {
    const noteId = onCreateNote(type)
    setSelectedId(noteId)
    setIsCreateMenuOpen(false)
  }

  const createMenu = !showArchived && isCreateMenuOpen ? <div className="note-create-menu" role="group" aria-label={tx('Elegir formato de nota')}>
    <button type="button" onClick={() => createAndSelect('text')}><FileText size={18} /><span><strong>{tx('Texto')}</strong><small>{tx('Ideas y apuntes libres.')}</small></span></button>
    <button type="button" onClick={() => createAndSelect('drawing')}><Pencil size={18} /><span><strong>{tx('Dibujo')}</strong><small>{tx('Un lienzo para escribir o dibujar.')}</small></span></button>
    <button type="button" onClick={() => createAndSelect('list')}><ListTodo size={18} /><span><strong>{tx('Lista')}</strong><small>{tx('Elementos ordenables y marcables.')}</small></span></button>
  </div> : null

  return (
    <div ref={notesPageRef} className="fullscreen-page notes-page page-enter">
      <PageHeader pageLabel="Notas" />
      <section className="notes-workspace" aria-label={tx('Notas locales')}>
        <aside className="notes-sidebar">
          <div className="notes-sidebar-header"><div><h1>{tx(showArchived ? 'Archivo' : 'Mis notas')}</h1><p>{showArchived ? tx('{{count}} archivadas', { count: archivedNotes.length }) : tx('{{count}} guardadas en esta tablet', { count: visibleNotes.length })}</p></div>{!showArchived ? <button type="button" className="icon-button" onClick={() => setIsCreateMenuOpen((open) => !open)} aria-haspopup="true" aria-expanded={isCreateMenuOpen} aria-label={tx('Crear una nota')}><Plus size={20} /></button> : null}</div>
          {createMenu}
          <div className="note-filter" role="tablist" aria-label={tx('Filtrar notas')}><button type="button" className={!showArchived ? 'is-active' : ''} onClick={() => { setShowArchived(false); setSelectedId(null); setIsCreateMenuOpen(false) }} role="tab" aria-selected={!showArchived}>{tx('Activas')}</button><button type="button" className={showArchived ? 'is-active' : ''} onClick={() => { setShowArchived(true); setSelectedId(null); setIsCreateMenuOpen(false) }} role="tab" aria-selected={showArchived}>{tx('Archivo')}</button></div>
          <div className="note-list">
            {notesForView.map((note) => <button key={note.id} type="button" className={`note-list-item note-${note.color} ${selectedNote?.id === note.id ? 'is-selected' : ''}`} onClick={() => { setSelectedId(note.id); setIsCreateMenuOpen(false) }}><span className="note-list-color" /><span><strong>{note.title || tx('Sin título')}</strong><small>{note.type === 'drawing' ? tx(note.drawing.length ? 'Dibujo guardado' : 'Lienzo vacío') : note.type === 'list' ? tx('{{checked}}/{{count}} marcados', { checked: parseNoteList(note.content).filter((item) => item.checked).length, count: parseNoteList(note.content).length }) : (note.content || tx('Texto'))}</small></span><span className="note-list-meta">{note.type === 'drawing' ? <Pencil size={14} aria-label={tx('Dibujo')} /> : note.type === 'list' ? <ListTodo size={14} aria-label={tx('Lista')} /> : <FileText size={14} aria-label={tx('Texto')} />}{note.pinned ? <Pin size={14} /> : null}</span></button>)}
            {notesForView.length === 0 ? <div className="notes-empty"><FileText size={24} /><p>{tx(showArchived ? 'No hay notas archivadas.' : 'Aún no hay notas.')}</p>{!showArchived ? <button type="button" onClick={() => setIsCreateMenuOpen(true)}>{tx('Crear la primera')}</button> : null}</div> : null}
          </div>
        </aside>
        {selectedNote ? <NoteEditor key={selectedNote.id} note={selectedNote} readOnly={showArchived} onUpdate={onUpdateNote} onArchive={() => { onArchiveNote(selectedNote.id); setSelectedId(null) }} onRestore={() => { onRestoreNote(selectedNote.id); setShowArchived(false); setSelectedId(selectedNote.id) }} onDelete={() => { if (window.confirm(tx('¿Eliminar esta nota de forma permanente?'))) { onDeleteNote(selectedNote.id); setSelectedId(null) } }} onPreviewNotification={onPreviewNotification} onEditingChange={onEditingChange} /> : <div className="notes-editor-placeholder"><FileText size={32} /><h2>{tx(showArchived ? 'Archivo vacío' : 'Tu espacio de notas')}</h2><p>{tx(showArchived ? 'Las notas archivadas aparecerán aquí.' : 'Crea una nota para guardar ideas y recordatorios locales.')}</p>{!showArchived ? <button type="button" onClick={() => setIsCreateMenuOpen(true)}>{tx('Nueva nota')}</button> : null}</div>}
      </section>
    </div>
  )
}

function drawingPath(points: NoteDrawingPoint[]) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} l .01 .01`
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function NoteDrawingPreview({ drawing }: { drawing: NoteDrawingStroke[] }) {
  return <svg className="note-preview-drawing" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label={tx('Vista previa del dibujo')}>
    <rect width="1000" height="600" className="note-preview-drawing-paper" />
    {drawing.map((stroke, index) => <path key={`${index}-${stroke.points.length}`} d={drawingPath(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={Math.max(5, stroke.width)} strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>
}

function NoteDrawingCanvas({ drawing, readOnly, onChange, onEditingChange }: { drawing: NoteDrawingStroke[]; readOnly: boolean; onChange: (drawing: NoteDrawingStroke[]) => void; onEditingChange: (isEditing: boolean) => void }) {
  const [strokes, setStrokes] = useState(drawing)
  const [activeStroke, setActiveStroke] = useState<NoteDrawingStroke | null>(null)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [inkColor, setInkColor] = useState('#f4f7ff')
  const [inkWidth, setInkWidth] = useState(6)
  const strokesRef = useRef(strokes)
  const activeStrokeRef = useRef<NoteDrawingStroke | null>(null)
  const gestureRef = useRef<{ pointerId: number; tool: 'pen' | 'eraser' } | null>(null)

  const setWorkingStrokes = (next: NoteDrawingStroke[]) => {
    strokesRef.current = next
    setStrokes(next)
  }

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): NoteDrawingPoint => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1000, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 1000)),
      y: Math.min(600, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 600)),
    }
  }

  const eraseAt = (point: NoteDrawingPoint) => {
    const radius = 28
    setWorkingStrokes(strokesRef.current.filter((stroke) => !stroke.points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radius + stroke.width)))
  }

  const startDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointFromEvent(event)
    gestureRef.current = { pointerId: event.pointerId, tool }
    event.currentTarget.setPointerCapture(event.pointerId)
    onEditingChange(true)
    if (tool === 'eraser') {
      eraseAt(point)
      return
    }
    const next = { color: inkColor, width: inkWidth, points: [point] }
    activeStrokeRef.current = next
    setActiveStroke(next)
  }

  const continueDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointFromEvent(event)
    if (gesture.tool === 'eraser') {
      eraseAt(point)
      return
    }
    const current = activeStrokeRef.current
    if (!current) return
    const previous = current.points[current.points.length - 1]
    if (Math.hypot(previous.x - point.x, previous.y - point.y) < 2) return
    const next = { ...current, points: [...current.points, point] }
    activeStrokeRef.current = next
    setActiveStroke(next)
  }

  const finishDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    gestureRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (gesture.tool === 'pen' && activeStrokeRef.current) setWorkingStrokes([...strokesRef.current, activeStrokeRef.current])
    activeStrokeRef.current = null
    setActiveStroke(null)
    onChange(strokesRef.current)
    onEditingChange(false)
  }

  const commit = (next: NoteDrawingStroke[]) => {
    setWorkingStrokes(next)
    onChange(next)
  }

  return <div className="note-drawing-panel" data-swipe-block>
    <div className="note-drawing-toolbar">
      <div className="note-drawing-tools" aria-label={tx('Herramientas de dibujo')}>
        <button type="button" disabled={readOnly} className={tool === 'pen' ? 'is-active' : ''} onClick={() => setTool('pen')}><Pencil size={16} />{tx('Lápiz')}</button>
        <button type="button" disabled={readOnly} className={tool === 'eraser' ? 'is-active' : ''} onClick={() => setTool('eraser')}><Eraser size={16} />{tx('Borrador')}</button>
      </div>
      <div className="note-ink-colors" aria-label={tx('Color del lápiz')}>{['#f4f7ff', '#7fa2ff', '#ff9b80', '#7cdec2', '#f7c85e'].map((color) => <button key={color} type="button" disabled={readOnly} className={inkColor === color && tool === 'pen' ? 'is-active' : ''} style={{ '--ink-color': color } as CSSProperties} onClick={() => { setInkColor(color); setTool('pen') }} aria-label={tx('Color {{color}}', { color })} />)}</div>
      <label className="note-stroke-width">{tx('Grosor')}<select value={inkWidth} disabled={readOnly} onChange={(event) => { setInkWidth(Number(event.target.value)); setTool('pen') }}><option value="3">{tx('Fino')}</option><option value="6">{tx('Medio')}</option><option value="12">{tx('Grueso')}</option></select></label>
      <div className="note-drawing-history">
        <button type="button" disabled={readOnly || strokes.length === 0} onClick={() => commit(strokes.slice(0, -1))}><Undo2 size={16} />{tx('Deshacer')}</button>
        <button type="button" disabled={readOnly || strokes.length === 0} className="is-danger" onClick={() => commit([])}><Trash2 size={16} />{tx('Limpiar')}</button>
      </div>
    </div>
    <svg className={`note-drawing-canvas ${readOnly ? 'is-read-only' : ''}`} viewBox="0 0 1000 600" preserveAspectRatio="none" role="img" aria-label={tx('Lienzo de dibujo de la nota')} onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={finishDrawing} onPointerCancel={finishDrawing}>
      <rect width="1000" height="600" className="note-drawing-paper" />
      {[...strokes, ...(activeStroke ? [activeStroke] : [])].map((stroke, index) => <path key={`${index}-${stroke.points.length}`} d={drawingPath(stroke.points)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  </div>
}

type NoteListItem = { checked: boolean; text: string }

function parseNoteList(content: string): NoteListItem[] {
  if (!content.trim()) return []
  return content.split('\n').map((line) => {
    const match = line.match(/^- \[([ xX])\]\s?(.*)$/)
    return match ? { checked: match[1].toLowerCase() === 'x', text: match[2] } : { checked: false, text: line }
  })
}

function serializeNoteList(items: NoteListItem[]) {
  return items.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`).join('\n').slice(0, 2000)
}

function NoteTextEditor({ note, readOnly, onUpdate, onEditingChange }: { note: Note; readOnly: boolean; onUpdate: (noteId: string, patch: NotePatch) => void; onEditingChange: (isEditing: boolean) => void }) {
  return <div className="note-text-editor">
    <textarea value={note.content} maxLength={2000} readOnly={readOnly} onChange={(event) => onUpdate(note.id, { content: event.target.value })} onFocus={() => onEditingChange(true)} onBlur={() => onEditingChange(false)} placeholder={tx('Escribe una nota…')} aria-label={tx('Contenido de la nota')} />
  </div>
}

function NoteListEditor({ note, readOnly, onUpdate, onEditingChange }: { note: Note; readOnly: boolean; onUpdate: (noteId: string, patch: NotePatch) => void; onEditingChange: (isEditing: boolean) => void }) {
  const items = parseNoteList(note.content)
  const [showCompleted, setShowCompleted] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [itemKeys, setItemKeys] = useState(() => items.map(() => createLocalId()))
  const itemsRef = useRef(items)
  const draggedIndexRef = useRef<number | null>(null)
  const draggedKeyRef = useRef<string | null>(null)
  const dropTargetIndexRef = useRef<number | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)
  const dragStartYRef = useRef(0)
  const dragStartScrollTopRef = useRef(0)
  const rowElementsRef = useRef(new Map<string, HTMLDivElement>())
  const previousRowTopsRef = useRef(new Map<string, number>())
  useEffect(() => { itemsRef.current = items }, [items])
  useLayoutEffect(() => {
    const nextTops = new Map<string, number>()
    rowElementsRef.current.forEach((element, key) => {
      const nextTop = element.getBoundingClientRect().top
      const previousTop = previousRowTopsRef.current.get(key)
      nextTops.set(key, nextTop)
      const delta = previousTop === undefined ? 0 : previousTop - nextTop
      if (Math.abs(delta) > 1 && key !== draggedKeyRef.current && typeof element.animate === 'function') {
        element.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' })
      }
    })
    previousRowTopsRef.current = nextTops
  })
  const allEntries = items.map((item, index) => ({ item, index, key: itemKeys[index] ?? `${note.id}-${index}` }))
  const activeEntries = allEntries.filter(({ item }) => !item.checked)
  const completedEntries = allEntries.filter(({ item }) => item.checked)

  const saveItems = (nextItems: NoteListItem[]) => {
    itemsRef.current = nextItems
    onUpdate(note.id, { content: serializeNoteList(nextItems) })
  }
  const updateItem = (index: number, patch: Partial<NoteListItem>) => saveItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  const addItem = () => {
    const firstCompletedIndex = items.findIndex((item) => item.checked)
    const insertAt = firstCompletedIndex === -1 ? items.length : firstCompletedIndex
    setItemKeys((current) => [...current.slice(0, insertAt), createLocalId(), ...current.slice(insertAt)])
    saveItems([...items.slice(0, insertAt), { checked: false, text: '' }, ...items.slice(insertAt)])
  }
  const moveItem = (fromIndex: number, toIndex: number) => {
    const currentItems = itemsRef.current
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= currentItems.length) return
    const nextItems = [...currentItems]
    const [movedItem] = nextItems.splice(fromIndex, 1)
    nextItems.splice(toIndex, 0, movedItem)
    setItemKeys((current) => {
      const nextKeys = [...current]
      const [movedKey] = nextKeys.splice(fromIndex, 1)
      nextKeys.splice(toIndex, 0, movedKey)
      return nextKeys
    })
    saveItems(nextItems)
  }
  const moveWithinGroup = (entries: { item: NoteListItem; index: number; key: string }[], position: number, direction: -1 | 1) => {
    const target = entries[position + direction]
    if (target) moveItem(entries[position].index, target.index)
  }

  const startPointerReorder = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (readOnly) return
    event.preventDefault()
    event.stopPropagation()
    dragPointerIdRef.current = event.pointerId
    draggedIndexRef.current = index
    draggedKeyRef.current = itemKeys[index] ?? null
    dropTargetIndexRef.current = index
    dragStartYRef.current = event.clientY
    dragStartScrollTopRef.current = (event.currentTarget.closest('.note-list-scroll') as HTMLElement | null)?.scrollTop ?? 0
    setDragOffsetY(0)
    setDraggedIndex(index)
    setDropTargetIndex(index)
    if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId)
    onEditingChange(true)
  }

  const continuePointerReorder = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current !== event.pointerId || draggedIndexRef.current === null) return
    event.preventDefault()
    event.stopPropagation()
    const scroller = event.currentTarget.closest('.note-list-scroll') as HTMLElement | null
    if (scroller) {
      const bounds = scroller.getBoundingClientRect()
      if (event.clientY < bounds.top + 44) scroller.scrollTop -= 18
      else if (event.clientY > bounds.bottom - 44) scroller.scrollTop += 18
    }
    const nextDragOffset = event.clientY - dragStartYRef.current + ((scroller?.scrollTop ?? 0) - dragStartScrollTopRef.current)
    setDragOffsetY(nextDragOffset)
    const fromIndex = draggedIndexRef.current
    const currentItems = itemsRef.current
    const rows = scroller ? Array.from(scroller.querySelectorAll<HTMLElement>('[data-note-list-index]')) : []
    const rowBounds = new Map(rows.map((row) => [row, row.getBoundingClientRect()]))
    const draggedRow = rows.find((row) => Number(row.dataset.noteListIndex) === fromIndex)
    const groupRows = rows.filter((row) => {
      const rowIndex = Number(row.dataset.noteListIndex)
      return Number.isInteger(rowIndex) && currentItems[rowIndex]?.checked === currentItems[fromIndex]?.checked
    })
    const groupPosition = groupRows.indexOf(draggedRow!)
    const draggedBounds = draggedRow ? rowBounds.get(draggedRow) : undefined
    const projectedCenter = draggedBounds ? draggedBounds.top - dragOffsetY + nextDragOffset + draggedBounds.height / 2 : 0
    const hasMeasuredRows = rows.some((row) => (rowBounds.get(row)?.height ?? 0) > 0)
    let targetIndex = fromIndex
    if (hasMeasuredRows && groupPosition >= 0) {
      if (projectedCenter < (draggedBounds?.top ?? 0) + (draggedBounds?.height ?? 0) / 2) {
        for (let position = 0; position < groupPosition; position += 1) {
          const row = groupRows[position]
          const bounds = rowBounds.get(row)
          if (bounds && projectedCenter <= bounds.top + bounds.height / 2 - 4) {
            targetIndex = Number(row.dataset.noteListIndex)
            break
          }
        }
      } else {
        for (let position = groupPosition + 1; position < groupRows.length; position += 1) {
          const row = groupRows[position]
          const bounds = rowBounds.get(row)
          if (!bounds || projectedCenter < bounds.top + bounds.height / 2 + 4) break
          targetIndex = Number(row.dataset.noteListIndex)
        }
      }
    } else {
      const fallbackRow = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-note-list-index]')
      const fallbackIndex = Number(fallbackRow?.dataset.noteListIndex)
      if (Number.isInteger(fallbackIndex) && currentItems[fallbackIndex]?.checked === currentItems[fromIndex]?.checked) targetIndex = fallbackIndex
    }
    dropTargetIndexRef.current = targetIndex
    setDropTargetIndex(targetIndex)
  }

  const finishPointerReorder = (event: ReactPointerEvent<HTMLButtonElement>, commit: boolean) => {
    if (dragPointerIdRef.current !== event.pointerId) return
    if (typeof event.currentTarget.hasPointerCapture === 'function' && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const fromIndex = draggedIndexRef.current
    const targetIndex = dropTargetIndexRef.current
    dragPointerIdRef.current = null
    draggedIndexRef.current = null
    draggedKeyRef.current = null
    dropTargetIndexRef.current = null
    if (commit && fromIndex !== null && targetIndex !== null && fromIndex !== targetIndex) moveItem(fromIndex, targetIndex)
    setDragOffsetY(0)
    setDraggedIndex(null)
    setDropTargetIndex(null)
    onEditingChange(false)
  }

  const removeItem = (index: number) => {
    setItemKeys((current) => current.filter((_, itemIndex) => itemIndex !== index))
    saveItems(items.filter((_, itemIndex) => itemIndex !== index))
  }

  const renderItem = ({ item, index, key }: { item: NoteListItem; index: number; key: string }, position: number, entries: { item: NoteListItem; index: number; key: string }[]) => {
    const dropPosition = draggedIndex !== null && dropTargetIndex !== null && dropTargetIndex !== draggedIndex && index === dropTargetIndex
      ? dropTargetIndex < draggedIndex ? 'is-drop-before' : 'is-drop-after'
      : ''
    return <div ref={(element) => { if (element) rowElementsRef.current.set(key, element); else rowElementsRef.current.delete(key) }} className={`note-list-row ${item.checked ? 'is-completed' : ''} ${draggedIndex === index ? 'is-dragging' : ''} ${dropPosition}`} key={key} data-note-list-index={index} style={draggedIndex === index ? { '--note-drag-y': `${dragOffsetY}px` } as CSSProperties : undefined}>
    {dropPosition ? <span className="note-list-drop-indicator" aria-hidden="true"><span>{tx('Soltar aquí')}</span></span> : null}
    <button type="button" className="note-list-reorder" disabled={readOnly} aria-label={tx('Mover elemento {{position}}', { position: position + 1 })} aria-pressed={draggedIndex === index} onPointerDown={(event) => startPointerReorder(event, index)} onPointerMove={continuePointerReorder} onPointerUp={(event) => finishPointerReorder(event, true)} onPointerCancel={(event) => finishPointerReorder(event, false)} onKeyDown={(event) => { if (event.key === 'ArrowUp') { event.preventDefault(); moveWithinGroup(entries, position, -1) } else if (event.key === 'ArrowDown') { event.preventDefault(); moveWithinGroup(entries, position, 1) } }}><GripVertical size={19} aria-hidden="true" /></button>
    <input type="checkbox" checked={item.checked} disabled={readOnly} aria-label={tx(item.checked ? 'Desmarcar elemento {{position}}' : 'Marcar elemento {{position}}', { position: position + 1 })} onChange={(event) => updateItem(index, { checked: event.target.checked })} />
    <input type="text" value={item.text} maxLength={300} readOnly={readOnly} aria-label={tx('Elemento de lista {{position}}', { position: position + 1 })} placeholder={tx('Elemento de lista')} onChange={(event) => updateItem(index, { text: event.target.value })} onFocus={() => onEditingChange(true)} onBlur={() => onEditingChange(false)} />
    {!readOnly ? <button type="button" className="note-list-remove" aria-label={tx('Eliminar elemento {{position}}', { position: position + 1 })} onClick={() => removeItem(index)}><X size={17} /></button> : null}
  </div>
  }

  return <div className="note-list-editor">
    <div className="note-list-scroll" aria-label={tx('Elementos de la lista')}>
      <div className="note-list-active">{activeEntries.map((entry, position) => renderItem(entry, position, activeEntries))}</div>
      {!readOnly ? <button type="button" className="note-list-add" onClick={addItem}><Plus size={19} />{tx('Añadir elemento')}</button> : null}
      {completedEntries.length > 0 ? <div className="note-list-completed">
        <button type="button" className="note-list-completed-toggle" aria-expanded={showCompleted} onClick={() => setShowCompleted((visible) => !visible)}>{showCompleted ? <ChevronUp size={18} /> : <ChevronDown size={18} />}<span>{tx(completedEntries.length === 1 ? '{{count}} elemento marcado' : '{{count}} elementos marcados', { count: completedEntries.length })}</span></button>
        {showCompleted ? <div>{completedEntries.map((entry, position) => renderItem(entry, position, completedEntries))}</div> : null}
      </div> : null}
    </div>
  </div>
}

function NoteEditor({ note, readOnly, onUpdate, onArchive, onRestore, onDelete, onPreviewNotification, onEditingChange }: { note: Note; readOnly: boolean; onUpdate: (noteId: string, patch: NotePatch) => void; onArchive: () => void; onRestore: () => void; onDelete: () => void; onPreviewNotification: (title: string, body: string) => void; onEditingChange: (isEditing: boolean) => void }) {
  const colors: NoteColor[] = ['coral', 'violet', 'mint', 'sun']
  const isDrawing = note.type === 'drawing'
  const isList = note.type === 'list'
  const listItems = isList ? parseNoteList(note.content) : []
  const notificationBody = isDrawing
    ? tx(note.drawing.length ? 'Tienes un dibujo guardado en esta nota.' : 'Tienes un lienzo de dibujo pendiente.')
    : isList
      ? (listItems.find((item) => !item.checked)?.text || tx('Tienes una lista guardada en Pablo Tablet.'))
      : (note.content || tx('Tienes un recordatorio en Pablo Tablet.'))

  return (
    <div className={`note-editor note-editor-${note.type}`}>
      <div className="note-editor-actions">
        <div className="note-colors" aria-label={tx('Color de la nota')}>{colors.map((color) => <button key={color} type="button" disabled={readOnly} className={`color-dot ${color} ${note.color === color ? 'is-active' : ''}`} onClick={() => onUpdate(note.id, { color })} aria-label={tx('Usar color {{color}}', { color })} />)}</div>
        {!readOnly ? <button type="button" className={`text-action ${note.pinned ? 'is-active' : ''}`} onClick={() => onUpdate(note.id, { pinned: !note.pinned })}><Pin size={16} />{tx(note.pinned ? 'Fijada' : 'Fijar')}</button> : null}
        <div className="editor-destructive-actions">{readOnly ? <button type="button" className="text-action" onClick={onRestore}><RotateCcw size={16} />{tx('Restaurar')}</button> : <button type="button" className="text-action" onClick={onArchive}><Archive size={16} />{tx('Archivar')}</button>}<button type="button" className="text-action danger" onClick={onDelete} aria-label={tx('Eliminar nota')}><Trash2 size={16} /></button></div>
      </div>
      <div className="note-editor-heading">
        <input className="note-title-input" value={note.title} maxLength={80} readOnly={readOnly} onChange={(event) => onUpdate(note.id, { title: event.target.value })} onFocus={() => onEditingChange(true)} onBlur={() => onEditingChange(false)} placeholder={tx('Título de la nota')} aria-label={tx('Título de la nota')} />
        <span className={`note-format-badge is-${note.type}`}>{isDrawing ? <Pencil size={15} /> : isList ? <ListTodo size={15} /> : <FileText size={15} />}{tx(isDrawing ? 'Dibujo' : isList ? 'Lista' : 'Texto')}</span>
      </div>
      <div className={`note-editor-body is-${note.type}`}>
        {isDrawing
          ? <NoteDrawingCanvas drawing={note.drawing} readOnly={readOnly} onChange={(drawing) => onUpdate(note.id, { drawing })} onEditingChange={onEditingChange} />
          : isList
            ? <NoteListEditor key={note.id} note={note} readOnly={readOnly} onUpdate={onUpdate} onEditingChange={onEditingChange} />
            : <NoteTextEditor note={note} readOnly={readOnly} onUpdate={onUpdate} onEditingChange={onEditingChange} />}
      </div>
      <div className="note-editor-footer">{readOnly ? <span>{tx('Nota archivada')}</span> : <span className="reminder-controls"><label>{tx('Recordatorio')}<input type="datetime-local" value={note.reminderAt ?? ''} onChange={(event) => onUpdate(note.id, { reminderAt: event.target.value || null })} /></label><button type="button" className="text-action" onClick={() => onPreviewNotification(note.title || tx('Recordatorio'), notificationBody)}><BellRing size={15} />{tx('Probar aviso')}</button></span>}<span>{isDrawing ? tx('{{count}} trazos · Dibujo local', { count: note.drawing.length }) : isList ? tx('{{checked}}/{{count}} marcados · Guardado local', { checked: listItems.filter((item) => item.checked).length, count: listItems.length }) : tx('{{count}}/2000 · Guardado local', { count: note.content.length })}</span></div>
    </div>
  )
}

export default App
