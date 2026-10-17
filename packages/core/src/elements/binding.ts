/**
 * Linear bindings — Excalidraw-style magnetic connections for lines and arrows.
 *
 * A bound tip records the id of the shape it docks onto
 * (`startBinding` / `endBinding` on the linear element, nothing on the shape)
 * and follows that shape around. The reverse lookup is a scene scan, which is
 * cheap for canvas-scale scenes and keeps the base element model untouched.
 *
 * Behavioral reference: .context/excalidraw/packages/element/src/binding.ts
 *   — gap between a docked tip and the shape edge:
 *       BASE_BINDING_GAP + strokeWidth / 2
 *   — magnetic radius around a shape at which a tip still binds:
 *       maxBindingDistance(zoom), base max(BASE_BINDING_GAP, 15)
 *   — where a docked tip sits: on the shape's OWN outline (diamond edges,
 *       ellipse curve, rectangle box), dilated by the gap — never the
 *       bounds box, which glues tips to the border the selection frame
 *       draws on (see `intersectElementWithLineSegment` in the reference)
 */

import { getElementBounds, pointInBounds } from '../geometry/bounds.js'
import { rotatePoint, unrotatePoint } from '../geometry/points.js'
import { isLinearElement } from './factories.js'
import type { ElementPatch } from './mutate.js'
import type {
  Bounds,
  Point,
  VueDrawBinding,
  VueDrawDiamondElement,
  VueDrawEllipseElement,
  VueDrawElement,
  VueDrawLinearElement,
  VueDrawRectangleElement,
  VueDrawTextElement,
} from '../types.js'

/** Shapes an arrow tip can dock onto (Excalidraw's bindable set, unlocked). */
export type VueDrawBindableShape =
  | VueDrawRectangleElement
  | VueDrawDiamondElement
  | VueDrawEllipseElement
  | VueDrawTextElement

/** Gaps exclude the shape's stroke width (must stay > 0, per Excalidraw). */
export const BASE_BINDING_GAP = 5

export function isBindableShape(element: VueDrawElement): element is VueDrawBindableShape {
  return (
    !element.locked &&
    (element.type === 'rectangle' ||
      element.type === 'diamond' ||
      element.type === 'ellipse' ||
      element.type === 'text')
  )
}

/** Kept clear of the shape edge by this much (scene px). */
export function bindingGap(shape: Pick<VueDrawBindableShape, 'strokeWidth'>): number {
  return BASE_BINDING_GAP + shape.strokeWidth / 2
}

/** Magnetic radius around bindable shapes, loosened at low zoom. */
export function maxBindingDistance(zoom = 1): number {
  const base = Math.max(BASE_BINDING_GAP, 15)
  const zoomValue = zoom < 1 ? zoom : 1
  return Math.min(Math.max(base / (zoomValue * 1.5), base), base * 2)
}

/**
 * Topmost bindable shape within `threshold` scene px of `point`.
 *
 * Probes the padded bounds rather than the precise outline hit-test: a tip
 * dropped inside an unfilled shape must still bind, and the magnetic radius
 * is boxy by design (Excalidraw compares against the padded box too).
 */
export function bindableShapeAt(
  elements: readonly VueDrawElement[],
  point: Point,
  threshold: number,
  excludeId?: string,
): VueDrawBindableShape | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]!
    if (element.id === excludeId || !isBindableShape(element)) {
      continue
    }
    const bounds = getElementBounds(element)
    if (
      pointInBounds(point, {
        x1: bounds.x1 - threshold,
        y1: bounds.y1 - threshold,
        x2: bounds.x2 + threshold,
        y2: bounds.y2 + threshold,
      })
    ) {
      return element
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Docking geometry
// ---------------------------------------------------------------------------

/** The shape's local box dilated by the binding gap, in element coordinates. */
function dilatedLocalBounds(shape: VueDrawBindableShape, gap: number): Bounds {
  return {
    x1: -gap,
    y1: -gap,
    x2: shape.width + gap,
    y2: shape.height + gap,
  }
}

/**
 * Liang-Barsky clip of segment `from` -> `to` against `rect`: returns the
 * entry parameter, or the exit parameter when the segment starts inside.
 */
function clipParam(from: Point, to: Point, rect: Bounds): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  let tEntry = 0
  let tExit = 1
  for (const [p, q] of [
    [-dx, from.x - rect.x1],
    [dx, rect.x2 - from.x],
    [-dy, from.y - rect.y1],
    [dy, rect.y2 - from.y],
  ] as Array<readonly [number, number]>) {
    if (p === 0) {
      continue
    }
    const r = q / p
    if (p < 0) {
      tEntry = Math.max(tEntry, r)
    } else {
      tExit = Math.min(tExit, r)
    }
  }
  const inside =
    from.x >= rect.x1 && from.x <= rect.x2 && from.y >= rect.y1 && from.y <= rect.y2
  return inside ? tExit : tEntry
}

