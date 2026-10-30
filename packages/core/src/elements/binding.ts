/**
 * Linear bindings — Excalidraw's fixed-point binding model
 * (packages/element/src/binding.ts, "simple" strategy), for lines and
 * arrows alike.
 *
 * A bound tip records the shape, a FIXED POINT (where inside the shape the
 * tip aims, as ratios of the shape's size) and a MODE:
 *   — `inside`: the tip sits exactly at the fixed point — what you get by
 *     dropping a tip inside a shape (or holding Alt);
 *   — `orbit`: the tip stops on the outline, dilated by a small gap, where
 *     the line from the fixed point toward the other end crosses it — what
 *     you get by dropping a tip just outside a shape. Its fixed point is a
 *     side midpoint when the tip lands near one, else the drop point
 *     projected onto the shape's diagonals.
 * Fixed points survive the shape moving, resizing and rotating, so an
 * arrow keeps aiming at the spot the user chose — no predefined zones.
 *
 * Constants and rules follow the reference: BASE_BINDING_GAP,
 * maxBindingDistance_simple, BASE_ARROW_MIN_LENGTH, normalizeFixedPoint,
 * calculateFixedPointForNonElbowArrowBinding, getSnapOutlineMidPoint,
 * projectFixedPointOntoDiagonal and updateBoundPoint.
 */
import { getElementBounds, pointInBounds } from '../geometry/bounds.js'
import { cornerRadius } from '../geometry/corners.js'
import { rotatePoint, unrotatePoint } from '../geometry/points.js'
import { isLinearElement } from './factories.js'
import { isPointInsideElement } from './hitTest.js'
import type { ElementPatch } from './mutate.js'
import type {
  BindMode,
  FixedPoint,
  OpenDrawBinding,
  OpenDrawDiamondElement,
  OpenDrawEllipseElement,
  OpenDrawElement,
  OpenDrawLinearElement,
  OpenDrawRectangleElement,
  OpenDrawTextElement,
  Point,
} from '../types.js'

/** Shapes a line or arrow tip can bind to (Excalidraw's bindable set, unlocked). */
export type OpenDrawBindableShape =
  | OpenDrawRectangleElement
  | OpenDrawDiamondElement
  | OpenDrawEllipseElement
  | OpenDrawTextElement

/** Excalidraw's BASE_BINDING_GAP. */
export const BASE_BINDING_GAP = 5
/** Excalidraw's BASE_ARROW_MIN_LENGTH — shorter arrows aim at the fixed point. */
export const BASE_ARROW_MIN_LENGTH = 10
/** Excalidraw's FOCUS_POINT_SIZE (screen px). */
export const FOCUS_POINT_SIZE = 10 / 1.5
/** Excalidraw's FIXED_POINT_BOUND — fixed points stay within ±10 sizes. */
const FIXED_POINT_BOUND = 10
/** Below this size a shape has no interior to anchor a ratio into. */
const MIN_BINDABLE_SIZE = 1
/** Rectangle diagonals are shrunk this much at each end (Excalidraw's OFFSET_PX). */
const DIAGONAL_INSET = 15

export function isBindableShape(element: OpenDrawElement): element is OpenDrawBindableShape {
  return (
    !element.locked &&
    (element.type === 'rectangle' ||
      element.type === 'diamond' ||
      element.type === 'ellipse' ||
      (element.type === 'text' && element.containerId === null))
  )
}

/** Excalidraw's getBindingGap: kept clear of the outline by this much. */
export function bindingGap(shape: Pick<OpenDrawBindableShape, 'strokeWidth'>): number {
  return BASE_BINDING_GAP + shape.strokeWidth / 2
}

/** Excalidraw's maxBindingDistance_simple: the magnetic radius, loosened at low zoom. */
export function maxBindingDistance(zoom = 1): number {
  const base = Math.max(BASE_BINDING_GAP, 15)
  const zoomValue = zoom < 1 ? zoom : 1
  return Math.min(Math.max(base / (zoomValue * 1.5), base), base * 2)
}

/**
 * Topmost bindable shape within `threshold` scene px of `point` — the
 * shape a tip at `point` would bind to.
 */
