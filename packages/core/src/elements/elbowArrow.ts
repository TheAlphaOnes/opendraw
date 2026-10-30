/**
 * Elbow arrows — a port of Excalidraw's element/src/elbowArrow.ts and
 * heading.ts (routing without user-fixed segments).
 *
 * An elbow arrow runs in horizontal and vertical legs only. Each tip has a
 * heading — the side of its shape it leaves through, or toward the other
 * tip when loose. The shapes are padded into "dongle" boxes that always
 * touch, a sparse grid is built from their edges, and A* walks it with a
 * heavy penalty for every bend and no reversing, so the route is the
 * fewest-bend path around both shapes. Bound tips sit on their shape's
 * outline (plus the binding gap) at their fixed point, so moving or
 * resizing a shape re-routes the arrow from the same spot.
 */

import { getElementBounds } from '../geometry/bounds.js'
import type { OpenDrawElement, OpenDrawLinearElement, Point } from '../types.js'
import type { ElementPatch } from './mutate.js'
import {
  BASE_BINDING_GAP,
  bindingGap,
  focusPointOf,
  isBindableShape,
  maxBindingDistance,
  outlineIntersections,
  snappedMidpoint,
  type OpenDrawBindableShape,
} from './binding.js'

// ---------------------------------------------------------------------------
// Headings (heading.ts)
// ---------------------------------------------------------------------------

export type Heading = readonly [1, 0] | readonly [0, 1] | readonly [-1, 0] | readonly [0, -1]

export const HEADING_RIGHT: Heading = [1, 0]
export const HEADING_DOWN: Heading = [0, 1]
export const HEADING_LEFT: Heading = [-1, 0]
export const HEADING_UP: Heading = [0, -1]

const sameHeading = (a: Heading, b: Heading): boolean => a[0] === b[0] && a[1] === b[1]
const isHorizontal = (h: Heading): boolean => sameHeading(h, HEADING_RIGHT) || sameHeading(h, HEADING_LEFT)
const flipHeading = (h: Heading): Heading => [-h[0] || 0, -h[1] || 0] as unknown as Heading

/** The dominant axis direction of a vector (vectorToHeading). */
export function vectorToHeading(x: number, y: number): Heading {
  const absX = Math.abs(x)
  const absY = Math.abs(y)
  if (x > absY) {
    return HEADING_RIGHT
  }
  if (x <= -absY) {
    return HEADING_LEFT
  }
  if (y > absX) {
    return HEADING_DOWN
  }
  return HEADING_UP
}

/** [x1, y1, x2, y2] — the tuple form the router's math is written in. */
type Box = [number, number, number, number]

function boxOf(element: OpenDrawElement, offset?: [number, number, number, number]): Box {
  const b = getElementBounds(element)
  if (!offset) {
    return [b.x1, b.y1, b.x2, b.y2]
  }
  const [top, right, down, left] = offset
  return [b.x1 - left, b.y1 - top, b.x2 + right, b.y2 + down]
}

const boxCenter = (b: Box): Point => ({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 })

function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const cross = (o: Point, u: Point, v: Point) => (u.x - o.x) * (v.y - o.y) - (u.y - o.y) * (v.x - o.x)
  const d1 = cross(p, a, b)
  const d2 = cross(p, b, c)
  const d3 = cross(p, c, a)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

/**
 * Which side of a shape a point is on (headingForPointFromElement): four
 * search cones from the center through the doubled box's corners.
 */
export function headingForPointFromElement(shape: OpenDrawBindableShape, box: Box, p: Point): Heading {
  const mid = boxCenter(box)
  if (shape.type === 'diamond') {
    return headingForPointFromDiamond(shape, mid, p)
  }
  const scale = (x: number, y: number): Point => ({ x: mid.x + (x - mid.x) * 2, y: mid.y + (y - mid.y) * 2 })
  const tl = scale(box[0], box[1])
  const tr = scale(box[2], box[1])
  const bl = scale(box[0], box[3])
  const br = scale(box[2], box[3])
  return inTriangle(p, tl, tr, mid)
    ? HEADING_UP
    : inTriangle(p, tr, br, mid)
      ? HEADING_RIGHT
      : inTriangle(p, br, bl, mid)
        ? HEADING_DOWN
        : HEADING_LEFT
}

