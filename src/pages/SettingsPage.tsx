import { BellRing, Bot, CalendarDays, Clock3, CloudSun, FileText, Home, Images, LogOut, Mic, Moon, Palette, RotateCw, Sparkles, SunMedium, Type, Volume2 } from 'lucide-react'
import { type DashboardPageId, type DashboardPreferences, type PageNavigationPosition, type PageNavigationStyle } from '../dashboardState'
import type { DashboardWidget, DashboardWidgetId } from '../widgetLayout'
import { playInteractionSound, previewDeviceVolume } from '../deviceSettings'
import { exitTabletApp } from '../kioskMode'
import { MobileAdminSettings } from '../MobileAdminSettings'
import { ScreensaverDelaySelect, ScreenTimeoutSelect, SettingsRange, SettingsTextSelect, SettingToggle, TimeSetting } from '../components/settings/SettingsControls'
import { ThemePicker } from '../components/settings/ThemePicker'
import { AppUpdateSettings } from '../components/settings/AppUpdateSettings'
import { NotificationSettings } from '../components/settings/NotificationSettings'

export interface SettingsPageProps {
  preferences: DashboardPreferences
  widgets: DashboardWidget[]
  onBack: () => void
  onPreferencesChange: (patch: Partial<DashboardPreferences>) => void
  onTogglePage: (pageId: DashboardPageId) => void
  nightModeActive: boolean
  onWidgetVisibilityChange: (widgetId: DashboardWidgetId, visible: boolean) => void
}

interface DashboardVisibilitySetting {
  label: string
  pageId: Exclude<DashboardPageId, 'dashboard'>
  widgetId?: DashboardWidgetId
  widgetDetail?: string
}

const DASHBOARD_VISIBILITY_SETTINGS: DashboardVisibilitySetting[] = [
  { label: 'Calendario', pageId: 'calendar', widgetId: 'agenda', widgetDetail: 'Resumen del mes y próximos eventos.' },
  { label: 'Reloj', pageId: 'clock', widgetId: 'clock', widgetDetail: 'Hora y fecha en el panel de inicio.' },
  { label: 'Tiempo', pageId: 'weather', widgetId: 'weather', widgetDetail: 'Previsión de la ubicación marcada como Casa.' },
  { label: 'Notas', pageId: 'notes', widgetId: 'notes', widgetDetail: 'Acceso a la nota destacada.' },
  { label: 'Asistente', pageId: 'assistant', widgetId: 'assistant', widgetDetail: 'Acceso directo al asistente local.' },
  { label: 'Galería', pageId: 'gallery' },
]

function dashboardIcon(id: DashboardWidgetId | DashboardPageId) {
  if (id === 'clock') return <Clock3 size={20} />
  if (id === 'calendar' || id === 'agenda') return <CalendarDays size={20} />
  if (id === 'gallery') return <Images size={20} />
  if (id === 'weather') return <CloudSun size={20} />
  if (id === 'assistant') return <Sparkles size={20} />
  return <FileText size={20} />
}

