/**
 * Arrowheads — Excalidraw's element/src/bounds.ts `getArrowheadPoints`
 * geometry and element/src/shape.ts `getArrowheadShapes` drawing, for the
 * straight polylines opendraw renders.
 *
 * Sizes and angles are Excalidraw's; each head shrinks on short segments so
 * it never swallows the line (half the last segment, a quarter for
 * diamonds).
 */

import type { Drawable, Options } from 'roughjs/bin/core.js'
import type { RoughGenerator } from 'roughjs/bin/generator.js'

import type { Arrowhead, OpenDrawLinearElement } from '../types.js'

type Position = 'start' | 'end'

function arrowheadSize(arrowhead: Arrowhead): number {
  switch (arrowhead) {
    case 'arrow':
      return 25
    case 'diamond':
    case 'diamond_outline':
      return 12
    default:
      return 15
  }
}

/** Half-opening of the head, in degrees. */
function arrowheadAngle(arrowhead: Arrowhead): number {
  switch (arrowhead) {
    case 'bar':
      return 90
    case 'arrow':
      return 20
    default:
      return 25
  }
}

function rotate(x: number, y: number, cx: number, cy: number, angle: number): [number, number] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [(x - cx) * cos - (y - cy) * sin + cx, (x - cx) * sin + (y - cy) * cos + cy]
}

/**
 * The head's construction points in element-local space:
 *   — circles: `[cx, cy, diameter]`;
 *   — diamonds: `[tipX, tipY, x3, y3, oppositeX, oppositeY, x4, y4]`;
 *   — everything else: `[tipX, tipY, x3, y3, x4, y4]` (the two wings).
 * Null when the end segment has no length to point along.
 */
export function arrowheadPoints(
  element: Pick<OpenDrawLinearElement, 'points' | 'strokeWidth'>,
  position: Position,
  arrowhead: Arrowhead,
  body?: Drawable,
): number[] | null {
  const { points } = element
  if (points.length < 2) {
    return null
  }
  const tip = position === 'end' ? points[points.length - 1]! : points[0]!
  const previous = position === 'end' ? points[points.length - 2]! : points[1]!
  const length = Math.hypot(tip.x - previous.x, tip.y - previous.y)
  if (length === 0) {
    return null
  }
  // The head points along the rendered stroke where it meets the tip — for
  // a curve, its tangent there, not the straight last segment.
  const direction = (body && strokeDirection(body, position)) ?? {
    x: (tip.x - previous.x) / length,
    y: (tip.y - previous.y) / length,
  }
  const nx = direction.x
  const ny = direction.y
  const lengthMultiplier = arrowhead === 'diamond' || arrowhead === 'diamond_outline' ? 0.25 : 0.5
  const size = Math.min(arrowheadSize(arrowhead), length * lengthMultiplier)
  const tx = tip.x
  const ty = tip.y
  const xs = tx - nx * size
  const ys = ty - ny * size

  if (arrowhead === 'circle' || arrowhead === 'circle_outline') {
    const diameter = Math.hypot(ys - ty, xs - tx) + element.strokeWidth - 2
    return [tx, ty, diameter]
  }

  const angle = (arrowheadAngle(arrowhead) * Math.PI) / 180
  const [x3, y3] = rotate(xs, ys, tx, ty, -angle)
  const [x4, y4] = rotate(xs, ys, tx, ty, angle)

  if (arrowhead === 'diamond' || arrowhead === 'diamond_outline') {
    // The far corner sits two head-lengths back along the segment.
    const [ox, oy] = [tx - nx * size * 2, ty - ny * size * 2]
    return [tx, ty, x3, y3, ox, oy, x4, y4]
  }
  return [tx, ty, x3, y3, x4, y4]
}

/**
 * Direction of the rendered stroke arriving at a tip — Excalidraw's
 * getArrowheadPoints: take the stroke's first (start) or last (end) cubic
 * bezier, evaluate it at t = 0.3 and point from there to the tip.
 */
