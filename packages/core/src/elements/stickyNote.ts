/**
 * Sticky notes, a port of Excalidraw's element/src/stickyNote.ts.
 *
 * A note is paper: a slightly jittered (by sloppiness) rounded sheet with a
 * soft drop shadow, a lifted corner at "cartoonist" sloppiness, and its
 * creation date in a footer. Its label wraps inside 16px padding and its
 * font shrinks from the size the user picked (the ceiling) in 2px steps
 * down to 16px; only text that still overflows grows the note past the
 * height the user gave it (`baseHeight`).
 */

import { rotatePoint } from '../geometry/points.js'
import { layoutText, lineHeightOf, wrapText } from '../geometry/text.js'
import type { ElementStyle, Point, OpenDrawStickyNoteElement, OpenDrawTextElement } from '../types.js'
import { mulberry32 } from '../utils/rng.js'
import type { ElementPatch } from './mutate.js'

export const DEFAULT_STICKY_NOTE_BG = '#ffdf6b'
export const DEFAULT_STICKY_NOTE_STROKE = '#1e1e1e'
/** The note palette's top picks: classic note colors, never transparent. */
export const STICKY_NOTE_BACKGROUND_PICKS: readonly string[] = [
  DEFAULT_STICKY_NOTE_BG,
  '#fcc2d7',
  '#b2f2bb',
  '#a5d8ff',
  '#ffd8a8',
]

export const DEFAULT_STICKY_NOTE_SIZE = 250
export const STICKY_NOTE_MIN_SIZE = 75
export const STICKY_NOTE_PADDING = 16
export const STICKY_NOTE_MIN_FONT_SIZE = 16
export const STICKY_NOTE_MAX_FONT_SIZE = 512
export const STICKY_NOTE_FONT_STEP = 2
export const STICKY_NOTE_SHADOW_OFFSET = 3
export const STICKY_NOTE_SHADOW_OPACITY = 0.16
export const STICKY_NOTE_EDGE_SHADOW_WIDTH = 0.5
export const STICKY_NOTE_EDGE_SHADOW_OPACITY = 0.08
export const STICKY_NOTE_FOOTER = {
  height: 20,
  fontSize: 12,
  fontFamily: 'Helvetica, Arial, sans-serif',
  baselineFromBottom: 14,
  minBodyWidthForYear: 80,
} as const
/** Outer height → label body height: both paddings plus the footer. */
export const STICKY_NOTE_BODY_INSET_Y = STICKY_NOTE_PADDING * 2 + STICKY_NOTE_FOOTER.height

const RENDER_ROUGHNESS = [0, 1.5, 8] as const
const CORNER_RADIUS_RATIO = 0.04
const MAX_CORNER_RADIUS = 16

export function isStickyNote(element: { type: string } | undefined): element is OpenDrawStickyNoteElement {
  return element?.type === 'stickynote'
}

/** A note is always filled and inked: transparent picks fall back to the defaults. */
export function stickyNoteColor(property: 'strokeColor' | 'backgroundColor', color: string): string {
  if (color && color !== 'transparent') {
    return color
  }
  return property === 'backgroundColor' ? DEFAULT_STICKY_NOTE_BG : DEFAULT_STICKY_NOTE_STROKE
}

/**
 * The part of a style change a note takes: never-transparent colors,
 * sloppiness and opacity, fill, stroke width and stroke style do not
 * apply to paper (Excalidraw's hasFillStyle / hasStrokeWidth).
 */
export function stickyNoteStylePatch(style: Partial<ElementStyle>): Partial<ElementStyle> {
  const patch: Partial<ElementStyle> = {}
  if (style.strokeColor !== undefined) {
    patch.strokeColor = stickyNoteColor('strokeColor', style.strokeColor)
  }
  if (style.backgroundColor !== undefined) {
    patch.backgroundColor = stickyNoteColor('backgroundColor', style.backgroundColor)
  }
  if (style.roughness !== undefined) {
    patch.roughness = style.roughness
  }
  if (style.opacity !== undefined) {
    patch.opacity = style.opacity
  }
  return patch
}

// ---------------------------------------------------------------------------
// The paper's outline
// ---------------------------------------------------------------------------

export type StickyNotePathCommand =
  | { type: 'move'; point: Point }
  | { type: 'line'; point: Point }
  | { type: 'quadratic'; control: Point; point: Point }

