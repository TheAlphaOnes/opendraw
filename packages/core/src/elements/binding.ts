/**
 * Arrow bindings — Excalidraw-style magnetic connections.
 *
 * A bound arrow tip records the id of the shape it docks onto
 * (`startBinding` / `endBinding` on the arrow, nothing on the shape) and
 * follows that shape around. The reverse lookup is a scene scan, which is
 * cheap for canvas-scale scenes and keeps the base element model untouched.
 *
 * Behavioral reference: .context/excalidraw/packages/element/src/binding.ts
 *   — gap between a docked tip and the shape edge:
 *       BASE_BINDING_GAP + strokeWidth / 2
 *   — magnetic radius around a shape at which a tip still binds:
 *       maxBindingDistance(zoom), base max(BASE_BINDING_GAP, 15)
 */

import { getElementBounds, pointInBounds } from '../geometry/bounds.js'
import { rotatePoint, unrotatePoint } from '../geometry/points.js'
import { isArrowElement } from './factories.js'
import type { ElementPatch } from './mutate.js'
import type {
  Bounds,
  Point,
  VueDrawArrowBinding,
  VueDrawArrowElement,
  VueDrawDiamondElement,
  VueDrawEllipseElement,
  VueDrawElement,
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

/** The shape's bounds dilated by the binding gap — the line tips dock onto. */
function dockingBounds(shape: VueDrawBindableShape): Bounds {
  const bounds = getElementBounds(shape)
  const gap = bindingGap(shape)
  return {
    x1: bounds.x1 - gap,
    y1: bounds.y1 - gap,
    x2: bounds.x2 + gap,
    y2: bounds.y2 + gap,
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
 * Where a tip docks on `shape`: the border crossing of the segment
 * `focus` -> shape center against the gap-dilated bounds. When the focus
 * itself lies inside those bounds (a self-loop, or the shape dragged over
 * the loose end) the perimeter point nearest the tip's current position wins,
 * so the two tips can never collapse onto a single point.
 */
export function dockPoint(
  shape: VueDrawBindableShape,
  focus: Point,
  current?: Point,
): Point {
  const rect = dockingBounds(shape)
  const center = { x: (rect.x1 + rect.x2) / 2, y: (rect.y1 + rect.y2) / 2 }
  const inside =
    focus.x >= rect.x1 && focus.x <= rect.x2 && focus.y >= rect.y1 && focus.y <= rect.y2
  if (inside) {
    return nearestPerimeterPoint(current ?? focus, rect)
  }
  if (Math.abs(center.x - focus.x) < 0.5 && Math.abs(center.y - focus.y) < 0.5) {
    // Degenerate ray (focus at the center): dock straight above it.
    return { x: center.x, y: rect.y1 }
  }
  const t = clipParam(focus, center, rect)
  return { x: focus.x + (center.x - focus.x) * t, y: focus.y + (center.y - focus.y) * t }
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

/** Scene-space positions of the arrow's first and last tip. */
function tipScenes(arrow: VueDrawArrowElement): { start: Point; end: Point } {
  const points = arrow.points
  return {
    start: scenePointOf(arrow, points[0]!),
    end: scenePointOf(arrow, points[points.length - 1]!),
  }
}

/**
 * Rewrite only the given tips, keeping every other point fixed in scene
 * space. Size fields follow the new points while the arrow is unrotated —
 * with an angle they are the rotation pivot and must stay untouched.
 */
function retipPatch(
  arrow: VueDrawArrowElement,
  tips: { start?: Point; end?: Point },
): ElementPatch<VueDrawArrowElement> {
  const points = arrow.points.map((point) => ({ ...point }))
  if (tips.start) {
    points[0] = localPointOf(arrow, tips.start)
  }
  if (tips.end) {
    points[points.length - 1] = localPointOf(arrow, tips.end)
  }
  const patch: ElementPatch<VueDrawArrowElement> = { points }
  if (arrow.angle === 0) {
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
 * Create-time binding for a freshly drawn arrow: any tip that ends over (or
 * within `threshold` of) a bindable shape docks onto it. Both tips re-dock
 * while intermediate points stay fixed. Returns null when neither tip is
 * near a shape.
 */
export function computeArrowBindings(
  arrow: VueDrawArrowElement,
  elements: readonly VueDrawElement[],
  threshold: number,
): ElementPatch<VueDrawArrowElement> | null {
  const { start, end } = tipScenes(arrow)
  const startShape = bindableShapeAt(elements, start, threshold, arrow.id)
  const endShape = bindableShapeAt(elements, end, threshold, arrow.id)
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
    ...retipPatch(arrow, { start: newStart, end: newEnd }),
    startBinding: startShape ? { elementId: startShape.id } : null,
    endBinding: endShape ? { elementId: endShape.id } : null,
  }
}

/**
 * The shape a binding points at, narrowed: deleted or non-bindable targets
 * (a hand-edited file can bind anything) count as unbound.
 */
function boundShape(
  binding: VueDrawArrowBinding | null,
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
 *   — an arrow bound to a moved shape re-docks that tip;
 *   — a moved arrow re-docks its own bound tips onto the stationary shapes,
 *     so the tip glides along the shape's edge.
 * Loose ends and intermediate points never move.
 */
export function arrowFollowPatches(
  movedIds: ReadonlySet<string>,
  elements: readonly VueDrawElement[],
): Map<string, ElementPatch<VueDrawArrowElement>> {
  const patches = new Map<string, ElementPatch<VueDrawArrowElement>>()
  const byId = new Map(elements.map((element) => [element.id, element]))
  for (const element of elements) {
    if (!isArrowElement(element)) {
      continue
    }
    const startShape = boundShape(element.startBinding, byId)
    const endShape = boundShape(element.endBinding, byId)
    const startMoved = startShape !== undefined && movedIds.has(startShape.id)
    const endMoved = endShape !== undefined && movedIds.has(endShape.id)
    const arrowMoved = movedIds.has(element.id)
    if (!arrowMoved && !startMoved && !endMoved) {
      continue
    }
    const { start, end } = tipScenes(element)
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    const selfLoop = startShape !== undefined && startShape.id === endShape?.id
    const tips: { start?: Point; end?: Point } = {}
    if (startShape && (startMoved || arrowMoved)) {
      tips.start = dockPoint(startShape, selfLoop ? mid : end, start)
    }
    if (endShape && (endMoved || arrowMoved)) {
      tips.end = dockPoint(endShape, selfLoop ? mid : start, end)
    }
    patches.set(element.id, retipPatch(element, tips))
  }
  return patches
}

/**
 * Patches nulling out bindings whose target was deleted — applied inside the
 * deletion's own undo step so the arrow and the cleanup revert together.
 */
export function orphanBindingPatches(
  deletedIds: ReadonlySet<string>,
  elements: readonly VueDrawElement[],
): Map<string, ElementPatch<VueDrawArrowElement>> {
  const patches = new Map<string, ElementPatch<VueDrawArrowElement>>()
  for (const element of elements) {
    if (!isArrowElement(element)) {
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
