import { BellRing, Bot, CalendarDays, Clock3, CloudSun, FileText, Home, Images, LogOut, Mic, Moon, Palette, RotateCw, Sparkles, SunMedium, Volume2 } from 'lucide-react'
import { DASHBOARD_PAGES, type DashboardPageId, type DashboardPreferences } from '../dashboardState'
import { playInteractionSound, previewDeviceVolume } from '../deviceSettings'
import { exitTabletApp } from '../kioskMode'
import { MobileAdminSettings } from '../MobileAdminSettings'
import { ScreensaverDelaySelect, ScreenTimeoutSelect, SettingsRange, SettingsSelect, SettingToggle, TimeSetting } from '../components/settings/SettingsControls'
import { ThemePicker } from '../components/settings/ThemePicker'
import { AppUpdateSettings } from '../components/settings/AppUpdateSettings'
import { NotificationSettings } from '../components/settings/NotificationSettings'

export interface SettingsPageProps {
  preferences: DashboardPreferences
  onBack: () => void
  onPreferencesChange: (patch: Partial<DashboardPreferences>) => void
  onTogglePage: (pageId: DashboardPageId) => void
  nightModeActive: boolean
  assistantWidgetVisible: boolean
  onAssistantWidgetVisibilityChange: (visible: boolean) => void
}

