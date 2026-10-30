import {
  findElementAt,
  handleAt,
  hasBoundingBox,
  hitThreshold,
  isTextContainer,
  linearHandleAt,
  linearMidpointHandle,
  linearPointHandles,
  pointInSelectionFrame,
  resizeCursorFor,
  selectionFrameOf,
} from '@opendrawjs/core'

import { elementAtPointer } from './frameGestures.js'
import type { CanvasRuntime } from './runtime.js'
import {
  loneSelectedLinear,
  SELECTION_GRAB_PADDING,
  selectionHandleLayout,
  sideGrabAt,
} from './selectionHits.js'

/**
 * The CSS cursor advertises what a press would do right here — the same
 * precedence the press handler resolves: point handles, transform
 * handles, border sides, the selection box, then element hits.
 */
export function resolveCursor(rt: CanvasRuntime): string {
  const { ctx } = rt
  const active = rt.interaction.value
  if (active.kind === 'panning' || active.kind === 'rotating') {
    return 'grabbing'
  }
  if (active.kind === 'resizing') {
    const angle = selectionFrameOf(ctx.selectedElements)?.angle ?? 0
    return resizeCursorFor(active.handle, angle)
  }
  if (active.kind === 'moving' || active.kind === 'movingPoint') {
    return 'move'
  }
  const tool = ctx.activeTool
  if (tool === 'hand') {
    return 'grab'
  }
  if (tool === 'text') {
    const point = rt.hoverScene.value
    const hit = point ? findElementAt(ctx.elements, point, hitThreshold(ctx.viewport.zoom)) : null
    // Text and shapes that can hold text both take the text caret.
    return hit && (hit.type === 'text' || isTextContainer(hit)) ? 'text' : 'crosshair'
  }
  if (tool !== 'selection') {
    return 'crosshair'
  }
  if (rt.spaceDown.value) {
    return 'grab'
  }
  const point = rt.hoverScene.value
  if (!point) {
    return 'default'
  }
  const zoom = ctx.viewport.zoom
  const frame = selectionFrameOf(ctx.selectedElements)
  if (frame) {
    // Point handles advertise a point drag before the box chrome does.
    const loneLinear = loneSelectedLinear(rt)
    if (loneLinear) {
      const mid = linearMidpointHandle(loneLinear)
      if (
        linearHandleAt(linearPointHandles(loneLinear), point, zoom) ||
        (mid && linearHandleAt([mid], point, zoom))
      ) {
        return 'move'
      }
    }
    const handle = handleAt(selectionHandleLayout(rt), point)
    if (handle) {
      return resizeCursorFor(handle, frame.angle)
    }
    const side = sideGrabAt(rt, point, frame)
    if (side) {
      return resizeCursorFor(side, frame.angle)
    }
    if (hasBoundingBox(ctx.selectedElements) && pointInSelectionFrame(frame, point, SELECTION_GRAB_PADDING / zoom)) {
      return 'move'
    }
  }
  const hit = elementAtPointer(rt, point)
  return hit && !hit.locked ? 'move' : 'default'
}
