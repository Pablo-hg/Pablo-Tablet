import { useId } from 'react'
import { CLOCK_WIDGET_STYLES, type ClockWidgetStyle } from '../clockStyles'
import { tx } from '../i18n'
import { ClockFace } from './ClockFace'

// The same sample time makes the four designs directly comparable.
const previewTime = new Date(2026, 0, 1, 9, 41)

export function ClockStylePicker({ value, onChange }: { value: ClockWidgetStyle; onChange: (style: ClockWidgetStyle) => void }) {
  const titleId = useId()
  return <section className="clock-style-picker" role="group" aria-labelledby={titleId} data-swipe-block>
    <h2 id={titleId}>{tx('Estilo del widget de reloj')}</h2>
    <p>{tx('Elige cómo se ve el reloj en Inicio. Se guarda automáticamente.')}</p>
    <div className="clock-style-options">
      {CLOCK_WIDGET_STYLES.map(style => <label key={style.id} className={`clock-style-option ${value === style.id ? 'is-selected' : ''}`}>
        <input type="radio" name="clock-widget-style" value={style.id} checked={value === style.id} onChange={() => onChange(style.id)} />
        <span className="clock-style-preview" aria-hidden="true"><ClockFace now={previewTime} style={style.id} /></span>
        <span className="clock-style-name">{tx(style.label)}</span>
      </label>)}
    </div>
  </section>
}