const jitter = (random: () => number, amount: number): number => (random() * 2 - 1) * amount

function pointAtDistance(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (!length) {
    return from
  }
  const ratio = Math.min(distance / length, 1)
  return { x: from.x + dx * ratio, y: from.y + dy * ratio }
}

export function stickyNoteCornerRadius(note: OpenDrawStickyNoteElement): number {
  return note.roundness ? Math.min(Math.min(note.width, note.height) * CORNER_RADIUS_RATIO, MAX_CORNER_RADIUS) : 0
}

/** The sheet's four corners in note-local space, jittered by sloppiness. */
function renderPoints(note: OpenDrawStickyNoteElement, offset = 0, seedOffset = 0): Point[] {
  const roughness = Math.max(0, Math.min(2, Math.round(note.roughness))) as 0 | 1 | 2
  const amount = Math.min(RENDER_ROUGHNESS[roughness], Math.min(note.width, note.height) * 0.012)
  const corners = [
    { x: offset, y: offset },
    { x: offset + note.width, y: offset },
    { x: offset + note.width, y: offset + note.height },
    { x: offset, y: offset + note.height },
  ]
  if (!amount) {
    return corners
  }
  const random = mulberry32(note.seed + seedOffset)
  return corners.map((p) => ({ x: p.x + jitter(random, amount), y: p.y + jitter(random, amount) }))
}

/**
 * The paper (or, with `shadow`, its offset shadow) as path commands in
 * note-local space. At "cartoonist" sloppiness one corner, the same for
 * paper and shadow, picked by the seed, lifts off the page.
 */
export function stickyNotePathCommands(
  note: OpenDrawStickyNoteElement,
  { shadow = false }: { shadow?: boolean } = {},
): StickyNotePathCommand[] {
  const points = shadow ? renderPoints(note, STICKY_NOTE_SHADOW_OFFSET, 1) : renderPoints(note)
  const radius = stickyNoteCornerRadius(note)
  const liftedCorner = note.roughness === 2 ? Math.floor(mulberry32(note.seed)() * points.length) : -1
  if (!radius && liftedCorner === -1) {
    return [{ type: 'move', point: points[0]! }, ...points.slice(1).map((point) => ({ type: 'line' as const, point }))]
  }
  const corners = points.map((point, index): StickyNotePathCommand[] => {
    const prev = points[(index + points.length - 1) % points.length]!
    const next = points[(index + 1) % points.length]!
    const cornerRadius = Math.min(
      radius,
      Math.hypot(point.x - prev.x, point.y - prev.y) / 2,
      Math.hypot(point.x - next.x, point.y - next.y) / 2,
    )
    if (index === liftedCorner) {
      const size = Math.min(note.width, note.height)
      const reach = Math.min(size * 0.18, 40)
      // The shadow follows the paper inward at half the bend.
      const lift = Math.min(size * 0.02, 5) * (shadow ? 0.5 : 1)
      const tip = {
        x: point.x + (index === 1 || index === 2 ? -lift : lift),
        y: point.y + (index >= 2 ? -lift : lift),
      }
      const start = pointAtDistance(point, prev, reach)
      const end = pointAtDistance(point, next, reach)
      return [
        { type: 'line', point: start },
        { type: 'quadratic', control: pointAtDistance(point, prev, reach / 2), point: pointAtDistance(tip, start, cornerRadius) },
        { type: 'quadratic', control: tip, point: pointAtDistance(tip, end, cornerRadius) },
        { type: 'quadratic', control: pointAtDistance(point, next, reach / 2), point: end },
      ]
    }
    return [
      { type: 'line', point: pointAtDistance(point, prev, cornerRadius) },
      { type: 'quadratic', control: point, point: pointAtDistance(point, next, cornerRadius) },
    ]
  })
  const commands: StickyNotePathCommand[] = [{ type: 'move', point: corners[0]![corners[0]!.length - 1]!.point }]
  for (let index = 1; index <= corners.length; index++) {
    commands.push(...corners[index % corners.length]!)
  }
  return commands
}

/** The same outline as SVG path data. */
export function stickyNoteSvgPath(commands: readonly StickyNotePathCommand[]): string {
  return `${commands
    .map((c) =>
      c.type === 'move'
        ? `M${c.point.x} ${c.point.y}`
        : c.type === 'line'
          ? `L${c.point.x} ${c.point.y}`
          : `Q${c.control.x} ${c.control.y} ${c.point.x} ${c.point.y}`,
    )
    .join(' ')} Z`
}

