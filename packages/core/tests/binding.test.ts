import { describe, expect, it } from 'vitest'

import {
  BASE_BINDING_GAP,
  bindingFollowPatches,
  bindableShapeAt,
  bindingGap,
  computeLinearBindings,
  dockPoint,
  isBindableShape,
  maxBindingDistance,
  orphanBindingPatches,
} from '../src/elements/binding.js'
import {
  newDiamondElement,
  newFreedrawElement,
  newLinearElement,
  newRectangleElement,
  newTextElement,
} from '../src/elements/factories.js'
import { coerceElement } from '../src/export/serialize.js'
import type { NewLinearElementOptions } from '../src/elements/factories.js'
import type {
  VueDrawArrowElement,
  VueDrawBinding,
  VueDrawElement,
  VueDrawLineElement,
} from '../src/types.js'

// ---------------------------------------------------------------------------
// Fixtures — rect A sits at (100,100) sized 100x80 (bounds 100,100–200,180,
// center 150,140). With the default strokeWidth 2 the binding gap is
// 5 + 2/2 = 6, so tips dock on the dilated rect 94,94–206,186.
// ---------------------------------------------------------------------------

const RECT_A_DILATED = { x1: 94, y1: 94, x2: 206, y2: 186 }

function rect(id: string, x: number, y: number, w = 100, h = 80) {
  return newRectangleElement({ id, x, y, width: w, height: h })
}

function makeArrow(
  id: string,
  start: [number, number],
  end: [number, number],
  bindings: { start?: VueDrawBinding | null; end?: VueDrawBinding | null } = {},
): VueDrawArrowElement {
  const opts: NewLinearElementOptions = {
    id,
    x: start[0],
    y: start[1],
    points: [
      { x: 0, y: 0 },
      { x: end[0] - start[0], y: end[1] - start[1] },
    ],
  }
  return {
    ...newLinearElement('arrow', opts),
    startBinding: bindings.start ?? null,
    endBinding: bindings.end ?? null,
  } as VueDrawArrowElement
}

function makeLine(
  id: string,
  start: [number, number],
  end: [number, number],
  bindings: { start?: VueDrawBinding | null; end?: VueDrawBinding | null } = {},
): VueDrawLineElement {
  const opts: NewLinearElementOptions = {
    id,
    x: start[0],
    y: start[1],
    points: [
      { x: 0, y: 0 },
      { x: end[0] - start[0], y: end[1] - start[1] },
    ],
  }
  return {
    ...newLinearElement('line', opts),
    startBinding: bindings.start ?? null,
    endBinding: bindings.end ?? null,
  } as VueDrawLineElement
}

describe('binding targets', () => {
  it('binds shapes and text, never locked or linear elements', () => {
    expect(isBindableShape(rect('r', 0, 0))).toBe(true)
    expect(isBindableShape(newDiamondElement({ x: 0, y: 0, width: 1, height: 1 }))).toBe(true)
    expect(isBindableShape(newTextElement({ x: 0, y: 0, text: 'hi' }))).toBe(true)
    expect(isBindableShape(newRectangleElement({ x: 0, y: 0, width: 1, height: 1, locked: true }))).toBe(false)
    expect(isBindableShape(newLinearElement('line', { x: 0, y: 0 }))).toBe(false)
    expect(isBindableShape(makeArrow('a', [0, 0], [1, 1]))).toBe(false)
    expect(isBindableShape(newFreedrawElement({ x: 0, y: 0 }))).toBe(false)
  })

  it('keeps the gap clear of the shape edge (Excalidraw formula)', () => {
    expect(BASE_BINDING_GAP).toBe(5)
    expect(bindingGap(rect('r', 0, 0))).toBe(6)
    expect(bindingGap(rect('r', 0, 0))).toBe(5 + 2 / 2)
  })

  it('uses Excalidraw magnetic distance, loosened at low zoom', () => {
    expect(maxBindingDistance(1)).toBe(15)
    expect(maxBindingDistance(2)).toBe(15)
    expect(maxBindingDistance(0.5)).toBe(20)
    expect(maxBindingDistance(0.25)).toBe(30) // clamped at 2x base
  })

  it('finds the topmost bindable shape, ignoring non-bindable overlays', () => {
    const rectA = rect('a', 100, 100)
    const overlayLine = newLinearElement('line', { x: 90, y: 140, points: [{ x: 0, y: 0 }, { x: 120, y: 0 }] })
    const above = rect('above', 100, 100, 50, 40)
    const elements: VueDrawElement[] = [rectA, overlayLine, above]

    // The line overlays the rect but cannot be a bind target.
    expect(bindableShapeAt(elements, { x: 150, y: 140 }, 0)?.id).toBe('above')
    // excludeId looks through to the shape underneath.
    expect(bindableShapeAt(elements, { x: 120, y: 120 }, 15, 'above')?.id).toBe('a')
    // Nothing bindable here.
    expect(bindableShapeAt(elements, { x: 500, y: 500 }, 15)).toBeNull()
  })
})

