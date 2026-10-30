/**
 * Text measurement and layout.
 *
 * Measurement needs a canvas 2D context; the measurer is injectable so the
 * engine stays runnable in non-DOM environments (tests, SSR).
 */

import { FONT_STACKS, LINE_HEIGHTS } from '../elements/defaults.js'
import type { FontFamily } from '../types.js'

export type FontMeasurer = (font: string, text: string) => number

let offscreenCtx: CanvasRenderingContext2D | null = null

function defaultMeasurer(font: string, text: string): number {
  if (typeof document === 'undefined') {
    // SSR / test fallback: conservative monospace-ish estimate.
    return text.length * 8
  }
  if (!offscreenCtx) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return text.length * 8
    }
    offscreenCtx = ctx
  }
  offscreenCtx.font = font
  return offscreenCtx.measureText(text).width
}

/** Width of one line of text in the given CSS font. */
export function measureTextWidth(font: string, text: string): number {
  return defaultMeasurer(font, text)
}

/** CSS `font` shorthand for a family/size pair. */
export function fontCss(family: FontFamily, fontSize: number): string {
  return `${fontSize}px ${FONT_STACKS[family]}`
}

export function lineHeightOf(family: FontFamily): number {
  return LINE_HEIGHTS[family]
}

/** Normalizes newlines: CRLF/CR → LF, strips lone trailing newlines. */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
}

export function textLines(text: string): string[] {
  return normalizeText(text).split('\n')
}

export interface TextLayout {
  lines: string[]
  /** Widest line, in local px. */
  width: number
  /** lineCount * fontSize * lineHeight, in local px. */
  height: number
  lineHeight: number
}

/**
 * Lays text out: line splitting is explicit (no wrapping in v1 — the
 * editor textarea wraps visually but stored text keeps its own breaks).
 */
export function layoutText(
  text: string,
  fontFamily: FontFamily,
  fontSize: number,
  measure: FontMeasurer = defaultMeasurer,
): TextLayout {
  const lines = textLines(text)
  const font = fontCss(fontFamily, fontSize)
  let width = 0
  for (const line of lines) {
    width = Math.max(width, measure(font, line))
  }
  const lineHeight = fontSize * lineHeightOf(fontFamily)
  return {
    lines,
    width,
    height: lines.length * lineHeight,
    lineHeight,
  }
}

/**
 * Word-wraps text to `maxWidth` (local px), keeping explicit line breaks —
 * Excalidraw's `wrapText` for bound text. Words longer than a line break
 * between characters; whitespace at a wrap point is dropped so wrapped
 * lines never start or end with the gap they wrapped at.
 */
export function wrapText(
  text: string,
  fontFamily: FontFamily,
  fontSize: number,
  maxWidth: number,
  measure: FontMeasurer = defaultMeasurer,
): string {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    return normalizeText(text)
  }
  const font = fontCss(fontFamily, fontSize)
  const width = (value: string): number => measure(font, value)
  const wrapped: string[] = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (width(line) <= maxWidth) {
      wrapped.push(line)
      continue
    }
    let current = ''
    for (const word of line.split(/(\s+)/)) {
      if (word === '') {
        continue
      }
      const candidate = current + word
      if (width(candidate) <= maxWidth) {
        current = candidate
        continue
      }
      if (/^\s+$/.test(word)) {
        // A gap at the wrap point is consumed by the break.
        wrapped.push(current)
        current = ''
        continue
      }
      if (current.trim() !== '') {
        wrapped.push(current.trimEnd())
      }
      current = ''
      // A word wider than the whole line breaks between characters.
      for (const char of word) {
        if (current !== '' && width(current + char) > maxWidth) {
          wrapped.push(current)
          current = ''
        }
        current += char
      }
    }
    wrapped.push(current.trimEnd())
  }
  return wrapped.join('\n')
}
