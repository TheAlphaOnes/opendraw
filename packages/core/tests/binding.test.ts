import { describe, expect, it } from 'vitest'

import {
  BASE_BINDING_GAP,
  bindingFollowPatches,
  bindableShapeAt,
  bindingGap,
  computeLinearBindings,
  computeTipBinding,
  dockPoint,
  isBindableShape,
  maxBindingDistance,
  moveLinearPoint,
  orphanBindingPatches,
  pointsPatch,
} from '../src/elements/binding.js'
import {
  newDiamondElement,
  newEllipseElement,
  newFreedrawElement,
  newLinearElement,
  newRectangleElement,
  newTextElement,
} from '../src/elements/factories.js'
import { coerceElement } from '../src/export/serialize.js'
import type { NewLinearElementOptions } from '../src/elements/factories.js'
import type {
  OpenDrawArrowElement,
  OpenDrawBinding,
  OpenDrawElement,
  OpenDrawLineElement,
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
  bindings: { start?: OpenDrawBinding | null; end?: OpenDrawBinding | null } = {},
): OpenDrawArrowElement {
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
  } as OpenDrawArrowElement
}

function makeLine(
  id: string,
  start: [number, number],
  end: [number, number],
  bindings: { start?: OpenDrawBinding | null; end?: OpenDrawBinding | null } = {},
): OpenDrawLineElement {
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
  } as OpenDrawLineElement
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
    const elements: OpenDrawElement[] = [rectA, overlayLine, above]

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

  it('docks a diagonal tip on the diamond slanted edge, not its bounds box', () => {
    // Diamond (300,120)-(460,220). The bounds-box dock used to land on the
    // left border at (294, 120.9) — exactly where the selection frame draws.
    const diamond = newDiamondElement({ id: 'd', x: 300, y: 120, width: 160, height: 100 })
    const dock = dockPoint(diamond, { x: 240, y: 90 })
    // The crossing with the upper-left slanted edge, gap-dilated.
    expect(dock.x).toBeCloseTo(334.20, 1)
    expect(dock.y).toBeCloseTo(143.83, 1)
  })

  it('docks a diagonal tip on the ellipse curve, not its bounds box', () => {
    // Ellipse (100,100)-(260,200). The bounds-box dock used to land on the
    // top border at (108.7, 94), floating far off the curve.
    const ellipse = newEllipseElement({ id: 'e', x: 100, y: 100, width: 160, height: 100 })
    const dock = dockPoint(ellipse, { x: 40, y: 40 })
    expect(dock.x).toBeCloseTo(125.13, 1)
    expect(dock.y).toBeCloseTo(106.89, 1)
  })

  it('docks on a rotated rectangle\'s true edge, not its bounds box', () => {
    // A 45°-rotated 100x60 rect: its bounds box extends ~7px past the shape
    // on the left; the bounds-box dock landed at (187.4, 130) on the box.
    const rotated = { ...rect('r', 200, 100, 100, 60), angle: Math.PI / 4 }
    const dock = dockPoint(rotated, { x: 0, y: 130 })
    // Six pixels off the rotated bottom edge, near its leftmost corner.
    expect(dock.x).toBeCloseTo(199.09, 1)
    expect(dock.y).toBeCloseTo(130, 1)
  })

  it('anchors a focus inside the diamond on its nearest slanted edge', () => {
    const diamond = newDiamondElement({ id: 'd', x: 300, y: 120, width: 160, height: 100 })
    // Focus at the center, tip up and left: nearest point on the dilated
    // upper-left edge — not a projection onto the bounds box.
    const dock = dockPoint(diamond, { x: 380, y: 170 }, { x: 330, y: 140 })
    expect(dock.x).toBeCloseTo(333.0, 1)
    expect(dock.y).toBeCloseTo(144.6, 1)
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
    } as OpenDrawArrowElement
    const patch = computeLinearBindings(arrow, [rectA], 15)

    expect(patch!.points![0]).toEqual({ x: 0, y: 0 })
    expect(patch!.points![1]).toEqual({ x: 40, y: 0 }) // untouched middle point
    expect(patch!.points![2]).toEqual({ x: 94, y: 0 }) // docked end
  })
})