export function bindableShapeAt(
  elements: readonly OpenDrawElement[],
  point: Point,
  threshold: number,
  excludeId?: string,
): OpenDrawBindableShape | null {
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
// Fixed points
// ---------------------------------------------------------------------------

/**
 * Excalidraw's normalizeFixedPoint: clamps to ±FIXED_POINT_BOUND and never
 * lets a ratio sit exactly on 0.5, which would make the arrow's heading
 * flip on floating-point noise.
 */
export function normalizeFixedPoint(fixedPoint: readonly number[]): FixedPoint {
  if (fixedPoint.length !== 2 || !fixedPoint.every((value) => Number.isFinite(value))) {
    return [0.5001, 0.5001]
  }
  const clamp = (ratio: number): number => {
    const bounded = Math.min(FIXED_POINT_BOUND, Math.max(-FIXED_POINT_BOUND, ratio))
    return Math.abs(bounded - 0.5) < 0.0001 ? 0.5001 : bounded
  }
  return [clamp(fixedPoint[0]!), clamp(fixedPoint[1]!)]
}

function centerOf(element: OpenDrawElement): Point {
  return { x: element.x + element.width / 2, y: element.y + element.height / 2 }
}

/**
 * The fixed point for a scene point — Excalidraw's
 * calculateFixedPointForNonElbowArrowBinding: the point un-rotated about
 * the shape's center, as ratios of its size (floored at the binding gap so
 * tiny shapes stay bounded).
 */
export function fixedPointFor(shape: OpenDrawBindableShape, point: Point): FixedPoint {
  if (shape.width < MIN_BINDABLE_SIZE || shape.height < MIN_BINDABLE_SIZE) {
    return normalizeFixedPoint([0.5, 0.5])
  }
  const local = shape.angle === 0 ? point : unrotatePoint(point, centerOf(shape), shape.angle)
  const floor = bindingGap(shape)
  return normalizeFixedPoint([
    (local.x - shape.x) / Math.max(shape.width, floor),
    (local.y - shape.y) / Math.max(shape.height, floor),
  ])
}

/** The scene point a binding aims at (getGlobalFixedPointForBindableElement). */
export function focusPointOf(shape: OpenDrawBindableShape, binding: Pick<OpenDrawBinding, 'fixedPoint'>): Point {
  const [fx, fy] = normalizeFixedPoint(binding.fixedPoint)
  const point = { x: shape.x + shape.width * fx, y: shape.y + shape.height * fy }
  return shape.angle === 0 ? point : rotatePoint(point, centerOf(shape), shape.angle)
}

/** A binding of `shape` aiming at the scene point `focus`. */
export function bindingAt(shape: OpenDrawBindableShape, focus: Point, mode: BindMode): OpenDrawBinding {
  return { elementId: shape.id, fixedPoint: fixedPointFor(shape, focus), mode }
}

// ---------------------------------------------------------------------------
// Snap targets: side midpoints and diagonal projection
// ---------------------------------------------------------------------------

/**
 * The shape's side midpoints in scene space (Excalidraw's getAllMidpoints):
 * right, bottom, left, top — a diamond's are its four corners.
 */
export function shapeMidpoints(shape: OpenDrawBindableShape): Point[] {
  const { width: w, height: h } = shape
  const local: Point[] =
    shape.type === 'diamond'
      ? [
          { x: w, y: h / 2 },
          { x: w / 2, y: h },
          { x: 0, y: h / 2 },
          { x: w / 2, y: 0 },
        ]
      : [
          { x: w, y: h / 2 },
          { x: w / 2, y: h },
          { x: 0, y: h / 2 },
          { x: w / 2, y: 0 },
        ]
  return local.map((p) => scenePointOf(shape, p))
}

/** Distance under which a tip outside the shape snaps to a side midpoint. */
export function midpointSnapDistance(shape: OpenDrawBindableShape, zoom: number): number {
  return maxBindingDistance(zoom) + shape.strokeWidth / 2
}

/**
 * The side midpoint a tip at `point` snaps to — only from OUTSIDE the
 * shape, within the snap distance (getSnapOutlineMidPoint for simple
 * arrows). Null when none is near.
 */
export function snappedMidpoint(shape: OpenDrawBindableShape, point: Point, zoom: number): Point | null {
  if (isPointInsideElement(shape, point)) {
    return null
  }
  const threshold = midpointSnapDistance(shape, zoom)
  return shapeMidpoints(shape).find((mid) => Math.hypot(mid.x - point.x, mid.y - point.y) <= threshold) ?? null
}

/** Excalidraw's getDiagonalsForBindableElement, in scene space. */
function shapeDiagonals(shape: OpenDrawBindableShape): Array<[Point, Point]> {
  const { width: w, height: h } = shape
  const shrink = ([a, b]: [Point, Point], inset: number): [Point, Point] => {
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const ux = ((b.x - a.x) / length) * inset
    const uy = ((b.y - a.y) / length) * inset
    return [
      { x: a.x + ux, y: a.y + uy },
      { x: b.x - ux, y: b.y - uy },
    ]
  }
  const rectangular = shape.type === 'rectangle' || shape.type === 'text'
  const local: Array<[Point, Point]> = rectangular
    ? [
        [{ x: 0, y: 0 }, { x: w, y: h }],
        [{ x: w, y: 0 }, { x: 0, y: h }],
      ]
    : [
        [{ x: w / 2, y: 0 }, { x: w / 2, y: h }],
        [{ x: 0, y: h / 2 }, { x: w, y: h / 2 }],
      ]
  return local.map(([a, b]) => shrink([scenePointOf(shape, a), scenePointOf(shape, b)], rectangular ? DIAGONAL_INSET : 0))
}

/** Intersection point of segments a→b and c→d, or null. */
function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const t = segmentCrossing(a, b, c, d)
  return t === null ? null : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/**
 * Where a tip dropped just outside the shape aims — Excalidraw's
 * projectFixedPointOntoDiagonal: a near side midpoint wins; else the line
 * from `from` (the other end) through `point` is projected onto the shape's
 * diagonals, keeping the crossing nearest `from` that lies inside the shape.
 */
export function projectOntoDiagonal(
  shape: OpenDrawBindableShape,
  point: Point,
  from: Point,
  zoom: number,
): Point | null {
  const mid = snappedMidpoint(shape, point, zoom)
  if (mid) {
    return mid
  }
  const dx = point.x - from.x
  const dy = point.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 3) {
    return null
  }
  const diagonals = shapeDiagonals(shape)
  const longest = Math.max(...diagonals.map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y)))
  const reach = (2 * length + longest) / length
  const far = { x: from.x + dx * reach, y: from.y + dy * reach }
  const hits = diagonals
    .map(([a, b]) => segmentIntersection(far, from, a, b))
    .filter((p): p is Point => p !== null)
    .sort((p, q) => Math.hypot(p.x - from.x, p.y - from.y) - Math.hypot(q.x - from.x, q.y - from.y))
  const projection = hits[0]
  return projection && isPointInsideElement(shape, projection) ? projection : null
}

