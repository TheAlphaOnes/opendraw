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
