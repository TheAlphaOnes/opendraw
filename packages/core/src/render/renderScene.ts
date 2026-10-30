/**
 * Static scene rendering: canvas background, grid and every element shape,
 * drawn in scene coordinates onto a 2D context.
 *
 * The hand-drawn look comes from rough.js. Drawable generation is the
 * expensive part, and elements are immutable (copy-on-write), so a module
 * level `WeakMap` keyed by element reference caches the generated drawables
 * and unchanged elements are simply replayed each frame. The cache entry
 * records the theme it was colored for, so a theme switch regenerates once
 * and then hits again.
 *
 * Freedraw strokes bypass rough.js entirely: perfect-freehand produces the
 * outline and we fill it as a single smoothed `Path2D`.
 */

import roughDefault from 'roughjs'
import type { Config, Drawable, Options } from 'roughjs/bin/core.js'
import type { RoughCanvas } from 'roughjs/bin/canvas.js'
import type { RoughGenerator } from 'roughjs/bin/generator.js'
import { getStroke } from 'perfect-freehand'
import { TRANSPARENT } from '../elements/defaults.js'
import { fontCss, textLines } from '../geometry/text.js'
import type {
  Point,
  Size,
  Viewport,
  OpenDrawAppState,
  OpenDrawArrowElement,
  OpenDrawElement,
  OpenDrawFrameElement,
  OpenDrawFreedrawElement,
  OpenDrawImageElement,
  OpenDrawLineElement,
  OpenDrawLinearElement,
  OpenDrawTextElement,
} from '../types.js'
import { applyViewportTransform, screenToScene } from '../viewport.js'
import { arrowheadDrawables } from './arrowheads.js'
import { themeColor, UI } from './theme.js'

/**
 * rough.js is a CJS package whose `.d.ts` is ESM-flavored (`export default`),
 * so under NodeNext the default import types as the module namespace. Every
 * runtime we target (Node ESM, Vite, Vitest) hands the factory object itself
 * to the default import, so re-bind it to the shape rough actually exports.
 */
const rough = roughDefault as unknown as {
  canvas(canvas: HTMLCanvasElement, config?: Config): RoughCanvas
  generator(config?: Config): RoughGenerator
}

/** Screen pixel dimensions of the canvas being rendered into. */
export interface CanvasSize {
  width: number
  height: number
}

export interface SceneRenderInput {
  /** Ordered back-to-front. */
  elements: readonly OpenDrawElement[]
  appState: Readonly<
    Pick<OpenDrawAppState, 'theme' | 'viewBackgroundColor' | 'viewport' | 'gridSize' | 'editingId'>
  >
  canvasSize: CanvasSize
  /** devicePixelRatio — fold into the transform so callers stay CSS-px. */
  dpr: number
  /**
   * Supplies a decoded bitmap for an image element, or null when it is not
   * (yet) available — core never decodes itself, keeping the package
   * environment-agnostic. Missing bitmaps render a placeholder instead.
   */
  resolveImage?: SceneImageResolver
}

/**
 * Maps an image element to a drawable bitmap source. Implemented in the host
 * (nuxt) layer on top of a decoded-bitmap cache so panning and zooming never
 * re-decode.
 */
export type SceneImageResolver = (element: OpenDrawImageElement) => CanvasImageSource | null

// ---------------------------------------------------------------------------
// Stroke dash arrays — shared with tests
// ---------------------------------------------------------------------------

export function getDashArrayDashed(strokeWidth: number): number[] {
  return [8, 8 + strokeWidth]
}

export function getDashArrayDotted(strokeWidth: number): number[] {
  return [1.5, 6 + strokeWidth]
}

// ---------------------------------------------------------------------------
// Roughness scaling — small shapes look cleaner with reduced jitter
// ---------------------------------------------------------------------------

type BoxElement = Extract<OpenDrawElement, { type: 'rectangle' | 'diamond' | 'ellipse' }>

function isBoxLike(element: OpenDrawElement): element is BoxElement {
  return element.type === 'rectangle' || element.type === 'diamond' || element.type === 'ellipse'
}

function isLinearType(
  element: OpenDrawElement,
): element is OpenDrawLineElement | OpenDrawArrowElement {
  return element.type === 'line' || element.type === 'arrow'
}

/**
 * The extent roughness is scaled against. For stroke-based elements the
 * geometry lives in `points`, not `width`/`height`, so measure from there.
 */
