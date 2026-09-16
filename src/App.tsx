import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CloudSun,
  Compass,
  FileText,
  Home,
  LockKeyhole,
  Maximize,
  Menu,
  Pause,
  Play,
  RotateCw,
  Settings,
  SunMedium,
  Volume2,
  X,
} from 'lucide-react'
import {
  DASHBOARD_PAGES,
  loadDashboardState,
  saveDashboardState,
  type DashboardPageDefinition,
  type DashboardPageId,
  type DashboardPreferences,
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
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
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
    setActivePageId('notes')
    registerInteraction()
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY }
    registerInteraction()
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!pointerStart.current || screen !== 'home') return
    const deltaX = event.clientX - pointerStart.current.x
    const deltaY = event.clientY - pointerStart.current.y
    pointerStart.current = null
    if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return
    moveToPage(activePageIndex + (deltaX < 0 ? 1 : -1))
  }

  return (
    <main
      className={`tablet-shell ${navigationVisible ? 'has-navigation' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
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
            note={dashboardState.note}
            onNoteChange={(note) => setDashboardState((current) => ({ ...current, note }))}
            onOpenNotes={openNotes}
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
  note,
  onNoteChange,
  onOpenNotes,
  onEditingChange,
}: {
  page: DashboardPageDefinition
  time: string
  date: string
  note: string
  onNoteChange: (note: string) => void
  onOpenNotes: () => void
  onEditingChange: (isEditing: boolean) => void
}) {
  if (page.id === 'clock') return <ClockPage time={time} date={date} />
  if (page.id === 'notes') return <NotesPage note={note} onNoteChange={onNoteChange} onEditingChange={onEditingChange} />
  return <GridDashboard time={time} date={date} note={note} onOpenNotes={onOpenNotes} />
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

function GridDashboard({ time, date, note, onOpenNotes }: { time: string; date: string; note: string; onOpenNotes: () => void }) {
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
        <article className="clock-card widget-card">
          <div className="widget-label"><span>Ahora</span><span className="live-dot">En directo</span></div>
          <time className="time">{time}</time>
          <p className="date">{date}</p>
          <div className="morning-line"><SunMedium size={18} /><span>Que tengas un día estupendo</span></div>
        </article>
        <article className="weather-card widget-card">
          <div className="weather-icon"><CloudSun size={38} strokeWidth={1.5} /></div>
          <div><p className="temperature">22°</p><p className="weather-copy">Parcialmente nublado</p></div>
          <span className="location">Casa</span>
        </article>
        <button type="button" className="note-card widget-card interactive-card" onClick={onOpenNotes}>
          <div className="widget-heading">
            <div className="heading-icon coral"><Check size={18} /></div>
            <div><p className="widget-title">Nota rápida</p><p className="widget-subtitle">Guardada en esta tablet</p></div>
          </div>
          <p className={`note-content ${note ? '' : 'is-placeholder'}`}>
            {note || 'Toca aquí para escribir una nota o recordatorio.'}
          </p>
          <div className="note-footer"><span>{note ? 'Editada' : 'Sin contenido'}</span><ChevronRight size={17} /></div>
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

function ClockPage({ time, date }: { time: string; date: string }) {
  return (
    <div className="fullscreen-page page-enter">
      <PageHeader pageLabel="Reloj" />
      <section className="focus-clock" aria-label="Reloj a pantalla completa">
        <span className="focus-clock-kicker">Ahora</span>
        <time>{time}</time>
        <p>{date}</p>
      </section>
    </div>
  )
}

function NotesPage({
  note,
  onNoteChange,
  onEditingChange,
}: {
  note: string
  onNoteChange: (note: string) => void
  onEditingChange: (isEditing: boolean) => void
}) {
  return (
    <div className="fullscreen-page page-enter">
      <PageHeader pageLabel="Nota rápida" />
      <section className="notes-workspace">
        <div className="notes-title">
          <div className="heading-icon coral"><FileText size={20} /></div>
          <div><h1>Nota de hoy</h1><p>Los cambios se guardan automáticamente en la tablet.</p></div>
        </div>
        <textarea
          value={note}
          maxLength={600}
          onChange={(event) => onNoteChange(event.target.value)}
          onFocus={() => onEditingChange(true)}
          onBlur={() => onEditingChange(false)}
          placeholder="Escribe una nota o recordatorio…"
          aria-label="Contenido de la nota rápida"
        />
        <div className="notes-meta"><span>Guardado local</span><span>{note.length}/600</span></div>
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