/** A diamond's sides face diagonally: pick the vertex direction nearest the point. */
function headingForPointFromDiamond(shape: OpenDrawBindableShape, mid: Point, p: Point): Heading {
  const dx = (p.x - mid.x) / Math.max(shape.width, 1)
  const dy = (p.y - mid.y) / Math.max(shape.height, 1)
  if (Math.abs(dx) === Math.abs(dy)) {
    return shape.width > shape.height ? (dy < 0 ? HEADING_UP : HEADING_DOWN) : dx < 0 ? HEADING_LEFT : HEADING_RIGHT
  }
  return vectorToHeading(dx, dy)
}

// ---------------------------------------------------------------------------
// Snapping a tip to a shape (bindPointToSnapToElementOutline, elbow branch)
// ---------------------------------------------------------------------------

/**
 * Where an elbow tip dropped near `shape` lands: on the outline (one
 * binding gap out), straight across from the shape's center axis on the
 * side the pointer is on — or at a side midpoint when the pointer is near
 * one — so the arrow always meets the shape square.
 */
export function elbowSnapPoint(shape: OpenDrawBindableShape, pointer: Point, zoom: number): Point {
  const box = boxOf(shape)
  const center = boxCenter(box)
  const snap = snappedMidpoint(shape, pointer, zoom)
  const resolved = snap ?? pointer
  const horizontal = isHorizontal(
    snap ? vectorToHeading(snap.x - center.x, snap.y - center.y) : headingForPointFromElement(shape, box, pointer),
  )
  const reach = Math.max(shape.width, shape.height) * 2
  const cast = (from: Point): Point | null => {
    const len = Math.hypot(resolved.x - from.x, resolved.y - from.y) || 1
    const to = { x: from.x + ((resolved.x - from.x) / len) * reach, y: from.y + ((resolved.y - from.y) / len) * reach }
    const hits = outlineIntersections(shape, from, to, bindingGap(shape))
    hits.sort((a, b) => Math.hypot(a.x - resolved.x, a.y - resolved.y) - Math.hypot(b.x - resolved.x, b.y - resolved.y))
    return hits[0] ?? null
  }
  return (
    cast(horizontal ? { x: center.x, y: resolved.y } : { x: resolved.x, y: center.y }) ??
    cast(horizontal ? { x: resolved.x, y: center.y } : { x: center.x, y: resolved.y }) ??
    resolved
  )
}

// ---------------------------------------------------------------------------
// The router (getElbowArrowData + routeElbowArrow)
// ---------------------------------------------------------------------------

export const BASE_PADDING = 40
/**
 * Interior legs shorter than this are folded away (see collapseJogs): at
 * the 16px corner radius a jog that short draws as a hooked kink.
 */
const JOG_LENGTH = 8
/** A U-turn narrower than two corner radii overlaps itself; it is widened to this. */
const U_TURN_WIDTH = 32

interface GridNode {
  f: number
  g: number
  h: number
  closed: boolean
  visited: boolean
  parent: GridNode | null
  pos: Point
  addr: [number, number]
}

interface Grid {
  rows: number
  cols: number
  data: GridNode[]
}

function offsetFromHeading(heading: Heading, head: number, side: number): [number, number, number, number] {
  if (sameHeading(heading, HEADING_UP)) {
    return [head, side, side, side]
  }
  if (sameHeading(heading, HEADING_RIGHT)) {
    return [side, head, side, side]
  }
  if (sameHeading(heading, HEADING_DOWN)) {
    return [side, side, head, side]
  }
  return [side, side, side, head]
}

const commonBox = (boxes: Box[]): Box => [
  Math.min(...boxes.map((b) => b[0])),
  Math.min(...boxes.map((b) => b[1])),
  Math.max(...boxes.map((b) => b[2])),
  Math.max(...boxes.map((b) => b[3])),
]

const insideBox = (p: Point, b: Box): boolean => p.x > b[0] && p.x < b[2] && p.y > b[1] && p.y < b[3]

/** The heading a tip leaves in: its shape's side, else toward the other tip. */
function tipHeading(p: Point, other: Point, shape: OpenDrawBindableShape | null, pointer: Point, zoom: number): Heading {
  if (!shape) {
    return vectorToHeading(other.x - p.x, other.y - p.y)
  }
  const near = Math.hypot(pointer.x - p.x, pointer.y - p.y) <= maxBindingDistance(zoom) + bindingGap(shape)
  if (!near) {
    const c = boxCenter(boxOf(shape))
    return vectorToHeading(p.x - c.x, p.y - c.y)
  }
  const gap = bindingGap(shape) * 2
  return headingForPointFromElement(shape, boxOf(shape, [gap, gap, gap, gap]), p)
}