/** Closest point on the rect's perimeter to `point`. */
function nearestPerimeterPoint(point: Point, rect: Bounds): Point {
  const left = point.x - rect.x1
  const right = rect.x2 - point.x
  const top = point.y - rect.y1
  const bottom = rect.y2 - point.y
  const min = Math.min(left, right, top, bottom)
  if (min === left) {
    return { x: rect.x1, y: point.y }
  }
  if (min === right) {
    return { x: rect.x2, y: point.y }
  }
  if (min === top) {
    return { x: point.x, y: rect.y1 }
  }
  return { x: point.x, y: rect.y2 }
}

/**
 * Line param where the infinite line `from -> toward` crosses segment
 * `a -> b`, or null when parallel or crossing outside the segment.
 */
function lineSegmentCrossing(from: Point, toward: Point, a: Point, b: Point): number | null {
  const d = { x: toward.x - from.x, y: toward.y - from.y }
  const e = { x: b.x - a.x, y: b.y - a.y }
  const w = { x: a.x - from.x, y: a.y - from.y }
  const denominator = d.x * e.y - d.y * e.x
  if (denominator === 0) {
    return null
  }
  const t = (w.x * e.y - w.y * e.x) / denominator
  const s = (w.x * d.y - w.y * d.x) / denominator
  return s >= 0 && s <= 1 ? t : null
}

/** Closest point on segment `a -> b` to `p`. */
function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const ex = b.x - a.x
  const ey = b.y - a.y
  const lengthSq = ex * ex + ey * ey
  if (lengthSq === 0) {
    return { ...a }
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / lengthSq))
  return { x: a.x + ex * t, y: a.y + ey * t }
}

/** The dilated rhombus vertices, clockwise from the top, in local coords. */
function diamondVertices(shape: VueDrawBindableShape, gap: number): readonly Point[] {
  const cx = shape.width / 2
  const cy = shape.height / 2
  return [
    { x: cx, y: -gap },
    { x: shape.width + gap, y: cy },
    { x: cx, y: shape.height + gap },
    { x: -gap, y: cy },
  ]
}

/**
 * Crossing of the infinite line `from -> toward` with the shape's dilated
 * outline (the smallest positive line param wins — the entry crossing when
 * `from` is outside, the exit when it starts inside), or null when the line
 * never crosses.
 */
function outlineCrossing(
  shape: VueDrawBindableShape,
  from: Point,
  toward: Point,
  gap: number,
): Point | null {
  let best: number | null = null
  if (shape.type === 'diamond') {
    const vertices = diamondVertices(shape, gap)
    for (let i = 0; i < vertices.length; i++) {
      const t = lineSegmentCrossing(
        from,
        toward,
        vertices[i]!,
        vertices[(i + 1) % vertices.length]!,
      )
      if (t !== null && t > 0 && (best === null || t < best)) {
        best = t
      }
    }
  } else if (shape.type === 'ellipse') {
    const a = shape.width / 2 + gap
    const b = shape.height / 2 + gap
    const dx = toward.x - from.x
    const dy = toward.y - from.y
    const ux = from.x - shape.width / 2
    const uy = from.y - shape.height / 2
    const qa = (dx * dx) / (a * a) + (dy * dy) / (b * b)
    if (qa > 0) {
      const qb = 2 * ((ux * dx) / (a * a) + (uy * dy) / (b * b))
      const qc = (ux * ux) / (a * a) + (uy * uy) / (b * b) - 1
      const discriminant = qb * qb - 4 * qa * qc
      if (discriminant >= 0) {
        const root = Math.sqrt(discriminant)
        for (const t of [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)]) {
          if (t > 0 && (best === null || t < best)) {
            best = t
          }
        }
      }
    }
  } else {
    // Rectangle (any corner rounding) and text frame a box.
    const t = clipParam(from, toward, dilatedLocalBounds(shape, gap))
    if (t > 0) {
      best = t
    }
  }
  if (best === null) {
    return null
  }
  return {
    x: from.x + (toward.x - from.x) * best,
    y: from.y + (toward.y - from.y) * best,
  }
}

/** Whether `point` (local coords) lies inside the shape's dilated outline. */
function outlineContains(shape: VueDrawBindableShape, point: Point, gap: number): boolean {
  if (shape.type === 'ellipse') {
    const a = shape.width / 2 + gap
    const b = shape.height / 2 + gap
    const ux = (point.x - shape.width / 2) / a
    const uy = (point.y - shape.height / 2) / b
    return ux * ux + uy * uy <= 1
  }
  if (shape.type === 'diamond') {
    const vertices = diamondVertices(shape, gap)
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i]!
      const b = vertices[(i + 1) % vertices.length]!
      const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
      if (cross < 0) {
        return false
      }
    }
    return true
  }
  const bounds = dilatedLocalBounds(shape, gap)
  return (
    point.x >= bounds.x1 &&
    point.x <= bounds.x2 &&
    point.y >= bounds.y1 &&
    point.y <= bounds.y2
  )
}

