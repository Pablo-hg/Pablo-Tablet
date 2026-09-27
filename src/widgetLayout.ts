export const DASHBOARD_COLUMNS = 3

export type DashboardWidgetId = 'clock' | 'weather' | 'notes' | 'agenda'
export type DashboardOrientation = 'landscape' | 'portrait'

export interface WidgetSize {
  width: number
  height: number
}

export interface WidgetPosition extends WidgetSize {
  x: number
  y: number
}

export interface DashboardWidget {
  id: DashboardWidgetId
  visible: boolean
  layouts: Record<DashboardOrientation, WidgetPosition>
}

export interface PlacedWidget extends DashboardWidget {
  layout: WidgetPosition
}

export const WIDGET_SIZES: Record<DashboardWidgetId, readonly WidgetSize[]> = {
  clock: [{ width: 1, height: 1 }, { width: 1, height: 2 }, { width: 2, height: 1 }, { width: 2, height: 2 }, { width: 3, height: 1 }, { width: 3, height: 2 }],
  weather: [{ width: 1, height: 1 }, { width: 1, height: 2 }, { width: 2, height: 1 }, { width: 2, height: 2 }],
  notes: [{ width: 1, height: 1 }, { width: 2, height: 1 }, { width: 2, height: 2 }, { width: 3, height: 1 }],
  agenda: [{ width: 1, height: 1 }, { width: 2, height: 1 }, { width: 2, height: 2 }, { width: 3, height: 1 }],
}

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'agenda', visible: true, layouts: { landscape: { x: 0, y: 0, width: 2, height: 2 }, portrait: { x: 0, y: 0, width: 3, height: 2 } } },
  { id: 'clock', visible: true, layouts: { landscape: { x: 2, y: 0, width: 1, height: 1 }, portrait: { x: 0, y: 2, width: 3, height: 1 } } },
  { id: 'weather', visible: true, layouts: { landscape: { x: 2, y: 1, width: 1, height: 2 }, portrait: { x: 0, y: 3, width: 1, height: 1 } } },
  { id: 'notes', visible: true, layouts: { landscape: { x: 0, y: 2, width: 2, height: 1 }, portrait: { x: 1, y: 3, width: 2, height: 1 } } },
]

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return value === 'clock' || value === 'weather' || value === 'notes' || value === 'agenda'
}

export function isWidgetPosition(value: unknown): value is WidgetPosition {
  if (!value || typeof value !== 'object') return false
  const position = value as Partial<WidgetPosition>
  return [position.x, position.y, position.width, position.height].every((part) => typeof part === 'number' && Number.isInteger(part))
}

export function isAllowedWidgetSize(widgetId: DashboardWidgetId, size: WidgetSize) {
  return WIDGET_SIZES[widgetId].some((candidate) => candidate.width === size.width && candidate.height === size.height)
}

function normalisePosition(widgetId: DashboardWidgetId, position: WidgetPosition, orientation: DashboardOrientation): WidgetPosition {
  const fallback = DEFAULT_WIDGETS.find((widget) => widget.id === widgetId)?.layouts[orientation] ?? { x: 0, y: 0, width: 1, height: 1 }
  const size = isAllowedWidgetSize(widgetId, position) ? position : fallback
  return {
    x: Math.max(0, Math.min(DASHBOARD_COLUMNS - size.width, position.x)),
    y: Math.max(0, position.y),
    width: size.width,
    height: size.height,
  }
}

/**
 * Keeps persisted data safe to consume. One record exists for every built-in
 * widget so a newer version of the app can add defaults without a migration UI.
 */
export function readWidgets(value: unknown): DashboardWidget[] {
  const input = Array.isArray(value) ? value : []
  const fromStorage = new Map<DashboardWidgetId, DashboardWidget>()

  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const widget = item as Partial<DashboardWidget>
    if (!isDashboardWidgetId(widget.id) || !widget.layouts || typeof widget.layouts !== 'object') continue
    const landscape = widget.layouts.landscape
    const portrait = widget.layouts.portrait
    if (!isWidgetPosition(landscape) || !isWidgetPosition(portrait)) continue
    fromStorage.set(widget.id, {
      id: widget.id,
      visible: typeof widget.visible === 'boolean' ? widget.visible : true,
      layouts: {
        landscape: normalisePosition(widget.id, landscape, 'landscape'),
        portrait: normalisePosition(widget.id, portrait, 'portrait'),
      },
    })
  }

  return DEFAULT_WIDGETS.map((fallback) => fromStorage.get(fallback.id) ?? {
    ...fallback,
    layouts: { landscape: { ...fallback.layouts.landscape }, portrait: { ...fallback.layouts.portrait } },
  })
}

function overlaps(a: WidgetPosition, b: WidgetPosition) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function findFirstSpace(candidate: WidgetPosition, occupied: WidgetPosition[]) {
  for (let y = 0; y < 100; y += 1) {
    for (let x = 0; x <= DASHBOARD_COLUMNS - candidate.width; x += 1) {
      const position = { ...candidate, x, y }
      if (!occupied.some((placed) => overlaps(position, placed))) return position
    }
  }
  return { ...candidate, x: 0, y: occupied.reduce((bottom, item) => Math.max(bottom, item.y + item.height), 0) }
}

/**
 * Resolves collisions deterministically. Layout editors can save positions in
 * any order; the tablet never renders overlapping or out-of-bounds cards.
 */
export function placeWidgets(widgets: DashboardWidget[], orientation: DashboardOrientation): PlacedWidget[] {
  const occupied: WidgetPosition[] = []
  return widgets
    .filter((widget) => widget.visible)
    .map((widget) => ({ widget, requested: normalisePosition(widget.id, widget.layouts[orientation], orientation) }))
    .sort((a, b) => a.requested.y - b.requested.y || a.requested.x - b.requested.x || a.widget.id.localeCompare(b.widget.id))
    .map(({ widget, requested }) => {
      const layout = occupied.some((placed) => overlaps(requested, placed)) ? findFirstSpace(requested, occupied) : requested
      occupied.push(layout)
      return { ...widget, layout }
    })
}