// ---------------------------------------------------------------------------
// Outline intersection (Excalidraw's intersectElementWithLineSegment)
// ---------------------------------------------------------------------------

/** Parameter t∈[0,1] along a→b where it crosses segment c→d. */
function segmentCrossing(a: Point, b: Point, c: Point, d: Point): number | null {
  const r = { x: b.x - a.x, y: b.y - a.y }
  const s = { x: d.x - c.x, y: d.y - c.y }
  const denominator = r.x * s.y - r.y * s.x
  if (denominator === 0) {
    return null
  }
  const w = { x: c.x - a.x, y: c.y - a.y }
  const t = (w.x * s.y - w.y * s.x) / denominator
  const u = (w.x * r.y - w.y * r.x) / denominator
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
}

/** Parameters t∈[0,1] along a→b where it crosses the ellipse (cx, cy, rx, ry). */
function ellipseCrossings(a: Point, b: Point, cx: number, cy: number, rx: number, ry: number): number[] {
  if (rx <= 0 || ry <= 0) {
    return []
  }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const ux = a.x - cx
  const uy = a.y - cy
  const qa = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
  if (qa === 0) {
    return []
  }
  const qb = 2 * ((ux * dx) / (rx * rx) + (uy * dy) / (ry * ry))
  const qc = (ux * ux) / (rx * rx) + (uy * uy) / (ry * ry) - 1
  const discriminant = qb * qb - 4 * qa * qc
  if (discriminant < 0) {
    return []
  }
  const root = Math.sqrt(discriminant)
  return [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)].filter((t) => t >= 0 && t <= 1)
}