describe('bindingFollowPatches (move/resize follow-through)', () => {
  function boundArrow(
    startBinding: OpenDrawBinding | null,
    endBinding: OpenDrawBinding | null,
  ): OpenDrawArrowElement {
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
    } as OpenDrawArrowElement
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
    } as OpenDrawArrowElement
    const patches = orphanBindingPatches(new Set(['a']), [rectA, arrow])

    expect(patches.get('ar')).toEqual({
      startBinding: null,
      endBinding: { elementId: 'b' },
    })
  })

  it('touches nothing when no binding targets the deleted ids', () => {
    const arrow = boundArrowOnly()
    expect(orphanBindingPatches(new Set(['zzz']), [arrow]).size).toBe(0)

    function boundArrowOnly(): OpenDrawArrowElement {
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
    }) as OpenDrawArrowElement | null

    expect(el).not.toBeNull()
    expect(el!.startBinding).toEqual({ elementId: 'shape-a' })
    expect(el!.endBinding).toBeNull()
  })

  it('coerces missing arrow bindings to null', () => {
    const el = coerceElement({ id: 'ar', type: 'arrow', points: [{ x: 0, y: 0 }] }) as
      | OpenDrawArrowElement
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
    }) as OpenDrawLineElement | null
    expect(el).not.toBeNull()
    expect(el!.startBinding).toEqual({ elementId: 'shape-a' })
    expect(el!.endBinding).toBeNull()
  })
})

describe('computeTipBinding', () => {
  const rectA = rect('rect-a', 100, 100)
  // Rect A dilated by the gap: 94,94 – 206,186.
  const THRESHOLD = 20

  it('docks a dragged end tip onto the shape under it', () => {
    // Tip at (220,140) sits within the magnetic radius of rect A.
    const arrow = makeArrow('arrow', [300, 140], [220, 140])
    const patch = computeTipBinding(arrow, 'end', [rectA], THRESHOLD)
    expect(patch.endBinding).toEqual({ elementId: 'rect-a' })
    // Docks on the dilated right edge: scene (206,140) → local (-94,0).
    expect(patch.points![1]).toEqual({ x: -94, y: 0 })
    expect(patch.points![0]).toEqual({ x: 0, y: 0 })
  })

  it('clears the binding when the tip is dropped loose', () => {
    const arrow = makeArrow('arrow', [400, 400], [500, 400], { end: { elementId: 'rect-a' } })
    const patch = computeTipBinding(arrow, 'end', [rectA], THRESHOLD)
    expect(patch.endBinding).toBeNull()
    expect(patch.startBinding).toBeNull()
    // A loose drop moves nothing — the points keep the dragged position.
    expect(patch.points).toBeUndefined()
  })

  it('keeps midpoints and the opposite tip fixed while docking', () => {
    const three = {
      ...makeArrow('three', [300, 140], [220, 140]),
      points: [{ x: 0, y: 0 }, { x: -40, y: -20 }, { x: -80, y: 0 }],
    }
    const patch = computeTipBinding(three, 'end', [rectA], THRESHOLD)
    expect(patch.points![1]).toEqual({ x: -40, y: -20 })
    expect(patch.points![0]).toEqual({ x: 0, y: 0 })
    expect(patch.endBinding).toEqual({ elementId: 'rect-a' })
  })

  it('keeps the opposite tip binding untouched while docking one end', () => {
    const arrow = makeArrow('arrow', [180, 200], [220, 140], { start: { elementId: 'rect-a' } })
    const patch = computeTipBinding(arrow, 'end', [rectA], THRESHOLD)
    expect(patch.startBinding).toEqual({ elementId: 'rect-a' })
    expect(patch.endBinding).toEqual({ elementId: 'rect-a' })
    // Self-loop: the dragged end docks apart from the parked start.
    const start = { x: 0, y: 0 }
    const end = patch.points![1]!
    expect(Math.abs(end.x - start.x)).toBeGreaterThan(0)
  })
})

describe('moveLinearPoint', () => {
  it('moves one point and resyncs the size fields', () => {
    const arrow = makeArrow('arrow', [100, 65], [300, 185])
    const patch = moveLinearPoint(arrow, 1, { x: 350, y: 205 })
    expect(patch.points).toEqual([{ x: 0, y: 0 }, { x: 250, y: 140 }])
    expect(patch.width).toBe(250)
    expect(patch.height).toBe(140)
  })

  it('leaves the pivot fields of a rotated element untouched', () => {
    const rotated = {
      ...makeArrow('arrow', [100, 65], [300, 185]),
      width: 200,
      height: 120,
      angle: Math.PI / 2,
    }
    const patch = moveLinearPoint(rotated, 1, { x: 350, y: 205 })
    expect(patch.width).toBeUndefined()
    expect(patch.height).toBeUndefined()
  })
})

describe('pointsPatch', () => {
  it('re-syncs the size fields to the points extents', () => {
    const arrow = { ...makeArrow('arrow', [100, 65], [300, 185]), width: 0, height: 0 }
    const patch = pointsPatch(arrow, [
      { x: 0, y: 0 },
      { x: 200, y: 120 },
    ])
    expect(patch.width).toBe(200)
    expect(patch.height).toBe(120)
  })
})