/**
 * Padded boxes around both ends that always touch each other
 * (generateDynamicAABBs): each grows to meet the other halfway.
 */
function dynamicBoxes(
  a: Box,
  b: Box,
  common: Box,
  startDiff: [number, number, number, number],
  endDiff: [number, number, number, number],
  disableSideHack: boolean,
  startEl: Box,
  endEl: Box,
): [Box, Box] {
  const [startUp, startRight, startDown, startLeft] = startDiff
  const [endUp, endRight, endDown, endLeft] = endDiff
  const first: Box = [
    a[0] > b[2]
      ? a[1] > b[3] || a[3] < b[1]
        ? Math.min((startEl[0] + endEl[2]) / 2, a[0] - startLeft)
        : (startEl[0] + endEl[2]) / 2
      : a[0] > b[0]
        ? a[0] - startLeft
        : common[0] - startLeft,
    a[1] > b[3]
      ? a[0] > b[2] || a[2] < b[0]
        ? Math.min((startEl[1] + endEl[3]) / 2, a[1] - startUp)
        : (startEl[1] + endEl[3]) / 2
      : a[1] > b[1]
        ? a[1] - startUp
        : common[1] - startUp,
    a[2] < b[0]
      ? a[1] > b[3] || a[3] < b[1]
        ? Math.max((startEl[2] + endEl[0]) / 2, a[2] + startRight)
        : (startEl[2] + endEl[0]) / 2
      : a[2] < b[2]
        ? a[2] + startRight
        : common[2] + startRight,
    a[3] < b[1]
      ? a[0] > b[2] || a[2] < b[0]
        ? Math.max((startEl[3] + endEl[1]) / 2, a[3] + startDown)
        : (startEl[3] + endEl[1]) / 2
      : a[3] < b[3]
        ? a[3] + startDown
        : common[3] + startDown,
  ]
  const second: Box = [
    b[0] > a[2]
      ? b[1] > a[3] || b[3] < a[1]
        ? Math.min((endEl[0] + startEl[2]) / 2, b[0] - endLeft)
        : (endEl[0] + startEl[2]) / 2
      : b[0] > a[0]
        ? b[0] - endLeft
        : common[0] - endLeft,
    b[1] > a[3]
      ? b[0] > a[2] || b[2] < a[0]
        ? Math.min((endEl[1] + startEl[3]) / 2, b[1] - endUp)
        : (endEl[1] + startEl[3]) / 2
      : b[1] > a[1]
        ? b[1] - endUp
        : common[1] - endUp,
    b[2] < a[0]
      ? b[1] > a[3] || b[3] < a[1]
        ? Math.max((endEl[2] + startEl[0]) / 2, b[2] + endRight)
        : (endEl[2] + startEl[0]) / 2
      : b[2] < a[2]
        ? b[2] + endRight
        : common[2] + endRight,
    b[3] < a[1]
      ? b[0] > a[2] || b[2] < a[0]
        ? Math.max((endEl[3] + startEl[1]) / 2, b[3] + endDown)
        : (endEl[3] + startEl[1]) / 2
      : b[3] < a[3]
        ? b[3] + endDown
        : common[3] + endDown,
  ]

  // Diagonally placed boxes that overlap in both extents split along the gap.
  const c = commonBox([first, second])
  if (
    !disableSideHack &&
    first[2] - first[0] + second[2] - second[0] > c[2] - c[0] + 1e-11 &&
    first[3] - first[1] + second[3] - second[1] > c[3] - c[1] + 1e-11
  ) {
    const endCenter = { x: (second[0] + second[2]) / 2, y: (second[1] + second[3]) / 2 }
    const cross = (ux: number, uy: number, vx: number, vy: number) => ux * vy - uy * vx
    if (b[0] > a[2] && a[1] > b[3]) {
      const cX = first[2] + (second[0] - first[2]) / 2
      const cY = second[3] + (first[1] - second[3]) / 2
      return cross(a[2] - endCenter.x, a[1] - endCenter.y, a[0] - endCenter.x, a[3] - endCenter.y) > 0
        ? [[first[0], first[1], cX, first[3]], [cX, second[1], second[2], second[3]]]
        : [[first[0], cY, first[2], first[3]], [second[0], second[1], second[2], cY]]
    }
    if (a[2] < b[0] && a[3] < b[1]) {
      const cX = first[2] + (second[0] - first[2]) / 2
      const cY = first[3] + (second[1] - first[3]) / 2
      return cross(a[0] - endCenter.x, a[1] - endCenter.y, a[2] - endCenter.x, a[3] - endCenter.y) > 0
        ? [[first[0], first[1], first[2], cY], [second[0], cY, second[2], second[3]]]
        : [[first[0], first[1], cX, first[3]], [cX, second[1], second[2], second[3]]]
    }
    if (a[0] > b[2] && a[3] < b[1]) {
      const cX = second[2] + (first[0] - second[2]) / 2
      const cY = first[3] + (second[1] - first[3]) / 2
      return cross(a[2] - endCenter.x, a[1] - endCenter.y, a[0] - endCenter.x, a[3] - endCenter.y) > 0
        ? [[cX, first[1], first[2], first[3]], [second[0], second[1], cX, second[3]]]
        : [[first[0], first[1], first[2], cY], [second[0], cY, second[2], second[3]]]
    }
    if (a[0] > b[2] && a[1] > b[3]) {
      const cX = second[2] + (first[0] - second[2]) / 2
      const cY = second[3] + (first[1] - second[3]) / 2
      return cross(a[0] - endCenter.x, a[1] - endCenter.y, a[2] - endCenter.x, a[3] - endCenter.y) > 0
        ? [[cX, first[1], first[2], first[3]], [second[0], second[1], cX, second[3]]]
        : [[first[0], cY, first[2], first[3]], [second[0], second[1], second[2], cY]]
    }
  }
  return [first, second]
}