/** Crossings of a→b with the quarter of a corner circle facing (sx, sy). */
function cornerArcCrossings(a: Point, b: Point, cx: number, cy: number, radius: number, sx: number, sy: number): number[] {
  return ellipseCrossings(a, b, cx, cy, radius, radius).filter((t) => {
    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t
    return (x - cx) * sx >= 0 && (y - cy) * sy >= 0
  })
}

/** All crossings of local segment a→b with the shape's outline dilated by `gap`. */
function localOutlineCrossings(shape: OpenDrawBindableShape, a: Point, b: Point, gap: number): number[] {
  const { width: w, height: h } = shape
  if (shape.type === 'ellipse') {
    return ellipseCrossings(a, b, w / 2, h / 2, w / 2 + gap, h / 2 + gap)
  }
  if (shape.type === 'diamond') {
    const vertices: Point[] = [
      { x: w / 2, y: -gap },
      { x: w + gap, y: h / 2 },
      { x: w / 2, y: h + gap },
      { x: -gap, y: h / 2 },
    ]
    return vertices.map((v, i) => segmentCrossing(a, b, v, vertices[(i + 1) % 4]!)).filter((t): t is number => t !== null)
  }
  // Rectangles (with their rounded corners) and free text frame a box.
  const r = shape.type === 'rectangle' && shape.roundness === 'round' ? cornerRadius(Math.min(w, h), 'rectangle') : 0
  const R = r + gap
  const [x1, y1, x2, y2] = [-gap, -gap, w + gap, h + gap]
  const edges: Array<[Point, Point]> = [
    [{ x: x1 + R, y: y1 }, { x: x2 - R, y: y1 }],
    [{ x: x2, y: y1 + R }, { x: x2, y: y2 - R }],
    [{ x: x2 - R, y: y2 }, { x: x1 + R, y: y2 }],
    [{ x: x1, y: y2 - R }, { x: x1, y: y1 + R }],
  ]
  const crossings = edges.map(([c, d]) => segmentCrossing(a, b, c, d)).filter((t): t is number => t !== null)
  if (r > 0) {
    crossings.push(
      ...cornerArcCrossings(a, b, r, r, R, -1, -1),
      ...cornerArcCrossings(a, b, w - r, r, R, 1, -1),
      ...cornerArcCrossings(a, b, w - r, h - r, R, 1, 1),
      ...cornerArcCrossings(a, b, r, h - r, R, -1, 1),
    )
  }
  return crossings
}

/**
 * Scene points where segment a→b crosses the shape's outline dilated by
 * `gap` — rotation-aware (the segment is tested in the shape's local frame).
 */
export function outlineIntersections(shape: OpenDrawBindableShape, a: Point, b: Point, gap: number): Point[] {
  const la = localPointOf(shape, a)
  const lb = localPointOf(shape, b)
  return localOutlineCrossings(shape, la, lb, gap).map((t) =>
    scenePointOf(shape, { x: la.x + (lb.x - la.x) * t, y: la.y + (lb.y - la.y) * t }),
  )
}

/** Whether the scene point lies within the shape's outline dilated by `gap`. */
function isInsideOutline(shape: OpenDrawBindableShape, point: Point, gap: number): boolean {
  const p = localPointOf(shape, point)
  const { width: w, height: h } = shape
  if (shape.type === 'ellipse') {
    const ux = (p.x - w / 2) / (w / 2 + gap)
    const uy = (p.y - h / 2) / (h / 2 + gap)
    return ux * ux + uy * uy <= 1
  }
  if (shape.type === 'diamond') {
    return Math.abs(p.x - w / 2) / (w / 2 + gap) + Math.abs(p.y - h / 2) / (h / 2 + gap) <= 1
  }
  return p.x >= -gap && p.x <= w + gap && p.y >= -gap && p.y <= h + gap
}

