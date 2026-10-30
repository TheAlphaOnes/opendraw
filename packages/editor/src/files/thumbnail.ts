/**
 * Drawing previews for the files list: the scene rendered by core's PNG
 * export, scaled to fit a small card and encoded compactly (WebP where the
 * browser supports it — Safari falls back to PNG).
 *
 * Browser-only: callers schedule it off the interaction path (idle time,
 * after a debounce), since it re-renders the whole scene.
 */

import {
  boundsHeight,
  boundsWidth,
  exportToCanvas,
  getCommonBounds,
  inflateBounds,
  type ThemeName,
  type OpenDrawElement,
} from '@opendraw/core'

import { imageResolver } from '../services/image.service.js'

/** Preview box in device pixels (a 2x card of 160x100 CSS px). */
export const THUMBNAIL_WIDTH = 320
export const THUMBNAIL_HEIGHT = 200

const THUMBNAIL_PADDING = 24

export interface ThumbnailScene {
  elements: readonly OpenDrawElement[]
  viewBackgroundColor: string
  theme: ThemeName
}

/**
 * Renders the scene's content, fitted into the preview box, as a data URL;
 * null for an empty scene (the list shows a placeholder) or without a DOM.
 */
export function renderThumbnail(scene: ThumbnailScene): string | null {
  if (scene.elements.length === 0 || typeof document === 'undefined') {
    return null
  }
  const bounds = inflateBounds(getCommonBounds(scene.elements), THUMBNAIL_PADDING)
  // Fit, but never upscale a small sketch past 1:1 — it would only blur.
  const scale = Math.min(1, THUMBNAIL_WIDTH / boundsWidth(bounds), THUMBNAIL_HEIGHT / boundsHeight(bounds))
  const canvas = exportToCanvas(scene.elements, scene.viewBackgroundColor, {
    padding: THUMBNAIL_PADDING,
    scale,
    theme: scene.theme,
    resolveImage: imageResolver,
  })
  const webp = canvas.toDataURL('image/webp', 0.8)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}
