import type { Point } from '@vuedraw/core'
import {
  bindableShapeAt,
  computeLinearBindings,
  isLinearElement,
  localPointOf,
  maxBindingDistance,
  pointsPatch,
} from '@vuedraw/core'

import type { CanvasRuntime } from './runtime.js'

/**
 * Multi-point line/arrow drafting — Excalidraw's `multiElement` flow. A
 * no-drag click with the line or arrow tool parks the first point; every
 * later click appends one until Enter, Escape or a double-click ends it.
 */

/**
 * Beyond this many scene px from the last committed point, a press commits
 * the temp point and starts a fresh one; inside it, a press retreats the
 * temp (Excalidraw's LINE_CONFIRM_THRESHOLD).
 */
const LINE_CONFIRM_THRESHOLD = 8

/**
 * A press in the live multi-point draft:
 *   — no temp yet: a press beyond the threshold spins one up; inside the
 *     zone the press is swallowed (the cursor sits on the committed tip);
 *   — temp live: a press beyond the threshold commits it and pushes a new
 *     temp at the press; a press back inside the zone retreats (pops the
 *     temp), which is also how a double-click's second press unwinds it.
 */
export function appendDraftPoint(rt: CanvasRuntime, at: Point): void {
  const { ctx } = rt
  const draft = rt.interaction.value
  if (draft.kind !== 'draftingLinear') {
    return
  }
  const el = ctx.doc.getElement(draft.elementId)
  if (!el || !isLinearElement(el)) {
    rt.interaction.value = { kind: 'none' }
    return
  }
  const local = localPointOf(el, at)
  const points = el.points.map((point) => ({ ...point }))
  const lastCommitted = points[draft.committedCount - 1]
  if (!lastCommitted) {
    return
  }
  const distance = Math.hypot(at.x - (el.x + lastCommitted.x), at.y - (el.y + lastCommitted.y))
  if (points.length === draft.committedCount) {
    // No temp: beyond the threshold a fresh temp starts following.
    if (distance >= LINE_CONFIRM_THRESHOLD) {
      points.push({ ...local })
      ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
    }
    return
  }
  if (distance < LINE_CONFIRM_THRESHOLD) {
    // Retreat — but never below the first committed point plus one.
    if (points.length > 2) {
      ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points.slice(0, -1)))
    }
    return
  }
  // Commit the temp where it parks and let a fresh temp follow the press.
  points.push({ ...local })
  rt.interaction.value = {
    kind: 'draftingLinear',
    elementId: el.id,
    committedCount: draft.committedCount + 1,
  }
  ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
  // Binding feedback for the tip that just parked.
  const shape = bindableShapeAt(
    ctx.elements.value,
    at,
    maxBindingDistance(ctx.viewport.value.zoom),
    el.id,
  )
  rt.bindingCandidates.value = shape ? [shape] : []
}

/** The trailing temp point follows the cursor between clicks. */
export function trackDraftPointer(rt: CanvasRuntime, scenePoint: Point): void {
  const { ctx } = rt
  const draft = rt.interaction.value
  if (draft.kind !== 'draftingLinear') {
    return
  }
  const el = ctx.doc.getElement(draft.elementId)
  if (!el || !isLinearElement(el)) {
    return
  }
  // If a retreat popped the temp, the first move spins a fresh one up.
  const points = el.points.map((point) => ({ ...point }))
  const local = localPointOf(el, scenePoint)
  if (points.length === draft.committedCount) {
    points.push({ ...local })
  } else {
    points[points.length - 1] = local
  }
  ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
  const shape = bindableShapeAt(
    ctx.elements.value,
    scenePoint,
    maxBindingDistance(ctx.viewport.value.zoom),
    el.id,
  )
  rt.bindingCandidates.value = shape ? [shape] : []
}

/**
 * Close the multi-point draft: the trailing temp is dropped, the remaining
 * polyline docks its tips like a fresh creation, and the step commits (or
 * cancels when fewer than two points remain).
 */
export function finishLinearDraft(rt: CanvasRuntime): void {
  const { ctx } = rt
  const draft = rt.interaction.value
  if (draft.kind !== 'draftingLinear') {
    return
  }
  rt.interaction.value = { kind: 'none' }
  rt.bindingCandidates.value = []
  const el = ctx.doc.getElement(draft.elementId)
  if (!el || !isLinearElement(el)) {
    return
  }
  const points = el.points.map((point) => ({ ...point }))
  // A live temp follows the cursor; a retreat may have popped it already
  // (the second press of a double-click does exactly that).
  if (points.length === draft.committedCount + 1) {
    points.pop()
  }
  if (points.length < 2) {
    ctx.doc.cancelStep()
    return
  }
  ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
  const binding = computeLinearBindings(
    { ...el, points },
    ctx.elements.value,
    maxBindingDistance(ctx.viewport.value.zoom),
  )
  if (binding) {
    ctx.doc.updateElement(el.id, binding)
  }
  ctx.doc.endStep()
  ctx.select(el.id)
  ctx.setActiveTool('selection')
}