describe('dockPoint', () => {
  const rectA = rect('a', 100, 100)

  it('docks on the dilated edge along the focus ray (horizontal approach)', () => {
    expect(dockPoint(rectA, { x: 0, y: 140 })).toEqual({ x: RECT_A_DILATED.x1, y: 140 })
  })

  it('docks on the dilated edge along the focus ray (vertical approach)', () => {
    const dock = dockPoint(rectA, { x: 150, y: 0 })
    expect(dock.x).toBeCloseTo(150, 6)
    expect(dock.y).toBeCloseTo(RECT_A_DILATED.y1, 6)
  })

  it('widens the dock for thicker strokes', () => {
    const thick = newRectangleElement({ id: 't', x: 100, y: 100, width: 100, height: 80, style: { strokeWidth: 4 } })
    // gap 5 + 4/2 = 7
    expect(dockPoint(thick, { x: 0, y: 140 })).toEqual({ x: 93, y: 140 })
  })

  it('falls back to the perimeter point nearest the tip when the focus is inside', () => {
    // Focus at the center, tip up and left: the nearest dilated edge is top.
    expect(dockPoint(rectA, { x: 150, y: 140 }, { x: 120, y: 105 })).toEqual({ x: 120, y: RECT_A_DILATED.y1 })
  })
})

describe('computeLinearBindings (create-time)', () => {
  const rectA = rect('a', 100, 100)

  it('returns null when neither tip is near a shape', () => {
    const far = makeArrow('ar', [0, 0], [10, 10])
    expect(computeLinearBindings(far, [rectA], 15)).toBeNull()
  })

  it('binds an end dropped over a shape and docks it on the edge', () => {
    const arrow = makeArrow('ar', [0, 140], [150, 140])
    const patch = computeLinearBindings(arrow, [rectA], 15)

    expect(patch).not.toBeNull()
    expect(patch!.startBinding).toBeNull()
    expect(patch!.endBinding).toEqual({ elementId: 'a' })
    // The loose start stays where it was drawn; the end docks on the edge.
    expect(patch!.points![0]).toEqual({ x: 0, y: 0 })
    expect(patch!.points![1]).toEqual({ x: 94, y: 0 })
    expect(patch!.width).toBe(94)
  })

  it('binds both tips across two shapes, keeping the tips on the facing edges', () => {
    const rectB = rect('b', 400, 100)
    const arrow = makeArrow('ar', [150, 140], [450, 140])
    const patch = computeLinearBindings(arrow, [rectA, rectB], 15)

    expect(patch!.startBinding).toEqual({ elementId: 'a' })
    expect(patch!.endBinding).toEqual({ elementId: 'b' })
    // Start docks on A's right dilated edge, end on B's left dilated edge.
    expect(patch!.points![0]).toEqual({ x: 56, y: 0 })
    expect(patch!.points![1]).toEqual({ x: 244, y: 0 })
  })

  it('spreads a self-loop onto different edges instead of collapsing', () => {
    const arrow = makeArrow('ar', [130, 120], [170, 160])
    const patch = computeLinearBindings(arrow, [rectA], 15)

    expect(patch!.startBinding).toEqual({ elementId: 'a' })
    expect(patch!.endBinding).toEqual({ elementId: 'a' })
    // Start snaps to the top dilated edge, end to the bottom one.
    expect(patch!.points![0]).toEqual({ x: 0, y: -26 })
    expect(patch!.points![1]).toEqual({ x: 40, y: 66 })
  })

  it('binds a line tip exactly like an arrow', () => {
    const line = makeLine('ln', [0, 140], [150, 140])
    const patch = computeLinearBindings(line, [rectA], 15)

    expect(patch).not.toBeNull()
    expect(patch!.startBinding).toBeNull()
    expect(patch!.endBinding).toEqual({ elementId: 'a' })
    expect(patch!.points![1]).toEqual({ x: 94, y: 0 })
  })

  it('keeps intermediate points fixed when a tip docks', () => {
    const arrow = {
      ...makeArrow('ar', [0, 140], [110, 140]),
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 110, y: 0 },
      ],
    } as VueDrawArrowElement
    const patch = computeLinearBindings(arrow, [rectA], 15)

    expect(patch!.points![0]).toEqual({ x: 0, y: 0 })
    expect(patch!.points![1]).toEqual({ x: 40, y: 0 }) // untouched middle point
    expect(patch!.points![2]).toEqual({ x: 94, y: 0 }) // docked end
  })
})