/** The point on the shape's dilated outline nearest `point` (local coords). */
function nearestOutlinePoint(shape: VueDrawBindableShape, point: Point, gap: number): Point {
  if (shape.type === 'ellipse') {
    const a = shape.width / 2 + gap
    const b = shape.height / 2 + gap
    const cx = shape.width / 2
    const cy = shape.height / 2
    const dx = point.x - cx
    const dy = point.y - cy
    const length = Math.hypot(dx, dy)
    if (length === 0) {
      return { x: cx, y: cy - b }
    }
    // Radial projection: exact for circles, a hairline off for stretched
    // ones — the inside case only anchors a tip already near the rim.
    return { x: cx + (a * dx) / length, y: cy + (b * dy) / length }
  }
  if (shape.type === 'diamond') {
    const vertices = diamondVertices(shape, gap)
    let nearest: Point | null = null
    let bestDistanceSq = Infinity
    for (let i = 0; i < vertices.length; i++) {
      const candidate = closestPointOnSegment(
        point,
        vertices[i]!,
        vertices[(i + 1) % vertices.length]!,
      )
      const distanceSq = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq
        nearest = candidate
      }
    }
    return nearest!
  }
  return nearestPerimeterPoint(point, dilatedLocalBounds(shape, gap))
}

/**
 * Where a tip docks on `shape`: the crossing of the ray from the opposite
 * tip toward the shape's center with the shape's OWN outline, dilated by
 * the binding gap — the diamond's slanted edges, the ellipse's curve, the
 * rectangle's box. Docking against the bounds box instead would glue tips
 * to the invisible border the selection frame draws on. When the focus
 * itself lies inside the dilated outline (a self-loop, or the shape
 * dragged over the loose end), the outline point nearest the tip's
 * current position wins, so the two tips can never collapse together.
 *
 * Geometry runs in the shape's unrotated local space — the same pivot the
 * hit-tester and retip math use — so rotated shapes dock on their true
 * rotated edges.
 */
export function dockPoint(
  shape: VueDrawBindableShape,
  focus: Point,
  current?: Point,
): Point {
  const gap = bindingGap(shape)
  const localFocus = localPointOf(shape, focus)
  const center = { x: shape.width / 2, y: shape.height / 2 }
  if (outlineContains(shape, localFocus, gap)) {
    const anchor = current ? localPointOf(shape, current) : localFocus
    return scenePointOf(shape, nearestOutlinePoint(shape, anchor, gap))
  }
  if (Math.abs(localFocus.x - center.x) < 0.5 && Math.abs(localFocus.y - center.y) < 0.5) {
    // Degenerate ray (focus at the center): dock straight above it.
    return scenePointOf(shape, { x: center.x, y: -gap })
  }
  const crossing = outlineCrossing(shape, localFocus, center, gap)
  return scenePointOf(shape, crossing ?? { x: center.x, y: -gap })
}

// ---------------------------------------------------------------------------
// Scene <-> local space (same pivot as the hit-tester: x + width / 2)
// ---------------------------------------------------------------------------

function pivotOf(element: VueDrawElement): Point {
  return { x: element.x + element.width / 2, y: element.y + element.height / 2 }
}

function scenePointOf(element: VueDrawElement, point: Point): Point {
  const base = { x: element.x + point.x, y: element.y + point.y }
  return element.angle === 0 ? base : rotatePoint(base, pivotOf(element), element.angle)
}

function localPointOf(element: VueDrawElement, scene: Point): Point {
  const base = element.angle === 0 ? scene : unrotatePoint(scene, pivotOf(element), element.angle)
  return { x: base.x - element.x, y: base.y - element.y }
}

/** Scene-space positions of the element's first and last tip. */
function tipScenes(element: VueDrawLinearElement): { start: Point; end: Point } {
  const points = element.points
  return {
    start: scenePointOf(element, points[0]!),
    end: scenePointOf(element, points[points.length - 1]!),
  }
}

/**
 * Rewrite only the given tips, keeping every other point fixed in scene
 * space. Size fields follow the new points while the element is unrotated —
 * with an angle they are the rotation pivot and must stay untouched.
 */