/** The non-uniform grid at the boxes' edges and the tips' lines (calculateGrid). */
function buildGrid(boxes: Box[], start: Point, startHeading: Heading, end: Point, endHeading: Heading, common: Box): Grid {
  const xs = new Set<number>()
  const ys = new Set<number>()
  if (isHorizontal(startHeading)) {
    ys.add(start.y)
  } else {
    xs.add(start.x)
  }
  if (isHorizontal(endHeading)) {
    ys.add(end.y)
  } else {
    xs.add(end.x)
  }
  for (const b of boxes) {
    xs.add(b[0])
    xs.add(b[2])
    ys.add(b[1])
    ys.add(b[3])
  }
  xs.add(common[0])
  xs.add(common[2])
  ys.add(common[1])
  ys.add(common[3])
  const cols = [...xs].sort((a, b) => a - b)
  const rows = [...ys].sort((a, b) => a - b)
  return {
    rows: rows.length,
    cols: cols.length,
    data: rows.flatMap((y, row) =>
      cols.map((x, col): GridNode => ({ f: 0, g: 0, h: 0, closed: false, visited: false, parent: null, pos: { x, y }, addr: [col, row] })),
    ),
  }
}

const nodeAt = (grid: Grid, col: number, row: number): GridNode | null =>
  col < 0 || col >= grid.cols || row < 0 || row >= grid.rows ? null : (grid.data[row * grid.cols + col] ?? null)

const nodeFor = (grid: Grid, p: Point): GridNode | null => grid.data.find((n) => n.pos.x === p.x && n.pos.y === p.y) ?? null

function donglePosition(box: Box, heading: Heading, p: Point): Point {
  if (sameHeading(heading, HEADING_UP)) {
    return { x: p.x, y: box[1] }
  }
  if (sameHeading(heading, HEADING_RIGHT)) {
    return { x: box[2], y: p.y }
  }
  if (sameHeading(heading, HEADING_DOWN)) {
    return { x: p.x, y: box[3] }
  }
  return { x: box[0], y: p.y }
}

const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

