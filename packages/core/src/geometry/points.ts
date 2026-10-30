/**
 * Vector math used across geometry, hit-testing and interaction.
 * All functions are pure and allocation-light.
 */

import type { Point } from '../types.js'

export const DEGREES = Math.PI / 180

export const point = (x: number, y: number): Point => ({ x, y })

export function translate(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy }
}

/** Rotate `p` around `origin` by `angle` radians. */
export function rotatePoint(p: Point, origin: Point, angle: number): Point {
  if (angle === 0) {
    return { ...p }
  }
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

/** Inverse of {@link rotatePoint}, un-rotate `p` around `origin`. */
export function unrotatePoint(p: Point, origin: Point, angle: number): Point {
  return rotatePoint(p, origin, -angle)
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Squared distance, for comparisons without the sqrt. */
export function distanceSq(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/**
 * Distance from `p` to the segment `a`→`b`.
 * Classic projection clamped to the segment parametric range.
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) {
    return distance(p, a)
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy })
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Angle of the vector `a`→`b` in radians. */
export function angleOf(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/** Smallest signed delta between two angles, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) {
    d -= Math.PI * 2
  }
  if (d <= -Math.PI) {
    d += Math.PI * 2
  }
  return d
}

/** Snap `angle` (radians) to the nearest `step` multiple. */
export function snapAngle(angle: number, step = 15 * DEGREES): number {
  return Math.round(angle / step) * step
}

export interface Segment {
  a: Point
  b: Point
}

/** Consecutive point pairs of a polyline. */
export function segmentsOf(points: readonly Point[]): Segment[] {
  const segments: Segment[] = []
  for (let i = 1; i < points.length; i++) {
    segments.push({ a: points[i - 1]!, b: points[i]! })
  }
  return segments
}
