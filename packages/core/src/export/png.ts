/**
 * PNG export — renders a scene to an offscreen canvas by pointing the
 * viewport at the content bounds. Browser-only by design; callers in SSR
 * contexts must guard (the component only exposes this on user action).
 */

import { getCommonBounds, inflateBounds, boundsWidth, boundsHeight } from '../geometry/bounds.js'
import { renderScene, type SceneImageResolver } from '../render/renderScene.js'
import type { ThemeName, VueDrawElement } from '../types.js'

export interface ExportOptions {
  /** Whitespace around content, in scene px. */
  padding?: number
  /** Output pixels per scene px. */
  scale?: number
  /** Background color; defaults to the app background. 'transparent' supported. */
  background?: string
  theme?: ThemeName
  /** Decoded-bitmap supply for image elements — required to composite them. */
  resolveImage?: SceneImageResolver
}

function requireDocument(): Document {
  if (typeof document === 'undefined') {
    throw new Error('PNG export requires a browser environment')
  }
  return document
}

/** Renders elements to a fresh offscreen canvas sized to their bounds. */
export function exportToCanvas(
  elements: readonly VueDrawElement[],
  viewBackgroundColor: string,
  options: ExportOptions = {},
): HTMLCanvasElement {
  const doc = requireDocument()
  const padding = options.padding ?? 20
  const scale = options.scale ?? 1
  const background = options.background ?? viewBackgroundColor

  const contentBounds =
    elements.length > 0
      ? inflateBounds(getCommonBounds(elements), padding)
      : { x1: -padding, y1: -padding, x2: padding, y2: padding }

  const width = Math.max(1, Math.ceil(boundsWidth(contentBounds) * scale))
  const height = Math.max(1, Math.ceil(boundsHeight(contentBounds) * scale))

  const canvas = doc.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('could not acquire 2d context for export')
  }

  renderScene(ctx, {
    elements,
    appState: {
      theme: options.theme ?? 'light',
      viewBackgroundColor: background,
      viewport: {
        scrollX: -contentBounds.x1,
        scrollY: -contentBounds.y1,
        zoom: scale,
      },
      gridSize: null,
      editingId: null,
    },
    canvasSize: { width, height },
    dpr: 1,
    resolveImage: options.resolveImage,
  })
  return canvas
}

export function exportToDataURL(
  elements: readonly VueDrawElement[],
  viewBackgroundColor: string,
  options: ExportOptions = {},
): string {
  const canvas = exportToCanvas(elements, viewBackgroundColor, options)
  return canvas.toDataURL('image/png')
}

export function exportToBlob(
  elements: readonly VueDrawElement[],
  viewBackgroundColor: string,
  options: ExportOptions = {},
): Promise<Blob> {
  const canvas = exportToCanvas(elements, viewBackgroundColor, options)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('canvas toBlob returned null'))
      }
    }, 'image/png')
  })
}

/** Triggers a browser download of the rendered PNG. */
export function downloadPNG(
  elements: readonly VueDrawElement[],
  viewBackgroundColor: string,
  filename: string,
  options: ExportOptions = {},
): void {
  const doc = requireDocument()
  const url = exportToDataURL(elements, viewBackgroundColor, options)
  const a = doc.createElement('a')
  a.href = url
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  a.click()
}
