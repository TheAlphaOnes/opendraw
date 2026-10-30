import type { Bounds, Point, OpenDrawElement } from '@opendraw/core'
import {
  bindableShapeAt,
  bindingFollowPatches,
  draftLinePoints,
  draftShapeRect,
  duplicateElements,
  elementsWithinBounds,
  isBoundText,
  isFreedrawElement,
  isLinearElement,
  maxBindingDistance,
  moveElements,
  moveLinearPoint,
  pointsPatch,
  resizeMultipleElements,
  resizeSingleElement,
  rotateElements,
} from '@opendraw/core'

import { trackDraftPointer } from './linearDraft.js'
import type { Interaction } from './runtime.js'
import { eraseAlong, pressureOf } from './pointerPress.js'
import { setModifiers, type CanvasRuntime } from './runtime.js'
import { mergeBindingCandidates } from './selectionHits.js'
import type { LaserTrail } from './useLaserTrail.js'

/**
 * Binding follow-through after a drag: lines and arrows bound to any of the
 * just-moved elements re-dock their tips onto the new geometry, and moved
 * linear elements glide along the edges of the shapes they are bound to.
 */
export function followBindings(rt: CanvasRuntime, originals: readonly OpenDrawElement[]): void {
  const movedIds = new Set(originals.map((el) => el.id))
  for (const [id, patch] of bindingFollowPatches(movedIds, rt.ctx.elements.value)) {
    rt.ctx.doc.updateElement(id, patch)
  }
}

/**
 * Alt-drag (Excalidraw's duplicateDraggedSelection): the originals stay
 * where the drag began and the drag continues on fresh duplicates, added
 * on top and selected — all inside the drag's own undo step.
 */
function duplicateDraggedSelection(
  rt: CanvasRuntime,
  drag: Extract<Interaction, { kind: 'moving' }>,
): void {
  const { ctx } = rt
  for (const original of drag.originals) {
    ctx.doc.forceUpdateElement(original.id, { x: original.x, y: original.y })
  }
  followBindings(rt, drag.originals)
  const copies = duplicateElements(drag.originals, { editingGroupId: ctx.editingGroupId.value })
  ctx.doc.addElements(copies, { select: true })
  drag.originals = copies
  drag.hitId = null
  drag.duplicated = true
}

/**
 * Idle pointer: feeds the hover cursor and, with a line/arrow tool,
 * outlines the shape a drag would bind to before the drag even starts.
 */
function handleIdleHover(rt: CanvasRuntime, scenePoint: Point): void {
  const { ctx } = rt
  rt.hoverScene.value = scenePoint
  const tool = ctx.activeTool.value
  if (tool === 'line' || tool === 'arrow') {
    const shape = bindableShapeAt(ctx.elements.value, scenePoint, maxBindingDistance(ctx.viewport.value.zoom))
    rt.bindingCandidates.value = shape ? [shape] : []
  } else if (rt.bindingCandidates.value.length > 0) {
    rt.bindingCandidates.value = []
  }
}

