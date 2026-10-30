import type { OpenDrawElement, OpenDrawFrameElement, Point } from '@opendrawjs/core'
import {
  commonFrameId,
  elementsInResizingFrame,
  findElementAt,
  frameNameAt,
  hitThreshold,
  isFrameElement,
  topLayerFrameAt,
} from '@opendrawjs/core'

import type { CanvasRuntime } from './runtime.js'

/**
 * Frame-aware pointer queries, Excalidraw's frame interaction in App.tsx
 * and App.selectionTool.ts: which element a press grabs (a frame's name
 * label grabs the frame), which frame a new element joins, which frame a
 * dragged selection would drop into, and the highlights that preview it.
 */

/** Tools whose new elements join the frame under the pointer (isEligibleFrameChildType). */
const FRAME_CHILD_TOOLS = new Set([
  'rectangle',
  'stickynote',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'freedraw',
  'text',
  'image',
  'frame',
])

/**
 * The topmost element a press at the point grabs. A frame's name label sits
 * above every element (Excalidraw renders it as DOM over the canvas), so it
 * wins; otherwise the hit test decides (frames by outline only, children
 * never outside their frame).
 */
export function elementAtPointer(rt: CanvasRuntime, point: Point): OpenDrawElement | null {
  const { ctx } = rt
  const threshold = hitThreshold(ctx.viewport.zoom)
  return frameNameAt(ctx.elements, point, ctx.viewport.zoom, threshold) ?? findElementAt(ctx.elements, point, threshold)
}

/** The frame a new element drawn at the point belongs to, or null. */
export function frameForNewElement(rt: CanvasRuntime, point: Point): OpenDrawFrameElement | null {
  const { ctx } = rt
  return topLayerFrameAt(ctx.elements, point, { hit: findElementAt(ctx.elements, point, hitThreshold(ctx.viewport.zoom)) })
}

/**
 * The frame the selection would drop into at the point: the top-layer frame
 * under it, looking through the dragged elements themselves.
 */
export function dropFrameAt(rt: CanvasRuntime, point: Point): OpenDrawFrameElement | null {
  const { ctx } = rt
  const selected = ctx.selectedElements
  const excludeIds = new Set(selected.map((el) => el.id))
  const below = ctx.elements.filter((el) => !excludeIds.has(el.id))
  return topLayerFrameAt(ctx.elements, point, {
    excludeIds,
    currentFrameId: commonFrameId(selected),
    hit: findElementAt(below, point, hitThreshold(ctx.viewport.zoom)),
  })
}

/**
 * While dragging the selection: highlight the frame it would drop into,
 * none when a frame is among the dragged elements (frames never nest).
 */
export function updateDragFrameHighlight(rt: CanvasRuntime, point: Point): void {
  const draggingFrame = rt.ctx.selectedElements.some(isFrameElement)
  setFrameHighlight(rt, draggingFrame ? null : dropFrameAt(rt, point))
}

/** Idle pointer with a frame-child tool armed: preview the frame a press joins. */
export function updateHoverFrameHighlight(rt: CanvasRuntime, point: Point): void {
  setFrameHighlight(rt, FRAME_CHILD_TOOLS.has(rt.ctx.activeTool) ? frameForNewElement(rt, point) : null)
}

/** While a frame is drawn or resized: outline what it would hold. */
export function updateResizingFrameHighlight(rt: CanvasRuntime, frames: readonly OpenDrawElement[]): void {
  const held = frames.filter(isFrameElement).flatMap((frame) => elementsInResizingFrame(rt.ctx.elements, frame))
  rt.elementsToHighlight.value = held.length > 0 ? held : null
}

export function clearFrameHighlights(rt: CanvasRuntime): void {
  setFrameHighlight(rt, null)
  rt.elementsToHighlight.value = null
}

function setFrameHighlight(rt: CanvasRuntime, frame: OpenDrawFrameElement | null): void {
  if (rt.frameToHighlight.value !== frame) {
    rt.frameToHighlight.value = frame
  }
}
