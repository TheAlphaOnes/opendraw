/**
 * The laser stroke's outline — a port of Excalidraw's
 * `@excalidraw/laser-pointer` (state.ts + math.ts). A stroke is one filled
 * polygon whose half-width at each point comes from `sizeMapping`, so the
 * trail tapers and decays as a single shape instead of overlapping
 * per-segment strokes. Excalidraw's laser runs with `simplify: 0`, so the
 * Douglas–Peucker pass is not ported.
 */

/** [x, y, pressure] — the laser stores the point's timestamp as pressure. */
export type OutlinePoint = [x: number, y: number, r: number]

export interface SizeMappingDetails {
  pressure: number
  runningLength: number
  currentIndex: number
  totalLength: number
}

export interface LaserStrokeOptions {
  /** Half-width of the stroke before `sizeMapping` scales it. */
  size: number
  /** 0..1 — how far each new point lags toward the previous one. */
  streamline: number
  keepHead: boolean
  sizeMapping: (details: SizeMappingDetails) => number
}

const CORNER_DETECTION_MAX_ANGLE = 75
const cornerDetectionVariance = (speed: number): number => (speed > 35 ? 0.5 : 1)
const MAX_TAIL_LENGTH = 50

const add = ([ax, ay, ar]: OutlinePoint, [bx, by, br]: OutlinePoint): OutlinePoint => [ax + bx, ay + by, ar + br]
const sub = ([ax, ay, ar]: OutlinePoint, [bx, by, br]: OutlinePoint): OutlinePoint => [ax - bx, ay - by, ar - br]
const smul = ([x, y, r]: OutlinePoint, s: number): OutlinePoint => [x * s, y * s, r * s]
const mag = ([x, y]: OutlinePoint): number => Math.sqrt(x ** 2 + y ** 2)
const norm = (p: OutlinePoint): OutlinePoint => [p[0] / mag(p), p[1] / mag(p), p[2]]
const dist = ([ax, ay]: OutlinePoint, [bx, by]: OutlinePoint): number => Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
const rot = ([x, y, r]: OutlinePoint, rad: number): OutlinePoint => [
  Math.cos(rad) * x - Math.sin(rad) * y,
  Math.sin(rad) * x + Math.cos(rad) * y,
  r,
]
const plerp = (a: OutlinePoint, b: OutlinePoint, t: number): OutlinePoint => add(a, smul(sub(b, a), t))
const angle = (p: OutlinePoint, p1: OutlinePoint, p2: OutlinePoint): number =>
  Math.atan2(p2[1] - p[1], p2[0] - p[0]) - Math.atan2(p1[1] - p[1], p1[0] - p[0])
const normAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a))
const UNIT_X: OutlinePoint = [1, 0, 0]

function runLength(ps: OutlinePoint[]): number {
  if (ps.length < 2) {
    return 0
  }
  let len = 0
  for (let i = 1; i <= ps.length - 1; i++) {
    len += dist(ps[i - 1]!, ps[i]!)
  }
  // Excalidraw counts the last segment twice; kept for identical tail timing.
  len += dist(ps[ps.length - 2]!, ps[ps.length - 1]!)
  return len
}

function circleAround(c: OutlinePoint, size: number): OutlinePoint[] {
  const ps: OutlinePoint[] = []
  for (let theta = 0; theta <= Math.PI * 2; theta += Math.PI / 16) {
    ps.push(add(c, smul(rot(UNIT_X, theta), size)))
  }
  ps.push(add(c, smul(UNIT_X, size)))
  return ps
}

/** One laser stroke: points stream in, the outline is read every frame. */
export class LaserStroke {
  readonly options: LaserStrokeOptions
  readonly originalPoints: OutlinePoint[] = []
  private stablePoints: OutlinePoint[] = []
  private tailPoints: OutlinePoint[] = []
  private isFresh = true

  constructor(options: LaserStrokeOptions) {
    this.options = { ...options }
  }

