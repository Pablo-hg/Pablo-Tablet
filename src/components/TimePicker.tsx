import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Clock3, Minus, Plus } from 'lucide-react'
import { tx } from '../i18n'
import './TimePicker.css'

interface TimePickerProps {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TimePicker({ label, value, onChange, disabled = false }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const displayId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const display = /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? `${String(Number(value.slice(0, 2)) % 12 || 12).padStart(2, '0')}:${value.slice(3)} ${Number(value.slice(0, 2)) >= 12 ? 'PM' : 'AM'}` : '––:––'
  const close = () => { setOpen(false); trigger.current?.focus() }
  return <div className="time-picker-field">
    <span className="time-picker-label">{label}</span>
    <button ref={trigger} type="button" className="time-picker-trigger" aria-label={label} aria-describedby={displayId} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={event => { setHost(event.currentTarget.closest<HTMLElement>('.tablet-shell') ?? document.body); setOpen(true) }}><Clock3 size={16} /><span id={displayId}>{display}</span></button>
    {open && host ? createPortal(<TimePickerDialog label={label} value={value} onCancel={close} onApply={next => { onChange(next); close() }} />, host) : null}
  </div>
}

function TimePickerDialog({ label, value, onCancel, onApply }: { label: string; value: string; onCancel: () => void; onApply: (value: string) => void }) {
  const validInitial = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '00:00'
  const hour24 = Number(validInitial.slice(0, 2))
  const [hour, setHour] = useState(String(hour24 % 12 || 12).padStart(2, '0'))
  const [minute, setMinute] = useState(validInitial.slice(3))
  const [period, setPeriod] = useState<'AM' | 'PM'>(hour24 >= 12 ? 'PM' : 'AM')
  const dialog = useRef<HTMLElement>(null)
  const hourInput = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const hintId = useId()
  const valid = /^\d{1,2}$/.test(hour) && Number(hour) >= 1 && Number(hour) <= 12 && /^\d{1,2}$/.test(minute) && Number(minute) >= 0 && Number(minute) <= 59
  useEffect(() => { hourInput.current?.focus(); hourInput.current?.select() }, [])
  const step = (part: 'hour' | 'minute', delta: number) => {
    if (part === 'minute') { setMinute(String(((Number(minute) || 0) + delta + 60) % 60).padStart(2, '0')); return }
    const next = ((Number(hour) || 12) % 12 + (period === 'PM' ? 12 : 0) + delta + 24) % 24
    setHour(String(next % 12 || 12).padStart(2, '0'))
    setPeriod(next >= 12 ? 'PM' : 'AM')
  }
  const apply = () => {
    if (valid) onApply(`${String(Number(hour) % 12 + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${minute.padStart(2, '0')}`)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); onCancel() }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); apply() }
    if (event.key === 'Tab') {
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }
  return <div className="time-picker-backdrop" onPointerDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) onCancel() }} onClick={event => event.stopPropagation()}>
    <section ref={dialog} className="time-picker-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={hintId} onKeyDown={onKeyDown}>
      <header><h2 id={titleId}>{tx('Elegir hora')}</h2><p>{label}</p></header>
      <div className="time-picker-clock">
        <div className="time-picker-column">
          <button type="button" aria-label={tx('Subir hora')} onClick={() => step('hour', 1)}><Plus size={18} /></button>
          <input ref={hourInput} type="number" inputMode="numeric" min={1} max={12} step={1} aria-label={tx('Horas')} value={hour} onChange={event => setHour(event.target.value)} />
          <button type="button" aria-label={tx('Bajar hora')} onClick={() => step('hour', -1)}><Minus size={18} /></button>
        </div>
        <span className="time-picker-colon" aria-hidden="true">:</span>
        <div className="time-picker-column">
          <button type="button" aria-label={tx('Subir minutos')} onClick={() => step('minute', 1)}><Plus size={18} /></button>
          <input type="number" inputMode="numeric" min={0} max={59} step={1} aria-label={tx('Minutos')} value={minute} onChange={event => setMinute(event.target.value)} />
          <button type="button" aria-label={tx('Bajar minutos')} onClick={() => step('minute', -1)}><Minus size={18} /></button>
        </div>
        <div className="time-picker-period" role="group" aria-label={tx('Periodo del día')}>
          {(['AM', 'PM'] as const).map(item => <button key={item} type="button" aria-pressed={period === item} onClick={() => setPeriod(item)}>{item}</button>)}
        </div>
      </div>
      <p id={hintId} className="time-picker-hint">{tx('Puedes escribir la hora y los minutos o usar los botones.')}</p>
      <footer><button type="button" className="time-picker-cancel" onClick={onCancel}>{tx('Cancelar')}</button><button type="button" className="time-picker-apply" disabled={!valid} onClick={apply}>{tx('Aplicar')}</button></footer>
    </section>
  </div>
}

/** Mantiene una fecha/hora incompleta como borrador; solo guarda al completar ambas. */
export function DateTimePicker({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  const localValue = value && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? (() => {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  })() : value ?? ''
  const [date, setDate] = useState(localValue.slice(0, 10))
  const [time, setTime] = useState(localValue.slice(11, 16))
  useEffect(() => { setDate(localValue.slice(0, 10)); setTime(localValue.slice(11, 16)) }, [localValue])
  return <div className="date-time-picker">
    <label><span>{label}</span><input type="date" aria-label={tx('Fecha del recordatorio')} value={date} onChange={event => { const next = event.target.value; setDate(next); if (next && time) onChange(`${next}T${time}`); else if (!next) onChange(null) }} /></label>
    <TimePicker label={tx('Hora del recordatorio')} value={time} onChange={next => { setTime(next); if (date) onChange(`${date}T${next}`) }} />
    {value || date || time ? <button type="button" className="text-action" onClick={() => { setDate(''); setTime(''); onChange(null) }}>{tx('Quitar recordatorio')}</button> : null}
  </div>
}