function elementExtent(element: OpenDrawElement): Size {
  if (!isLinearType(element) && element.type !== 'freedraw') {
    return { width: element.width, height: element.height }
  }
  let x1 = Number.POSITIVE_INFINITY
  let y1 = Number.POSITIVE_INFINITY
  let x2 = Number.NEGATIVE_INFINITY
  let y2 = Number.NEGATIVE_INFINITY
  if (isLinearType(element)) {
    for (const p of element.points) {
      x1 = Math.min(x1, p.x)
      y1 = Math.min(y1, p.y)
      x2 = Math.max(x2, p.x)
      y2 = Math.max(y2, p.y)
    }
  } else {
    for (const p of element.points) {
      x1 = Math.min(x1, p[0]!)
      y1 = Math.min(y1, p[1]!)
      x2 = Math.max(x2, p[0]!)
      y2 = Math.max(y2, p[1]!)
    }
  }
  return { width: x2 - x1, height: y2 - y1 }
}

/**
 * Keeps the hand-drawn feel on sizeable shapes but tightens it on tiny
 * ones, where full roughness turns into visual noise. Modeled on
 * Excalidraw's heuristic.
 */
export function adjustRoughness(element: OpenDrawElement): number {
  const { width, height } = elementExtent(element)
  const minSize = Math.min(width, height)
  const maxSize = Math.max(width, height)
  const roughness = element.roughness
  if (
    // Both sides relatively big.
    (minSize >= 20 && maxSize >= 50) ||
    // A closed shape keeps its roughness once both sides reach 15px.
    (isBoxLike(element) && minSize >= 15) ||
    // Long linear elements keep their character.
    (isLinearType(element) && maxSize >= 50)
  ) {
    return roughness
  }
  return Math.min(roughness / (maxSize < 10 ? 3 : 2), 2.5)
}

// ---------------------------------------------------------------------------
// rough.js options & shape generation
// ---------------------------------------------------------------------------

/** One generator instance for the whole module — drawables are seed-stable. */
const generator = rough.generator()

interface CachedShape {
  /** Theme the drawables were colored for — a theme switch regenerates. */
  dark: boolean
  /** Canvas background outline arrowheads were filled with. */
  background: string
  drawables: readonly Drawable[]
}

/** Background assumed when a caller has none (standalone element draws). */
const DEFAULT_BACKGROUND = '#ffffff'

/** Elements are immutable, so reference identity is a valid cache key. */
const shapeCache = new WeakMap<OpenDrawElement, CachedShape>()

function buildRoughOptions(element: OpenDrawElement, dark: boolean): Options {
  const strokeWidth = element.strokeWidth
  return {
    seed: element.seed,
    roughness: adjustRoughness(element),
    stroke: themeColor(element.strokeColor, dark),
    // Non-solid strokes lose the second sketch pass, so widen a touch to
    // keep the perceived weight — and keep fill metrics tied to the plain
    // width so hachure density doesn't shift.
    strokeWidth:
      element.strokeStyle !== 'solid' ? strokeWidth + 0.5 : strokeWidth,
    strokeLineDash:
      element.strokeStyle === 'dashed'
        ? getDashArrayDashed(strokeWidth)
        : element.strokeStyle === 'dotted'
          ? getDashArrayDotted(strokeWidth)
          : undefined,
    disableMultiStroke: element.strokeStyle !== 'solid',
    fill:
      element.backgroundColor !== TRANSPARENT
        ? themeColor(element.backgroundColor, dark)
        : undefined,
    fillStyle: element.fillStyle,
    fillWeight: strokeWidth / 2,
    hachureGap: strokeWidth * 4,
    preserveVertices: element.roughness < 2,
  }
}

/** rough.js consumes `[x, y]` tuples. */
function toRoughPoints(points: readonly Point[]): [number, number][] {
  return points.map((p) => [p.x, p.y] as [number, number])
}

/**
 * Excalidraw's proportional corner radius: 25% of the element's shorter
 * side (their `DEFAULT_PROPORTIONAL_RADIUS`). Shared with the overlay's
 * highlight so the chrome traces the same corners the renderer draws.
 */
export const PROPORTIONAL_RADIUS = 0.25

/** Rounded-rectangle outline as an SVG path — Q curves at each corner. */
function roundedRectPath(width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2)
  return [
    `M ${r} 0`,
    `L ${width - r} 0`,
    `Q ${width} 0, ${width} ${r}`,
    `L ${width} ${height - r}`,
    `Q ${width} ${height}, ${width - r} ${height}`,
    `L ${r} ${height}`,
    `Q 0 ${height}, 0 ${height - r}`,
    `L 0 ${r}`,
    `Q 0 0, ${r} 0`,
  ].join(' ')
}

