import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import {
  AlarmClock,
  Archive,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Cloud,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  FileText,
  Home,
  LockKeyhole,
  MapPin,
  Maximize,
  Menu,
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
  type Note,
  type NoteColor,
  type Timer,
  type DashboardPreferences,
} from './dashboardState'
import { syncAlarmNotifications, syncReminderNotifications } from './reminderNotifications'
import { placeWidgets, type DashboardOrientation, type PlacedWidget } from './widgetLayout'
import './App.css'

type Screen = 'home' | 'settings'
type SimulatedAlert = { title: string; body: string }

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
  const pointerStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const suppressClick = useRef(false)
  const deliveredSimulationIds = useRef(new Set<string>())

  const enabledPages = useMemo(
    () => DASHBOARD_PAGES.filter((page) => dashboardState.preferences.enabledPageIds.includes(page.id)),
    [dashboardState.preferences.enabledPageIds],
  )
  const activePageIndex = Math.max(0, enabledPages.findIndex((page) => page.id === activePageId))
  const activePage = enabledPages[activePageIndex] ?? enabledPages[0]
  const time = timeFormatter.format(now)
  const date = weekdayFormatter.format(now)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    saveDashboardState(dashboardState)
  }, [dashboardState])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncReminderNotifications(dashboardState.notes), 600)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.notes])

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncAlarmNotifications(dashboardState.alarms), 600)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.alarms])

  const registerInteraction = useCallback(() => {
    setInteractionVersion((version) => version + 1)
  }, [])

  const showSimulatedAlert = useCallback((title: string, body: string) => {
    setSimulatedAlert({ title, body })
  }, [])

  useEffect(() => {
    const finished = dashboardState.timers.filter((timer) => timer.endsAt && new Date(timer.endsAt).getTime() <= now.getTime())
    if (finished.length === 0) return
    const timeout = window.setTimeout(() => {
      setDashboardState((current) => ({ ...current, timers: current.timers.map((timer) => finished.some((item) => item.id === timer.id) ? { ...timer, remainingSeconds: 0, endsAt: null } : timer) }))
      const timer = finished[0]
      showSimulatedAlert(timer.label || 'Temporizador', 'El temporizador ha terminado.')
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [dashboardState.timers, now, showSimulatedAlert])

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    const cutoff = now.getTime() - 35_000
    const dueNote = dashboardState.notes.find((note) => !note.archived && note.reminderAt && new Date(note.reminderAt).getTime() <= now.getTime() && new Date(note.reminderAt).getTime() > cutoff && !deliveredSimulationIds.current.has(`note:${note.id}:${note.reminderAt}`))
    if (dueNote) {
      deliveredSimulationIds.current.add(`note:${dueNote.id}:${dueNote.reminderAt}`)
      showSimulatedAlert(dueNote.title || 'Recordatorio', dueNote.content || 'Tienes un recordatorio en Pablo Tablet.')
      return
    }
    const currentTime = timeFormatter.format(now)
    const dueAlarm = dashboardState.alarms.find((alarm) => alarm.enabled && alarm.time === currentTime && !deliveredSimulationIds.current.has(`alarm:${alarm.id}:${now.toDateString()}`))
    if (dueAlarm) {
      deliveredSimulationIds.current.add(`alarm:${dueAlarm.id}:${now.toDateString()}`)
      showSimulatedAlert(dueAlarm.label || 'Alarma', `Alarma programada para las ${dueAlarm.time}.`)
    }
  }, [dashboardState.alarms, dashboardState.notes, now, showSimulatedAlert])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let removeListener: (() => void) | undefined

    void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
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
    }).then((listener) => { removeListener = () => listener.remove() })

    return () => removeListener?.()
  }, [registerInteraction])

  useEffect(() => {
    if (!navigationVisible) return
    const timeout = window.setTimeout(
      () => setNavigationVisible(false),
      dashboardState.preferences.navigationSeconds * 1000,
    )
    return () => window.clearTimeout(timeout)
  }, [dashboardState.preferences.navigationSeconds, interactionVersion, navigationVisible])

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
  ])

  const goTo = (nextScreen: Screen) => {
    setScreen(nextScreen)
    setNavigationVisible(false)
    setInteractionLocked(false)
    if (nextScreen === 'home') setActivePageId('dashboard')
  }

  const updatePreferences = (patch: Partial<DashboardPreferences>) => {
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
    const alarm: Alarm = { id: createLocalId(), label: 'Alarma', time, enabled: true, createdAt: new Date().toISOString() }
    setDashboardState((current) => ({ ...current, alarms: [...current.alarms, alarm] }))
  }

  const updateAlarm = (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled'>>) => {
    setDashboardState((current) => ({ ...current, alarms: current.alarms.map((alarm) => alarm.id === alarmId ? { ...alarm, ...patch } : alarm) }))
  }

  const deleteAlarm = (alarmId: string) => {
    setDashboardState((current) => ({ ...current, alarms: current.alarms.filter((alarm) => alarm.id !== alarmId) }))
  }

  const createTimer = () => {
    const timer: Timer = { id: createLocalId(), label: 'Temporizador', durationSeconds: 300, remainingSeconds: 300, endsAt: null, createdAt: new Date().toISOString() }
    setDashboardState((current) => ({ ...current, timers: [...current.timers, timer] }))
  }
  const updateTimer = (timerId: string, patch: Partial<Pick<Timer, 'label' | 'durationSeconds' | 'remainingSeconds' | 'endsAt'>>) => setDashboardState((current) => ({ ...current, timers: current.timers.map((timer) => timer.id === timerId ? { ...timer, ...patch } : timer) }))
  const deleteTimer = (timerId: string) => setDashboardState((current) => ({ ...current, timers: current.timers.filter((timer) => timer.id !== timerId) }))

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

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    const isWidget = target.closest('.widget-card')
    const gestureBlocked = !isWidget && target.closest('button, input, textarea, select, [data-swipe-block]')
    if (gestureBlocked) {
      pointerStart.current = null
      return
    }

    pointerStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    if (!isWidget) event.currentTarget.setPointerCapture(event.pointerId)
    registerInteraction()
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
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
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
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

  return (
    <main
      className={`tablet-shell ${navigationVisible ? 'has-navigation' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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
            alarms={dashboardState.alarms}
            timers={dashboardState.timers}
            onCreateNote={createNote}
            onUpdateNote={updateNote}
            onArchiveNote={archiveNote}
            onRestoreNote={restoreNote}
            onDeleteNote={deleteNote}
            onCreateAlarm={createAlarm}
            onUpdateAlarm={updateAlarm}
            onDeleteAlarm={deleteAlarm}
            onPreviewNotification={showSimulatedAlert}
            onCreateTimer={createTimer}
            onUpdateTimer={updateTimer}
            onDeleteTimer={deleteTimer}
            onOpenNotes={openNotes}
            onOpenWeather={openWeather}
            onEditingChange={(isEditing) => {
              setInteractionLocked(isEditing)
              if (!isEditing) registerInteraction()
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
  alarms,
  timers,
  onCreateNote,
  onUpdateNote,
  onArchiveNote,
  onRestoreNote,
  onDeleteNote,
  onCreateAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  onCreateTimer,
  onUpdateTimer,
  onDeleteTimer,
  onPreviewNotification,
  onOpenNotes,
  onOpenWeather,
  onEditingChange,
}: {
  page: DashboardPageDefinition
  now: Date
  time: string
  date: string
  widgets: import('./widgetLayout').DashboardWidget[]
  notes: Note[]
  alarms: Alarm[]
  timers: Timer[]
  onCreateNote: () => string
  onUpdateNote: (noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'pinned' | 'reminderAt'>>) => void
  onArchiveNote: (noteId: string) => void
  onRestoreNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onCreateAlarm: () => void
  onUpdateAlarm: (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled'>>) => void
  onDeleteAlarm: (alarmId: string) => void
  onCreateTimer: () => void
  onUpdateTimer: (timerId: string, patch: Partial<Pick<Timer, 'label' | 'durationSeconds' | 'remainingSeconds' | 'endsAt'>>) => void
  onDeleteTimer: (timerId: string) => void
  onPreviewNotification: (title: string, body: string) => void
  onOpenNotes: (noteId?: string) => void
  onOpenWeather: () => void
  onEditingChange: (isEditing: boolean) => void
}) {
  if (page.id === 'clock') return <ClockPage time={time} date={date} now={now} alarms={alarms} timers={timers} onCreateAlarm={onCreateAlarm} onUpdateAlarm={onUpdateAlarm} onDeleteAlarm={onDeleteAlarm} onCreateTimer={onCreateTimer} onUpdateTimer={onUpdateTimer} onDeleteTimer={onDeleteTimer} onPreviewNotification={onPreviewNotification} />
  if (page.id === 'weather') return <WeatherPage />
  if (page.id === 'notes') return <NotesPage notes={notes} onCreateNote={onCreateNote} onUpdateNote={onUpdateNote} onArchiveNote={onArchiveNote} onRestoreNote={onRestoreNote} onDeleteNote={onDeleteNote} onPreviewNotification={onPreviewNotification} onEditingChange={onEditingChange} />
  return <GridDashboard now={now} time={time} date={date} widgets={widgets} notes={notes} onOpenNotes={onOpenNotes} onOpenWeather={onOpenWeather} />
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

function GridDashboard({ now, time, date, widgets, notes, onOpenNotes, onOpenWeather }: { now: Date; time: string; date: string; widgets: import('./widgetLayout').DashboardWidget[]; notes: Note[]; onOpenNotes: (noteId?: string) => void; onOpenWeather: () => void }) {
  const orientation = useDashboardOrientation()
  const placedWidgets = useMemo(() => placeWidgets(widgets, orientation), [orientation, widgets])
  const featuredNote = notes
    .filter((note) => !note.archived)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))[0]
  const upcomingReminders = notes
    .filter((note) => !note.archived && note.reminderAt && new Date(note.reminderAt).getTime() > now.getTime())
    .sort((a, b) => (a.reminderAt as string).localeCompare(b.reminderAt as string))
    .slice(0, 2)
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
          ? placedWidgets.map((widget) => <DashboardWidgetCard key={widget.id} widget={widget} time={time} date={date} featuredNote={featuredNote} upcomingReminders={upcomingReminders} onOpenNotes={onOpenNotes} onOpenWeather={onOpenWeather} />)
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

function DashboardWidgetCard({ widget, time, date, featuredNote, upcomingReminders, onOpenNotes, onOpenWeather }: { widget: PlacedWidget; time: string; date: string; featuredNote: Note | undefined; upcomingReminders: Note[]; onOpenNotes: (noteId?: string) => void; onOpenWeather: () => void }) {
  const style = {
    gridColumn: `${widget.layout.x + 1} / span ${widget.layout.width}`,
    gridRow: `${widget.layout.y + 1} / span ${widget.layout.height}`,
  } satisfies CSSProperties

  if (widget.id === 'clock') return <article className="clock-card widget-card" style={style}>
    <div className="widget-label"><span>Ahora</span><span className="live-dot">En directo</span></div>
    <time className="time">{time}</time>
    <p className="date">{date}</p>
    <div className="morning-line"><SunMedium size={18} /><span>Que tengas un día estupendo</span></div>
  </article>

  if (widget.id === 'weather') return <button type="button" className="weather-card widget-card interactive-card" style={style} onClick={onOpenWeather}>
    <div className="weather-icon"><CloudSun size={38} strokeWidth={1.5} /></div>
    <div><p className="temperature">22°</p><p className="weather-copy">Parcialmente nublado</p></div>
    <span className="location">Casa</span>
  </button>

  if (widget.id === 'notes') return <button type="button" className={`note-card widget-card interactive-card ${featuredNote ? `note-${featuredNote.color}` : ''}`} style={style} onClick={() => onOpenNotes(featuredNote?.id)}>
    <div className="widget-heading">
      <div className="heading-icon coral"><Check size={18} /></div>
      <div><p className="widget-title">Nota rápida</p><p className="widget-subtitle">Guardada en esta tablet</p></div>
    </div>
    <p className={`note-content ${featuredNote?.content ? '' : 'is-placeholder'}`}>{featuredNote?.content || 'Toca aquí para escribir una nota o recordatorio.'}</p>
    <div className="note-footer"><span>{featuredNote ? (featuredNote.pinned ? 'Fijada' : 'Editada') : 'Sin contenido'}</span><ChevronRight size={17} /></div>
  </button>

  return <article className="agenda-card widget-card" style={style}>
    <div className="widget-heading">
      <div className="heading-icon blue"><CalendarDays size={18} /></div>
      <div><p className="widget-title">Próximamente</p><p className="widget-subtitle">{upcomingReminders.length ? `${upcomingReminders.length} recordatorio${upcomingReminders.length > 1 ? 's' : ''} programado${upcomingReminders.length > 1 ? 's' : ''}` : 'Sin recordatorios pendientes'}</p></div>
    </div>
    {upcomingReminders.length > 0 ? <div className="reminder-list">{upcomingReminders.map((note) => <button key={note.id} type="button" onClick={() => onOpenNotes(note.id)}><span><strong>{note.title || 'Recordatorio'}</strong><small>{note.content || 'Sin contenido'}</small></span><time>{formatReminder(note.reminderAt as string)}</time></button>)}</div> : <div className="agenda-empty"><Compass size={22} /><span>Tu agenda aparecerá aquí</span></div>}
  </article>
}

function formatReminder(value: string) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
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
  onCreateAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  onCreateTimer,
  onUpdateTimer,
  onDeleteTimer,
  onPreviewNotification,
}: {
  now: Date
  time: string
  date: string
  alarms: Alarm[]
  timers: Timer[]
  onCreateAlarm: () => void
  onUpdateAlarm: (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled'>>) => void
  onDeleteAlarm: (alarmId: string) => void
  onCreateTimer: () => void
  onUpdateTimer: (timerId: string, patch: Partial<Pick<Timer, 'label' | 'durationSeconds' | 'remainingSeconds' | 'endsAt'>>) => void
  onDeleteTimer: (timerId: string) => void
  onPreviewNotification: (title: string, body: string) => void
}) {
  return (
    <div className="fullscreen-page clock-page page-enter">
      <PageHeader pageLabel="Reloj" />
      <section className="focus-clock" aria-label="Reloj a pantalla completa">
        <span className="focus-clock-kicker">Ahora</span>
        <time>{time}</time>
        <p>{date}</p>
      </section>
      <section className="alarm-panel" aria-labelledby="alarms-title">
        <div className="alarm-panel-heading"><div><p className="eyebrow">Diariamente</p><h1 id="alarms-title">Alarmas</h1></div><button type="button" className="text-action is-active" onClick={onCreateAlarm}><Plus size={16} />Nueva alarma</button></div>
        {alarms.length > 0 ? <div className="alarm-list">{[...alarms].sort((a, b) => a.time.localeCompare(b.time)).map((alarm) => <div key={alarm.id} className={`alarm-row ${alarm.enabled ? '' : 'is-disabled'}`}><input type="time" value={alarm.time} onChange={(event) => onUpdateAlarm(alarm.id, { time: event.target.value })} aria-label={`Hora de ${alarm.label}`} /><input className="alarm-label-input" value={alarm.label} maxLength={60} onChange={(event) => onUpdateAlarm(alarm.id, { label: event.target.value })} aria-label="Nombre de alarma" /><button type="button" className="alarm-test-button" onClick={() => onPreviewNotification(alarm.label || 'Alarma', `Alarma programada para las ${alarm.time}.`)} aria-label={`Probar ${alarm.label}`}><BellRing size={15} /></button><button type="button" className={`alarm-toggle ${alarm.enabled ? 'is-on' : ''}`} role="switch" aria-checked={alarm.enabled} onClick={() => onUpdateAlarm(alarm.id, { enabled: !alarm.enabled })}><span /></button><button type="button" className="text-action danger" onClick={() => onDeleteAlarm(alarm.id)} aria-label={`Eliminar ${alarm.label}`}><Trash2 size={16} /></button></div>)}</div> : <div className="alarm-empty"><AlarmClock size={22} /><span>No hay alarmas. Crea una para recibir un aviso diario.</span></div>}
      </section>
      <section className="timer-panel" aria-labelledby="timers-title">
        <div className="alarm-panel-heading"><div><p className="eyebrow">Cuenta atrás</p><h1 id="timers-title">Temporizadores</h1></div><button type="button" className="text-action is-active" onClick={onCreateTimer}><Plus size={16} />Nuevo</button></div>
        {timers.length > 0 ? <div className="timer-list">{timers.map((timer) => {
          const remaining = timer.endsAt ? Math.max(0, Math.ceil((new Date(timer.endsAt).getTime() - now.getTime()) / 1000)) : timer.remainingSeconds
          const running = Boolean(timer.endsAt)
          return <div key={timer.id} className="timer-row"><input className="alarm-label-input" value={timer.label} maxLength={60} onChange={(event) => onUpdateTimer(timer.id, { label: event.target.value })} aria-label="Nombre del temporizador" /><strong>{formatCountdown(remaining)}</strong><button type="button" className="text-action" onClick={() => running ? onUpdateTimer(timer.id, { remainingSeconds: remaining, endsAt: null }) : onUpdateTimer(timer.id, { endsAt: new Date(now.getTime() + remaining * 1000).toISOString() })}>{running ? 'Pausar' : 'Iniciar'}</button><button type="button" className="text-action" onClick={() => onUpdateTimer(timer.id, { remainingSeconds: timer.durationSeconds, endsAt: null })}>Reiniciar</button><button type="button" className="text-action danger" onClick={() => onDeleteTimer(timer.id)} aria-label={`Eliminar ${timer.label}`}><Trash2 size={16} /></button></div>
        })}</div> : <div className="alarm-empty"><Clock3 size={22} /><span>No hay temporizadores activos.</span></div>}
      </section>
    </div>
  )
}

function formatCountdown(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
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
              icon={page.id === 'clock' ? <Clock3 size={20} /> : <FileText size={20} />}
              title={`Página ${page.label}`}
              detail="Página fullscreen incluida en el swipe y en la rotación."
              checked={preferences.enabledPageIds.includes(page.id)}
              onChange={() => onTogglePage(page.id)}
            />
          ))}
        </div>
      </section>

      <section className="settings-list" aria-label="Próximos ajustes de la tablet">
        <SettingsRow icon={<Maximize size={20} />} title="Pantalla" detail="Preparada para pantalla completa" />
        <SettingsRow icon={<Volume2 size={20} />} title="Sonido" detail="Control de volumen y avisos · Próximamente" />
        <SettingsRow icon={<LockKeyhole size={20} />} title="Modo hogar" detail="Mantener Pablo Tablet como inicio · Próximamente" />
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

function SettingsRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="settings-row passive-row">
      <span className="settings-icon">{icon}</span>
      <span className="settings-copy"><strong>{title}</strong><small>{detail}</small></span>
      <ChevronRight size={20} />
    </div>
  )
}

export default App