  private get lastPoint(): OutlinePoint {
    return (this.tailPoints[this.tailPoints.length - 1] ?? this.stablePoints[this.stablePoints.length - 1])!
  }

  addPoint(point: OutlinePoint): void {
    const last = this.originalPoints[this.originalPoints.length - 1]
    if (last && last[0] === point[0] && last[1] === point[1]) {
      return
    }
    this.originalPoints.push(point)
    if (this.isFresh) {
      this.isFresh = false
      this.stablePoints.push(point)
      return
    }
    if (this.options.streamline > 0) {
      point = plerp(this.lastPoint, point, 1 - this.options.streamline)
    }
    this.tailPoints.push(point)
    if (runLength(this.tailPoints) > MAX_TAIL_LENGTH) {
      this.stabilizeTail()
    }
  }

  close(): void {
    this.stabilizeTail()
  }

  private stabilizeTail(): void {
    this.stablePoints.push(...this.tailPoints)
    this.tailPoints = []
  }

  private sizeAt(size: number, pressure: number, index: number, totalLength: number, runningLength: number): number {
    return size * this.options.sizeMapping({ pressure, runningLength, currentIndex: index, totalLength })
  }

  /** The closed outline polygon; empty once the whole stroke has decayed. */
  getStrokeOutline(sizeOverride?: number): OutlinePoint[] {
    if (this.isFresh) {
      return []
    }
    const size = sizeOverride ?? this.options.size
    const points = [...this.stablePoints, ...this.tailPoints]
    const len = points.length

    if (len === 1) {
      const c = points[0]!
      const cSize = this.sizeAt(size, c[2], 0, len, 0)
      return cSize < 0.5 ? [] : circleAround(c, cSize)
    }

    if (len === 2) {
      const c = points[0]!
      const n = points[1]!
      const cSize = this.sizeAt(size, c[2], 0, len, 0)
      const nSize = this.sizeAt(size, n[2], 0, len, 0)
      if (cSize < 0.5 || nSize < 0.5) {
        return []
      }
      const ps: OutlinePoint[] = []
      const pAngle = angle(c, [c[0], c[1] - 100, c[2]], n)
      for (let theta = pAngle; theta <= Math.PI + pAngle; theta += Math.PI / 16) {
        ps.push(add(c, smul(rot(UNIT_X, theta), cSize)))
      }
      for (let theta = Math.PI + pAngle; theta <= Math.PI * 2 + pAngle; theta += Math.PI / 16) {
        ps.push(add(n, smul(rot(UNIT_X, theta), nSize)))
      }
      ps.push(ps[0]!)
      return ps
    }

    const forwardPoints: OutlinePoint[] = []
    const backwardPoints: OutlinePoint[] = []
    let speed = 0
    let prevSpeed = 0
    let visibleStartIndex = 0
    let runningLength = 0

    for (let i = 1; i < len - 1; i++) {
      const p = points[i - 1]!
      const c = points[i]!
      const n = points[i + 1]!
      const d = dist(p, c)
      runningLength += d
      speed = prevSpeed + (d - prevSpeed) * 0.2

      const cSize = this.sizeAt(size, c[2], i, len, runningLength)
      if (cSize === 0) {
        visibleStartIndex = i + 1
        continue
      }

      const dirPC = norm(sub(p, c))
      const dirNC = norm(sub(n, c))
      const p1dirPC = rot(dirPC, Math.PI / 2)
      const p2dirPC = rot(dirPC, -Math.PI / 2)
      const p1dirNC = rot(dirNC, Math.PI / 2)
      const p2dirNC = rot(dirNC, -Math.PI / 2)

      const p1PC = add(c, smul(p1dirPC, cSize))
      const p2PC = add(c, smul(p2dirPC, cSize))
      const p1NC = add(c, smul(p1dirNC, cSize))
      const p2NC = add(c, smul(p2dirNC, cSize))

      const ftdir = add(p1dirPC, p2dirNC)
      const btdir = add(p2dirPC, p1dirNC)
      const paPC = add(c, smul(mag(ftdir) === 0 ? dirPC : norm(ftdir), cSize))
      const paNC = add(c, smul(mag(btdir) === 0 ? dirNC : norm(btdir), cSize))

      const cAngle = normAngle(angle(c, p, n))
      const D_ANGLE = (CORNER_DETECTION_MAX_ANGLE / 180) * Math.PI * cornerDetectionVariance(speed)

      if (Math.abs(cAngle) < D_ANGLE) {
        // A sharp corner: round it with an arc instead of a spike.
        const tAngle = Math.abs(normAngle(Math.PI - cAngle))
        if (tAngle === 0) {
          continue
        }
        if (cAngle < 0) {
          backwardPoints.push(p2PC, paNC)
          for (let theta = 0; theta <= tAngle; theta += tAngle / 4) {
            forwardPoints.push(add(c, rot(smul(p1dirPC, cSize), theta)))
          }
          for (let theta = tAngle; theta >= 0; theta -= tAngle / 4) {
            backwardPoints.push(add(c, rot(smul(p1dirPC, cSize), theta)))
          }
          backwardPoints.push(paNC, p1NC)
        } else {
          forwardPoints.push(p1PC, paPC)
          for (let theta = 0; theta <= tAngle; theta += tAngle / 4) {
            backwardPoints.push(add(c, rot(smul(p1dirPC, -cSize), -theta)))
          }
          for (let theta = tAngle; theta >= 0; theta -= tAngle / 4) {
            forwardPoints.push(add(c, rot(smul(p1dirPC, -cSize), -theta)))
          }
          forwardPoints.push(paPC, p2NC)
        }
      } else {
        forwardPoints.push(paPC)
        backwardPoints.push(paNC)
      }
      prevSpeed = speed
    }

    if (visibleStartIndex >= len - 2) {
      return this.options.keepHead ? circleAround(points[len - 1]!, this.options.size) : []
    }

    const first = points[visibleStartIndex]!
    const second = points[visibleStartIndex + 1]!
    const penultimate = points[len - 2]!
    const ultimate = points[len - 1]!

    const ppdirFS = rot(norm(sub(second, first)), -Math.PI / 2)
    const ppdirPU = rot(norm(sub(penultimate, ultimate)), Math.PI / 2)

    const startCapSize = this.sizeAt(size, first[2], 0, len, 0)
    const startCap: OutlinePoint[] = []
    const endCapSize = this.options.keepHead
      ? this.options.size
      : this.sizeAt(size, penultimate[2], len - 2, len, runningLength)
    const endCap: OutlinePoint[] = []

    if (startCapSize > 0.1) {
      for (let theta = 0; theta <= Math.PI; theta += Math.PI / 16) {
        startCap.unshift(add(first, rot(smul(ppdirFS, startCapSize), -theta)))
      }
      startCap.unshift(add(first, smul(ppdirFS, -startCapSize)))
    } else {
      startCap.push(first)
    }

    for (let theta = 0; theta <= Math.PI * 3; theta += Math.PI / 16) {
      endCap.push(add(ultimate, rot(smul(ppdirPU, -endCapSize), -theta)))
    }

    const outline = [...startCap, ...forwardPoints, ...endCap.reverse(), ...backwardPoints.reverse()]
    if (startCap.length > 0) {
      outline.push(startCap[0]!)
    }
    return outline
  }
}

/**
 * Excalidraw's getSvgPathFromStroke: a smooth closed path through the
 * outline (quadratic segments through the midpoints). Fed to Path2D.
 */
export function svgPathFromOutline(points: readonly OutlinePoint[]): string {
  const len = points.length
  if (len < 4) {
    return ''
  }
  const avg = (a: number, b: number): string => ((a + b) / 2).toFixed(2)
  let a = points[0]!
  let b = points[1]!
  const c = points[2]!
  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0])},${avg(b[1], c[1])} T`
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i]!
    b = points[i + 1]!
    result += `${avg(a[0], b[0])},${avg(a[1], b[1])} `
  }
  return `${result}Z`
}