/**
 * Rounded-diamond outline: straight apex-to-apex edges with C-curve corners,
 * each corner scaled by the distance to its apexes (Excalidraw's math).
 */
function roundedDiamondPath(
  width: number,
  height: number,
  vRadius: number,
  hRadius: number,
): string {
  const topX = width / 2
  const rightY = height / 2
  return [
    `M ${topX + vRadius} ${hRadius}`,
    `L ${width - vRadius} ${rightY - hRadius}`,
    `C ${width} ${rightY}, ${width} ${rightY}, ${width - vRadius} ${rightY + hRadius}`,
    `L ${topX + vRadius} ${height - hRadius}`,
    `C ${topX} ${height}, ${topX} ${height}, ${topX - vRadius} ${height - hRadius}`,
    `L ${vRadius} ${rightY + hRadius}`,
    `C 0 ${rightY}, 0 ${rightY}, ${vRadius} ${rightY - hRadius}`,
    `L ${topX - vRadius} ${hRadius}`,
    `C ${topX} 0, ${topX} 0, ${topX + vRadius} ${hRadius}`,
  ].join(' ')
}

function buildBoxShape(element: BoxElement, dark: boolean): Drawable[] {
  const options = buildRoughOptions(element, dark)
  const { width, height } = element
  switch (element.type) {
    case 'rectangle':
      if (element.roundness === 'round') {
        const radius = Math.min(width, height) * PROPORTIONAL_RADIUS
        return [generator.path(roundedRectPath(width, height, radius), options)]
      }
      return [generator.rectangle(0, 0, width, height, options)]
    case 'diamond':
      if (element.roundness === 'round') {
        const vRadius = (width / 2) * PROPORTIONAL_RADIUS
        const hRadius = (height / 2) * PROPORTIONAL_RADIUS
        return [generator.path(roundedDiamondPath(width, height, vRadius, hRadius), options)]
      }
      return [
        generator.polygon(
          [
            [width / 2, 0],
            [width, height / 2],
            [width / 2, height],
            [0, height / 2],
          ],
          options,
        ),
      ]
    case 'ellipse':
      return [
        generator.ellipse(
          width / 2,
          height / 2,
          width,
          height,
          { ...options, curveFitting: 1 },
        ),
      ]
  }
}

/** First and last point this close (scene px) counts as a closed loop. */
const LOOP_MAX_DISTANCE = 10

function isClosedLoop(points: readonly Point[]): boolean {
  if (points.length < 3) {
    return false
  }
  const first = points[0]!
  const last = points[points.length - 1]!
  return Math.hypot(first.x - last.x, first.y - last.y) <= LOOP_MAX_DISTANCE
}

function buildLinearShape(
  element: OpenDrawLineElement | OpenDrawArrowElement,
  dark: boolean,
  background: string,
): Drawable[] {
  const points = toRoughPoints(element.points)
  if (isClosedLoop(element.points)) {
    // Only closed loops take a fill; the polygon closes the path.
    return [generator.polygon(points, buildRoughOptions(element, dark))]
  }
  const strokeOptions: Options = { ...buildRoughOptions(element, dark), fill: undefined }
  const drawables: Drawable[] = [generator.linearPath(points, strokeOptions)]
  // Only arrows render heads (Excalidraw's lines carry the fields unused).
  if (element.type === 'arrow') {
    const stroke = themeColor(element.strokeColor, dark)
    // Outline heads punch the canvas color through; the background is user
    // data that is never dark-filtered, so it fills unfiltered too.
    const fill = background
    for (const [position, head] of [['start', element.startArrowhead], ['end', element.endArrowhead]] as const) {
      if (head) {
        drawables.push(...arrowheadDrawables(generator, element, position, head, strokeOptions, stroke, fill))
      }
    }
  }
  return drawables
}

function buildShape(element: OpenDrawElement, dark: boolean, background: string): readonly Drawable[] {
  if (isBoxLike(element)) {
    return buildBoxShape(element, dark)
  }
  if (isLinearType(element)) {
    return buildLinearShape(element, dark, background)
  }
  // Freedraw and text never render through rough.js.
  return []
}

