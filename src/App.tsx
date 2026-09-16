import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, Check, ChevronRight, CloudSun, Compass, Home, LockKeyhole, Maximize, Menu, Settings, SunMedium, Volume2, X } from 'lucide-react'
import './App.css'

type Screen = 'home' | 'settings'

const weekdayFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [navigationVisible, setNavigationVisible] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  const date = weekdayFormatter.format(now)
  const goTo = (nextScreen: Screen) => { setScreen(nextScreen); setNavigationVisible(false) }

  return (
    <main className="tablet-shell" onPointerDown={() => setNavigationVisible(true)}>
      <div className="wallpaper" aria-hidden="true"><span className="orb orb-one" /><span className="orb orb-two" /><span className="grid-glow" /></div>
      <section className="tablet-content" aria-label="Pablo Tablet">
        {screen === 'home' ? <Dashboard time={time} date={date} /> : <SettingsScreen onBack={() => goTo('home')} />}
      </section>
      <button className="navigation-reveal" type="button" onClick={(event) => { event.stopPropagation(); setNavigationVisible((visible) => !visible) }} aria-label={navigationVisible ? 'Ocultar navegación' : 'Mostrar navegación'}>
        {navigationVisible ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav className={`bottom-navigation ${navigationVisible ? 'is-visible' : ''}`} aria-label="Navegación principal">
        <button type="button" className={screen === 'home' ? 'is-active' : ''} onClick={(event) => { event.stopPropagation(); goTo('home') }}><Home size={21} strokeWidth={2.25} /><span>Inicio</span></button>
        <button type="button" className={screen === 'settings' ? 'is-active' : ''} onClick={(event) => { event.stopPropagation(); goTo('settings') }}><Settings size={21} strokeWidth={2.25} /><span>Ajustes</span></button>
      </nav>
    </main>
  )
}

function Dashboard({ time, date }: { time: string; date: string }) {
  return <div className="dashboard-page">
    <header className="dashboard-header"><div><p className="eyebrow">Pablo Tablet</p><p className="welcome">Buenos días, Pablo</p></div><div className="status-pill" aria-label="Estado de la tablet"><LockKeyhole size={14} /><span>Modo hogar</span></div></header>
    <div className="dashboard-grid">
      <article className="clock-card widget-card"><div className="widget-label"><span>Ahora</span><span className="live-dot">En directo</span></div><time className="time">{time}</time><p className="date">{date}</p><div className="morning-line"><SunMedium size={18} /><span>Que tengas un día estupendo</span></div></article>
      <article className="weather-card widget-card"><div className="weather-icon"><CloudSun size={38} strokeWidth={1.5} /></div><div><p className="temperature">22°</p><p className="weather-copy">Parcialmente nublado</p></div><span className="location">Casa</span></article>
      <article className="note-card widget-card"><div className="widget-heading"><div className="heading-icon coral"><Check size={18} /></div><div><p className="widget-title">Nota rápida</p><p className="widget-subtitle">Tu espacio personal</p></div></div><p className="note-content">Toca aquí para escribir una nota o recordatorio.</p><div className="note-footer"><span>Hoy</span><ChevronRight size={17} /></div></article>
      <article className="agenda-card widget-card"><div className="widget-heading"><div className="heading-icon blue"><CalendarDays size={18} /></div><div><p className="widget-title">Próximamente</p><p className="widget-subtitle">Sin eventos pendientes</p></div></div><div className="agenda-empty"><Compass size={22} /><span>Tu agenda aparecerá aquí</span></div></article>
    </div>
  </div>
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
  return <div className="settings-page"><header className="settings-header"><div><p className="eyebrow">Pablo Tablet</p><h1>Ajustes</h1></div><button type="button" className="back-button" onClick={onBack}>Volver al inicio</button></header><section className="settings-list" aria-label="Ajustes de la tablet"><SettingsRow icon={<Maximize size={20} />} title="Pantalla" detail="Preparada para pantalla completa" /><SettingsRow icon={<Volume2 size={20} />} title="Sonido" detail="Control de volumen y avisos" /><SettingsRow icon={<LockKeyhole size={20} />} title="Modo hogar" detail="Mantener Pablo Tablet como inicio" /></section><p className="settings-note">Estos controles se activarán en próximas fases del MVP.</p></div>
}

function SettingsRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <button type="button" className="settings-row"><span className="settings-icon">{icon}</span><span className="settings-copy"><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={20} /></button>
}

export default App
