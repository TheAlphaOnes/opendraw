/**
 * SVG export — the same rough.js drawables the canvas renderer uses,
 * converted to standalone SVG markup. Pure string building: no DOM is
 * involved, so this runs in Node and SSR contexts too (unlike PNG export,
 * which needs an offscreen canvas).
 */

import { getCommonBounds, inflateBounds, boundsWidth, boundsHeight } from '../geometry/bounds.js'
import { textLines } from '../geometry/text.js'
import { FONT_STACKS, TRANSPARENT } from '../elements/defaults.js'
import {
  getElementDrawables,
  getFreedrawOutline,
  outlineCommands,
} from '../render/renderScene.js'
import { FRAME_NAME_STYLE, frameTitle } from '../elements/frames.js'
import {
  STICKY_NOTE_FOOTER,
  STICKY_NOTE_SHADOW_OPACITY,
  stickyNoteFooter,
  stickyNotePathCommands,
  stickyNoteSvgPath,
} from '../elements/stickyNote.js'
import { themeColor } from '../render/theme.js'
import type { Drawable, Op } from 'roughjs/bin/core.js'
import type { ThemeName, OpenDrawElement, OpenDrawFreedrawElement, OpenDrawTextElement } from '../types.js'
import type { ExportOptions } from './png.js'

// ---------------------------------------------------------------------------
// Opset → path data
// ---------------------------------------------------------------------------

