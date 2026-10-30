import type { ElementPatch, OpenDrawLinearElement, Point } from '@opendraw/core'
import { isLinearElement, localPointOf, pointsPatch, scenePointOf } from '@opendraw/core'

import type { CanvasRuntime } from './runtime.js'
import { dragTipTo, type TipModifiers } from './tipBinding.js'

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
  // Excalidraw: a click while the temp tip orbits a shape other than the
  // start's binds there and finishes the arrow immediately.
  if (el.endBinding?.mode === 'orbit' && el.endBinding.elementId !== el.startBinding?.elementId) {
    rt.interaction.value = { kind: 'draftingLinear', elementId: el.id, committedCount: draft.committedCount + 1 }
    finishLinearDraft(rt)
    return
  }
  // Commit the temp where it parks and let a fresh temp follow the press.
  points.push({ ...local })
  rt.interaction.value = {
    kind: 'draftingLinear',
    elementId: el.id,
    committedCount: draft.committedCount + 1,
  }
  // The committed point is no tip any more: the fresh temp owns the end.
  const committed: ElementPatch<OpenDrawLinearElement> = { ...pointsPatch(el, points), endBinding: null }
  ctx.doc.forceUpdateElement(el.id, committed)
}

/** The trailing temp point follows the cursor between clicks, binding live. */
export function trackDraftPointer(rt: CanvasRuntime, scenePoint: Point, modifiers: TipModifiers): void {
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
  dragTipTo(rt, el.id, 'end', scenePoint, modifiers)
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
  rt.suggestedBinding.value = null
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
  const droppedTemp = points.length !== el.points.length
  ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
  // The temp's live binding went with it: the remaining last point binds
  // where it parked, by the same rules as a dragged tip.
  if (droppedTemp) {
    const last = scenePointOf(el, points[points.length - 1]!)
    dragTipTo(rt, el.id, 'end', last, { skip: false, inside: false })
    rt.suggestedBinding.value = null
  }
  ctx.doc.endStep()
  if (!ctx.toolLocked) {
    ctx.select(el.id)
  }
  ctx.finishToolUse()
}
