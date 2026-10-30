/**
 * Rendering theme helpers.
 *
 * Light mode is a pure pass-through. Dark mode re-creates the CSS filter
 * `invert(93%) hue-rotate(180deg)` in JS, the same approach Excalidraw
 * uses, so element colors stay readable on a dark canvas without shipping
 * a color library. Only the two color notations the element model actually
 * produces are parsed: `#rgb`/`#rrggbb` (plus alpha extensions) and
 * `rgb()`/`rgba()`. Anything else is returned unchanged.
 */

/** Minimal theme descriptor consumed by renderers and export helpers. */
export interface RenderTheme {
  dark: boolean
}

/** Chrome colors used by the overlay renderer, not element user data. */
export const UI = {
  /**
   * Selection borders, handles and the marquee, opendraw's orange accent
   * (the chrome's --od-accent) per theme. Chrome colors are consumed as-is
   * (like `grid`), never through the element dark filter.
   */
  selection: { light: '#ea580c', dark: '#fdba74' },
  /** Linear point handles' stroke (Excalidraw's renderSingleLinearPoint role). */
  point: '#c2410c',
  /** Midpoint ("phantom") handles' fill. */
  phantomPoint: 'rgba(251, 146, 60, 0.7)',
  /** Focus point indicator ink (circle stroke and dashed connector). */
  focus: 'rgba(234, 88, 12, 0.6)',
  /** De-emphasized accent for locked selections. */
  locked: '#ced4da',
  /** Scene grid ink per theme, low contrast so content stays in focus. */
  grid: { light: '#dddddd', dark: '#2e2e2e' },
} as const

/** CSS `invert()` amount applied before the hue rotation. */
const DARK_INVERT_PERCENT = 93

/** CSS `hue-rotate()` angle applied after the invert. */
const DARK_HUE_ROTATE_DEGREES = 180

/** Parsed color; channels 0-255, alpha 0-1. */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** RGB channels only, the intermediate state between filter steps. */
interface Channels {
  r: number
  g: number
  b: number
}

/** Dark-mode results keyed by input, colors repeat heavily per scene. */
const darkFilterCache = new Map<string, string>()

/**
 * Maps an element color for the given theme.
 *
 * - Light mode: the input, unchanged.
 * - Dark mode: the `invert(93%) hue-rotate(180deg)` equivalent.
 * - `'transparent'` and unparseable values pass through unchanged.
 */
export function themeColor(color: string, dark: boolean): string {
  if (!dark || color === 'transparent') {
    return color
  }
  const cached = darkFilterCache.get(color)
  if (cached !== undefined) {
    return cached
  }
  const parsed = parseColor(color)
  const result = parsed === null ? color : formatRgba(darkFilter(parsed))
  darkFilterCache.set(color, result)
  return result
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Parses `#hex` (3, 4, 6, 8 digits) and `rgb()`/`rgba()` colors; null otherwise. */
export function parseColor(input: string): Rgba | null {
  const color = input.trim().toLowerCase()
  if (color.startsWith('#')) {
    return parseHex(color.slice(1))
  }
  if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
    return parseRgbFunction(color)
  }
  return null
}

function parseHex(hex: string): Rgba | null {
  const expanded =
    hex.length === 3 || hex.length === 4
      ? hex
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : hex
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(expanded)) {
    return null
  }
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  }
}

const CHANNEL_PATTERN = /^[+-]?\d+$/
const ALPHA_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)$/

/**
 * Accepts the classic `rgb(r, g, b)` / `rgba(r, g, b, a)` and the modern
 * `rgb(r g b / a)` spellings. Percent components are not supported and
 * yield `null` (the color then passes through unchanged).
 */
function parseRgbFunction(color: string): Rgba | null {
  const open = color.indexOf('(')
  if (open < 0 || !color.endsWith(')')) {
    return null
  }
  const body = color.slice(open + 1, -1).trim()
  const [rgbPart = '', slashAlpha] = body.split('/')
  const parts = rgbPart
    .split(/[\s,]+/)
    .filter((part) => part.length > 0)
  if (parts.length !== 3 && parts.length !== 4) {
    return null
  }
  const channels = parts.slice(0, 3)
  if (!channels.every((channel) => CHANNEL_PATTERN.test(channel))) {
    return null
  }
  let alpha = 1
  const alphaRaw = parts.length === 4 ? parts[3] : slashAlpha
  if (alphaRaw !== undefined) {
    if (!ALPHA_PATTERN.test(alphaRaw.trim())) {
      return null
    }
    alpha = clamp01(parseFloat(alphaRaw))
  }
  return {
    r: clampChannel(parseInt(channels[0]!, 10)),
    g: clampChannel(parseInt(channels[1]!, 10)),
    b: clampChannel(parseInt(channels[2]!, 10)),
    a: alpha,
  }
}

// ---------------------------------------------------------------------------
// Filter math
// ---------------------------------------------------------------------------

/**
 * The dark-mode filter: invert(93%) first, then hue-rotate(180deg), the
 * order matches the CSS `filter: invert(93%) hue-rotate(180deg)`.
 */
function darkFilter(color: Rgba): Rgba {
  const p = DARK_INVERT_PERCENT / 100
  const inverted: Channels = {
    r: invertChannel(color.r, p),
    g: invertChannel(color.g, p),
    b: invertChannel(color.b, p),
  }
  const rotated = hueRotate180(inverted)
  return { ...rotated, a: color.a }
}

function invertChannel(value: number, p: number): number {
  return Math.round(clampChannel(value * (1 - p) + (255 - value) * p))
}

/** CSS `hue-rotate(180deg)` matrix, applied to normalized channels. */
function hueRotate180({ r, g, b }: Channels): Channels {
  const radians = (DARK_HUE_ROTATE_DEGREES * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const matrix: readonly [
    number, number, number,
    number, number, number,
    number, number, number,
  ] = [
    0.213 + cos * 0.787 - sin * 0.213,
    0.715 - cos * 0.715 - sin * 0.715,
    0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143,
    0.715 + cos * 0.285 + sin * 0.14,
    0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787,
    0.715 - cos * 0.715 + sin * 0.715,
    0.072 + cos * 0.928 + sin * 0.072,
  ]
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255
  return {
    r: Math.round(clamp01(nr * matrix[0] + ng * matrix[1] + nb * matrix[2]) * 255),
    g: Math.round(clamp01(nr * matrix[3] + ng * matrix[4] + nb * matrix[5]) * 255),
    b: Math.round(clamp01(nr * matrix[6] + ng * matrix[7] + nb * matrix[8]) * 255),
  }
}

// ---------------------------------------------------------------------------
// Formatting & small helpers
// ---------------------------------------------------------------------------

function formatRgba({ r, g, b, a }: Rgba): string {
  if (a >= 1) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`
}

function toHex(channel: number): string {
  return channel.toString(16).padStart(2, '0')
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, value))
}
