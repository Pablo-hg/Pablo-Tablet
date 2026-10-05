export type DashboardWidgetId = 'clock' | 'weather' | 'notes' | 'agenda'
export type DashboardOrientation = 'landscape' | 'portrait'

export const DASHBOARD_COLUMNS: Record<DashboardOrientation, number> = { landscape: 4, portrait: 3 }
export const DASHBOARD_ROWS: Record<DashboardOrientation, number> = { landscape: 3, portrait: 4 }

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

const RESPONSIVE_WIDGET_SIZES: readonly WidgetSize[] = [
  { width: 1, height: 1 },
  { width: 1, height: 2 },
  { width: 1, height: 3 },
  { width: 1, height: 4 },
  { width: 2, height: 1 },
  { width: 2, height: 2 },
  { width: 2, height: 3 },
  { width: 2, height: 4 },
  { width: 3, height: 1 },
  { width: 3, height: 2 },
  { width: 3, height: 3 },
  { width: 3, height: 4 },
  { width: 4, height: 1 },
  { width: 4, height: 2 },
  { width: 4, height: 3 },
  { width: 4, height: 4 },
]

export const WIDGET_SIZES: Record<DashboardWidgetId, readonly WidgetSize[]> = {
  clock: RESPONSIVE_WIDGET_SIZES,
  weather: RESPONSIVE_WIDGET_SIZES,
  notes: RESPONSIVE_WIDGET_SIZES,
  agenda: RESPONSIVE_WIDGET_SIZES,
}

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'agenda', visible: true, layouts: { landscape: { x: 0, y: 0, width: 2, height: 2 }, portrait: { x: 0, y: 0, width: 3, height: 3 } } },
  { id: 'clock', visible: true, layouts: { landscape: { x: 2, y: 0, width: 2, height: 1 }, portrait: { x: 0, y: 3, width: 1, height: 1 } } },
  { id: 'weather', visible: true, layouts: { landscape: { x: 2, y: 1, width: 1, height: 2 }, portrait: { x: 1, y: 3, width: 1, height: 1 } } },
  { id: 'notes', visible: true, layouts: { landscape: { x: 0, y: 2, width: 2, height: 1 }, portrait: { x: 2, y: 3, width: 1, height: 1 } } },
]

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return value === 'clock' || value === 'weather' || value === 'notes' || value === 'agenda'
}

export function isWidgetPosition(value: unknown): value is WidgetPosition {
  if (!value || typeof value !== 'object') return false
  const position = value as Partial<WidgetPosition>
  return [position.x, position.y, position.width, position.height].every((part) => typeof part === 'number' && Number.isInteger(part))
}

export function isAllowedWidgetSize(widgetId: DashboardWidgetId, size: WidgetSize, orientation?: DashboardOrientation) {
  return WIDGET_SIZES[widgetId].some((candidate) => candidate.width === size.width && candidate.height === size.height)
    && (!orientation || (size.width <= DASHBOARD_COLUMNS[orientation] && size.height <= DASHBOARD_ROWS[orientation]))
}

function normalisePosition(widgetId: DashboardWidgetId, position: WidgetPosition, orientation: DashboardOrientation): WidgetPosition {
  const fallback = DEFAULT_WIDGETS.find((widget) => widget.id === widgetId)?.layouts[orientation] ?? { x: 0, y: 0, width: 1, height: 1 }
  const size = isAllowedWidgetSize(widgetId, position, orientation) ? position : fallback
  return {
    x: Math.max(0, Math.min(DASHBOARD_COLUMNS[orientation] - size.width, position.x)),
    y: Math.max(0, Math.min(DASHBOARD_ROWS[orientation] - size.height, position.y)),
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

function positionsForSize(size: WidgetSize, orientation: DashboardOrientation, requested: WidgetPosition) {
  const columns = DASHBOARD_COLUMNS[orientation]
  const rows = DASHBOARD_ROWS[orientation]
  const positions: WidgetPosition[] = []
  for (let y = 0; y <= rows - size.height; y += 1) {
    for (let x = 0; x <= columns - size.width; x += 1) positions.push({ ...size, x, y })
  }
  return positions.sort((a, b) => {
    const distanceA = Math.abs(a.x - requested.x) + Math.abs(a.y - requested.y)
    const distanceB = Math.abs(b.x - requested.x) + Math.abs(b.y - requested.y)
    return distanceA - distanceB || a.y - b.y || a.x - b.x
  })
}

/**
 * Places a moved or resized widget at its requested cell and searches for a
 * complete arrangement for the rest. Returns null when the grid cannot fit.
 */
export function arrangeWidgets(widgets: DashboardWidget[], orientation: DashboardOrientation, preferredId: DashboardWidgetId, preferredPosition: WidgetPosition): DashboardWidget[] | null {
  const rows = DASHBOARD_ROWS[orientation]
  const columns = DASHBOARD_COLUMNS[orientation]
  const preferredWidget = widgets.find((widget) => widget.id === preferredId && widget.visible)
  if (!preferredWidget || !isAllowedWidgetSize(preferredId, preferredPosition, orientation)) return null

  const normalisedPreferred = normalisePosition(preferredId, preferredPosition, orientation)
  const preferred = { ...normalisedPreferred, y: Math.min(normalisedPreferred.y, rows - normalisedPreferred.height) }
  const visible = widgets.filter((widget) => widget.visible)
  const totalArea = visible.reduce((area, widget) => {
    const layout = widget.id === preferredId ? preferred : normalisePosition(widget.id, widget.layouts[orientation], orientation)
    return area + layout.width * layout.height
  }, 0)
  if (totalArea > columns * rows) return null

  const remaining = visible
    .filter((widget) => widget.id !== preferredId)
    .map((widget) => ({ widget, requested: normalisePosition(widget.id, widget.layouts[orientation], orientation) }))
    .sort((a, b) => b.requested.width * b.requested.height - a.requested.width * a.requested.height || a.requested.y - b.requested.y || a.requested.x - b.requested.x)
  const placements = new Map<DashboardWidgetId, WidgetPosition>([[preferredId, preferred]])

  const placeNext = (index: number, occupied: WidgetPosition[]): boolean => {
    if (index >= remaining.length) return true
    const { widget, requested } = remaining[index]
    for (const candidate of positionsForSize(requested, orientation, requested)) {
      if (occupied.some((position) => overlaps(candidate, position))) continue
      placements.set(widget.id, candidate)
      if (placeNext(index + 1, [...occupied, candidate])) return true
      placements.delete(widget.id)
    }
    return false
  }

  if (!placeNext(0, [preferred])) return null
  return widgets.map((widget) => {
    const layout = placements.get(widget.id)
    return layout ? { ...widget, layouts: { ...widget.layouts, [orientation]: layout } } : widget
  })
}

/** Resizes one widget while preserving every other widget's chosen size. */
export function resizeWidgets(widgets: DashboardWidget[], orientation: DashboardOrientation, preferredId: DashboardWidgetId, preferredPosition: WidgetPosition): DashboardWidget[] | null {
  return arrangeWidgets(widgets, orientation, preferredId, preferredPosition)
}

function findFirstSpace(candidate: WidgetPosition, occupied: WidgetPosition[], orientation: DashboardOrientation) {
  for (let y = 0; y < 100; y += 1) {
    for (let x = 0; x <= DASHBOARD_COLUMNS[orientation] - candidate.width; x += 1) {
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
      const layout = occupied.some((placed) => overlaps(requested, placed)) ? findFirstSpace(requested, occupied, orientation) : requested
      occupied.push(layout)
      return { ...widget, layout }
    })
}