// ---------------------------------------------------------------------------
// Scene <-> local space (same pivot as the hit-tester: x + width / 2)
// ---------------------------------------------------------------------------

/** Scene-space position of an element-local point, rotated about the pivot. */
export function scenePointOf(element: OpenDrawElement, point: Point): Point {
  const base = { x: element.x + point.x, y: element.y + point.y }
  return element.angle === 0 ? base : rotatePoint(base, centerOf(element), element.angle)
}

/** Element-local position of a scene point, un-rotated about the pivot. */
export function localPointOf(element: OpenDrawElement, scene: Point): Point {
  const base = element.angle === 0 ? scene : unrotatePoint(scene, centerOf(element), element.angle)
  return { x: base.x - element.x, y: base.y - element.y }
}

/**
 * Points patch with size fields re-synced — unrotated elements carry the
 * points' extents in width/height; with an angle those fields are the
 * rotation pivot and must stay untouched. Every linear points write in
 * the app goes through here so the size fields never go stale.
 */
export function pointsPatch(element: OpenDrawLinearElement, points: Point[]): ElementPatch<OpenDrawLinearElement> {
  const patch: ElementPatch<OpenDrawLinearElement> = { points }
  if (element.angle === 0) {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    patch.width = Math.max(...xs) - Math.min(...xs)
    patch.height = Math.max(...ys) - Math.min(...ys)
  }
  return patch
}

/** Move one point of a linear element to a scene position, the rest fixed. */
export function moveLinearPoint(element: OpenDrawLinearElement, index: number, scene: Point): ElementPatch<OpenDrawLinearElement> {
  const points = element.points.map((point) => ({ ...point }))
  points[index] = localPointOf(element, scene)
  return pointsPatch(element, points)
}

// ---------------------------------------------------------------------------
// Choosing a binding for a dragged tip (the "simple" strategy)
// ---------------------------------------------------------------------------

type End = 'start' | 'end'

export interface TipBindingOptions {
  /** Alt held: bind inside at the exact point, whatever the position. */
  inside?: boolean
}

export interface TipBindingResult {
  /** The binding for the dragged tip, or null to leave it loose. */
  binding: OpenDrawBinding | null
  /** The shape it binds to (the binding highlight's target). */
  shape: OpenDrawBindableShape | null
  /**
   * Replacement for the OTHER end's binding when the rules change it (both
   * ends on one shape bind inside); undefined leaves it as it is.
   */
  other?: OpenDrawBinding | null
}

/**
 * The binding a dragged tip takes at `tip` — Excalidraw's
 * getBindingStrategyForDraggingBindingElementEndpoints_simple:
 *   — no shape within the magnetic distance: loose;
 *   — the other end already bound to the same shape: both ends bind
 *     inside (the other at its own fixed point);
 *   — Alt held, or the tip inside the shape: `inside` at the tip;
 *   — otherwise `orbit`, aiming at a near side midpoint or at the tip's
 *     projection onto the shape's diagonals (else the tip itself).
 */
export function resolveTipBinding(
  arrow: OpenDrawLinearElement,
  end: End,
  tip: Point,
  elements: readonly OpenDrawElement[],
  zoom: number,
  options: TipBindingOptions = {},
): TipBindingResult {
  const shape = bindableShapeAt(elements, tip, maxBindingDistance(zoom), arrow.id)
  if (!shape) {
    return { binding: null, shape: null }
  }
  const otherBinding = end === 'start' ? arrow.endBinding : arrow.startBinding
  if (otherBinding && otherBinding.elementId === shape.id) {
    return {
      binding: bindingAt(shape, tip, 'inside'),
      shape,
      other: { ...otherBinding, mode: 'inside' },
    }
  }
  if (options.inside || isPointInsideElement(shape, tip)) {
    return { binding: bindingAt(shape, tip, 'inside'), shape }
  }
  const neighborIndex = end === 'start' ? 1 : arrow.points.length - 2
  let from = scenePointOf(arrow, arrow.points[neighborIndex] ?? arrow.points[0]!)
  if (arrow.points.length === 2 && otherBinding) {
    const otherShape = elements.find((el) => el.id === otherBinding.elementId)
    if (otherShape && isBindableShape(otherShape)) {
      from = focusPointOf(otherShape, otherBinding)
    }
  }
  const focus = projectOntoDiagonal(shape, tip, from, zoom) ?? tip
  return { binding: bindingAt(shape, focus, 'orbit'), shape }
}

