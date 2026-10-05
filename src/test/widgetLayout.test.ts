import { describe, expect, it } from 'vitest'
import { arrangeWidgets, DEFAULT_WIDGETS, placeWidgets, readWidgets, type WidgetPosition } from '../widgetLayout'

function overlaps(first: WidgetPosition, second: WidgetPosition) {
  return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y
}

describe('layouts de widgets', () => {
  it('normaliza posiciones fuera del grid y restaura widgets que faltan', () => {
    const widgets = readWidgets([{ id: 'clock', visible: true, layouts: {
      landscape: { x: 20, y: -5, width: 2, height: 1 },
      portrait: { x: 9, y: 9, width: 1, height: 1 },
    } }])

    expect(widgets).toHaveLength(DEFAULT_WIDGETS.length)
    expect(widgets.find((widget) => widget.id === 'clock')?.layouts).toEqual({
      landscape: { x: 2, y: 0, width: 2, height: 1 },
      portrait: { x: 2, y: 3, width: 1, height: 1 },
    })
  })

  it('recoloca el resto de widgets sin solapamientos', () => {
    const arranged = arrangeWidgets(DEFAULT_WIDGETS, 'landscape', 'weather', { x: 0, y: 0, width: 1, height: 1 })
    expect(arranged).not.toBeNull()
    const placed = placeWidgets(arranged!, 'landscape')
    for (let index = 0; index < placed.length; index += 1) {
      for (let other = index + 1; other < placed.length; other += 1) {
        expect(overlaps(placed[index].layout, placed[other].layout)).toBe(false)
      }
    }
    expect(placed.find((widget) => widget.id === 'weather')?.layout).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('rechaza una configuración cuya superficie no cabe en el grid', () => {
    const oversized = DEFAULT_WIDGETS.map((widget) => ({
      ...widget,
      layouts: { ...widget.layouts, landscape: { x: 0, y: 0, width: 4, height: 3 } },
    }))
    expect(arrangeWidgets(oversized, 'landscape', 'clock', oversized[0].layouts.landscape)).toBeNull()
  })
})
