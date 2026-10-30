/**
 * Rotation-aware element hit-testing.
 *
 * The idiom throughout: to test a rotated element we un-rotate the POINT
 * about the element center and test against the axis-aligned local shape —
 * cheaper and simpler than rotating the shape.
 *
 * Two-stage like Excalidraw: a padded-AABB fast path, then a precise
 * per-type test. "Inside" only counts for opaque-background shapes; open
 * paths (lines/arrows) only hit on their stroke within a zoom-aware
 * threshold.
 */

import { boundsContain, getElementBounds, boundsIntersect, pointInBounds } from '../geometry/bounds.js'
import { distanceToSegment, segmentsOf, unrotatePoint } from '../geometry/points.js'
import { isLinearElement, isFreedrawElement } from './factories.js'
import { TRANSPARENT } from './defaults.js'
import type { Bounds, Point, OpenDrawElement } from '../types.js'

/** Screen-space collision base (0.85 * Excalidraw's 8px), scene-scaled. */
export function hitThreshold(zoom: number): number {
  return (0.85 * 8) / Math.max(zoom, 0.001)
}

/** Local-space point: un-rotate about the element center. */
function toLocal(element: OpenDrawElement, point: Point): Point {
  if (element.angle === 0) {
    return { ...point }
  }
  return unrotatePoint(
    point,
    { x: element.x + element.width / 2, y: element.y + element.height / 2 },
    element.angle,
  )
}

/** True when the element's background makes its interior clickable. */
function hasOpaqueBackground(element: OpenDrawElement): boolean {
  return element.backgroundColor !== TRANSPARENT
}

/** A polyline whose endpoints nearly touch counts as a closed loop. */
export function isPathALoop(points: readonly Point[], tolerance = 10): boolean {
  if (points.length < 3) {
    return false
  }
  const first = points[0]!
  const last = points[points.length - 1]!
  return Math.hypot(last.x - first.x, last.y - first.y) <= tolerance
}

/** Standard even-odd ray-cast polygon test. */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!
    const pj = polygon[j]!
    if (
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x
    ) {
      inside = !inside
    }
  }
  return inside
}

/** First-order distance from a point to an ellipse outline. */
function distanceToEllipseOutline(point: Point, cx: number, cy: number, rx: number, ry: number): number {
  const dx = point.x - cx
  const dy = point.y - cy
  if (rx === 0 || ry === 0) {
    return Math.hypot(dx, dy)
  }
  const ux = dx / rx
  const uy = dy / ry
  const norm = Math.hypot(ux, uy)
  if (norm === 0) {
    return Math.min(rx, ry)
  }
  const theta = Math.atan2(uy, ux)
  const localRadius = (rx * ry) / Math.hypot(ry * Math.cos(theta), rx * Math.sin(theta))
  return Math.abs(norm - 1) * localRadius
}

/** Local-frame outline distance for the rectangle family (incl. text). */
function distanceToRectOutline(point: Point, x: number, y: number, width: number, height: number): number {
  const corners: Point[] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
  let min = Number.POSITIVE_INFINITY
  const sides = segmentsOf([...corners, corners[0]!])
  for (const seg of sides) {
    min = Math.min(min, distanceToSegment(point, seg.a, seg.b))
  }
  return min
}

function diamondPoints(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x: x + width / 2, y },
    { x: x + width, y: y + height / 2 },
    { x: x + width / 2, y: y + height },
    { x, y: y + height / 2 },
  ]
}

/** Precise point-in-element (local frame). */
function pointInsideShape(element: OpenDrawElement, local: Point): boolean {
  const { x, y, width, height } = element
  switch (element.type) {
    case 'rectangle':
    case 'text':
    case 'image':
    case 'frame':
      return local.x >= x && local.x <= x + width && local.y >= y && local.y <= y + height
    case 'ellipse': {
      const rx = width / 2
      const ry = height / 2
      const dx = (local.x - x - rx) / rx
      const dy = (local.y - y - ry) / ry
      return dx * dx + dy * dy <= 1
    }
    case 'diamond': {
      const hw = width / 2
      const hh = height / 2
      return Math.abs(local.x - x - hw) / hw + Math.abs(local.y - y - hh) / hh <= 1
    }
    case 'freedraw': {
      const points = element.points.map((p) => ({ x: element.x + p[0]!, y: element.y + p[1]! }))
      return isPathALoop(points) && hasOpaqueBackground(element)
        ? pointInPolygon(local, points)
        : false
    }
    default:
      return false
  }
}