/** A lower bound on the bends still needed (estimateSegmentCount). */
function estimateSegmentCount(start: GridNode, end: GridNode, startHeading: Heading, endHeading: Heading): number {
  const s = start.pos
  const e = end.pos
  const is = (a: Heading, b: Heading) => sameHeading(a, b)
  if (is(endHeading, HEADING_RIGHT)) {
    if (is(startHeading, HEADING_RIGHT)) return s.x >= e.x ? 4 : s.y === e.y ? 0 : 2
    if (is(startHeading, HEADING_UP)) return s.y > e.y && s.x < e.x ? 1 : 3
    if (is(startHeading, HEADING_DOWN)) return s.y < e.y && s.x < e.x ? 1 : 3
    return s.y === e.y ? 4 : 2
  }
  if (is(endHeading, HEADING_LEFT)) {
    if (is(startHeading, HEADING_RIGHT)) return s.y === e.y ? 4 : 2
    if (is(startHeading, HEADING_UP)) return s.y > e.y && s.x > e.x ? 1 : 3
    if (is(startHeading, HEADING_DOWN)) return s.y < e.y && s.x > e.x ? 1 : 3
    return s.x <= e.x ? 4 : s.y === e.y ? 0 : 2
  }
  if (is(endHeading, HEADING_UP)) {
    if (is(startHeading, HEADING_RIGHT)) return s.y > e.y && s.x < e.x ? 1 : 3
    if (is(startHeading, HEADING_UP)) return s.y >= e.y ? 4 : s.x === e.x ? 0 : 2
    if (is(startHeading, HEADING_DOWN)) return s.x === e.x ? 4 : 2
    return s.y > e.y && s.x > e.x ? 1 : 3
  }
  if (is(startHeading, HEADING_RIGHT)) return s.y < e.y && s.x < e.x ? 1 : 3
  if (is(startHeading, HEADING_UP)) return s.x === e.x ? 4 : 2
  if (is(startHeading, HEADING_DOWN)) return s.y <= e.y ? 4 : s.x === e.x ? 0 : 2
  return s.y < e.y && s.x > e.x ? 1 : 3
}

const NEIGHBOR_HEADINGS: readonly Heading[] = [HEADING_UP, HEADING_RIGHT, HEADING_DOWN, HEADING_LEFT]

/**
 * A* over the grid (astar): bends cost the cube of the tips' distance,
 * the heuristic adds the estimated bends squared, and a leg may never turn
 * back on itself or leave/enter a tip against its heading.
 */
function astar(start: GridNode, end: GridNode, grid: Grid, startHeading: Heading, endHeading: Heading, boxes: Box[]): GridNode[] | null {
  const bend = manhattan(start.pos, end.pos)
  const open: GridNode[] = [start]
  while (open.length > 0) {
    let best = 0
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[best]!.f) {
        best = i
      }
    }
    const current = open.splice(best, 1)[0]!
    if (current.closed) {
      continue
    }
    if (current === end) {
      const path: GridNode[] = []
      let node: GridNode | null = current
      while (node && node !== start) {
        path.unshift(node)
        node = node.parent
      }
      path.unshift(start)
      return path
    }
    current.closed = true
    const [col, row] = current.addr
    const neighbors = [nodeAt(grid, col, row - 1), nodeAt(grid, col + 1, row), nodeAt(grid, col, row + 1), nodeAt(grid, col - 1, row)]
    for (let i = 0; i < 4; i++) {
      const neighbor = neighbors[i]
      if (!neighbor || neighbor.closed) {
        continue
      }
      const half = { x: (neighbor.pos.x + current.pos.x) / 2, y: (neighbor.pos.y + current.pos.y) / 2 }
      if (boxes.some((b) => insideBox(half, b))) {
        continue
      }
      const heading = NEIGHBOR_HEADINGS[i]!
      const previous = current.parent
        ? vectorToHeading(current.pos.x - current.parent.pos.x, current.pos.y - current.parent.pos.y)
        : startHeading
      const reverse =
        sameHeading(flipHeading(previous), heading) ||
        (neighbor === start && sameHeading(heading, startHeading)) ||
        (neighbor === end && sameHeading(heading, endHeading))
      if (reverse) {
        continue
      }
      const g = current.g + manhattan(neighbor.pos, current.pos) + (sameHeading(previous, heading) ? 0 : Math.pow(bend, 3))
      if (!neighbor.visited || g < neighbor.g) {
        const bends = estimateSegmentCount(neighbor, end, heading, endHeading)
        neighbor.parent = current
        neighbor.g = g
        neighbor.h = manhattan(end.pos, neighbor.pos) + bends * Math.pow(bend, 2)
        neighbor.f = neighbor.g + neighbor.h
        if (!neighbor.visited) {
          neighbor.visited = true
          open.push(neighbor)
        }
      }
    }
  }
  return null
}

/** Keeps the tips and the points where the route turns (getElbowArrowCornerPoints). */
function cornerPoints(points: Point[]): Point[] {
  if (points.length <= 1) {
    return points
  }
  let previousHorizontal = Math.abs(points[0]!.y - points[1]!.y) < Math.abs(points[0]!.x - points[1]!.x)
  return points.filter((p, i) => {
    if (i === 0 || i === points.length - 1) {
      return true
    }
    const next = points[i + 1]!
    const nextHorizontal = Math.abs(p.y - next.y) < Math.abs(p.x - next.x)
    const keep = previousHorizontal !== nextHorizontal
    previousHorizontal = nextHorizontal
    return keep
  })
}