// ---------------------------------------------------------------------------
// The creation-date footer
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "7 Sep" within the current year (or when short), else "7 Sep 2025"; null without a date. */
export function stickyNoteDateLabel(
  created: number | null,
  { short = false, now = Date.now() }: { short?: boolean; now?: number } = {},
): string | null {
  if (created === null || !Number.isFinite(created)) {
    return null
  }
  const date = new Date(created)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`
  return short || date.getFullYear() === new Date(now).getFullYear() ? label : `${label} ${date.getFullYear()}`
}

/** The footer text and its right-aligned baseline, note-local; null for drafts under the minimum. */
export function stickyNoteFooter(
  note: Pick<OpenDrawStickyNoteElement, 'created' | 'width' | 'height'>,
  now = Date.now(),
): { text: string; x: number; y: number } | null {
  if (note.width < STICKY_NOTE_MIN_SIZE || note.height < STICKY_NOTE_MIN_SIZE) {
    return null
  }
  const text = stickyNoteDateLabel(note.created, {
    short: note.width - STICKY_NOTE_PADDING * 2 < STICKY_NOTE_FOOTER.minBodyWidthForYear,
    now,
  })
  return text
    ? { text, x: note.width - STICKY_NOTE_PADDING, y: note.height - STICKY_NOTE_FOOTER.baselineFromBottom }
    : null
}

// ---------------------------------------------------------------------------
// Sizing and label layout
// ---------------------------------------------------------------------------

export function normalizeStickyNoteFontSize(fontSize: number): number {
  return Number.isFinite(fontSize) ? Math.min(STICKY_NOTE_MAX_FONT_SIZE, Math.max(1, fontSize)) : 28
}

/** The smallest note one line of the label fits in, never under the 75px floor. */
export function stickyNoteMinSize(fontSize: number, fontFamily: OpenDrawTextElement['fontFamily']): { width: number; height: number } {
  const line = Math.ceil(normalizeStickyNoteFontSize(fontSize) * lineHeightOf(fontFamily))
  return {
    width: Math.max(STICKY_NOTE_MIN_SIZE, line + STICKY_NOTE_PADDING * 2),
    height: Math.max(STICKY_NOTE_MIN_SIZE, line + STICKY_NOTE_BODY_INSET_Y),
  }
}

interface FontFit {
  text: string
  fontSize: number
  width: number
  height: number
}

/**
 * The largest size on the grid {ceiling − k·2} ∪ {min} whose wrapped text
 * fits, binary search warm-started from the previous fit, so a keystroke
 * costs one or two measure passes (fitStickyNoteFont).
 */
function fitFont(
  fit: (fontSize: number) => FontFit,
  ceiling: number,
  min: number,
  maxWidth: number,
  maxHeight: number,
  warmStart: number,
): FontFit {
  const steps = Math.max(0, Math.ceil((ceiling - min) / STICKY_NOTE_FONT_STEP))
  const sizeAt = (index: number): number => (index >= steps ? min : ceiling - index * STICKY_NOTE_FONT_STEP)
  const cache = new Map<number, FontFit>()
  const at = (index: number): FontFit => {
    let result = cache.get(index)
    if (!result) {
      result = fit(sizeAt(index))
      cache.set(index, result)
    }
    return result
  }
  const fits = (index: number): boolean => at(index).width <= maxWidth && at(index).height <= maxHeight
  if (steps === 0) {
    return at(0)
  }
  const warm = Math.max(0, Math.min(steps, Math.round((ceiling - warmStart) / STICKY_NOTE_FONT_STEP)))
  let lo: number
  let hi: number
  if (fits(warm)) {
    if (warm === 0 || !fits(warm - 1)) {
      return at(warm)
    }
    lo = 0
    hi = warm - 1
  } else {
    if (warm === steps) {
      return at(steps)
    }
    lo = warm + 1
    hi = steps
  }
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (fits(mid)) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return at(lo)
}

export interface StickyNoteLayout {
  text: ElementPatch<OpenDrawTextElement>
  container: ElementPatch<OpenDrawStickyNoteElement> | null
}

/**
 * Lays a note's label out (getStickyNoteLayout): wrap at the padded width,
 * fit the font under the ceiling, grow the note only when the text still
 * overflows at the minimum, then place the label, vertically centered in
 * the whole padded note while it stays clear of the footer.
 */
export function layoutStickyNoteText(text: OpenDrawTextElement, note: OpenDrawStickyNoteElement): StickyNoteLayout {
  const width = Math.max(note.width, STICKY_NOTE_MIN_SIZE)
  const baseHeight = Math.max(note.baseHeight || note.height, STICKY_NOTE_MIN_SIZE)
  const ceiling = normalizeStickyNoteFontSize(text.baseFontSize ?? text.fontSize)
  const min = Math.min(STICKY_NOTE_MIN_FONT_SIZE, ceiling)
  const maxWidth = Math.max(width - STICKY_NOTE_PADDING * 2, 1)
  const maxHeight = Math.max(baseHeight - STICKY_NOTE_BODY_INSET_Y, 0)
  const fit = (fontSize: number): FontFit => {
    const wrapped = wrapText(text.originalText, text.fontFamily, fontSize, maxWidth)
    const metrics = layoutText(wrapped, text.fontFamily, fontSize)
    return { text: wrapped, fontSize, width: metrics.width, height: metrics.height }
  }
  const blank = text.originalText.trim() === ''
  const fitted = blank
    ? { text: '', fontSize: ceiling, width: 0, height: layoutText('', text.fontFamily, ceiling).height }
    : fitFont(fit, ceiling, min, maxWidth, maxHeight, text.fontSize)
  const height = blank ? baseHeight : Math.max(baseHeight, fitted.height + STICKY_NOTE_BODY_INSET_Y)

  const bodyHeight = Math.max(0, height - STICKY_NOTE_BODY_INSET_Y)
  const originX = note.x + STICKY_NOTE_PADDING
  const originY = note.y + STICKY_NOTE_PADDING
  const x =
    text.textAlign === 'left'
      ? originX
      : text.textAlign === 'right'
        ? originX + maxWidth - fitted.width
        : originX + (maxWidth - fitted.width) / 2
  const y =
    text.verticalAlign === 'top'
      ? originY
      : text.verticalAlign === 'bottom'
        ? originY + bodyHeight - fitted.height
        : originY + Math.min((height - STICKY_NOTE_PADDING * 2 - fitted.height) / 2, bodyHeight - fitted.height)

  let position: Point = { x, y }
  if (note.angle !== 0) {
    // The footer makes the body asymmetric; it still turns about the note's center.
    const center = { x: note.x + width / 2, y: note.y + height / 2 }
    const textCenter = rotatePoint({ x: x + fitted.width / 2, y: y + fitted.height / 2 }, center, note.angle)
    position = { x: textCenter.x - fitted.width / 2, y: textCenter.y - fitted.height / 2 }
  }

  const containerPatch: ElementPatch<OpenDrawStickyNoteElement> = {}
  if (width !== note.width) {
    containerPatch.width = width
  }
  if (height !== note.height) {
    containerPatch.height = height
  }
  if (baseHeight !== note.baseHeight) {
    containerPatch.baseHeight = baseHeight
  }
  return {
    text: {
      text: fitted.text,
      fontSize: fitted.fontSize,
      baseFontSize: ceiling,
      width: fitted.width,
      height: fitted.height,
      x: position.x,
      y: position.y,
      angle: note.angle,
    },
    container: Object.keys(containerPatch).length > 0 ? containerPatch : null,
  }
}

/**
 * Where a finished creation gesture leaves the note: a click drops the
 * default 250px square centered on the press; a drag keeps its size, at
 * least one line tall, growing away from the press corner.
 */
export function stickyNoteCreationRect(
  draft: Pick<OpenDrawStickyNoteElement, 'x' | 'y' | 'width' | 'height'>,
  origin: Point,
  { isClick, minSize, keepSquare }: { isClick: boolean; minSize: { width: number; height: number }; keepSquare: boolean },
): { x: number; y: number; width: number; height: number } {
  if (isClick) {
    const size = DEFAULT_STICKY_NOTE_SIZE
    return { x: origin.x - size / 2, y: origin.y - size / 2, width: size, height: size }
  }
  let width = Math.max(draft.width, minSize.width)
  let height = Math.max(draft.height, minSize.height)
  if (keepSquare) {
    width = height = Math.max(width, height)
  }
  return {
    x: draft.x < origin.x ? origin.x - width : draft.x,
    y: draft.y < origin.y ? origin.y - height : draft.y,
    width,
    height,
  }
}