export function SettingsPage({ preferences, widgets, onBack, onPreferencesChange, onTogglePage, nightModeActive, onWidgetVisibilityChange }: SettingsPageProps) {
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
        <div className="section-heading"><div><p className="eyebrow">Dashboard</p><h2 id="dashboard-settings-title">Widgets y páginas</h2></div><Home size={22} /></div>
        <div className="page-navigation-settings">
          <SettingsTextSelect<PageNavigationStyle>
            label="Diseño del paginador"
            value={preferences.pageNavigationStyle}
            options={[
              { value: 'dock', label: 'Dock compacto' },
              { value: 'labels', label: 'Barra con nombres' },
              { value: 'segmented', label: 'Segmentado' },
              { value: 'minimal', label: 'Línea mínima' },
            ]}
            onChange={(pageNavigationStyle) => onPreferencesChange({ pageNavigationStyle })}
          />
          <SettingsTextSelect<PageNavigationPosition>
            label="Posición del dock"
            value={preferences.pageNavigationPosition}
            options={[
              { value: 'bottom', label: 'Abajo' },
              { value: 'top', label: 'Arriba' },
              { value: 'left', label: 'Izquierda' },
              { value: 'right', label: 'Derecha' },
            ]}
            onChange={(pageNavigationPosition) => onPreferencesChange({ pageNavigationPosition })}
          />
          <SettingToggle
            icon={<Type size={20} />}
            title="Mostrar nombre de la página"
            detail="Añade el nombre junto al icono en el paginador."
            checked={preferences.showPageNavigationLabels}
            onChange={(showPageNavigationLabels) => onPreferencesChange({ showPageNavigationLabels })}
          />
        </div>
        <div className="dashboard-visibility-list">
          {DASHBOARD_VISIBILITY_SETTINGS.map((setting) => (
            <div key={setting.pageId} className={`dashboard-visibility-row ${setting.widgetId ? '' : 'is-page-only'}`}>
              {setting.widgetId ? (
                <SettingToggle
                  icon={dashboardIcon(setting.widgetId)}
                  title={`Widget ${setting.label}`}
                  detail={setting.widgetDetail ?? ''}
                  checked={widgets.find((current) => current.id === setting.widgetId)?.visible ?? false}
                  onChange={(visible) => onWidgetVisibilityChange(setting.widgetId!, visible)}
                />
              ) : null}
              <SettingToggle
                icon={dashboardIcon(setting.pageId)}
                title={`Página ${setting.label}`}
                detail="Disponible mediante swipe y navegación."
                checked={preferences.enabledPageIds.includes(setting.pageId)}
                onChange={() => onTogglePage(setting.pageId)}
              />
            </div>
          ))}
        </div>
        <div className="calendar-widget-options">
          <SettingToggle
            icon={<CalendarDays size={20} />}
            title="Próximos festivos"
            detail="Muestra una sección separada en el widget de calendario cuando dispone de espacio."
            checked={preferences.showUpcomingCalendarHolidays}
            onChange={(showUpcomingCalendarHolidays) => onPreferencesChange({ showUpcomingCalendarHolidays })}
          />
        </div>
      </section>

      <section className="settings-section" data-swipe-block aria-labelledby="assistant-settings-title">
        <div className="section-heading"><div><p className="eyebrow">Privacidad</p><h2 id="assistant-settings-title">Asistente</h2></div><Bot size={22} /></div>
        <div className="page-toggle-list assistant-settings-list">
          <SettingToggle icon={<Sparkles size={20} />} title="Activar Asistente" detail="Procesamiento local seguro; no envía datos ni guarda la conversación." checked={preferences.assistantEnabled} onChange={(assistantEnabled) => onPreferencesChange({ assistantEnabled })} />
          <SettingToggle icon={<Mic size={20} />} title="Entrada por voz" detail="El micrófono solo se activa al pulsar el botón." checked={preferences.assistantVoiceEnabled} disabled={!preferences.assistantEnabled} onChange={(assistantVoiceEnabled) => onPreferencesChange({ assistantVoiceEnabled })} />
          <SettingToggle icon={<Volume2 size={20} />} title="Leer respuestas automáticamente" detail="También puedes leer cada respuesta manualmente." checked={preferences.assistantReadAloud} disabled={!preferences.assistantEnabled} onChange={(assistantReadAloud) => onPreferencesChange({ assistantReadAloud })} />
        </div>
        <p className="settings-note assistant-privacy-note">Proveedor activo: local seguro · Límite: 30 peticiones por sesión · Historial: no guardado.</p>
      </section>

      <MobileAdminSettings />

      <section className="settings-section settings-list" data-swipe-block aria-labelledby="display-settings-title">
        <div className="section-heading"><div><p className="eyebrow">Dispositivo</p><h2 id="display-settings-title">Pantalla</h2></div><SunMedium size={22} /></div>
        <div className={`night-mode-settings ${preferences.nightModeEnabled ? 'is-enabled' : ''} ${nightModeActive ? 'is-active' : ''}`}>
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

      <div className="settings-compact-grid">
        <section className="settings-section settings-list compact-notifications" data-swipe-block aria-labelledby="notification-settings-title">
          <div className="section-heading"><div><p className="eyebrow">Avisos</p><h2 id="notification-settings-title">Notificaciones</h2></div><BellRing size={22} /></div>
          <NotificationSettings />
        </section>

        <section className="settings-section settings-list compact-screensaver" data-swipe-block aria-labelledby="screensaver-settings-title">
          <div className="section-heading"><div><p className="eyebrow">Inactividad</p><h2 id="screensaver-settings-title">Salvapantallas</h2></div><Images size={22} /></div>
          <SettingToggle icon={<Images size={20} />} title="Salvapantallas de fotos" detail="Muestra las fotos elegidas cuando la tablet queda inactiva." checked={preferences.screensaverEnabled} onChange={(screensaverEnabled) => onPreferencesChange({ screensaverEnabled })} />
          {preferences.screensaverEnabled ? <ScreensaverDelaySelect value={preferences.screensaverDelaySeconds} onChange={(screensaverDelaySeconds) => onPreferencesChange({ screensaverDelaySeconds })} /> : null}
        </section>

        <section className="settings-section compact-updates" data-swipe-block aria-label="Actualizaciones">
          <AppUpdateSettings />
        </section>

        <section className="settings-section settings-list compact-system" data-swipe-block aria-labelledby="system-settings-title">
          <div className="section-heading"><div><p className="eyebrow">Aplicación</p><h2 id="system-settings-title">Sistema</h2></div><LogOut size={22} /></div>
          <button type="button" className="settings-row exit-app-row" onClick={() => void exitTabletApp()}>
            <span className="settings-icon"><LogOut size={20} /></span>
            <span className="settings-copy"><strong>Salir de la app</strong><small>Desbloquear Android y cerrar Pablo Tablet</small></span>
          </button>
        </section>
      </div>
    </div>
  )
}