function strokeDirection(body: Drawable, position: Position): { x: number; y: number } | null {
  const ops = body.sets.find((set) => set.type === 'path')?.ops
  if (!ops || ops.length < 2) {
    return null
  }
  const index = position === 'start' ? 1 : ops.length - 1
  const op = ops[index]!
  const prev = ops[index - 1]!
  if (op.op !== 'bcurveTo' || op.data.length !== 6) {
    return null
  }
  const [c1x, c1y, c2x, c2y, ex, ey] = op.data as [number, number, number, number, number, number]
  const p0 =
    prev.op === 'move' ? [prev.data[0]!, prev.data[1]!] : prev.op === 'bcurveTo' ? [prev.data[4]!, prev.data[5]!] : [0, 0]
  // Excalidraw's (reversed-weight) cubic: B(0.3) lands near the far end.
  const at = (t: number, i: 0 | 1): number =>
    Math.pow(1 - t, 3) * (i === 0 ? ex : ey) +
    3 * t * Math.pow(1 - t, 2) * (i === 0 ? c2x : c2y) +
    3 * Math.pow(t, 2) * (1 - t) * (i === 0 ? c1x : c1y) +
    p0[i]! * Math.pow(t, 3)
  const [x2, y2] = position === 'start' ? [p0[0]!, p0[1]!] : [ex, ey]
  const x1 = at(0.3, 0)
  const y1 = at(0.3, 1)
  const distance = Math.hypot(x2 - x1, y2 - y1)
  if (distance === 0) {
    return null
  }
  return { x: (x2 - x1) / distance, y: (y2 - y1) / distance }
}

/**
 * Rough.js drawables for one head. Heads always draw with a solid stroke
 * and at most roughness 1 (Excalidraw keeps caps legible); filled heads
 * use the stroke color, outline heads the canvas background.
 */
export function arrowheadDrawables(
  generator: RoughGenerator,
  element: OpenDrawLinearElement,
  position: Position,
  arrowhead: Arrowhead,
  options: Options,
  strokeColor: string,
  backgroundColor: string,
  body?: Drawable,
): Drawable[] {
  const head = arrowheadPoints(element, position, arrowhead, body)
  if (!head) {
    return []
  }
  const solid: Options = { ...options, strokeLineDash: undefined, roughness: Math.min(1, options.roughness ?? 0) }
  const fill = arrowhead.endsWith('_outline') ? backgroundColor : strokeColor

  switch (arrowhead) {
    case 'circle':
    case 'circle_outline': {
      const [x, y, diameter] = head as [number, number, number]
      return [
        generator.circle(x, y, diameter, {
          ...solid,
          fill,
          fillStyle: 'solid',
          stroke: strokeColor,
          roughness: Math.min(0.5, options.roughness ?? 0),
        }),
      ]
    }
    case 'triangle':
    case 'triangle_outline': {
      const [x, y, x2, y2, x3, y3] = head as [number, number, number, number, number, number]
      return [generator.polygon([[x, y], [x2, y2], [x3, y3], [x, y]], { ...solid, fill, fillStyle: 'solid' })]
    }
    case 'diamond':
    case 'diamond_outline': {
      const [x, y, x2, y2, x3, y3, x4, y4] = head as [number, number, number, number, number, number, number, number]
      return [
        generator.polygon([[x, y], [x2, y2], [x3, y3], [x4, y4], [x, y]], { ...solid, fill, fillStyle: 'solid' }),
      ]
    }
    case 'bar':
    case 'arrow': {
      const [x2, y2, x3, y3, x4, y4] = head as [number, number, number, number, number, number]
      const lineOptions: Options = { ...solid, fill: undefined }
      return [generator.line(x3, y3, x2, y2, lineOptions), generator.line(x4, y4, x2, y2, lineOptions)]
    }
  }
}
