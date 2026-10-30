import { isFreedrawElement, isLinearElement, rebindAfterDrag } from '@opendraw/core'

import type { LaserTrail } from './laserTrail.js'
import type { CanvasRuntime } from './runtime.js'

/** Box tools whose click-without-drag leaves nothing worth keeping. */
const BOX_TOOLS = new Set(['rectangle', 'diamond', 'ellipse', 'frame'])

/** pointerup / pointercancel: closes the live gesture's history step. */
export function onCanvasPointerUp(rt: CanvasRuntime, laser: LaserTrail, event: PointerEvent): void {
  const { ctx } = rt
  const current = rt.interaction.value
  rt.interaction.value = { kind: 'none' }
  rt.marquee.value = null
  rt.suggestedBinding.value = null
  const host = rt.host
  if (host?.hasPointerCapture(event.pointerId)) {
    host.releasePointerCapture(event.pointerId)
  }

  switch (current.kind) {
    case 'creating': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el) {
        return
      }
      if (isLinearElement(el) && (el.points.length < 2 || (el.points[1]!.x === 0 && el.points[1]!.y === 0))) {
        // Excalidraw's multi-point creation: a no-drag click parks the
        // first point and keeps the draft live — each later click beyond
        // the commit threshold appends a point until Enter, Escape or a
        // double-click ends it.
        ctx.doc.forceUpdateElement(el.id, { points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] })
        rt.interaction.value = { kind: 'draftingLinear', elementId: el.id, committedCount: 1 }
        return
      }
      if (BOX_TOOLS.has(el.type) && el.width < 2 && el.height < 2) {
        ctx.doc.cancelStep()
        return
      }
      // A line/arrow was bound live while its end was dragged; the binding
      // is already part of the draw's undo step.
      ctx.doc.endStep()
      // A locked tool keeps drawing, so nothing gets selected in between
      // (App.tsx selects the new element only when the tool reverts).
      if (!ctx.toolLocked) {
        ctx.select(el.id)
      }
      ctx.finishToolUse()
      return
    }
    case 'freedrawing': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el || !isFreedrawElement(el) || el.points.length < 2) {
        ctx.doc.cancelStep()
        return
      }
      // Excalidraw parity: the pen stays armed for the next stroke and the
      // stroke is not selected (App.tsx excludes freedraw from both).
      ctx.doc.endStep()
      return
    }
    case 'moving': {
      // A line or arrow dragged on its own rebinds to whatever its tips
      // landed on (or unbinds) — one moved with its bound shapes keeps
      // its bindings. Folded into the drag's own undo step.
      if (current.didDrag) {
        const movedIds = new Set(current.originals.map((el) => el.id))
        for (const original of current.originals) {
          const el = ctx.doc.getElement(original.id)
          if (!el || !isLinearElement(el)) {
            continue
          }
          const bound = [el.startBinding, el.endBinding].filter((b) => b !== null)
          if (bound.length > 0 && bound.every((b) => movedIds.has(b.elementId))) {
            continue
          }
          ctx.doc.updateElement(el.id, rebindAfterDrag(el, ctx.elements, ctx.viewport.zoom))
        }
      }
      ctx.doc.endStep()
      // A no-drag click on an element inside a multi-selection narrows the
      // selection to it; a drag moved the whole group instead.
      if (!current.didDrag && current.hitId) {
        ctx.selectGrouped([current.hitId])
      }
      return
    }
    case 'movingPoint': {
      // The dragged tip was bound (or unbound) live as it moved.
      ctx.doc.endStep()
      return
    }
    case 'draftingLinear':
      // The commit/retreat logic lives on pointerdown (Excalidraw's
      // multiElement flow) — the release just keeps the draft live.
      rt.interaction.value = current
      return
    case 'laser':
      laser.end()
      return
    case 'resizing':
    case 'rotating':
    case 'erasing':
      ctx.doc.endStep()
      return
    default:
      return
  }
}

export function onCanvasPointerLeave(rt: CanvasRuntime): void {
  // Mid-gesture the capture owns the pointer; only an idle leave clears.
  if (rt.interaction.value.kind === 'none') {
    rt.hoverScene.value = null
    rt.suggestedBinding.value = null
  }
}
