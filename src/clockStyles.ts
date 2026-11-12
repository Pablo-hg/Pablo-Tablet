export const CLOCK_WIDGET_STYLES = [
  { id: 'digital', label: 'Digital clásico' },
  { id: 'digital-blocks', label: 'Digital en bloques' },
  { id: 'analog', label: 'Analógico con números' },
  { id: 'analog-minimal', label: 'Analógico minimalista' },
] as const

export type ClockWidgetStyle = typeof CLOCK_WIDGET_STYLES[number]['id']

export function readClockWidgetStyle(value: unknown): ClockWidgetStyle {
  return CLOCK_WIDGET_STYLES.find(style => style.id === value)?.id ?? 'digital'
}