// ---------------------------------------------------------------------------
// Bound tip positions (Excalidraw's updateBoundPoint)
// ---------------------------------------------------------------------------

function boundShape(binding: OpenDrawBinding | null, byId: ReadonlyMap<string, OpenDrawElement>): OpenDrawBindableShape | null {
  if (!binding) {
    return null
  }
  const target = byId.get(binding.elementId)
  return target !== undefined && isBindableShape(target) ? target : null
}

const area = (shape: OpenDrawBindableShape): number => shape.width * shape.height
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)
const nearestTo = (points: readonly Point[], target: Point): Point | null =>
  points.reduce<Point | null>((best, p) => (best === null || distance(p, target) < distance(best, target) ? p : best), null)

function asMap(elements: readonly OpenDrawElement[] | ReadonlyMap<string, OpenDrawElement>): ReadonlyMap<string, OpenDrawElement> {
  return elements instanceof Map ? elements : new Map((elements as readonly OpenDrawElement[]).map((el) => [el.id, el]))
}

export interface BoundTipOptions {
  /** True while the tip is being dragged — skips the nested-shape rule. */
  dragging?: boolean
}

/**
 * Where a bound tip sits right now — Excalidraw's updateBoundPoint:
 *   — `inside`: exactly at the fixed point;
 *   — `orbit`: where the line from the fixed point toward the other end (its
 *     fixed point when also bound and the arrow has two points, else the
 *     neighboring point) crosses the dilated outline — falling back to the
 *     fixed point when the arrow would be too short or would invert into a
 *     smaller shape nested in this one.
 * Null when the tip is unbound or its shape is gone.
 */
export function boundTipPoint(
  arrow: OpenDrawLinearElement,
  end: End,
  elements: readonly OpenDrawElement[] | ReadonlyMap<string, OpenDrawElement>,
  options: BoundTipOptions = {},
): Point | null {
  const byId = asMap(elements)
  const binding = end === 'start' ? arrow.startBinding : arrow.endBinding
  const shape = boundShape(binding, byId)
  if (!binding || !shape) {
    return null
  }
  const focus = focusPointOf(shape, binding)
  if (binding.mode === 'inside') {
    return focus
  }

  const otherBinding = end === 'start' ? arrow.endBinding : arrow.startBinding
  const otherShape = boundShape(otherBinding, byId)
  const otherFocus = otherShape && otherBinding ? focusPointOf(otherShape, otherBinding) : null
  const neighbor = scenePointOf(arrow, arrow.points[end === 'start' ? 1 : arrow.points.length - 2] ?? arrow.points[0]!)
  const toward = arrow.points.length === 2 ? (otherFocus ?? neighbor) : neighbor

  const outline = nearestTo(outlineIntersections(shape, focus, toward, bindingGap(shape)), toward)
  const otherOutline = otherShape ? nearestTo(outlineIntersections(otherShape, focus, toward, bindingGap(otherShape)), focus) : null
  const hasHead = end === 'start' ? arrow.startArrowhead !== null : arrow.endArrowhead !== null
  const noHeads = arrow.startArrowhead === null && arrow.endArrowhead === null
  const resolved = noHeads || hasHead ? focus : (outline ?? focus)

  // A smaller shape nested inside this one: snapping to the outline would
  // invert the arrow, so aim at the fixed point instead.
  if (
    otherShape &&
    outline &&
    !options.dragging &&
    area(otherShape) < area(shape) * 2 &&
    isInsideOutline(otherShape, outline, bindingGap(otherShape))
  ) {
    return resolved
  }

  const otherTarget = otherShape ? (otherOutline ?? otherFocus ?? neighbor) : neighbor
  const tooShort = distance(otherTarget, outline ?? focus) <= BASE_ARROW_MIN_LENGTH
  if (!otherShape) {
    return tooShort ? focus : (outline ?? focus)
  }
  if (tooShort) {
    return resolved
  }
  return outline ?? focus
}