export function onCanvasPointerMove(rt: CanvasRuntime, laser: LaserTrail, event: PointerEvent): void {
  const { ctx } = rt
  setModifiers(rt, event)
  const current = rt.interaction.value
  const scenePoint = rt.toScene(event)
  if (current.kind === 'none') {
    handleIdleHover(rt, scenePoint)
    return
  }
  const modifiers = rt.modifiers.value

  switch (current.kind) {
    case 'panning': {
      const dx = event.clientX - current.lastScreen.x
      const dy = event.clientY - current.lastScreen.y
      current.lastScreen = { x: event.clientX, y: event.clientY }
      ctx.panBy(dx, dy)
      return
    }
    case 'marquee': {
      const bounds: Bounds = {
        x1: Math.min(current.originScene.x, scenePoint.x),
        y1: Math.min(current.originScene.y, scenePoint.y),
        x2: Math.max(current.originScene.x, scenePoint.x),
        y2: Math.max(current.originScene.y, scenePoint.y),
      }
      rt.marquee.value = bounds
      // Box selection takes what it wholly contains (Excalidraw's default
      // "contain" mode), and a contained member brings its whole group.
      const ids = new Set(current.baseIds)
      for (const el of elementsWithinBounds(ctx.elements.value, bounds)) {
        // Labels are part of their shape, never selected on their own.
        if (!isBoundText(el)) {
          ids.add(el.id)
        }
      }
      ctx.selectGrouped([...ids])
      return
    }
    case 'creating': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el) {
        return
      }
      if (isLinearElement(el)) {
        const points = draftLinePoints(current.originScene, scenePoint, modifiers)
        ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
        // Connect feedback: outline every shape the line would bind — the
        // one under the dragged tip AND the one the drag started on.
        // The draft is never rotated, so scene position is origin + point.
        const tip = points[points.length - 1]!
        const distance = maxBindingDistance(ctx.viewport.value.zoom)
        const startShape = bindableShapeAt(ctx.elements.value, current.originScene, distance, el.id)
        const tipShape = bindableShapeAt(
          ctx.elements.value,
          { x: el.x + tip.x, y: el.y + tip.y },
          distance,
          el.id,
        )
        rt.bindingCandidates.value = mergeBindingCandidates([startShape, tipShape])
      } else {
        ctx.doc.forceUpdateElement(el.id, draftShapeRect(current.originScene, scenePoint, modifiers))
      }
      return
    }
    case 'freedrawing': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el || !isFreedrawElement(el)) {
        return
      }
      const points = [...el.points, [scenePoint.x - el.x, scenePoint.y - el.y, pressureOf(event)]]
      ctx.doc.forceUpdateElement(el.id, { points })
      return
    }
    case 'moving': {
      const delta: Point = {
        x: scenePoint.x - current.originScene.x,
        y: scenePoint.y - current.originScene.y,
      }
      if (delta.x !== 0 || delta.y !== 0) {
        current.didDrag = true
        if (modifiers.alt && !current.duplicated) {
          duplicateDraggedSelection(rt, current)
        }
      }
      for (const { id, patch } of moveElements(current.originals, delta, ctx.gridSize.value)) {
        ctx.doc.forceUpdateElement(id, patch)
      }
      followBindings(rt, current.originals)
      return
    }
    case 'movingPoint': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el || !isLinearElement(el)) {
        return
      }
      ctx.doc.forceUpdateElement(el.id, moveLinearPoint(el, current.index, scenePoint))
      // Binding feedback while a tip is dragged: outline the shape it
      // would dock onto.
      if (current.end) {
        const shape = bindableShapeAt(
          ctx.elements.value,
          scenePoint,
          maxBindingDistance(ctx.viewport.value.zoom),
          el.id,
        )
        rt.bindingCandidates.value = shape ? [shape] : []
      }
      return
    }
    case 'draftingLinear':
      trackDraftPointer(rt, scenePoint)
      return
    case 'resizing': {
      if (current.originals.length === 1) {
        const original = current.originals[0]!
        ctx.doc.forceUpdateElement(original.id, resizeSingleElement(original, current.handle, scenePoint, modifiers))
      } else {
        for (const { id, patch } of resizeMultipleElements(current.originals, current.handle, scenePoint, modifiers)) {
          ctx.doc.forceUpdateElement(id, patch)
        }
      }
      followBindings(rt, current.originals)
      return
    }
    case 'rotating': {
      const patches = rotateElements(current.originals, current.frame, current.startAngle, scenePoint, modifiers)
      for (const { id, patch } of patches) {
        ctx.doc.forceUpdateElement(id, patch)
      }
      followBindings(rt, current.originals)
      return
    }
    case 'erasing':
      eraseAlong(rt, current.lastScene, scenePoint)
      current.lastScene = scenePoint
      return
    case 'laser':
      laser.extend(scenePoint)
      return
  }
}