const legLength = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

/** Drops zero-length legs (a tip that lands exactly on its dongle). */
function withoutRepeats(points: Point[]): Point[] {
  return points.filter((p, i) => i === 0 || legLength(p, points[i - 1]!) > 0)
}

/**
 * Cleans short interior jogs out of an orthogonal route. Two grid lines a
 * few px apart (box edges, the tips' own lines) make the search route a
 * tiny step between them, drawn as a hooked kink or as two strokes on top
 * of each other. Excalidraw's removeElbowArrowShortSegments deletes the
 * step's point, which leaves a leg slightly off axis; here a neighbouring
 * leg moves instead, so every leg stays axis-aligned and the tips never
 * move:
 * - a Z-step folds flat: the leg before it slides onto the line after it
 *   (or the leg after onto the line before);
 * - a U-turn retraces its own line: the overlap is trimmed (the jog moves
 *   to where the shorter arm ends, and that arm disappears); when the
 *   shorter arm is a tip's, the other leg slides outward until the U fits
 *   both corners instead.
 * A step between two tip legs is a real offset between the tips and stays.
 */
function collapseJogs(route: Point[]): Point[] {
  let points = cornerPoints(withoutRepeats(route))
  // Every fold removes points and a widening never makes a new short leg,
  // so this ends on its own; the cap only guards against float drift.
  for (let pass = 0, i = 1; i + 2 < points.length && pass < route.length * 4; i++) {
    const [before, from, to, after] = [points[i - 1]!, points[i]!, points[i + 1]!, points[i + 2]!]
    const length = legLength(from, to)
    if (length >= JOG_LENGTH) {
      continue
    }
    // The legs on either side run the same way (a Z-step) or opposite ways (a U-turn).
    const zStep =
      Math.sign(from.x - before.x) === Math.sign(after.x - to.x) && Math.sign(from.y - before.y) === Math.sign(after.y - to.y)
    const unit = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) }
    // Z: close the step entirely. U: trim the retraced overlap, else open
    // the U to the full width, pushing the movable leg away from the other.
    const next = zStep
      ? (slideLead(points, i, unit, length) ?? slideTrail(points, i, unit, -length))
      : (trimUTurn(points, i) ??
        slideLead(points, i, unit, -(U_TURN_WIDTH - length)) ??
        slideTrail(points, i, unit, U_TURN_WIDTH - length))
    if (next) {
      points = cornerPoints(withoutRepeats(next))
      pass++
      i = 0
    }
  }
  return points
}

/**
 * Cuts the overlap out of a U-turn at jog i: the arms before and after it
 * run back over each other, so the jog moves to where the shorter arm
 * ends and that arm disappears. Null when the shorter arm is a tip's, or
 * when what is left of the longer arm would be a new jog.
 */
function trimUTurn(points: Point[], i: number): Point[] | null {
  const [before, from, to, after] = [points[i - 1]!, points[i]!, points[i + 1]!, points[i + 2]!]
  const lead = legLength(before, from)
  const trail = legLength(to, after)
  const way = { x: Math.sign(from.x - before.x), y: Math.sign(from.y - before.y) }
  const next = [...points]
  if (trail <= lead && i + 2 < points.length - 1) {
    // The trail arm is the shorter: the lead arm stops where it ends.
    const stop = { x: from.x - way.x * trail, y: from.y - way.y * trail }
    if (!keepsCourse(before, from, stop)) {
      return null
    }
    next[i] = stop
    next[i + 1] = { ...after }
    return next
  }
  if (lead < trail && i - 1 > 0) {
    // The lead arm is the shorter: the trail arm starts where it began.
    const start = { x: to.x - way.x * lead, y: to.y - way.y * lead }
    if (!keepsCourse(after, to, start)) {
      return null
    }
    next[i] = { ...before }
    next[i + 1] = start
    return next
  }
  return null
}

/**
 * Moves leg i-1 (the one before jog i) by `by` along the jog's axis, or
 * returns null when that leg is the start tip's, or when the leg behind it
 * (which the move stretches or shrinks) would reverse or turn into a new
 * jog — a fold must never create the kink it removes.
 */