/**
 * The points patch that puts every bound tip of `arrow` where its binding
 * says (a two-point arrow re-aims both ends; a polyline only its tips).
 * Null when nothing is bound.
 */
export function boundTipsPatch(
  arrow: OpenDrawLinearElement,
  elements: readonly OpenDrawElement[] | ReadonlyMap<string, OpenDrawElement>,
  options: BoundTipOptions = {},
): ElementPatch<OpenDrawLinearElement> | null {
  if (!arrow.startBinding && !arrow.endBinding) {
    return null
  }
  const start = boundTipPoint(arrow, 'start', elements, options)
  const end = boundTipPoint(arrow, 'end', elements, options)
  if (!start && !end) {
    return null
  }
  const points = arrow.points.map((point) => ({ ...point }))
  if (start) {
    points[0] = localPointOf(arrow, start)
  }
  if (end) {
    points[points.length - 1] = localPointOf(arrow, end)
  }
  return pointsPatch(arrow, points)
}

/**
 * Patches after shapes move, resize or rotate: every line or arrow bound to
 * one of them re-aims its bound tips. A linear element that moved WITH all
 * its bound shapes moved rigidly and needs nothing; one dragged on its own
 * keeps its geometry until the drag ends (see `rebindAfterDrag`).
 */
export function bindingFollowPatches(
  movedIds: ReadonlySet<string>,
  elements: readonly OpenDrawElement[],
): Map<string, ElementPatch<OpenDrawLinearElement>> {
  const patches = new Map<string, ElementPatch<OpenDrawLinearElement>>()
  const byId = asMap(elements)
  for (const element of elements) {
    if (!isLinearElement(element) || (!element.startBinding && !element.endBinding)) {
      continue
    }
    const bound = [element.startBinding, element.endBinding].filter((b): b is OpenDrawBinding => b !== null)
    if (!bound.some((b) => movedIds.has(b.elementId))) {
      continue
    }
    if (movedIds.has(element.id) && bound.every((b) => movedIds.has(b.elementId))) {
      continue
    }
    const patch = boundTipsPatch(element, byId)
    if (patch) {
      patches.set(element.id, patch)
    }
  }
  return patches
}

/**
 * After a line or arrow is dragged on its own, each tip binds to whatever
 * shape it now lands on (by the same rules as dragging a tip) or unbinds —
 * Excalidraw's bindOrUnbindBindingElements at the end of a drag.
 */
export function rebindAfterDrag(
  arrow: OpenDrawLinearElement,
  elements: readonly OpenDrawElement[],
  zoom: number,
): ElementPatch<OpenDrawLinearElement> {
  const loose = { ...arrow, startBinding: null, endBinding: null }
  const start = resolveTipBinding(loose, 'start', scenePointOf(arrow, arrow.points[0]!), elements, zoom).binding
  const end = resolveTipBinding({ ...loose, startBinding: start }, 'end', scenePointOf(arrow, arrow.points[arrow.points.length - 1]!), elements, zoom).binding
  const rebound = { ...arrow, startBinding: start, endBinding: end }
  return { startBinding: start, endBinding: end, ...(boundTipsPatch(rebound, elements) ?? {}) }
}

/**
 * Patches nulling out bindings whose target was deleted — applied inside the
 * deletion's own undo step so the element and the cleanup revert together.
 */
export function orphanBindingPatches(
  deletedIds: ReadonlySet<string>,
  elements: readonly OpenDrawElement[],
): Map<string, ElementPatch<OpenDrawLinearElement>> {
  const patches = new Map<string, ElementPatch<OpenDrawLinearElement>>()
  for (const element of elements) {
    if (!isLinearElement(element)) {
      continue
    }
    const startOrphaned = element.startBinding !== null && deletedIds.has(element.startBinding.elementId)
    const endOrphaned = element.endBinding !== null && deletedIds.has(element.endBinding.elementId)
    if (startOrphaned || endOrphaned) {
      patches.set(element.id, {
        startBinding: startOrphaned ? null : element.startBinding,
        endBinding: endOrphaned ? null : element.endBinding,
      })
    }
  }
  return patches
}
