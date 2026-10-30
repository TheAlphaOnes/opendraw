/**
 * Selection-frame interaction tests: frame containment, border grabbing and
 * the resize cursors that advertise it. The hit tolerances are pinned to
 * Excalidraw's constants on purpose, a silent change to the grab zones
 * should turn this suite red.
 */

import { describe, expect, it } from 'vitest'

import {
  SIDE_GRAB_THRESHOLD,
  linearHandleAt,
  linearMidpointHandle,
  linearPointHandles,
  pointInSelectionFrame,
  POINT_HANDLE_HIT_RADIUS,
  resizeCursorFor,
  sideHandleAt,
} from '../src/interaction/handles.js'
import type { SelectionFrame } from '../src/interaction/handles.js'
import { newLinearElement } from '../src/elements/factories.js'

const FRAME: SelectionFrame = { x: 0, y: 0, width: 100, height: 50, angle: 0 }

describe('pointInSelectionFrame', () => {
  it('contains points inside the frame and rejects points outside', () => {
    expect(pointInSelectionFrame(FRAME, { x: 50, y: 25 })).toBe(true)
    expect(pointInSelectionFrame(FRAME, { x: -1, y: 25 })).toBe(false)
    expect(pointInSelectionFrame(FRAME, { x: 101, y: 25 })).toBe(false)
    expect(pointInSelectionFrame(FRAME, { x: 50, y: 51 })).toBe(false)
  })

  it('includes the frame border itself', () => {
    expect(pointInSelectionFrame(FRAME, { x: 0, y: 0 })).toBe(true)
    expect(pointInSelectionFrame(FRAME, { x: 100, y: 50 })).toBe(true)
  })

  it('dilates by the padding, in scene units', () => {
    expect(pointInSelectionFrame(FRAME, { x: -4, y: 25 }, 5)).toBe(true)
    expect(pointInSelectionFrame(FRAME, { x: -6, y: 25 }, 5)).toBe(false)
    expect(pointInSelectionFrame(FRAME, { x: 50, y: 55 }, 5)).toBe(true)
  })

  it('tests rotated frames in their local space', () => {
    const rotated: SelectionFrame = { x: 0, y: 0, width: 100, height: 50, angle: Math.PI / 2 }
    // Center stays the center; a point 5px off-center along the local
    // width axis (visual up) is still inside the rotated frame.
    expect(pointInSelectionFrame(rotated, { x: 50, y: 25 })).toBe(true)
    expect(pointInSelectionFrame(rotated, { x: 50, y: 20 })).toBe(true)
    // Far past the rotated edge (the local +y edge sits visually at x = 0).
    expect(pointInSelectionFrame(rotated, { x: -10, y: 25 })).toBe(false)
  })
})

describe('sideHandleAt', () => {
  it('returns the side a near-border point grabs', () => {
    expect(sideHandleAt(FRAME, { x: 50, y: 1 }, 1)).toBe('n')
    expect(sideHandleAt(FRAME, { x: 50, y: 49 }, 1)).toBe('s')
    expect(sideHandleAt(FRAME, { x: 99, y: 25 }, 1)).toBe('e')
    expect(sideHandleAt(FRAME, { x: 1, y: 25 }, 1)).toBe('w')
  })

  it('grabs from just inside and just outside the border', () => {
    expect(sideHandleAt(FRAME, { x: 50, y: SIDE_GRAB_THRESHOLD - 1 }, 1)).toBe('n')
    expect(sideHandleAt(FRAME, { x: 50, y: -SIDE_GRAB_THRESHOLD + 1 }, 1)).toBe('n')
  })

  it('rejects deep interiors and far exteriors', () => {
    expect(sideHandleAt(FRAME, { x: 50, y: 25 }, 1)).toBe(null)
    expect(sideHandleAt(FRAME, { x: 120, y: 25 }, 1)).toBe(null)
    expect(sideHandleAt(FRAME, { x: 50, y: -20 }, 1)).toBe(null)
  })

  it('stays finger-constant: the scene tolerance loosens at low zoom', () => {
    // 7px off the border misses at zoom 1 but grabs at zoom 0.5.
    expect(sideHandleAt(FRAME, { x: 50, y: -7 }, 1)).toBe(null)
    expect(sideHandleAt(FRAME, { x: 50, y: -7 }, 0.5)).toBe('n')
  })

  it('dilates past the corners so diagonal misses still grab a side', () => {
    // Just past the top-right corner, closer to the top border's dilated end.
    expect(sideHandleAt(FRAME, { x: 103, y: -2 }, 1)).toBe('n')
  })

  it('tests rotated frames in their local space', () => {
    const rotated: SelectionFrame = { x: 0, y: 0, width: 100, height: 50, angle: Math.PI / 2 }
    // The local top edge sits visually at x = 50..?, its midpoint is (75, 25),
    // with the local "up" direction pointing visually right.
    expect(sideHandleAt(rotated, { x: 77, y: 25 }, 1)).toBe('n')
  })
})