/** Precise distance from the point to the element's outline (local frame). */
function outlineDistance(element: OpenDrawElement, local: Point): number {
  const { x, y, width, height } = element
  switch (element.type) {
    case 'rectangle':
    case 'text':
    case 'image':
    case 'frame':
      return distanceToRectOutline(local, x, y, width, height)
    case 'diamond': {
      const pts = diamondPoints(x, y, width, height)
      let min = Number.POSITIVE_INFINITY
      for (const seg of segmentsOf([...pts, pts[0]!])) {
        min = Math.min(min, distanceToSegment(local, seg.a, seg.b))
      }
      return min
    }
    case 'ellipse':
      return distanceToEllipseOutline(local, x + width / 2, y + height / 2, width / 2, height / 2)
    case 'line':
    case 'arrow': {
      let min = Number.POSITIVE_INFINITY
      for (const seg of segmentsOf(element.points)) {
        min = Math.min(
          min,
          distanceToSegment(local, { x: x + seg.a.x, y: y + seg.a.y }, { x: x + seg.b.x, y: y + seg.b.y }),
        )
      }
      return min
    }
    case 'freedraw': {
      let min = Number.POSITIVE_INFINITY
      const pts = element.points
      for (let i = 1; i < pts.length; i++) {
        const a = { x: x + pts[i - 1]![0]!, y: y + pts[i - 1]![1]! }
        const b = { x: x + pts[i]![0]!, y: y + pts[i]![1]! }
        min = Math.min(min, distanceToSegment(local, a, b))
      }
      return min
    }
  }
}

/**
 * Full hit test: padded-AABB fast path, then per-type precise test.
 * `threshold` is in scene px (screen tolerance / zoom).
 */
export function hitTestElement(
  element: OpenDrawElement,
  point: Point,
  threshold: number,
): boolean {
  const padded = getElementBounds(element)
  if (
    !pointInBounds(point, {
      x1: padded.x1 - threshold,
      y1: padded.y1 - threshold,
      x2: padded.x2 + threshold,
      y2: padded.y2 + threshold,
    })
  ) {
    return false
  }
  const local = toLocal(element, point)

  const testInside =
    element.type === 'text' ||
    element.type === 'image' ||
    element.type === 'frame' ||
    (hasOpaqueBackground(element) && element.type !== 'line' && element.type !== 'arrow')
  if (testInside && pointInsideShape(element, local)) {
    return true
  }
  // Linear elements with a filled loop also test inside.
  if (
    (element.type === 'line' || element.type === 'arrow') &&
    hasOpaqueBackground(element) &&
    isPathALoop(element.points)
  ) {
    const poly = element.points.map((p) => ({ x: element.x + p.x, y: element.y + p.y }))
    if (pointInPolygon(local, poly)) {
      return true
    }
  }
  return outlineDistance(element, local) <= threshold
}

/**
 * True when the scene point lies inside the element's area, regardless of
 * fill — the "inside" half of the hit test, rotation-aware.
 */
export function isPointInsideElement(element: OpenDrawElement, point: Point): boolean {
  return pointInsideShape(element, toLocal(element, point))
}

/** Topmost element under the point (z-order: later wins), or null. */
export function findElementAt(
  elements: readonly OpenDrawElement[],
  point: Point,
  threshold: number,
): OpenDrawElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]!
    if (hitTestElement(element, point, threshold)) {
      return element
    }
  }
  return null
}

/** Elements whose (rotation-aware) bounds intersect `bounds` — marquee. */
export function elementsInBounds(
  elements: readonly OpenDrawElement[],
  bounds: Bounds,
): OpenDrawElement[] {
  return elements.filter((element) => boundsIntersect(getElementBounds(element), bounds))
}

/**
 * Elements whose (rotation-aware) bounds lie wholly inside `bounds` —
 * the marquee's box selection. Excalidraw's default `boxSelectionMode`
 * is "contain": brushing past an element's edge does not select it.
 */
export function elementsWithinBounds(
  elements: readonly OpenDrawElement[],
  bounds: Bounds,
): OpenDrawElement[] {
  return elements.filter((element) => boundsContain(bounds, getElementBounds(element)))
}

/**
 * Elements swept by an eraser stroke from `from` to `to` (scene points).
 *
 * Excalidraw tests the whole segment between consecutive pointer samples
 * (eraser/index.ts), so a fast drag cannot jump over an element between
 * events. We get equivalent coverage by sampling the segment at
 * sub-threshold spacing and reusing the point hit test: anything the stroke
 * passes within `threshold - step/2` of is always caught, and the "inside"
 * tests (opaque shapes, text) come along for free.
 */
export function elementsUnderEraser(
  elements: readonly OpenDrawElement[],
  from: Point,
  to: Point,
  zoom: number,
): OpenDrawElement[] {
  const threshold = hitThreshold(zoom) + 4 / zoom
  // Fast reject: anything outside the stroke's padded bounds is skipped
  // before the per-sample work.
  const sweepBounds: Bounds = {
    x1: Math.min(from.x, to.x) - threshold,
    y1: Math.min(from.y, to.y) - threshold,
    x2: Math.max(from.x, to.x) + threshold,
    y2: Math.max(from.y, to.y) + threshold,
  }
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const samples = length === 0 ? 0 : Math.ceil(length / (threshold / 2))
  return elements.filter((element) => {
    if (!boundsIntersect(getElementBounds(element), sweepBounds)) {
      return false
    }
    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const point = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      }
      if (hitTestElement(element, point, threshold)) {
        return true
      }
    }
    return false
  })
}

/** Utility re-exports for consumers reasoning about element shapes. */
export { isLinearElement, isFreedrawElement }