function getShape(element: OpenDrawElement, dark: boolean, background: string): readonly Drawable[] {
  const cached = shapeCache.get(element)
  if (cached && cached.dark === dark && cached.background === background) {
    return cached.drawables
  }
  const drawables = buildShape(element, dark, background)
  shapeCache.set(element, { dark, background, drawables })
  return drawables
}

/**
 * The cached rough.js drawables an element renders with. The SVG exporter
 * consumes the same drawables (same seed, same jitter) so vector output is
 * faithful to the canvas instead of a re-generated approximation.
 */
export function getElementDrawables(
  element: OpenDrawElement,
  dark: boolean,
  background: string = DEFAULT_BACKGROUND,
): readonly Drawable[] {
  return getShape(element, dark, background)
}

// ---------------------------------------------------------------------------
// Freedraw — perfect-freehand outline filled as one smoothed path
// ---------------------------------------------------------------------------

/** Stroke size relative to `strokeWidth`, tuned by Excalidraw visually. */
const FREEDRAW_SIZE_FACTOR = 4.25

const freedrawPathCache = new WeakMap<OpenDrawFreedrawElement, Path2D>()

/** The perfect-freehand outline of a freedraw stroke, in local space. */
export function getFreedrawOutline(element: OpenDrawFreedrawElement): number[][] {
  return getStroke(element.points, {
    simulatePressure: element.simulatePressure,
    size: element.strokeWidth * FREEDRAW_SIZE_FACTOR,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t: number) => Math.sin((t * Math.PI) / 2),
    last: true,
  })
}

/**
 * Quadratic-midpoint smoothing as pure commands, so the canvas renderer
 * (Path2D) and the SVG exporter (path data) walk the exact same geometry.
 */
export type PathCommand = { kind: 'M' | 'Q'; values: readonly number[] }

export function outlineCommands(outline: readonly (readonly number[])[]): readonly PathCommand[] {
  const commands: PathCommand[] = []
  const count = outline.length
  if (count === 0) {
    return commands
  }
  commands.push({ kind: 'M', values: outline[0]! })
  for (let i = 0; i < count; i++) {
    const current = outline[i]!
    const next = outline[(i + 1) % count]!
    commands.push({
      kind: 'Q',
      values: [
        current[0]!,
        current[1]!,
        (current[0]! + next[0]!) / 2,
        (current[1]! + next[1]!) / 2,
      ],
    })
  }
  return commands
}

function getFreedrawPath(element: OpenDrawFreedrawElement): Path2D {
  const cached = freedrawPathCache.get(element)
  if (cached) {
    return cached
  }
  const path = outlineToPath(getFreedrawOutline(element))
  freedrawPathCache.set(element, path)
  return path
}

/** Replays the smoothed outline commands into a fillable canvas path. */
function outlineToPath(outline: readonly (readonly number[])[]): Path2D {
  const path = new Path2D()
  for (const command of outlineCommands(outline)) {
    if (command.kind === 'M') {
      path.moveTo(command.values[0]!, command.values[1]!)
    } else {
      path.quadraticCurveTo(
        command.values[0]!,
        command.values[1]!,
        command.values[2]!,
        command.values[3]!,
      )
    }
  }
  path.closePath()
  return path
}