describe('bindingFollowPatches (move/resize follow-through)', () => {
  function boundArrow(
    startBinding: VueDrawBinding | null,
    endBinding: VueDrawBinding | null,
  ): VueDrawArrowElement {
    // Start tip docked at (94,140) — A's left dilated edge; loose end at (40,140).
    return makeArrow('ar', [94, 140], [40, 140], { start: startBinding, end: endBinding })
  }

  it('re-docks a tip when its shape moves', () => {
    const movedA = rect('a', 130, 120) // A moved by (30,20)
    const arrow = boundArrow({ elementId: 'a' }, null)
    const patches = bindingFollowPatches(new Set(['a']), [movedA, arrow])

    const patch = patches.get('ar')
    expect(patch).toBeDefined()
    // Focus is the loose end (40,140); the dock rides A's new left edge.
    expect(patch!.points![0]).toEqual({ x: 30, y: 12 })
    expect(patch!.points![1]).toEqual({ x: -54, y: 0 }) // loose end never moves
  })

  it('re-docks a bound line tip the same way', () => {
    const movedA = rect('a', 130, 120) // A moved by (30,20)
    const line = makeLine('ln', [94, 140], [150, 140], { end: { elementId: 'a' } })
    const patches = bindingFollowPatches(new Set(['a']), [movedA, line])

    const patch = patches.get('ln')
    expect(patch).toBeDefined()
    // Follow-through rewrites geometry only — never the bindings themselves.
    expect(patch!.endBinding).toBeUndefined()
    expect(patch!.points![0]).toEqual({ x: 0, y: 0 }) // loose start never moves
    expect(patch!.points![1]!.x).toBeCloseTo(30, 5)
    expect(patch!.points![1]!.y).toBeCloseTo(6.9767, 3)
  })

  it('keeps a moved arrow glued to its stationary shape', () => {
    const rectA = rect('a', 100, 100)
    const arrow = boundArrow({ elementId: 'a' }, null)
    const patches = bindingFollowPatches(new Set(['ar']), [rectA, arrow])

    const patch = patches.get('ar')
    expect(patch).toBeDefined()
    // The bound tip re-docks to the same edge point it already sat on.
    expect(patch!.points![0]).toEqual({ x: 0, y: 0 })
  })

  it('moves only the tip whose shape moved on a two-bound arrow', () => {
    const rectA = rect('a', 100, 100)
    const movedB = rect('b', 430, 100) // B moved right by 30
    // Start docked on A's right edge (206,140), end on B's left edge (394,140).
    const arrow = {
      ...makeArrow('ar', [206, 140], [394, 140]),
      startBinding: { elementId: 'a' },
      endBinding: { elementId: 'b' },
    } as VueDrawArrowElement
    const patches = bindingFollowPatches(new Set(['b']), [rectA, movedB, arrow])

    const patch = patches.get('ar')
    expect(patch).toBeDefined()
    expect(patch!.points![0]).toEqual({ x: 0, y: 0 }) // A didn't move: start stays
    expect(patch!.points![1]).toEqual({ x: 218, y: 0 }) // end rides B's new edge
  })

  it('ignores moves that no bound arrow cares about', () => {
    const rectA = rect('a', 100, 100)
    const arrow = boundArrow({ elementId: 'a' }, null)
    const patches = bindingFollowPatches(new Set(['unrelated']), [rectA, arrow])
    expect(patches.size).toBe(0)
  })

  it('leaves dangling bindings alone (deletion owns that cleanup)', () => {
    const arrow = boundArrow({ elementId: 'ghost' }, null)
    const patches = bindingFollowPatches(new Set(['ghost']), [arrow])
    expect(patches.size).toBe(0)
  })
})

describe('orphanBindingPatches (deletion cleanup)', () => {
  it('nulls only the bindings whose target was deleted', () => {
    const rectA = rect('a', 100, 100)
    const arrow = {
      ...makeArrow('ar', [94, 140], [300, 140]),
      startBinding: { elementId: 'a' },
      endBinding: { elementId: 'b' },
    } as VueDrawArrowElement
    const patches = orphanBindingPatches(new Set(['a']), [rectA, arrow])

    expect(patches.get('ar')).toEqual({
      startBinding: null,
      endBinding: { elementId: 'b' },
    })
  })

  it('touches nothing when no binding targets the deleted ids', () => {
    const arrow = boundArrowOnly()
    expect(orphanBindingPatches(new Set(['zzz']), [arrow]).size).toBe(0)

    function boundArrowOnly(): VueDrawArrowElement {
      return {
        ...makeArrow('ar', [0, 0], [10, 0]),
        startBinding: { elementId: 'a' },
        endBinding: null,
      }
    }
  })
})

describe('binding coercion on restore', () => {
  it('keeps valid bindings and drops malformed ones', () => {
    const el = coerceElement({
      id: 'ar',
      type: 'arrow',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      startBinding: { elementId: 'shape-a' },
      endBinding: { elementId: 42 },
    }) as VueDrawArrowElement | null

    expect(el).not.toBeNull()
    expect(el!.startBinding).toEqual({ elementId: 'shape-a' })
    expect(el!.endBinding).toBeNull()
  })

  it('coerces missing arrow bindings to null', () => {
    const el = coerceElement({ id: 'ar', type: 'arrow', points: [{ x: 0, y: 0 }] }) as
      | VueDrawArrowElement
      | null
    expect(el!.startBinding).toBeNull()
    expect(el!.endBinding).toBeNull()
  })

  it('binds lines exactly like arrows: valid kept, malformed coerced to null', () => {
    const el = coerceElement({
      id: 'ln',
      type: 'line',
      points: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
      startBinding: { elementId: 'shape-a' },
      endBinding: 'not-a-binding',
    }) as VueDrawLineElement | null
    expect(el).not.toBeNull()
    expect(el!.startBinding).toEqual({ elementId: 'shape-a' })
    expect(el!.endBinding).toBeNull()
  })
})
