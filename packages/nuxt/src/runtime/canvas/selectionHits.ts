import type {
  HandleBox,
  HandleDirection,
  Point,
  SelectionFrame,
  OpenDrawBindableShape,
  OpenDrawElement,
  OpenDrawLinearElement,
} from '@opendraw/core'
import { getHandleLayout, isLinearElement, selectionFrameOf, sideHandleAt } from '@opendraw/core'

import type { CanvasRuntime } from './runtime.js'

/**
 * Screen-px slack around the selection frame that still grabs (moves) the
 * selection — Excalidraw sums its collision threshold (≈8px) and handle
 * spacing (4px) into roughly this padding.
 */
export const SELECTION_GRAB_PADDING = 12

/** The transform handles of the current selection, zoom-aware. */
export function selectionHandleLayout(rt: CanvasRuntime): readonly HandleBox[] {
  const selected = rt.ctx.selectedElements.value
  if (selected.length === 0) {
    return []
  }
  const frame = selectionFrameOf(selected)
  if (!frame) {
    return []
  }
  return getHandleLayout(frame, { zoom: rt.ctx.viewport.value.zoom, pointer: 'mouse' })
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
  const selected = rt.ctx.selectedElements.value
  const only = selected.length === 1 ? selected[0] : null
  if (only && isLinearElement(only) && only.points.length <= 2) {
    return null
  }
  return sideHandleAt(frame, point, rt.ctx.viewport.value.zoom)
}

/** The lone selected, unlocked line/arrow — or null. */
export function loneSelectedLinear(rt: CanvasRuntime): OpenDrawLinearElement | null {
  const selected = rt.ctx.selectedElements.value
  const only = selected.length === 1 ? selected[0] : null
  return only && !only.locked && isLinearElement(only) ? only : null
}

/** Both-end probe results, deduped — a drag from a shape onto itself outlines it once. */
export function mergeBindingCandidates(
  shapes: ReadonlyArray<OpenDrawBindableShape | null>,
): readonly OpenDrawBindableShape[] {
  const merged: OpenDrawBindableShape[] = []
  const seen = new Set<string>()
  for (const shape of shapes) {
    if (shape && !seen.has(shape.id)) {
      seen.add(shape.id)
      merged.push(shape)
    }
  }
  return merged
}

/** Live copies of the selection — the pointerdown snapshot transforms read. */
export function snapshotSelection(rt: CanvasRuntime): readonly OpenDrawElement[] {
  return rt.ctx.selectedElements.value.map((el) => rt.ctx.doc.getElement(el.id) ?? el)
}
