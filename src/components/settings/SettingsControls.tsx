import type { ReactNode } from 'react'

export function SettingToggle({
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

export function SettingsSelect({
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

export function SettingsRange({ icon, label, value, minimum, maximum = 100, disabled = false, onChange }: { icon: ReactNode; label: string; value: number; minimum: number; maximum?: number; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <label className={`settings-row settings-range-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="settings-icon">{icon}</span>
      <span className="settings-range-content">
        <span><strong>{label}</strong><output>{value}%</output></span>
        <input type="range" min={minimum} max={maximum} step="1" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
      </span>
    </label>
  )
}

export function TimeSetting({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span>{label}</span><input type="time" value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function DurationSelect({ title, detail, value, options, onChange }: { title: string; detail: string; value: number; options: { value: number; label: string }[]; onChange: (value: number) => void }) {
  return (
    <label className="settings-row timeout-select-row">
      <span className="settings-copy"><strong>{title}</strong><small>{detail}</small></span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

export function ScreenTimeoutSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <DurationSelect title="Apagar pantalla tras" detail="Tiempo sin interacción antes de bloquearse." value={value} onChange={onChange} options={[
    { value: 30, label: '30 segundos' },
    { value: 60, label: '1 minuto' },
    { value: 120, label: '2 minutos' },
    { value: 300, label: '5 minutos' },
    { value: 600, label: '10 minutos' },
  ]} />
}

export function ScreensaverDelaySelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <DurationSelect title="Activar tras" detail="Tiempo sin tocar la pantalla." value={value} onChange={onChange} options={[
    { value: 30, label: '30 segundos' },
    { value: 60, label: '1 minuto' },
    { value: 180, label: '3 minutos' },
    { value: 300, label: '5 minutos' },
    { value: 600, label: '10 minutos' },
  ]} />
}
