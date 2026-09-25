import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  AlarmClock,
  Archive,
  ArchiveRestore,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Cloud,
  CloudRain,
  CloudSun,
  Compass,
  FileText,
  Home,
  LockKeyhole,
  MapPin,
  Maximize,
  Menu,
  Pause,
  Pin,
  Play,
  Plus,
  RotateCw,
  RotateCcw,
  Settings,
  Sunrise,
  SunMedium,
  Timer,
  Trash2,
  Wind,
  Droplets,
  Volume2,
  X,
} from 'lucide-react'
import {
  createAlarm,
  createCountdownTimer,
  createNote,
  DASHBOARD_PAGES,
  getDashboardNote,
  loadDashboardState,
  saveDashboardState,
  type Alarm,
  type CountdownTimer,
  type DashboardPageDefinition,
  type DashboardPageId,
  type DashboardPreferences,
  type Note,
  type NoteColor,
} from './dashboardState'
import './App.css'

type Screen = 'home' | 'settings'

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

function getTimerRemaining(timer: CountdownTimer, now: Date) {
  if (timer.status !== 'running' || !timer.endsAt) return timer.remainingSeconds
  return Math.max(0, Math.min(
    timer.remainingSeconds,
    Math.ceil((new Date(timer.endsAt).getTime() - now.getTime()) / 1000),
  ))
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [navigationVisible, setNavigationVisible] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [dashboardState, setDashboardState] = useState(loadDashboardState)
  const [activePageId, setActivePageId] = useState<DashboardPageId>('dashboard')
  const [interactionVersion, setInteractionVersion] = useState(0)
  const [interactionLocked, setInteractionLocked] = useState(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const enabledPages = useMemo(
    () => DASHBOARD_PAGES.filter((page) => dashboardState.preferences.enabledPageIds.includes(page.id)),
    [dashboardState.preferences.enabledPageIds],
  )
  const activePageIndex = Math.max(0, enabledPages.findIndex((page) => page.id === activePageId))
  const activePage = enabledPages[activePageIndex] ?? enabledPages[0]
  const time = timeFormatter.format(now)
  const date = weekdayFormatter.format(now)

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextNow = new Date()
      setNow(nextNow)
      setDashboardState((current) => {
        let changed = false
        const timers = current.timers.map((timer) => {
          if (timer.status !== 'running' || !timer.endsAt || new Date(timer.endsAt).getTime() > nextNow.getTime()) return timer
          changed = true
          return { ...timer, status: 'finished' as const, remainingSeconds: 0, endsAt: null }
        })
        return changed ? { ...current, timers } : current
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    saveDashboardState(dashboardState)
  }, [dashboardState])

  const registerInteraction = useCallback(() => {
    setNavigationVisible(true)
    setInteractionVersion((version) => version + 1)
  }, [])

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

  const openNotes = () => {
    if (!dashboardState.preferences.enabledPageIds.includes('notes')) {
      updatePreferences({
        enabledPageIds: DASHBOARD_PAGES
          .map((page) => page.id)
          .filter((id) => dashboardState.preferences.enabledPageIds.includes(id) || id === 'notes'),
      })
    }
    setDashboardState((current) => ({
      ...current,
      activeNoteId: current.activeNoteId
        ?? getDashboardNote(current.notes)?.id
        ?? current.notes[0]?.id
        ?? null,
    }))
    setActivePageId('notes')
    registerInteraction()
  }

  const openClock = () => {
    if (!dashboardState.preferences.enabledPageIds.includes('clock')) {
      updatePreferences({
        enabledPageIds: DASHBOARD_PAGES
          .map((page) => page.id)
          .filter((id) => dashboardState.preferences.enabledPageIds.includes(id) || id === 'clock'),
      })
    }
    setActivePageId('clock')
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

  const createNewNote = () => {
    const note = createNote()
    setDashboardState((current) => ({
      ...current,
      notes: [...current.notes, note],
      activeNoteId: note.id,
      preferences: {
        ...current.preferences,
        enabledPageIds: current.preferences.enabledPageIds.includes('notes')
          ? current.preferences.enabledPageIds
          : [...current.preferences.enabledPageIds, 'notes'],
      },
    }))
    setActivePageId('notes')
    registerInteraction()
  }

  const updateNote = (noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'pinned'>>) => {
    setDashboardState((current) => ({
      ...current,
      notes: current.notes.map((note) => note.id === noteId
        ? { ...note, ...patch, updatedAt: new Date().toISOString() }
        : note),
    }))
  }

  const archiveNote = (noteId: string) => {
    setDashboardState((current) => {
      const nextNotes = current.notes.map((note) => note.id === noteId
        ? { ...note, archived: true, pinned: false, updatedAt: new Date().toISOString() }
        : note)
      return {
        ...current,
        notes: nextNotes,
        activeNoteId: nextNotes.find((note) => !note.archived)?.id ?? null,
      }
    })
  }

  const restoreNote = (noteId: string) => {
    setDashboardState((current) => ({
      ...current,
      notes: current.notes.map((note) => note.id === noteId
        ? { ...note, archived: false, updatedAt: new Date().toISOString() }
        : note),
      activeNoteId: noteId,
    }))
  }

  const deleteNote = (noteId: string) => {
    setDashboardState((current) => {
      const nextNotes = current.notes.filter((note) => note.id !== noteId)
      return {
        ...current,
        notes: nextNotes,
        activeNoteId: nextNotes.find((note) => !note.archived)?.id ?? nextNotes[0]?.id ?? null,
      }
    })
  }

  const addAlarm = () => {
    const alarm = createAlarm()
    setDashboardState((current) => ({ ...current, alarms: [...current.alarms, alarm] }))
  }

  const updateAlarm = (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled'>>) => {
    setDashboardState((current) => ({
      ...current,
      alarms: current.alarms.map((alarm) => alarm.id === alarmId ? { ...alarm, ...patch } : alarm),
    }))
  }

  const deleteAlarm = (alarmId: string) => {
    setDashboardState((current) => ({ ...current, alarms: current.alarms.filter((alarm) => alarm.id !== alarmId) }))
  }

  const addTimer = (minutes: number, label: string) => {
    const timer = createCountdownTimer(minutes * 60, label)
    setDashboardState((current) => ({ ...current, timers: [...current.timers, timer] }))
  }

  const startTimer = (timerId: string) => {
    setDashboardState((current) => ({
      ...current,
      timers: current.timers.map((timer) => {
        if (timer.id !== timerId) return timer
        const remainingSeconds = timer.remainingSeconds > 0 ? timer.remainingSeconds : timer.durationSeconds
        return {
          ...timer,
          remainingSeconds,
          status: 'running',
          endsAt: new Date(Date.now() + remainingSeconds * 1000).toISOString(),
        }
      }),
    }))
  }

  const pauseTimer = (timerId: string) => {
    setDashboardState((current) => ({
      ...current,
      timers: current.timers.map((timer) => timer.id === timerId
        ? { ...timer, remainingSeconds: getTimerRemaining(timer, new Date()), status: 'paused', endsAt: null }
        : timer),
    }))
  }

  const resetTimer = (timerId: string) => {
    setDashboardState((current) => ({
      ...current,
      timers: current.timers.map((timer) => timer.id === timerId
        ? { ...timer, remainingSeconds: timer.durationSeconds, status: 'idle', endsAt: null }
        : timer),
    }))
  }

  const deleteTimer = (timerId: string) => {
    setDashboardState((current) => ({ ...current, timers: current.timers.filter((timer) => timer.id !== timerId) }))
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    const gestureBlocked = target.closest('.widget-card, button, input, textarea, select, [data-swipe-block]')
    if (gestureBlocked) {
      pointerStart.current = null
      registerInteraction()
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    pointerStart.current = { x: event.clientX, y: event.clientY }
    registerInteraction()
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!pointerStart.current || screen !== 'home') return
    const deltaX = event.clientX - pointerStart.current.x
    const deltaY = event.clientY - pointerStart.current.y
    pointerStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
    moveToPage(activePageIndex + (deltaX < 0 ? 1 : -1))
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    pointerStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <main
      className={`tablet-shell ${navigationVisible ? 'has-navigation' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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
            time={time}
            date={date}
            now={now}
            notes={dashboardState.notes}
            alarms={dashboardState.alarms}
            timers={dashboardState.timers}
            activeNoteId={dashboardState.activeNoteId}
            onOpenClock={openClock}
            onOpenNotes={openNotes}
            onOpenWeather={openWeather}
            onAddAlarm={addAlarm}
            onUpdateAlarm={updateAlarm}
            onDeleteAlarm={deleteAlarm}
            onAddTimer={addTimer}
            onStartTimer={startTimer}
            onPauseTimer={pauseTimer}
            onResetTimer={resetTimer}
            onDeleteTimer={deleteTimer}
            onCreateNote={createNewNote}
            onSelectNote={(activeNoteId) => setDashboardState((current) => ({ ...current, activeNoteId }))}
            onUpdateNote={updateNote}
            onArchiveNote={archiveNote}
            onRestoreNote={restoreNote}
            onDeleteNote={deleteNote}
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
  time,
  date,
  now,
  notes,
  alarms,
  timers,
  activeNoteId,
  onOpenClock,
  onOpenNotes,
  onOpenWeather,
  onAddAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  onAddTimer,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onDeleteTimer,
  onCreateNote,
  onSelectNote,
  onUpdateNote,
  onArchiveNote,
  onRestoreNote,
  onDeleteNote,
  onEditingChange,
}: {
  page: DashboardPageDefinition
  time: string
  date: string
  now: Date
  notes: Note[]
  alarms: Alarm[]
  timers: CountdownTimer[]
  activeNoteId: string | null
  onOpenClock: () => void
  onOpenNotes: () => void
  onOpenWeather: () => void
  onAddAlarm: () => void
  onUpdateAlarm: (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled'>>) => void
  onDeleteAlarm: (alarmId: string) => void
  onAddTimer: (minutes: number, label: string) => void
  onStartTimer: (timerId: string) => void
  onPauseTimer: (timerId: string) => void
  onResetTimer: (timerId: string) => void
  onDeleteTimer: (timerId: string) => void
  onCreateNote: () => void
  onSelectNote: (noteId: string) => void
  onUpdateNote: (noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'pinned'>>) => void
  onArchiveNote: (noteId: string) => void
  onRestoreNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onEditingChange: (isEditing: boolean) => void
}) {
  if (page.id === 'clock') {
    return (
      <ClockPage
        time={time}
        date={date}
        now={now}
        alarms={alarms}
        timers={timers}
        onAddAlarm={onAddAlarm}
        onUpdateAlarm={onUpdateAlarm}
        onDeleteAlarm={onDeleteAlarm}
        onAddTimer={onAddTimer}
        onStartTimer={onStartTimer}
        onPauseTimer={onPauseTimer}
        onResetTimer={onResetTimer}
        onDeleteTimer={onDeleteTimer}
        onEditingChange={onEditingChange}
      />
    )
  }
  if (page.id === 'weather') return <WeatherPage />
  if (page.id === 'notes') {
    return (
      <NotesPage
        notes={notes}
        activeNoteId={activeNoteId}
        onCreateNote={onCreateNote}
        onSelectNote={onSelectNote}
        onUpdateNote={onUpdateNote}
        onArchiveNote={onArchiveNote}
        onRestoreNote={onRestoreNote}
        onDeleteNote={onDeleteNote}
        onEditingChange={onEditingChange}
      />
    )
  }
  return (
    <GridDashboard
      time={time}
      date={date}
      now={now}
      notes={notes}
      alarms={alarms}
      timers={timers}
      onOpenClock={onOpenClock}
      onOpenNotes={onOpenNotes}
      onOpenWeather={onOpenWeather}
    />
  )
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

function GridDashboard({
  time,
  date,
  now,
  notes,
  alarms,
  timers,
  onOpenClock,
  onOpenNotes,
  onOpenWeather,
}: {
  time: string
  date: string
  now: Date
  notes: Note[]
  alarms: Alarm[]
  timers: CountdownTimer[]
  onOpenClock: () => void
  onOpenNotes: () => void
  onOpenWeather: () => void
}) {
  const dashboardNote = getDashboardNote(notes)
  const activeNoteCount = notes.filter((note) => !note.archived).length
  const notePreview = dashboardNote?.content || dashboardNote?.title || ''
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const nextAlarm = alarms
    .filter((alarm) => alarm.enabled)
    .sort((first, second) => {
      const toMinutes = (value: string) => {
        const [hours, minutes] = value.split(':').map(Number)
        return (hours * 60 + minutes - currentMinutes + 1440) % 1440
      }
      return toMinutes(first.time) - toMinutes(second.time)
    })[0]
  const activeTimer = timers.find((timer) => timer.status === 'running' || timer.status === 'finished')
  const clockSummary = activeTimer
    ? activeTimer.status === 'finished'
      ? `${activeTimer.label} terminado`
      : `${activeTimer.label} · ${formatDuration(getTimerRemaining(activeTimer, now))}`
    : nextAlarm
      ? `Próxima alarma · ${nextAlarm.time}`
      : 'Configurar alarmas y temporizadores'
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
      <div className="dashboard-grid">
        <button type="button" className="clock-card widget-card interactive-card" onClick={onOpenClock}>
          <div className="widget-label"><span>Ahora</span><span className="live-dot">En directo</span></div>
          <time className="time">{time}</time>
          <p className="date">{date}</p>
          <div className="morning-line"><AlarmClock size={18} /><span>{clockSummary}</span></div>
        </button>
        <button type="button" className="weather-card widget-card interactive-card" onClick={onOpenWeather}>
          <div className="weather-icon"><CloudSun size={38} strokeWidth={1.5} /></div>
          <div><p className="temperature">22°</p><p className="weather-copy">Parcialmente nublado</p></div>
          <span className="location">Casa</span>
        </button>
        <button type="button" className="note-card widget-card interactive-card" onClick={onOpenNotes}>
          <div className="widget-heading">
            <div className={`heading-icon ${dashboardNote?.color ?? 'coral'}`}><Check size={18} /></div>
            <div>
              <p className="widget-title">{dashboardNote?.title || 'Notas'}</p>
              <p className="widget-subtitle">{dashboardNote?.pinned ? 'Nota fijada' : 'Guardadas en esta tablet'}</p>
            </div>
          </div>
          <p className={`note-content ${notePreview ? '' : 'is-placeholder'}`}>
            {notePreview || 'Toca aquí para crear una nota o recordatorio.'}
          </p>
          <div className="note-footer">
            <span>{activeNoteCount === 0 ? 'Sin notas' : `${activeNoteCount} ${activeNoteCount === 1 ? 'nota' : 'notas'}`}</span>
            <ChevronRight size={17} />
          </div>
        </button>
        <article className="agenda-card widget-card">
          <div className="widget-heading">
            <div className="heading-icon blue"><CalendarDays size={18} /></div>
            <div><p className="widget-title">Próximamente</p><p className="widget-subtitle">Sin eventos pendientes</p></div>
          </div>
          <div className="agenda-empty"><Compass size={22} /><span>Tu agenda aparecerá aquí</span></div>
        </article>
      </div>
    </div>
  )
}

type ClockSection = 'clock' | 'alarms' | 'timers'

function ClockPage({
  time,
  date,
  now,
  alarms,
  timers,
  onAddAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  onAddTimer,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onDeleteTimer,
  onEditingChange,
}: {
  time: string
  date: string
  now: Date
  alarms: Alarm[]
  timers: CountdownTimer[]
  onAddAlarm: () => void
  onUpdateAlarm: (alarmId: string, patch: Partial<Pick<Alarm, 'label' | 'time' | 'enabled'>>) => void
  onDeleteAlarm: (alarmId: string) => void
  onAddTimer: (minutes: number, label: string) => void
  onStartTimer: (timerId: string) => void
  onPauseTimer: (timerId: string) => void
  onResetTimer: (timerId: string) => void
  onDeleteTimer: (timerId: string) => void
  onEditingChange: (isEditing: boolean) => void
}) {
  const [section, setSection] = useState<ClockSection>('clock')
  const [timerMinutes, setTimerMinutes] = useState(5)
  const [timerLabel, setTimerLabel] = useState('')

  const addCustomTimer = () => {
    onAddTimer(Math.max(1, Math.min(180, timerMinutes)), timerLabel)
    setTimerLabel('')
  }

  return (
    <div className="fullscreen-page clock-page page-enter">
      <PageHeader pageLabel="Reloj" />
      <section className="clock-module" data-swipe-block>
        <nav className="clock-tabs" aria-label="Secciones del reloj">
          <button type="button" className={section === 'clock' ? 'is-active' : ''} onClick={() => setSection('clock')}><Clock3 size={18} />Reloj</button>
          <button type="button" className={section === 'alarms' ? 'is-active' : ''} onClick={() => setSection('alarms')}><AlarmClock size={18} />Alarmas <span>{alarms.length}</span></button>
          <button type="button" className={section === 'timers' ? 'is-active' : ''} onClick={() => setSection('timers')}><Timer size={18} />Temporizadores <span>{timers.length}</span></button>
        </nav>

        {section === 'clock' ? (
          <div className="focus-clock clock-module-focus" aria-label="Reloj a pantalla completa">
            <span className="focus-clock-kicker">Ahora</span>
            <time>{time}</time>
            <p>{date}</p>
          </div>
        ) : null}

        {section === 'alarms' ? (
          <div className="clock-tool-view">
            <div className="clock-tool-heading">
              <div><span className="eyebrow">Rutinas diarias</span><h1>Alarmas</h1></div>
              <button type="button" className="clock-primary-button" onClick={onAddAlarm}><Plus size={18} />Nueva alarma</button>
            </div>
            <div className="alarm-list">
              {alarms.map((alarm) => (
                <article className={`alarm-row ${alarm.enabled ? '' : 'is-disabled'}`} key={alarm.id}>
                  <button
                    type="button"
                    className={`alarm-toggle ${alarm.enabled ? 'is-on' : ''}`}
                    onClick={() => onUpdateAlarm(alarm.id, { enabled: !alarm.enabled })}
                    aria-label={alarm.enabled ? 'Desactivar alarma' : 'Activar alarma'}
                    aria-pressed={alarm.enabled}
                  ><Bell size={18} /></button>
                  <input
                    className="alarm-time-input"
                    type="time"
                    value={alarm.time}
                    onFocus={() => onEditingChange(true)}
                    onBlur={() => onEditingChange(false)}
                    onChange={(event) => onUpdateAlarm(alarm.id, { time: event.target.value })}
                    aria-label="Hora de la alarma"
                  />
                  <div className="alarm-copy">
                    <input
                      value={alarm.label}
                      onFocus={() => onEditingChange(true)}
                      onBlur={() => onEditingChange(false)}
                      onChange={(event) => onUpdateAlarm(alarm.id, { label: event.target.value })}
                      aria-label="Nombre de la alarma"
                      placeholder="Nombre de la alarma"
                    />
                    <small>Todos los días · guardada en esta tablet</small>
                  </div>
                  <button type="button" className="clock-icon-button danger" onClick={() => onDeleteAlarm(alarm.id)} aria-label="Eliminar alarma"><Trash2 size={18} /></button>
                </article>
              ))}
              {alarms.length === 0 ? (
                <div className="clock-empty"><AlarmClock size={32} /><strong>No hay alarmas</strong><span>Crea una para empezar tu rutina.</span></div>
              ) : null}
            </div>
            <p className="native-feature-note">Las alarmas ya se guardan localmente. El aviso con sonido y pantalla bloqueada llegará con las notificaciones nativas de Android.</p>
          </div>
        ) : null}

        {section === 'timers' ? (
          <div className="clock-tool-view">
            <div className="clock-tool-heading timer-heading">
              <div><span className="eyebrow">Cuenta atrás</span><h1>Temporizadores</h1></div>
              <div className="timer-presets" aria-label="Temporizadores rápidos">
                {[5, 15, 30].map((minutes) => <button type="button" key={minutes} onClick={() => onAddTimer(minutes, '')}>+ {minutes} min</button>)}
              </div>
            </div>
            <div className="timer-creator">
              <input
                type="text"
                value={timerLabel}
                onFocus={() => onEditingChange(true)}
                onBlur={() => onEditingChange(false)}
                onChange={(event) => setTimerLabel(event.target.value)}
                placeholder="Nombre opcional"
                aria-label="Nombre del temporizador"
              />
              <label><input
                type="number"
                min="1"
                max="180"
                value={timerMinutes}
                onFocus={() => onEditingChange(true)}
                onBlur={() => onEditingChange(false)}
                onChange={(event) => setTimerMinutes(Number(event.target.value))}
                aria-label="Duración en minutos"
              /><span>min</span></label>
              <button type="button" className="clock-primary-button" onClick={addCustomTimer}><Plus size={18} />Crear</button>
            </div>
            <div className="timer-list">
              {timers.map((timer) => {
                const remaining = getTimerRemaining(timer, now)
                return (
                  <article className={`timer-row is-${timer.status}`} key={timer.id}>
                    <div className="timer-dial"><Timer size={22} /><span>{Math.round((remaining / timer.durationSeconds) * 100)}%</span></div>
                    <div className="timer-copy">
                      <div><strong>{timer.label}</strong><small>{timer.status === 'running' ? 'En marcha' : timer.status === 'paused' ? 'En pausa' : timer.status === 'finished' ? 'Terminado' : 'Preparado'}</small></div>
                      <time>{formatDuration(remaining)}</time>
                      <progress max={timer.durationSeconds} value={remaining} aria-label={`Tiempo restante de ${timer.label}`} />
                    </div>
                    <div className="timer-actions">
                      {timer.status === 'running'
                        ? <button type="button" onClick={() => onPauseTimer(timer.id)} aria-label="Pausar"><Pause size={18} /></button>
                        : <button type="button" className="primary" onClick={() => onStartTimer(timer.id)} aria-label="Iniciar"><Play size={18} /></button>}
                      <button type="button" onClick={() => onResetTimer(timer.id)} aria-label="Reiniciar"><RotateCcw size={18} /></button>
                      <button type="button" className="danger" onClick={() => onDeleteTimer(timer.id)} aria-label="Eliminar"><Trash2 size={18} /></button>
                    </div>
                  </article>
                )
              })}
              {timers.length === 0 ? (
                <div className="clock-empty"><Timer size={32} /><strong>No hay temporizadores</strong><span>Usa un acceso rápido o crea uno personalizado.</span></div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
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
        <section className="weather-current-panel" data-swipe-block>
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
        <section className="weather-forecast-panel" data-swipe-block>
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

const noteDateFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })

function NotesPage({
  notes,
  activeNoteId,
  onCreateNote,
  onSelectNote,
  onUpdateNote,
  onArchiveNote,
  onRestoreNote,
  onDeleteNote,
  onEditingChange,
}: {
  notes: Note[]
  activeNoteId: string | null
  onCreateNote: () => void
  onSelectNote: (noteId: string) => void
  onUpdateNote: (noteId: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color' | 'pinned'>>) => void
  onArchiveNote: (noteId: string) => void
  onRestoreNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
  onEditingChange: (isEditing: boolean) => void
}) {
  const [showArchived, setShowArchived] = useState(false)
  const visibleNotes = useMemo(() => notes
    .filter((note) => note.archived === showArchived)
    .sort((first, second) => {
      if (!showArchived && first.pinned !== second.pinned) return first.pinned ? -1 : 1
      return second.updatedAt.localeCompare(first.updatedAt)
    }), [notes, showArchived])
  const activeNote = visibleNotes.find((note) => note.id === activeNoteId) ?? visibleNotes[0] ?? null
  const archivedCount = notes.filter((note) => note.archived).length

  const requestDelete = (note: Note) => {
    const noteName = note.title.trim() || 'esta nota'
    if (window.confirm(`¿Eliminar definitivamente ${noteName}?`)) onDeleteNote(note.id)
  }

  return (
    <div className="fullscreen-page page-enter notes-page">
      <PageHeader pageLabel="Notas" />
      <section className="notes-manager" data-swipe-block>
        <aside className="notes-sidebar" aria-label="Lista de notas">
          <div className="notes-sidebar-header">
            <div><span className="notes-kicker">Tus notas</span><strong>{visibleNotes.length}</strong></div>
            <button type="button" className="icon-button primary" onClick={onCreateNote} aria-label="Crear nota">
              <Plus size={20} />
            </button>
          </div>
          <div className="notes-filter" role="group" aria-label="Filtrar notas">
            <button type="button" className={!showArchived ? 'is-active' : ''} onClick={() => setShowArchived(false)}>Activas</button>
            <button type="button" className={showArchived ? 'is-active' : ''} onClick={() => setShowArchived(true)}>Archivadas ({archivedCount})</button>
          </div>
          <div className="notes-list">
            {visibleNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                className={`note-list-item note-color-${note.color} ${note.id === activeNote?.id ? 'is-active' : ''}`}
                onClick={() => onSelectNote(note.id)}
              >
                <span className="note-list-heading">
                  <strong>{note.title.trim() || 'Sin título'}</strong>
                  {note.pinned ? <Pin size={13} fill="currentColor" /> : null}
                </span>
                <span className="note-list-preview">{note.content.trim() || 'Nota vacía'}</span>
                <small>{noteDateFormatter.format(new Date(note.updatedAt))}</small>
              </button>
            ))}
            {visibleNotes.length === 0 ? (
              <div className="notes-list-empty">
                <FileText size={24} />
                <span>{showArchived ? 'No hay notas archivadas' : 'Todavía no hay notas'}</span>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="note-editor">
          {activeNote ? (
            <>
              <div className="note-editor-toolbar">
                <span className={`note-color-dot note-color-${activeNote.color}`} />
                <div className="note-editor-actions">
                  {!activeNote.archived ? (
                    <>
                      <button
                        type="button"
                        className={activeNote.pinned ? 'is-active' : ''}
                        onClick={() => onUpdateNote(activeNote.id, { pinned: !activeNote.pinned })}
                        aria-label={activeNote.pinned ? 'Desfijar nota' : 'Fijar nota'}
                        title={activeNote.pinned ? 'Desfijar' : 'Fijar'}
                      ><Pin size={18} /></button>
                      <button type="button" onClick={() => onArchiveNote(activeNote.id)} aria-label="Archivar nota" title="Archivar"><Archive size={18} /></button>
                    </>
                  ) : (
                    <button type="button" onClick={() => onRestoreNote(activeNote.id)} aria-label="Restaurar nota" title="Restaurar"><ArchiveRestore size={18} /></button>
                  )}
                  <button type="button" className="danger" onClick={() => requestDelete(activeNote)} aria-label="Eliminar nota" title="Eliminar"><Trash2 size={18} /></button>
                </div>
              </div>
              <input
                className="note-title-input"
                value={activeNote.title}
                maxLength={80}
                disabled={activeNote.archived}
                onChange={(event) => onUpdateNote(activeNote.id, { title: event.target.value })}
                onFocus={() => onEditingChange(true)}
                onBlur={() => onEditingChange(false)}
                placeholder="Título de la nota"
                aria-label="Título de la nota"
              />
              <textarea
                value={activeNote.content}
                maxLength={2000}
                disabled={activeNote.archived}
                onChange={(event) => onUpdateNote(activeNote.id, { content: event.target.value })}
                onFocus={() => onEditingChange(true)}
                onBlur={() => onEditingChange(false)}
                placeholder="Escribe una nota o recordatorio…"
                aria-label="Contenido de la nota"
              />
              <div className="note-editor-footer">
                <div className="note-colors" aria-label="Color de la nota">
                  {(['coral', 'blue', 'green', 'amber'] as NoteColor[]).map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`note-color-${color} ${activeNote.color === color ? 'is-active' : ''}`}
                      disabled={activeNote.archived}
                      onClick={() => onUpdateNote(activeNote.id, { color })}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
                <span>{activeNote.archived ? 'Archivada' : 'Guardado local'} · {activeNote.content.length}/2000</span>
              </div>
            </>
          ) : (
            <div className="note-editor-empty">
              <div className="heading-icon coral"><FileText size={22} /></div>
              <h1>{showArchived ? 'Archivo vacío' : 'Crea tu primera nota'}</h1>
              <p>{showArchived ? 'Las notas archivadas aparecerán aquí.' : 'Podrás escribirla, fijarla y elegir su color.'}</p>
              {!showArchived ? <button type="button" className="create-note-button" onClick={onCreateNote}><Plus size={18} />Nueva nota</button> : null}
            </div>
          )}
        </div>
      </section>
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
              icon={page.id === 'clock'
                ? <Clock3 size={20} />
                : page.id === 'weather'
                  ? <CloudSun size={20} />
                  : <FileText size={20} />}
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
