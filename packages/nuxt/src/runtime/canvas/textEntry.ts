import type { Point } from '@vuedraw/core'
import { findElementAt, hitThreshold, newTextElement } from '@vuedraw/core'

import { finishLinearDraft } from './linearDraft.js'
import type { CanvasRuntime } from './runtime.js'

/**
 * Text creation and re-entry. Every path opens ONE history step that the
 * mounted <TextEditor> closes on commit — create + type + commit undo as
 * a single gesture.
 */

/** Creates an empty text element centered vertically on the point and edits it. */
export function createTextAt(rt: CanvasRuntime, point: Point): void {
  const { ctx } = rt
  const style = ctx.appState.value
  const fontSize = style.textStyle.fontSize
  const element = newTextElement({
    x: point.x,
    y: point.y - fontSize * 1.25 * 0.5,
    style: style.style,
    text: '',
    textStyle: style.textStyle,
  })
  ctx.doc.beginStep()
  ctx.doc.addElement(element)
  ctx.select(element.id)
  ctx.setActiveTool('selection')
  ctx.setEditing(element.id)
}

/** Re-opens an existing text element's editor inside a fresh step. */
export function editTextElement(rt: CanvasRuntime, id: string): void {
  rt.ctx.doc.beginStep()
  rt.ctx.setEditing(id)
}

export function onCanvasDoubleClick(rt: CanvasRuntime, event: MouseEvent): void {
  const { ctx } = rt
  if (rt.interaction.value.kind === 'draftingLinear') {
    // The second press of a double-click appended its point already; the
    // dedup pass on its pointerup removed it. Finish here.
    finishLinearDraft(rt)
    return
  }
  if (ctx.activeTool.value !== 'selection') {
    return
  }
  // A pointerdown may have opened a "moving" step; discard it — the click
  // was really a double-click.
  if (rt.interaction.value.kind === 'moving') {
    ctx.doc.cancelStep()
    rt.interaction.value = { kind: 'none' }
  }
  const scenePoint = rt.toScene(event)
  const hit = findElementAt(ctx.elements.value, scenePoint, hitThreshold(ctx.viewport.value.zoom))
  if (hit && hit.type === 'text') {
    editTextElement(rt, hit.id)
    return
  }
  if (!hit) {
    createTextAt(rt, scenePoint)
  }
}
