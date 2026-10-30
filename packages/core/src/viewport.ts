/**
 * Viewport math: mapping between scene coordinates and screen pixels.
 *
 * Screen px = (scene px + scroll) * zoom. Scroll lives in scene units, so
 * zooming about a fixed screen point only touches scroll + zoom.
 */

import type { Point, Viewport } from './types.js'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 30

export const DEFAULT_VIEWPORT: Viewport = {
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
}

export function sceneToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x + viewport.scrollX) * viewport.zoom,
    y: (point.y + viewport.scrollY) * viewport.zoom,
  }
}

export function screenToScene(point: Point, viewport: Viewport): Point {
  return {
    x: point.x / viewport.zoom - viewport.scrollX,
    y: point.y / viewport.zoom - viewport.scrollY,
  }
}

/** Screen px length → scene px length (tolerances, handle sizes). */
export function screenToSceneLength(length: number, zoom: number): number {
  return length / zoom
}

/**
 * Applies the full viewport transform to a context:
 * reset → dpr scale → zoom scale → scroll translate.
 * Everything drawn afterwards uses scene coordinates.
 */
export function applyViewportTransform(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  dpr: number,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.scale(viewport.zoom, viewport.zoom)
  ctx.translate(viewport.scrollX, viewport.scrollY)
}

export interface ZoomOptions {
  /** Screen px point to keep visually fixed (the pointer). */
  at: Point
  zoom: number
}

/** New viewport zoomed about a screen point. */
export function zoomViewport(viewport: Viewport, options: ZoomOptions): Viewport {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, options.zoom))
  const { at } = options
  return {
    zoom,
    scrollX: at.x / zoom - (at.x / viewport.zoom - viewport.scrollX),
    scrollY: at.y / zoom - (at.y / viewport.zoom - viewport.scrollY),
  }
}

/** New viewport panned by a screen-space delta (drag distance). */
export function panViewport(viewport: Viewport, dx: number, dy: number): Viewport {
  return {
    ...viewport,
    scrollX: viewport.scrollX + dx / viewport.zoom,
    scrollY: viewport.scrollY + dy / viewport.zoom,
  }
}

export interface FitViewportOptions {
  /** CSS-pixel size of the canvas. */
  size: { width: number; height: number }
  /**
   * `scale-down` never zooms past 100% (fit-all, Shift+1 / Shift+2);
   * `contain` fills the canvas at any zoom (Shift+3) — Excalidraw's
   * zoomToFitBounds fit modes.
   */
  fit: 'scale-down' | 'contain'
}

/**
 * The viewport that centers `bounds` and fits it on the canvas. Empty or
 * degenerate bounds keep the current zoom and only center.
 */
export function fitViewportToBounds(
  viewport: Viewport,
  bounds: { x1: number; y1: number; x2: number; y2: number },
  options: FitViewportOptions,
): Viewport {
  const { width, height } = options.size
  const boundsWidth = bounds.x2 - bounds.x1
  const boundsHeight = bounds.y2 - bounds.y1
  if (!Number.isFinite(boundsWidth) || !Number.isFinite(boundsHeight) || width <= 0 || height <= 0) {
    return viewport
  }
  let zoom = viewport.zoom
  if (boundsWidth > 0 || boundsHeight > 0) {
    const fitZoom = Math.min(
      boundsWidth > 0 ? width / boundsWidth : Number.POSITIVE_INFINITY,
      boundsHeight > 0 ? height / boundsHeight : Number.POSITIVE_INFINITY,
    )
    zoom = options.fit === 'scale-down' ? Math.min(fitZoom, 1) : fitZoom
  }
  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
  const centerX = (bounds.x1 + bounds.x2) / 2
  const centerY = (bounds.y1 + bounds.y2) / 2
  return {
    zoom,
    scrollX: width / 2 / zoom - centerX,
    scrollY: height / 2 / zoom - centerY,
  }
}
