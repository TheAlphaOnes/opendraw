/**
 * Bounds geometry: axis-aligned boxes in scene space.
 *
 * Rotation-aware helpers exist because elements carry an `angle` around
 * their center — the AABB of a rotated element is the AABB of its rotated
 * corner points.
 */

import type { Bounds, Point, OpenDrawElement } from '../types.js'
import { rotatePoint } from './points.js'

export function boundsOfPoints(points: readonly Point[]): Bounds {
  let x1 = Number.POSITIVE_INFINITY
  let y1 = Number.POSITIVE_INFINITY
  let x2 = Number.NEGATIVE_INFINITY
  let y2 = Number.NEGATIVE_INFINITY
  for (const p of points) {
    x1 = Math.min(x1, p.x)
    y1 = Math.min(y1, p.y)
    x2 = Math.max(x2, p.x)
    y2 = Math.max(y2, p.y)
  }
  return { x1, y1, x2, y2 }
}

export function boundsOfXYWH(x: number, y: number, width: number, height: number): Bounds {
  return {
    x1: Math.min(x, x + width),
    y1: Math.min(y, y + height),
    x2: Math.max(x, x + width),
    y2: Math.max(y, y + height),
  }
}

/** The four corners of an element in scene space, rotation applied. */
export function elementCorners(element: OpenDrawElement): [Point, Point, Point, Point] {
  const { x, y, width, height, angle } = element
  if (angle === 0) {
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ]
  }
  const center = { x: x + width / 2, y: y + height / 2 }
  const corners: [Point, Point, Point, Point] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
  return corners.map((c) => rotatePoint(c, center, angle)) as [Point, Point, Point, Point]
}

/** Rotation-aware AABB of a single element (geometry, not visual stroke). */
export function getElementBounds(element: OpenDrawElement): Bounds {
  if (element.type === 'line' || element.type === 'arrow') {
    const points = element.points.map((p) => ({
      x: element.x + p.x,
      y: element.y + p.y,
    }))
    const base = boundsOfPoints(points)
    if (element.angle !== 0) {
      return boundsOfPoints(elementCorners({ ...element, x: base.x1, y: base.y1, width: base.x2 - base.x1, height: base.y2 - base.y1 }))
    }
    return base
  }
  if (element.type === 'freedraw') {
    const points = element.points.map((p) => ({
      x: element.x + p[0]!,
      y: element.y + p[1]!,
    }))
    const base = boundsOfPoints(points)
    if (element.angle !== 0) {
      return boundsOfPoints(elementCorners({ ...element, x: base.x1, y: base.y1, width: base.x2 - base.x1, height: base.y2 - base.y1 }))
    }
    return base
  }
  return boundsOfPoints(elementCorners(element))
}

/** Union AABB of many elements. Empty input yields an inverted empty box. */
export function getCommonBounds(elements: readonly OpenDrawElement[]): Bounds {
  let x1 = Number.POSITIVE_INFINITY
  let y1 = Number.POSITIVE_INFINITY
  let x2 = Number.NEGATIVE_INFINITY
  let y2 = Number.NEGATIVE_INFINITY
  for (const element of elements) {
    const b = getElementBounds(element)
    x1 = Math.min(x1, b.x1)
    y1 = Math.min(y1, b.y1)
    x2 = Math.max(x2, b.x2)
    y2 = Math.max(y2, b.y2)
  }
  return { x1, y1, x2, y2 }
}

/** Union of raw bounds — for marquee/selection math without re-measuring. */
export function unionBounds(bounds: readonly Bounds[]): Bounds {
  let x1 = Number.POSITIVE_INFINITY
  let y1 = Number.POSITIVE_INFINITY
  let x2 = Number.NEGATIVE_INFINITY
  let y2 = Number.NEGATIVE_INFINITY
  for (const b of bounds) {
    x1 = Math.min(x1, b.x1)
    y1 = Math.min(y1, b.y1)
    x2 = Math.max(x2, b.x2)
    y2 = Math.max(y2, b.y2)
  }
  return { x1, y1, x2, y2 }
}

export function normalizeBounds(bounds: Bounds): Bounds {
  return {
    x1: Math.min(bounds.x1, bounds.x2),
    y1: Math.min(bounds.y1, bounds.y2),
    x2: Math.max(bounds.x1, bounds.x2),
    y2: Math.max(bounds.y1, bounds.y2),
  }
}

export function boundsCenter(bounds: Bounds): Point {
  return { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 }
}

export function boundsWidth(bounds: Bounds): number {
  return bounds.x2 - bounds.x1
}

export function boundsHeight(bounds: Bounds): number {
  return bounds.y2 - bounds.y1
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1
}

export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.x1 >= outer.x1 && inner.x2 <= outer.x2 && inner.y1 >= outer.y1 && inner.y2 <= outer.y2
  )
}

export function pointInBounds(p: Point, bounds: Bounds): boolean {
  return p.x >= bounds.x1 && p.x <= bounds.x2 && p.y >= bounds.y1 && p.y <= bounds.y2
}

export function translateBounds(bounds: Bounds, dx: number, dy: number): Bounds {
  return { x1: bounds.x1 + dx, y1: bounds.y1 + dy, x2: bounds.x2 + dx, y2: bounds.y2 + dy }
}

export function inflateBounds(bounds: Bounds, amount: number): Bounds {
  return {
    x1: bounds.x1 - amount,
    y1: bounds.y1 - amount,
    x2: bounds.x2 + amount,
    y2: bounds.y2 + amount,
  }
}

/** Scale a box around its top-left by (sx, sy) — used by group resize. */
export function scaleBounds(bounds: Bounds, sx: number, sy: number): Bounds {
  return {
    x1: bounds.x1 * sx,
    y1: bounds.y1 * sy,
    x2: bounds.x2 * sx,
    y2: bounds.y2 * sy,
  }
}