function slideLead(points: Point[], i: number, unit: Point, by: number): Point[] | null {
  if (i - 1 === 0) {
    return null
  }
  const moved = (p: Point): Point => ({ x: p.x + unit.x * by, y: p.y + unit.y * by })
  const anchor = points[i - 2]!
  if (!keepsCourse(anchor, points[i - 1]!, moved(points[i - 1]!))) {
    return null
  }
  const next = [...points]
  next[i - 1] = moved(points[i - 1]!)
  next[i] = moved(points[i]!)
  return next
}

/** slideLead's mirror: moves leg i+1 (after jog i), never the end tip's. */
function slideTrail(points: Point[], i: number, unit: Point, by: number): Point[] | null {
  if (i + 2 === points.length - 1) {
    return null
  }
  const moved = (p: Point): Point => ({ x: p.x + unit.x * by, y: p.y + unit.y * by })
  const anchor = points[i + 3]!
  if (!keepsCourse(anchor, points[i + 2]!, moved(points[i + 2]!))) {
    return null
  }
  const next = [...points]
  next[i + 1] = moved(points[i + 1]!)
  next[i + 2] = moved(points[i + 2]!)
  return next
}

/**
 * Whether the leg from `anchor` still runs the same way once its far end
 * moves from `was` to `now`, and is either gone (a fold merges it) or no
 * shorter than a jog.
 */
function keepsCourse(anchor: Point, was: Point, now: Point): boolean {
  const length = legLength(anchor, now)
  if (length === 0) {
    return true
  }
  const sameWay = Math.sign(now.x - anchor.x) === Math.sign(was.x - anchor.x) && Math.sign(now.y - anchor.y) === Math.sign(was.y - anchor.y)
  return sameWay && length >= JOG_LENGTH
}

export interface ElbowEnds {
  start: Point
  end: Point
  startShape: OpenDrawBindableShape | null
  endShape: OpenDrawBindableShape | null
  /** Where the pointer actually is (headings use it while dragging). */
  startPointer?: Point
  endPointer?: Point
}

/** The orthogonal route between two tips, in scene points (routeElbowArrow). */
export function routeElbow(
  arrow: Pick<OpenDrawLinearElement, 'startArrowhead' | 'endArrowhead'> & { startBound: boolean },
  ends: ElbowEnds,
  zoom = 1,
): Point[] {
  const { start, end, startShape, endShape } = ends
  const startHeading = tipHeading(start, end, startShape, ends.startPointer ?? start, zoom)
  const endHeading = tipHeading(end, start, endShape, ends.endPointer ?? end, zoom)
  const pointBox = (p: Point): Box => [p.x - 2, p.y - 2, p.x + 2, p.y + 2]
  const startPointBox = pointBox(start)
  const endPointBox = pointBox(end)
  const gapFor = (shape: OpenDrawBindableShape, head: boolean) => (head ? bindingGap(shape) * 6 : bindingGap(shape) * 2)
  const startElementBox = startShape
    ? boxOf(startShape, offsetFromHeading(startHeading, gapFor(startShape, arrow.startArrowhead !== null), 1))
    : startPointBox
  const endElementBox = endShape
    ? boxOf(endShape, offsetFromHeading(endHeading, gapFor(endShape, arrow.endArrowhead !== null), 1))
    : endPointBox
  const boundsOverlap =
    insideBox(start, endShape ? boxOf(endShape, offsetFromHeading(endHeading, BASE_PADDING, BASE_PADDING)) : endPointBox) ||
    insideBox(end, startShape ? boxOf(startShape, offsetFromHeading(startHeading, BASE_PADDING, BASE_PADDING)) : startPointBox)
  const common = commonBox(boundsOverlap ? [startPointBox, endPointBox] : [startElementBox, endElementBox])
  const anyShape = !!startShape || !!endShape
  const headGap = (head: boolean) => BASE_PADDING - (head ? BASE_BINDING_GAP * 6 : BASE_BINDING_GAP * 2)
  const boxes = dynamicBoxes(
    boundsOverlap ? startPointBox : startElementBox,
    boundsOverlap ? endPointBox : endElementBox,
    common,
    boundsOverlap
      ? offsetFromHeading(startHeading, anyShape ? BASE_PADDING : 0, 0)
      : offsetFromHeading(startHeading, anyShape ? headGap(arrow.startArrowhead !== null) : 0, BASE_PADDING),
    boundsOverlap
      ? offsetFromHeading(endHeading, anyShape ? BASE_PADDING : 0, 0)
      : offsetFromHeading(endHeading, anyShape ? headGap(arrow.endArrowhead !== null) : 0, BASE_PADDING),
    boundsOverlap,
    startShape ? boxOf(startShape) : startPointBox,
    endShape ? boxOf(endShape) : endPointBox,
  )
  const startDongle = donglePosition(boxes[0], startHeading, start)
  const endDongle = donglePosition(boxes[1], endHeading, end)
  const grid = buildGrid(boxes, startDongle, startHeading, endDongle, endHeading, common)
  const startNode = nodeFor(grid, startDongle)
  const endNode = nodeFor(grid, endDongle)
  if (!startNode || !endNode) {
    return [start, end]
  }
  const dongleOverlap = insideBox(startNode.pos, boxes[1]) || insideBox(endNode.pos, boxes[0])
  const path = astar(startNode, endNode, grid, startHeading, endHeading, dongleOverlap ? [] : boxes)
  if (!path) {
    return [start, end]
  }
  return collapseJogs([start, ...path.map((n) => n.pos), end])
}