function formatNumber(value: number): string {
  // Two decimals is imperceptible at any reasonable zoom and keeps files small.
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

/** Mirrors rough.js's own `opsToPath` (it is not exported from the package). */
function opsToPathData(ops: readonly Op[]): string {
  const parts: string[] = []
  for (const op of ops) {
    const d = op.data
    if (op.op === 'move') {
      parts.push(`M ${formatNumber(d[0] ?? 0)} ${formatNumber(d[1] ?? 0)}`)
    } else if (op.op === 'lineTo') {
      parts.push(`L ${formatNumber(d[0] ?? 0)} ${formatNumber(d[1] ?? 0)}`)
    } else if (op.op === 'bcurveTo') {
      parts.push(
        `C ${formatNumber(d[0] ?? 0)} ${formatNumber(d[1] ?? 0)}, ${formatNumber(d[2] ?? 0)} ${formatNumber(d[3] ?? 0)}, ${formatNumber(d[4] ?? 0)} ${formatNumber(d[5] ?? 0)}`,
      )
    }
  }
  return parts.join(' ')
}

/**
 * One rough.js drawable → SVG paths, matching RoughSVG's semantics:
 * `path` sets stroke, `fillPath` sets a solid fill, `fillSketch` strokes the
 * fill color with `fillWeight` (hachure & friends).
 */
function drawableToSvgPaths(drawable: Drawable): string {
  const options = drawable.options
  let out = ''
  for (const set of drawable.sets) {
    const d = opsToPathData(set.ops)
    if (!d) {
      continue
    }
    if (set.type === 'path') {
      const dash =
        options.strokeLineDash && options.strokeLineDash.length > 0
          ? ` stroke-dasharray="${options.strokeLineDash.join(' ')}"`
          : ''
      out += `<path d="${d}" fill="none" stroke="${options.stroke}" stroke-width="${options.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`
    } else if (set.type === 'fillPath') {
      const evenOdd =
        drawable.shape === 'curve' || drawable.shape === 'polygon' ? ' fill-rule="evenodd"' : ''
      out += `<path d="${d}" stroke="none" stroke-width="0" fill="${options.fill ?? 'none'}"${evenOdd}/>`
    } else if (set.type === 'fillSketch') {
      const weight = options.fillWeight < 0 ? options.strokeWidth / 2 : options.fillWeight
      out += `<path d="${d}" fill="none" stroke="${options.fill ?? 'none'}" stroke-width="${weight}" stroke-linecap="round"/>`
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Freedraw & text
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  // Entity strings are concatenated so no tooling rewrites them.
  return value
    .replaceAll('&', '&' + 'amp;')
    .replaceAll('<', '&' + 'lt;')
    .replaceAll('>', '&' + 'gt;')
    .replaceAll('"', '&' + 'quot;')
    .replaceAll("'", '&' + '#39;')
}

/** Freedraw strokes fill a single smoothed path (no rough.js involved). */
function freedrawToPathData(element: OpenDrawFreedrawElement): string {
  const commands = outlineCommands(getFreedrawOutline(element))
  if (commands.length === 0) {
    return ''
  }
  const parts: string[] = []
  for (const command of commands) {
    const v = command.values
    if (command.kind === 'M') {
      parts.push(`M ${formatNumber(v[0] ?? 0)} ${formatNumber(v[1] ?? 0)}`)
    } else {
      parts.push(
        `Q ${formatNumber(v[0] ?? 0)} ${formatNumber(v[1] ?? 0)}, ${formatNumber(v[2] ?? 0)} ${formatNumber(v[3] ?? 0)}`,
      )
    }
  }
  parts.push('Z')
  return parts.join(' ')
}

function textAnchorOf(align: OpenDrawTextElement['textAlign']): string {
  if (align === 'center') {
    return 'middle'
  }
  return align === 'right' ? 'end' : 'start'
}

/** Text lines as `<text>` nodes, matching the canvas baseline math. */
function textToSvg(element: OpenDrawTextElement, dark: boolean): string {
  const fill = themeColor(element.strokeColor, dark)
  const anchorX =
    element.textAlign === 'center' ? element.width / 2 : element.textAlign === 'right' ? element.width : 0
  const anchor = textAnchorOf(element.textAlign)
  const lineStep = element.fontSize * element.lineHeight
  const lines = textLines(element.text)
  const parts: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const y = i * lineStep + element.fontSize
    parts.push(
      `<text x="${formatNumber(anchorX)}" y="${formatNumber(y)}" font-family="${escapeXml(FONT_STACKS[element.fontFamily])}" font-size="${element.fontSize}" fill="${fill}" text-anchor="${anchor}">${escapeXml(lines[i] ?? '')}</text>`,
    )
  }
  return parts.join('')
}

// ---------------------------------------------------------------------------
// Element & scene assembly
// ---------------------------------------------------------------------------

/**
 * One element as a positioned `<g>`: translate to the element origin, rotate
 * around its center — the same transform the canvas renderer applies.
 */
function elementToSvg(element: OpenDrawElement, dark: boolean, background: string): string {
  const rotate =
    element.angle !== 0
      ? ` rotate(${formatNumber((element.angle * 180) / Math.PI)} ${formatNumber(element.width / 2)} ${formatNumber(element.height / 2)})`
      : ''
  const opacity = element.opacity !== 100 ? ` opacity="${element.opacity / 100}"` : ''
  let body = ''
  switch (element.type) {
    case 'rectangle':
    case 'diamond':
    case 'ellipse':
    case 'line':
    case 'arrow': {
      for (const drawable of getElementDrawables(element, dark, background)) {
        body += drawableToSvgPaths(drawable)
      }
      break
    }
    case 'freedraw': {
      const d = freedrawToPathData(element)
      if (d) {
        body += `<path d="${d}" stroke="none" fill="${themeColor(element.strokeColor, dark)}"/>`
      }
      break
    }
    case 'text':
      body += textToSvg(element, dark)
      break
    case 'image': {
      // The data URL keeps the file self-contained; images are user content
      // and are never theme-inverted.
      if (element.dataUrl) {
        body += `<image href="${escapeXml(element.dataUrl)}" x="0" y="0" width="${formatNumber(element.width)}" height="${formatNumber(element.height)}"/>`
      }
      break
    }
    case 'frame': {
      // FRAME_STYLE: a thin rounded outline and a 14px name above it.
      const stroke = themeColor('#bbbbbb', dark)
      const name = dark ? '#7a7a7a' : '#999999'
      body += `<rect x="0" y="0" width="${formatNumber(element.width)}" height="${formatNumber(element.height)}" rx="8" ry="8" fill="none" stroke="${stroke}" stroke-width="2"/>`
      body += `<text x="0" y="${formatNumber(-6)}" font-family="${escapeXml(FRAME_NAME_STYLE.fontFamily)}" font-size="${FRAME_NAME_STYLE.fontSize}" fill="${name}">${escapeXml(frameTitle(element))}</text>`
      break
    }
    case 'stickynote': {
      const shadow = stickyNoteSvgPath(stickyNotePathCommands(element, { shadow: true }))
      const paper = stickyNoteSvgPath(stickyNotePathCommands(element))
      body += `<path d="${shadow}" fill="rgba(0, 0, 0, ${STICKY_NOTE_SHADOW_OPACITY})"/>`
      body += `<path d="${paper}" fill="${themeColor(element.backgroundColor, dark)}"/>`
      const footer = stickyNoteFooter(element)
      if (footer) {
        body += `<text x="${formatNumber(footer.x)}" y="${formatNumber(footer.y)}" text-anchor="end" font-family="${escapeXml(STICKY_NOTE_FOOTER.fontFamily)}" font-size="${STICKY_NOTE_FOOTER.fontSize}" fill="${themeColor(element.strokeColor, dark)}">${escapeXml(footer.text)}</text>`
      }
      break
    }
  }
  if (!body) {
    return ''
  }
  return `<g transform="translate(${formatNumber(element.x)} ${formatNumber(element.y)})${rotate}"${opacity}>${body}</g>`
}

/**
 * Serializes a scene to a standalone SVG document. The viewBox is the
 * content bounds (plus padding) in scene coordinates, so elements keep
 * their absolute positions and the output scales losslessly.
 */
export function exportToSvg(
  elements: readonly OpenDrawElement[],
  viewBackgroundColor: string,
  options: ExportOptions = {},
): string {
  const padding = options.padding ?? 20
  const background = options.background ?? viewBackgroundColor
  const dark = (options.theme ?? 'light') === 'dark'

  const contentBounds =
    elements.length > 0
      ? inflateBounds(getCommonBounds(elements), padding)
      : { x1: -padding, y1: -padding, x2: padding, y2: padding }

  const width = Math.max(1, boundsWidth(contentBounds))
  const height = Math.max(1, boundsHeight(contentBounds))

  // The canvas background is user data — it is never dark-filtered.
  const backgroundRect =
    background.toLowerCase() === TRANSPARENT
      ? ''
      : `<rect x="${formatNumber(contentBounds.x1)}" y="${formatNumber(contentBounds.y1)}" width="${formatNumber(width)}" height="${formatNumber(height)}" fill="${background}"/>`

  let body = backgroundRect
  for (const element of elements) {
    // Outline arrowheads fill with the canvas color; a transparent export
    // has none, so they fall back to white like Excalidraw's export.
    body += elementToSvg(element, dark, background.toLowerCase() === TRANSPARENT ? '#ffffff' : background)
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(width)}" height="${formatNumber(height)}" ` +
    `viewBox="${formatNumber(contentBounds.x1)} ${formatNumber(contentBounds.y1)} ${formatNumber(width)} ${formatNumber(height)}">` +
    body +
    '</svg>'
  )
}

/** Triggers a browser download of the serialized SVG. */
export function downloadSVG(
  elements: readonly OpenDrawElement[],
  viewBackgroundColor: string,
  filename: string,
  options: ExportOptions = {},
): void {
  if (typeof document === 'undefined') {
    throw new Error('SVG download requires a browser environment')
  }
  const svg = exportToSvg(elements, viewBackgroundColor, options)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.svg') ? filename : `${filename}.svg`
  anchor.click()
  URL.revokeObjectURL(url)
}