export function SettingsPage({ preferences, onBack, onPreferencesChange, onTogglePage, nightModeActive, assistantWidgetVisible, onAssistantWidgetVisibilityChange }: SettingsPageProps) {
  return (
    <div className="settings-page page-enter">
      <header className="settings-header">
        <div><p className="eyebrow">Pablo Tablet</p><h1>Ajustes</h1></div>
        <button type="button" className="btn back-button" onClick={onBack}>Volver al inicio</button>
      </header>

      <section className="settings-section" data-swipe-block aria-labelledby="appearance-settings-title">
        <div className="section-heading">
          <div><p className="eyebrow">Personalización</p><h2 id="appearance-settings-title">Apariencia</h2></div>
          <Palette size={22} />
        </div>
        <ThemePicker value={preferences.themeId} onChange={(themeId) => onPreferencesChange({ themeId })} />
      </section>

      <section className="settings-section" data-swipe-block aria-labelledby="dashboard-settings-title">
        <div className="section-heading"><div><p className="eyebrow">Dashboard</p><h2 id="dashboard-settings-title">Páginas</h2></div><Home size={22} /></div>
        <SettingsSelect label="Ocultar navegación tras" value={preferences.navigationSeconds} options={[3, 5, 8]} suffix="s" onChange={(navigationSeconds) => onPreferencesChange({ navigationSeconds })} />
        <div className="page-toggle-list">
          {DASHBOARD_PAGES.filter((page) => page.id !== 'dashboard').map((page) => (
            <SettingToggle
              key={page.id}
              icon={page.id === 'clock' ? <Clock3 size={20} /> : page.id === 'calendar' ? <CalendarDays size={20} /> : page.id === 'gallery' ? <Images size={20} /> : page.id === 'weather' ? <CloudSun size={20} /> : page.id === 'assistant' ? <Sparkles size={20} /> : <FileText size={20} />}
              title={`Página ${page.label}`}
              detail="Página fullscreen disponible mediante swipe y navegación."
              checked={preferences.enabledPageIds.includes(page.id)}
              onChange={() => onTogglePage(page.id)}
            />
          ))}
        </div>
      </section>

      <section className="settings-section" data-swipe-block aria-labelledby="assistant-settings-title">
        <div className="section-heading"><div><p className="eyebrow">Privacidad</p><h2 id="assistant-settings-title">Asistente</h2></div><Bot size={22} /></div>
        <div className="page-toggle-list assistant-settings-list">
          <SettingToggle icon={<Sparkles size={20} />} title="Activar Asistente" detail="Procesamiento local seguro; no envía datos ni guarda la conversación." checked={preferences.assistantEnabled} onChange={(assistantEnabled) => onPreferencesChange({ assistantEnabled })} />
          <SettingToggle icon={<Home size={20} />} title="Widget Asistente" detail="Añade un acceso configurable sin cambiar la cuadrícula 3 × 4." checked={assistantWidgetVisible} onChange={onAssistantWidgetVisibilityChange} />
          <SettingToggle icon={<Mic size={20} />} title="Entrada por voz" detail="El micrófono solo se activa al pulsar el botón." checked={preferences.assistantVoiceEnabled} disabled={!preferences.assistantEnabled} onChange={(assistantVoiceEnabled) => onPreferencesChange({ assistantVoiceEnabled })} />
          <SettingToggle icon={<Volume2 size={20} />} title="Leer respuestas automáticamente" detail="También puedes leer cada respuesta manualmente." checked={preferences.assistantReadAloud} disabled={!preferences.assistantEnabled} onChange={(assistantReadAloud) => onPreferencesChange({ assistantReadAloud })} />
        </div>
        <p className="settings-note assistant-privacy-note">Proveedor activo: local seguro · Límite: 30 peticiones por sesión · Historial: no guardado.</p>
      </section>

      <MobileAdminSettings />

      <section className="settings-section settings-list" data-swipe-block aria-labelledby="display-settings-title">
        <div className="section-heading"><div><p className="eyebrow">Dispositivo</p><h2 id="display-settings-title">Pantalla</h2></div><SunMedium size={22} /></div>
        <div className={`night-mode-settings ${nightModeActive ? 'is-active' : ''}`}>
          <SettingToggle
            icon={<Moon size={20} />}
            title={nightModeActive ? 'Modo nocturno activo' : 'Modo nocturno automático'}
            detail={nightModeActive ? `Activo hasta las ${preferences.nightModeEnd}.` : `Se activará a las ${preferences.nightModeStart}.`}
            checked={preferences.nightModeEnabled}
            onChange={(nightModeEnabled) => onPreferencesChange({ nightModeEnabled })}
          />
          {preferences.nightModeEnabled ? <div className="night-mode-controls">
            <div className="night-schedule" aria-label="Horario del modo nocturno">
              <TimeSetting label="Desde" value={preferences.nightModeStart} onChange={(nightModeStart) => onPreferencesChange({ nightModeStart })} />
              <TimeSetting label="Hasta" value={preferences.nightModeEnd} onChange={(nightModeEnd) => onPreferencesChange({ nightModeEnd })} />
            </div>
            <SettingsRange icon={<SunMedium size={20} />} label="Brillo nocturno" value={preferences.nightBrightness} minimum={1} maximum={30} onChange={(nightBrightness) => onPreferencesChange({ nightBrightness })} />
            <SettingsRange icon={<Volume2 size={20} />} label="Alarmas por la noche" value={preferences.nightAlarmVolume} minimum={0} onChange={(nightAlarmVolume) => onPreferencesChange({ nightAlarmVolume })} />
            <SettingsRange icon={<Volume2 size={20} />} label="Volumen nocturno" value={preferences.nightMediaVolume} minimum={0} onChange={(nightMediaVolume) => onPreferencesChange({ nightMediaVolume })} />
          </div> : null}
        </div>
        <SettingToggle icon={<RotateCw size={20} />} title="Rotación automática" detail={preferences.autoRotate ? 'La pantalla cambia al girar la tablet.' : 'La orientación actual permanecerá bloqueada.'} checked={preferences.autoRotate} onChange={(autoRotate) => onPreferencesChange({ autoRotate })} />
        <SettingToggle icon={<SunMedium size={20} />} title={nightModeActive && preferences.autoBrightness ? 'Brillo automático en pausa' : 'Brillo automático'} detail={nightModeActive && preferences.autoBrightness ? 'Se recuperará al terminar el horario nocturno.' : 'Adapta el brillo a la luz ambiental de la habitación.'} checked={preferences.autoBrightness} onChange={(autoBrightness) => onPreferencesChange({ autoBrightness })} />
        <SettingsRange icon={<SunMedium size={20} />} label="Brillo" value={preferences.brightness} minimum={10} disabled={preferences.autoBrightness} onChange={(brightness) => onPreferencesChange({ brightness })} />
        <SettingToggle icon={<SunMedium size={20} />} title="Pantalla siempre encendida" detail="Evita que la tablet se suspenda mientras Pablo Tablet está abierta." checked={preferences.keepScreenAwake} onChange={(keepScreenAwake) => onPreferencesChange({ keepScreenAwake })} />
        {!preferences.keepScreenAwake ? <ScreenTimeoutSelect value={preferences.screenTimeoutSeconds} onChange={(screenTimeoutSeconds) => onPreferencesChange({ screenTimeoutSeconds })} /> : null}
      </section>

      <section className="settings-section settings-list" data-swipe-block aria-labelledby="sound-settings-title">
        <div className="section-heading"><div><p className="eyebrow">Dispositivo</p><h2 id="sound-settings-title">Sonido</h2></div><Volume2 size={22} /></div>
        <SettingsRange icon={<Volume2 size={20} />} label="Volumen de alarmas" value={preferences.alarmVolume} minimum={0} onChange={(alarmVolume) => { onPreferencesChange({ alarmVolume }); void previewDeviceVolume('alarm', alarmVolume) }} />
        <SettingsRange icon={<Volume2 size={20} />} label="Volumen general" value={preferences.mediaVolume} minimum={0} onChange={(mediaVolume) => { onPreferencesChange({ mediaVolume }); void playInteractionSound(mediaVolume) }} />
        <SettingToggle icon={<Volume2 size={20} />} title="Sonido al interactuar" detail="Reproduce un toque breve al pulsar controles." checked={preferences.interactionSoundsEnabled} onChange={(interactionSoundsEnabled) => { onPreferencesChange({ interactionSoundsEnabled }); if (interactionSoundsEnabled) void playInteractionSound(preferences.mediaVolume) }} />
      </section>

      <section className="settings-section settings-list" data-swipe-block aria-labelledby="notification-settings-title">
        <div className="section-heading"><div><p className="eyebrow">Avisos</p><h2 id="notification-settings-title">Notificaciones</h2></div><BellRing size={22} /></div>
        <NotificationSettings />
      </section>

      <section className="settings-section settings-list" data-swipe-block aria-labelledby="screensaver-settings-title">
        <div className="section-heading"><div><p className="eyebrow">Inactividad</p><h2 id="screensaver-settings-title">Salvapantallas</h2></div><Images size={22} /></div>
        <SettingToggle icon={<Images size={20} />} title="Salvapantallas de fotos" detail="Muestra las fotos elegidas cuando la tablet queda inactiva." checked={preferences.screensaverEnabled} onChange={(screensaverEnabled) => onPreferencesChange({ screensaverEnabled })} />
        {preferences.screensaverEnabled ? <ScreensaverDelaySelect value={preferences.screensaverDelaySeconds} onChange={(screensaverDelaySeconds) => onPreferencesChange({ screensaverDelaySeconds })} /> : null}
      </section>

      <section className="settings-section" data-swipe-block aria-label="Actualizaciones">
        <AppUpdateSettings />
      </section>

      <section className="settings-section settings-list" data-swipe-block aria-labelledby="system-settings-title">
        <div className="section-heading"><div><p className="eyebrow">Aplicación</p><h2 id="system-settings-title">Sistema</h2></div><LogOut size={22} /></div>
        <button type="button" className="settings-row exit-app-row" onClick={() => void exitTabletApp()}>
          <span className="settings-icon"><LogOut size={20} /></span>
          <span className="settings-copy"><strong>Salir de la app</strong><small>Desbloquear Android y cerrar Pablo Tablet</small></span>
        </button>
      </section>
    </div>
  )
}