// ---------------------------------------------------------------------------
// Applying a route to an arrow
// ---------------------------------------------------------------------------

function boundShapeOf(id: string | undefined, byId: ReadonlyMap<string, OpenDrawElement>): OpenDrawBindableShape | null {
  const target = id ? byId.get(id) : undefined
  return target && isBindableShape(target) ? target : null
}

/**
 * The patch that re-routes an elbow arrow: bound tips sit at their fixed
 * points (on the outline), loose tips stay where they are; the arrow is
 * renormalized so its first point is its origin (normalizeArrowElementUpdate).
 */
export function elbowRoutePatch(
  arrow: OpenDrawLinearElement,
  elements: readonly OpenDrawElement[] | ReadonlyMap<string, OpenDrawElement>,
  options: { zoom?: number; startPointer?: Point; endPointer?: Point } = {},
): ElementPatch<OpenDrawLinearElement> {
  const byId = elements instanceof Map ? elements : new Map((elements as readonly OpenDrawElement[]).map((el) => [el.id, el]))
  const first = arrow.points[0]!
  const last = arrow.points[arrow.points.length - 1]!
  const startShape = boundShapeOf(arrow.startBinding?.elementId, byId)
  const endShape = boundShapeOf(arrow.endBinding?.elementId, byId)
  const start = startShape && arrow.startBinding ? focusPointOf(startShape, arrow.startBinding) : { x: arrow.x + first.x, y: arrow.y + first.y }
  const end = endShape && arrow.endBinding ? focusPointOf(endShape, arrow.endBinding) : { x: arrow.x + last.x, y: arrow.y + last.y }
  const route = routeElbow(
    { startArrowhead: arrow.startArrowhead, endArrowhead: arrow.endArrowhead, startBound: !!startShape },
    {
      start,
      end,
      startShape,
      endShape,
      ...(options.startPointer ? { startPointer: options.startPointer } : {}),
      ...(options.endPointer ? { endPointer: options.endPointer } : {}),
    },
    options.zoom ?? 1,
  )
  const origin = route[0]!
  const points = route.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y }))
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    x: origin.x,
    y: origin.y,
    angle: 0,
    points,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

/**
 * The rendered path (generateElbowArrowShape): straight legs joined by
 * quadratic corners of up to `radius`, never more than half a leg.
 */
export function elbowArrowPath(points: readonly Point[], radius = 16): string {
  if (points.length < 2) {
    return ''
  }
  const parts = [`M ${points[0]!.x} ${points[0]!.y}`]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!
    const point = points[i]!
    const next = points[i + 1]!
    const corner = Math.min(radius, Math.hypot(next.x - point.x, next.y - point.y) / 2, Math.hypot(prev.x - point.x, prev.y - point.y) / 2)
    const inX = Math.sign(point.x - prev.x)
    const inY = Math.sign(point.y - prev.y)
    const outX = Math.sign(next.x - point.x)
    const outY = Math.sign(next.y - point.y)
    parts.push(`L ${point.x - inX * corner} ${point.y - inY * corner}`)
    parts.push(`Q ${point.x} ${point.y} ${point.x + outX * corner} ${point.y + outY * corner}`)
  }
  const last = points[points.length - 1]!
  parts.push(`L ${last.x} ${last.y}`)
  return parts.join(' ')
}
