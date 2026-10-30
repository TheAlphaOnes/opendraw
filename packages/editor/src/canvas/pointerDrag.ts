import type { Bounds, Point, OpenDrawElement } from '@opendraw/core'
import {
  bindableShapeAt,
  bindingFollowPatches,
  boundTipsPatch,
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
import { updateDragFrameHighlight, updateHoverFrameHighlight, updateResizingFrameHighlight } from './frameGestures.js'
import { dragTipTo, tipModifiers } from './tipBinding.js'
import type { Interaction } from './runtime.js'
import { eraseAlong, pressureOf } from './pointerPress.js'
import { setModifiers, type CanvasRuntime } from './runtime.js'
import type { LaserTrail } from './laserTrail.js'

/**
 * Binding follow-through after a drag: lines and arrows bound to any of the
 * just-moved elements re-dock their tips onto the new geometry, and moved
 * linear elements glide along the edges of the shapes they are bound to.
 */
export function followBindings(rt: CanvasRuntime, originals: readonly OpenDrawElement[]): void {
  const movedIds = new Set(originals.map((el) => el.id))
  for (const [id, patch] of bindingFollowPatches(movedIds, rt.ctx.elements)) {
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
  const copies = duplicateElements(drag.originals, { editingGroupId: ctx.editingGroupId })
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
  updateHoverFrameHighlight(rt, scenePoint)
  const tool = ctx.activeTool
  if (tool === 'line' || tool === 'arrow') {
    // Hovering with a line/arrow tool previews the binding a press here
    // would make.
    const shape = bindableShapeAt(ctx.elements, scenePoint, maxBindingDistance(ctx.viewport.zoom))
    rt.suggestedBinding.value = shape ? { shape, pointer: scenePoint } : null
  } else if (rt.suggestedBinding.value) {
    rt.suggestedBinding.value = null
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
      for (const el of elementsWithinBounds(ctx.elements, bounds)) {
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
      if (isLinearElement(el) && el.elbowed) {
        // An elbow arrow follows the pointer with its end tip and re-routes;
        // its origin moves with the route, so the tip is set in scene space.
        dragTipTo(rt, el.id, 'end', scenePoint, tipModifiers(event))
        return
      }
      if (isLinearElement(el)) {
        // Shift locks the angle; the end tip then binds (or not) and every
        // bound tip snaps live — the draft is never rotated, so the scene
        // tip is origin + point.
        const points = draftLinePoints(current.originScene, scenePoint, modifiers)
        // Lay the draft's two points down first (a fresh draft holds only
        // its start), then let the end tip bind.
        ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
        const end = points[points.length - 1]!
        dragTipTo(rt, el.id, 'end', { x: el.x + end.x, y: el.y + end.y }, tipModifiers(event))
      } else {
        // A note drags out square unless Shift frees it.
        const rectModifiers = el.type === 'stickynote' ? { ...modifiers, shift: !modifiers.shift } : modifiers
        ctx.doc.forceUpdateElement(el.id, draftShapeRect(current.originScene, scenePoint, rectModifiers))
        // A frame being drawn outlines what it will adopt.
        const drawn = ctx.doc.getElement(el.id)
        if (drawn?.type === 'frame') {
          updateResizingFrameHighlight(rt, [drawn])
        }
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
      for (const { id, patch } of moveElements(current.originals, delta, ctx.gridSize)) {
        ctx.doc.forceUpdateElement(id, patch)
      }
      followBindings(rt, current.originals)
      if (current.didDrag) {
        updateDragFrameHighlight(rt, scenePoint)
      }
      return
    }
    case 'movingPoint': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el || !isLinearElement(el)) {
        return
      }
      if (current.end) {
        // A tip: it binds (or unbinds) as it moves, like Excalidraw's
        // endpoint drag.
        dragTipTo(rt, el.id, current.end, scenePoint, tipModifiers(event))
        return
      }
      // An inner point: bound tips re-aim at the new neighbor.
      ctx.doc.forceUpdateElement(el.id, moveLinearPoint(el, current.index, scenePoint))
      const moved = ctx.doc.getElement(el.id)
      if (moved && isLinearElement(moved)) {
        const snapped = boundTipsPatch(moved, ctx.elements, { dragging: true })
        if (snapped) {
          ctx.doc.forceUpdateElement(el.id, snapped)
        }
      }
      return
    }
    case 'draftingLinear':
      trackDraftPointer(rt, scenePoint, tipModifiers(event))
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
      // A frame being resized outlines what it will hold.
      if (current.originals.some((el) => el.type === 'frame')) {
        updateResizingFrameHighlight(rt, ctx.selectedElements)
      }
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