describe('resizeCursorFor', () => {
  it('maps each handle to its bidirectional cursor', () => {
    expect(resizeCursorFor('n')).toBe('ns-resize')
    expect(resizeCursorFor('s')).toBe('ns-resize')
    expect(resizeCursorFor('e')).toBe('ew-resize')
    expect(resizeCursorFor('w')).toBe('ew-resize')
    expect(resizeCursorFor('nw')).toBe('nwse-resize')
    expect(resizeCursorFor('se')).toBe('nwse-resize')
    expect(resizeCursorFor('ne')).toBe('nesw-resize')
    expect(resizeCursorFor('sw')).toBe('nesw-resize')
  })

  it('uses grab for the rotation handle', () => {
    expect(resizeCursorFor('rotation')).toBe('grab')
  })

  it('walks the cursor 45° per rotation step', () => {
    // A selection rotated 90°: its north side points visually east.
    expect(resizeCursorFor('n', Math.PI / 2)).toBe('ew-resize')
    expect(resizeCursorFor('nw', Math.PI / 4)).toBe('ns-resize')
    // A full turn comes back around.
    expect(resizeCursorFor('n', Math.PI * 2)).toBe('ns-resize')
    // Negative rotations normalize instead of falling off the list.
    expect(resizeCursorFor('n', -Math.PI / 4)).toBe('nwse-resize')
  })
})

describe('linear point handles', () => {
  const arrow = newLinearElement('arrow', {
    x: 100,
    y: 65,
    width: 200,
    height: 120,
    points: [{ x: 0, y: 0 }, { x: 200, y: 120 }],
  })

  it('lays the handles out at the scene positions of the points', () => {
    const handles = linearPointHandles(arrow)
    expect(handles).toEqual([
      { index: 0, at: { x: 100, y: 65 } },
      { index: 1, at: { x: 300, y: 185 } },
    ])
  })

  it('rotates handle positions with the element', () => {
    const rotated = { ...arrow, angle: Math.PI / 2 }
    const handles = linearPointHandles(rotated)
    // Pivot (200,125): start (100,65) lands at (260,25).
    expect(handles[0]!.at.x).toBeCloseTo(260, 5)
    expect(handles[0]!.at.y).toBeCloseTo(25, 5)
  })

  it('hits within the grab radius and misses outside it', () => {
    const handles = linearPointHandles(arrow)
    expect(linearHandleAt(handles, { x: 102, y: 66 }, 1)?.index).toBe(0)
    expect(linearHandleAt(handles, { x: 300, y: 200 }, 1)).toBeNull()
  })

  it('lets the later handle win when two overlap', () => {
    const handles = [
      { index: 0, at: { x: 100, y: 65 } },
      { index: 1, at: { x: 103, y: 65 } },
    ]
    // Equidistant-ish: the right-to-left scan must resolve to index 1.
    expect(linearHandleAt(handles, { x: 101.5, y: 65 }, 1)?.index).toBe(1)
  })

  it('pins the grab radius to Excalidraw constants', () => {
    expect(POINT_HANDLE_HIT_RADIUS).toBe(11)
  })

  it('shows one midpoint handle for a two-point linear only', () => {
    const mid = linearMidpointHandle(arrow)
    expect(mid).toEqual({ index: 1, at: { x: 200, y: 125 } })
    const three = { ...arrow, points: [{ x: 0, y: 0 }, { x: 100, y: 60 }, { x: 200, y: 120 }] }
    expect(linearMidpointHandle(three)).toBeNull()
  })
})