function drawFreedraw(
  ctx: CanvasRenderingContext2D,
  element: OpenDrawFreedrawElement,
  dark: boolean,
): void {
  if (element.points.length === 0) {
    return
  }
  ctx.fillStyle = themeColor(element.strokeColor, dark)
  ctx.fill(getFreedrawPath(element))
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function drawText(ctx: CanvasRenderingContext2D, element: OpenDrawTextElement, dark: boolean): void {
  ctx.font = fontCss(element.fontFamily, element.fontSize)
  ctx.fillStyle = themeColor(element.strokeColor, dark)
  ctx.textAlign = element.textAlign
  ctx.textBaseline = 'alphabetic'
  const anchorX =
    element.textAlign === 'center'
      ? element.width / 2
      : element.textAlign === 'right'
        ? element.width
        : 0
  const lineStep = element.fontSize * element.lineHeight
  const lines = textLines(element.text)
  for (let i = 0; i < lines.length; i++) {
    // Ascender-approximated baseline: full font size below the line top.
    ctx.fillText(lines[i]!, anchorX, i * lineStep + element.fontSize)
  }
}

// ---------------------------------------------------------------------------
// Element drawing
// ---------------------------------------------------------------------------

/**
 * Draws one element at its scene position: translate to the element origin,
 * rotate around the element center, then render in element-local space.
 */
function drawElement(
  ctx: CanvasRenderingContext2D,
  rc: ReturnType<typeof rough.canvas>,
  element: OpenDrawElement,
  dark: boolean,
  resolveImage: SceneImageResolver | undefined,
  background: string,
): void {
  ctx.save()
  ctx.translate(element.x, element.y)
  if (element.angle !== 0) {
    const cx = element.width / 2
    const cy = element.height / 2
    ctx.translate(cx, cy)
    ctx.rotate(element.angle)
    ctx.translate(-cx, -cy)
  }
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = element.opacity / 100
  switch (element.type) {
    case 'rectangle':
    case 'diamond':
    case 'ellipse':
    case 'line':
    case 'arrow': {
      for (const drawable of getShape(element, dark, background)) {
        // rough.js resets some ctx state per opset — re-apply alpha so
        // multi-drawable elements (arrowheads) stay uniformly faded.
        ctx.globalAlpha = element.opacity / 100
        rc.draw(drawable)
      }
      break
    }
    case 'freedraw':
      drawFreedraw(ctx, element, dark)
      break
    case 'text':
      drawText(ctx, element, dark)
      break
    case 'image':
      drawImageElement(ctx, element, dark, resolveImage)
      break
    case 'frame':
      drawFrame(ctx, element, dark)
      break
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Images & frames — box-like, never hand-drawn
// ---------------------------------------------------------------------------

/** Placeholder ink per theme — chrome color, never the dark element filter. */
const IMAGE_PLACEHOLDER = { fill: '#ececec', stroke: '#b3b3b3' } as const
const IMAGE_PLACEHOLDER_DARK = { fill: '#2a2a2a', stroke: '#525252' } as const

/**
 * Draws an image at its scene rect. A decoded bitmap is composited as-is —
 * images are user content and are never color-inverted in dark mode. Without
 * a bitmap (not yet decoded, or a broken data URL) a neutral placeholder
 * renders so the canvas never breaks.
 */
function drawImageElement(
  ctx: CanvasRenderingContext2D,
  element: OpenDrawImageElement,
  dark: boolean,
  resolveImage?: SceneImageResolver,
): void {
  const source = resolveImage?.(element) ?? null
  if (source) {
    try {
      ctx.drawImage(source, 0, 0, element.width, element.height)
    } catch {
      drawImagePlaceholder(ctx, element, dark)
    }
    return
  }
  drawImagePlaceholder(ctx, element, dark)
}

function drawImagePlaceholder(
  ctx: CanvasRenderingContext2D,
  element: OpenDrawImageElement,
  dark: boolean,
): void {
  const ink = dark ? IMAGE_PLACEHOLDER_DARK : IMAGE_PLACEHOLDER
  ctx.fillStyle = ink.fill
  ctx.fillRect(0, 0, element.width, element.height)
  ctx.strokeStyle = ink.stroke
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.strokeRect(0.5, 0.5, Math.max(0, element.width - 1), Math.max(0, element.height - 1))
  // A small "broken image" glyph: mountain + sun, the universal icon.
  const cx = element.width / 2
  const cy = element.height / 2
  const r = Math.max(4, Math.min(element.width, element.height) / 4)
  ctx.beginPath()
  ctx.moveTo(cx - r, cy + r / 2)
  ctx.lineTo(cx - r / 3, cy - r / 2)
  ctx.lineTo(cx + r / 6, cy + r / 6)
  ctx.lineTo(cx + r / 3, cy - r / 6)
  ctx.lineTo(cx + r, cy + r / 2)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx - r / 2, cy - r / 3, Math.max(1.5, r / 5), 0, Math.PI * 2)
  ctx.stroke()
}

/** Frame chrome ink per theme — muted, so contents stay the focus. */
const FRAME_INK = { light: '#a0a0a0', dark: '#5c5c5c' } as const
const FRAME_NAME_INK = { light: '#8a8a8a', dark: '#777777' } as const

/** Frames: dashed box + name above the top-left corner (Excalidraw parity). */
function drawFrame(ctx: CanvasRenderingContext2D, element: OpenDrawFrameElement, dark: boolean): void {
  ctx.strokeStyle = dark ? FRAME_INK.dark : FRAME_INK.light
  ctx.lineWidth = 1
  ctx.setLineDash([8, 6])
  ctx.strokeRect(0.5, 0.5, Math.max(0, element.width - 1), Math.max(0, element.height - 1))
  ctx.setLineDash([])
  ctx.fillStyle = dark ? FRAME_NAME_INK.dark : FRAME_NAME_INK.light
  ctx.font = '12px sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(element.name, 0, -6)
}

// ---------------------------------------------------------------------------
// Scene rendering
// ---------------------------------------------------------------------------

/** The scene-space rectangle the viewport currently shows. */
function visibleSceneRect(canvasSize: CanvasSize, viewport: Viewport) {
  const topLeft = screenToScene({ x: 0, y: 0 }, viewport)
  const bottomRight = screenToScene(
    { x: canvasSize.width, y: canvasSize.height },
    viewport,
  )
  return { x1: topLeft.x, y1: topLeft.y, x2: bottomRight.x, y2: bottomRight.y }
}

/**
 * Elements a scene render paints: everything except the one being edited.
 * The wysiwyg editor is the only visible copy while editing — it mirrors the
 * live text through a transparent textarea, so painting the canvas copy too
 * would double every glyph under the caret.
 */
export function renderableElements(
  elements: readonly OpenDrawElement[],
  editingId: string | null,
): readonly OpenDrawElement[] {
  return editingId === null ? elements : elements.filter((el) => el.id !== editingId)
}

/** Beyond this many grid lines the grid is visual noise — skip the frame's cost. */
const MAX_GRID_LINES = 10_000

function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  visible: { x1: number; y1: number; x2: number; y2: number },
  gridSize: number,
  dark: boolean,
): void {
  const firstX = Math.ceil(visible.x1 / gridSize)
  const lastX = Math.floor(visible.x2 / gridSize)
  const firstY = Math.ceil(visible.y1 / gridSize)
  const lastY = Math.floor(visible.y2 / gridSize)
  if (lastX - firstX + lastY - firstY > MAX_GRID_LINES) {
    return
  }
  ctx.save()
  ctx.strokeStyle = dark ? UI.grid.dark : UI.grid.light
  ctx.lineWidth = 1 / viewport.zoom
  ctx.beginPath()
  for (let ix = firstX; ix <= lastX; ix++) {
    const x = ix * gridSize
    ctx.moveTo(x, visible.y1)
    ctx.lineTo(x, visible.y2)
  }
  for (let iy = firstY; iy <= lastY; iy++) {
    const y = iy * gridSize
    ctx.moveTo(visible.x1, y)
    ctx.lineTo(visible.x2, y)
  }
  ctx.stroke()
  ctx.restore()
}

export function renderScene(ctx: CanvasRenderingContext2D, input: SceneRenderInput): void {
  const { elements, appState, canvasSize, dpr } = input
  const { theme, viewBackgroundColor, viewport, gridSize, editingId } = appState
  const dark = theme === 'dark'
  ctx.save()
  applyViewportTransform(ctx, viewport, dpr)
  const visible = visibleSceneRect(canvasSize, viewport)
  // The canvas background is user data — it is never dark-filtered.
  ctx.fillStyle = viewBackgroundColor
  ctx.fillRect(visible.x1, visible.y1, visible.x2 - visible.x1, visible.y2 - visible.y1)
  if (gridSize !== null && gridSize > 0) {
    drawGrid(ctx, viewport, visible, gridSize, dark)
  }
  // One RoughCanvas per render call; drawables come from the shared generator.
  const rc = rough.canvas(ctx.canvas)
  for (const element of renderableElements(elements, editingId)) {
    drawElement(ctx, rc, element, dark, input.resolveImage, viewBackgroundColor)
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Standalone element drawing (no viewport involved)
// ---------------------------------------------------------------------------

/**
 * Draws a single element as-is — assumes `ctx` already carries whatever
 * transform the caller wants (identity for exports, viewport for previews).
 */
export function renderElementShape(
  ctx: CanvasRenderingContext2D,
  element: OpenDrawElement,
  dark: boolean,
  resolveImage?: SceneImageResolver,
  background: string = DEFAULT_BACKGROUND,
): void {
  drawElement(ctx, rough.canvas(ctx.canvas), element, dark, resolveImage, background)
}

/**
 * Convenience wrapper for export paths: draws a single element with no
 * viewport transform applied. `renderElementShape` is already viewport-free
 * (the viewport is owned by `renderScene`), so this exists as the semantic
 * entry point for exporters.
 */
export function exportElementShape(
  ctx: CanvasRenderingContext2D,
  element: OpenDrawElement,
  dark: boolean,
  resolveImage?: SceneImageResolver,
  background: string = DEFAULT_BACKGROUND,
): void {
  renderElementShape(ctx, element, dark, resolveImage, background)
}
