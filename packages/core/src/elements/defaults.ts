/**
 * Default style payloads, color palette and font stacks.
 *
 * Defaults follow Excalidraw's constants (stroke #1e1e1e, strokeWidth 2,
 * roughness 1, opacity 100) so the library feels familiar out of the box.
 */

import type { ElementStyle, FontFamily, TextStyle } from '../types.js'

// ---------------------------------------------------------------------------
// Style defaults
// ---------------------------------------------------------------------------

export const STROKE_WIDTHS = {
  thin: 1,
  medium: 2,
  bold: 4,
} as const

export const ROUGHNESS_LEVELS = {
  architect: 0,
  artist: 1,
  cartoonist: 2,
} as const

export const TRANSPARENT = 'transparent'

/** Style applied to elements created with no explicit style. */
export const DEFAULT_ELEMENT_STYLE: ElementStyle = {
  strokeColor: '#1e1e1e',
  backgroundColor: TRANSPARENT,
  fillStyle: 'hachure',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 20,
  fontFamily: 'hand',
  textAlign: 'left',
}

// ---------------------------------------------------------------------------
// Palette — the swatches shipped with the default UI
// ---------------------------------------------------------------------------

/** Stroke swatches, light-friendly (dark theme reuses the same inks). */
export const STROKE_PALETTE: readonly string[] = [
  '#1e1e1e',
  '#e03131',
  '#2f9e44',
  '#1971c2',
  '#f08c00',
  '#6741d9',
]

export const BACKGROUND_PALETTE: readonly string[] = [
  'transparent',
  '#ffc9c9',
  '#b2f2bb',
  '#a5d8ff',
  '#ffec99',
  '#d0bfff',
]

/** Canvas background defaults per theme. */
export const CANVAS_BACKGROUND = {
  light: '#ffffff',
  dark: '#121212',
} as const

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

/**
 * Font stacks per family. No font files ship with the library — stacks
 * degrade gracefully and users can register their own (e.g. Virgil for the
 * hand-drawn feel Excalidraw ships as Excalifont).
 */
export const FONT_STACKS: Record<FontFamily, string> = {
  hand: '"Excalifont", "Virgil", "Segoe Print", "Bradley Hand", cursive',
  normal: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  code: '"Cascadia Code", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
}

export const LINE_HEIGHTS: Record<FontFamily, number> = {
  hand: 1.25,
  normal: 1.25,
  code: 1.25,
}
