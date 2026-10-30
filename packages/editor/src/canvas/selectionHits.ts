import type {
  HandleBox,
  HandleDirection,
  Point,
  SelectionFrame,
  OpenDrawElement,
  OpenDrawLinearElement,
} from '@opendraw/core'
import {
  getHandleLayout,
  hasBoundingBox,
  isFrameElement,
  isLinearElement,
  selectionFrameOf,
  sideHandleAt,
  withFrameChildren,
} from '@opendraw/core'

import type { CanvasRuntime } from './runtime.js'

/**
 * Screen-px slack around the selection frame that still grabs (moves) the
 * selection — Excalidraw sums its collision threshold (≈8px) and handle
 * spacing (4px) into roughly this padding.
 */
export const SELECTION_GRAB_PADDING = 12

/** The transform handles of the current selection, zoom-aware. */
export function selectionHandleLayout(rt: CanvasRuntime): readonly HandleBox[] {
  const selected = rt.ctx.selectedElements
  // A lone two-point line/arrow has no box, hence no transform handles.
  if (selected.length === 0 || !hasBoundingBox(selected)) {
    return []
  }
  const frame = selectionFrameOf(selected)
  if (!frame) {
    return []
  }
  // Frames never rotate (Excalidraw drops the handle for any selected frame).
  const showRotation = !selected.some(isFrameElement)
  return getHandleLayout(frame, { zoom: rt.ctx.viewport.zoom, pointer: 'mouse', showRotation })
}

/**
 * The side a border press grabs for a resize, honoring Excalidraw's
 * exclusion: a lone two-point linear never side-resizes.
 */
export function sideGrabAt(
  rt: CanvasRuntime,
  point: Point,
  frame: SelectionFrame,
): HandleDirection | null {
  const selected = rt.ctx.selectedElements
  const only = selected.length === 1 ? selected[0] : null
  if (only && isLinearElement(only) && only.points.length <= 2) {
    return null
  }
  return sideHandleAt(frame, point, rt.ctx.viewport.zoom)
}

/** The lone selected, unlocked line/arrow — or null. */
export function loneSelectedLinear(rt: CanvasRuntime): OpenDrawLinearElement | null {
  const selected = rt.ctx.selectedElements
  const only = selected.length === 1 ? selected[0] : null
  return only && !only.locked && isLinearElement(only) ? only : null
}

/** Live copies of the selection — the pointerdown snapshot transforms read. */
export function snapshotSelection(rt: CanvasRuntime): readonly OpenDrawElement[] {
  return rt.ctx.selectedElements.map((el) => rt.ctx.doc.getElement(el.id) ?? el)
}

/** What a drag of the selection moves: the selection plus its frames' children. */
export function snapshotMovingSelection(rt: CanvasRuntime): readonly OpenDrawElement[] {
  const ids = rt.ctx.selectedElements.map((el) => el.id)
  return withFrameChildren(rt.ctx.elements, ids).map((el) => rt.ctx.doc.getElement(el.id) ?? el)
}
