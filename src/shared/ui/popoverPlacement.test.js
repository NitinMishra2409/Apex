import { describe, expect, it } from 'vitest'
import { placePopover } from './popoverPlacement'

describe('select popup placement', () => {
  it('anchors below a trigger with room', () => {
    expect(placePopover({ left: 20, top: 40, bottom: 84, width: 120 }, { width: 400, height: 600 }, 200, 180)).toEqual({ left: 20, top: 88, width: 180, maxHeight: 200 })
  })
  it('opens above a trigger near the bottom and shifts away from the right edge', () => {
    expect(placePopover({ left: 330, top: 440, bottom: 484, width: 120 }, { width: 400, height: 500 }, 200, 180)).toEqual({ left: 212, top: 236, width: 180, maxHeight: 200 })
  })
  it('fits a narrow viewport', () => {
    const result = placePopover({ left: 2, top: 20, bottom: 64, width: 300 }, { width: 320, height: 300 }, 500, 400)
    expect(result.left).toBe(8)
    expect(result.width).toBe(304)
    expect(result.maxHeight).toBeLessThanOrEqual(228)
  })
  it('stays in the visible portion of a zoomed and panned phone viewport', () => {
    const result = placePopover({ left: 170, top: 320, bottom: 364, width: 160 }, { left: 100, top: 200, width: 195, height: 300 }, 320, 240)
    expect(result).toEqual({ left: 108, top: 368, width: 179, maxHeight: 124 })
  })
})
