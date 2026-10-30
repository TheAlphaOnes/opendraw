import { computed, type ComputedRef } from 'vue'

import {
  findElementAt,
  handleAt,
  hitThreshold,
  isTextContainer,
  linearHandleAt,
  linearMidpointHandle,
  linearPointHandles,
  pointInSelectionFrame,
  resizeCursorFor,
  selectionFrameOf,
} from '@opendraw/core'

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
export function useCanvasCursor(rt: CanvasRuntime): ComputedRef<string> {
  const { ctx } = rt
  return computed(() => {
    const active = rt.interaction.value
    if (active.kind === 'panning' || active.kind === 'rotating') {
      return 'grabbing'
    }
    if (active.kind === 'resizing') {
      const angle = selectionFrameOf(ctx.selectedElements.value)?.angle ?? 0
      return resizeCursorFor(active.handle, angle)
    }
    if (active.kind === 'moving' || active.kind === 'movingPoint') {
      return 'move'
    }
    const tool = ctx.activeTool.value
    if (tool === 'hand') {
      return 'grab'
    }
    if (tool === 'text') {
      const point = rt.hoverScene.value
      const hit = point ? findElementAt(ctx.elements.value, point, hitThreshold(ctx.viewport.value.zoom)) : null
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
    const zoom = ctx.viewport.value.zoom
    const frame = selectionFrameOf(ctx.selectedElements.value)
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
      if (pointInSelectionFrame(frame, point, SELECTION_GRAB_PADDING / zoom)) {
        return 'move'
      }
    }
    const hit = findElementAt(ctx.elements.value, point, hitThreshold(zoom))
    return hit && !hit.locked ? 'move' : 'default'
  })
}