function retipPatch(
  element: VueDrawLinearElement,
  tips: { start?: Point; end?: Point },
): ElementPatch<VueDrawLinearElement> {
  const points = element.points.map((point) => ({ ...point }))
  if (tips.start) {
    points[0] = localPointOf(element, tips.start)
  }
  if (tips.end) {
    points[points.length - 1] = localPointOf(element, tips.end)
  }
  const patch: ElementPatch<VueDrawLinearElement> = { points }
  if (element.angle === 0) {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    patch.width = Math.max(...xs) - Math.min(...xs)
    patch.height = Math.max(...ys) - Math.min(...ys)
  }
  return patch
}

// ---------------------------------------------------------------------------
// Binding passes
// ---------------------------------------------------------------------------

/**
 * Create-time binding for a freshly drawn line or arrow: any tip that ends
 * over (or within `threshold` of) a bindable shape docks onto it. Both tips
 * re-dock while intermediate points stay fixed. Returns null when neither tip
 * is near a shape.
 */
export function computeLinearBindings(
  element: VueDrawLinearElement,
  elements: readonly VueDrawElement[],
  threshold: number,
): ElementPatch<VueDrawLinearElement> | null {
  const { start, end } = tipScenes(element)
  const startShape = bindableShapeAt(elements, start, threshold, element.id)
  const endShape = bindableShapeAt(elements, end, threshold, element.id)
  if (!startShape && !endShape) {
    return null
  }
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const selfLoop = startShape !== null && startShape.id === endShape?.id
  // The opposite end drives the dock; self-loops use the midpoint so the
  // two tips spread onto different edges.
  const newStart = startShape ? dockPoint(startShape, selfLoop ? mid : end, start) : start
  const newEnd = endShape ? dockPoint(endShape, selfLoop ? mid : start, end) : end
  return {
    ...retipPatch(element, { start: newStart, end: newEnd }),
    startBinding: startShape ? { elementId: startShape.id } : null,
    endBinding: endShape ? { elementId: endShape.id } : null,
  }
}

/**
 * The shape a binding points at, narrowed: deleted or non-bindable targets
 * (a hand-edited file can bind anything) count as unbound.
 */
function boundShape(
  binding: VueDrawBinding | null,
  byId: Map<string, VueDrawElement>,
): VueDrawBindableShape | undefined {
  if (!binding) {
    return undefined
  }
  const target = byId.get(binding.elementId)
  return target !== undefined && isBindableShape(target) ? target : undefined
}

/**
 * Patches after elements move or resize:
 *   — a linear element bound to a moved shape re-docks that tip;
 *   — a moved linear element re-docks its own bound tips onto the
 *     stationary shapes, so the tip glides along the shape's edge.
 * Loose ends and intermediate points never move.
 */
export function bindingFollowPatches(
  movedIds: ReadonlySet<string>,
  elements: readonly VueDrawElement[],
): Map<string, ElementPatch<VueDrawLinearElement>> {
  const patches = new Map<string, ElementPatch<VueDrawLinearElement>>()
  const byId = new Map(elements.map((element) => [element.id, element]))
  for (const element of elements) {
    if (!isLinearElement(element)) {
      continue
    }
    const startShape = boundShape(element.startBinding, byId)
    const endShape = boundShape(element.endBinding, byId)
    const startMoved = startShape !== undefined && movedIds.has(startShape.id)
    const endMoved = endShape !== undefined && movedIds.has(endShape.id)
    const elementMoved = movedIds.has(element.id)
    if (!elementMoved && !startMoved && !endMoved) {
      continue
    }
    const { start, end } = tipScenes(element)
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    const selfLoop = startShape !== undefined && startShape.id === endShape?.id
    const tips: { start?: Point; end?: Point } = {}
    if (startShape && (startMoved || elementMoved)) {
      tips.start = dockPoint(startShape, selfLoop ? mid : end, start)
    }
    if (endShape && (endMoved || elementMoved)) {
      tips.end = dockPoint(endShape, selfLoop ? mid : start, end)
    }
    patches.set(element.id, retipPatch(element, tips))
  }
  return patches
}

/**
 * Patches nulling out bindings whose target was deleted — applied inside the
 * deletion's own undo step so the element and the cleanup revert together.
 */
export function orphanBindingPatches(
  deletedIds: ReadonlySet<string>,
  elements: readonly VueDrawElement[],
): Map<string, ElementPatch<VueDrawLinearElement>> {
  const patches = new Map<string, ElementPatch<VueDrawLinearElement>>()
  for (const element of elements) {
    if (!isLinearElement(element)) {
      continue
    }
    const startOrphaned =
      element.startBinding !== null && deletedIds.has(element.startBinding.elementId)
    const endOrphaned =
      element.endBinding !== null && deletedIds.has(element.endBinding.elementId)
    if (!startOrphaned && !endOrphaned) {
      continue
    }
    patches.set(element.id, {
      startBinding: startOrphaned ? null : element.startBinding,
      endBinding: endOrphaned ? null : element.endBinding,
    })
  }
  return patches
}
