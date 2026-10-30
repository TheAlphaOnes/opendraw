import type { Point } from '@opendraw/core'
import type { TextContainer, OpenDrawElement } from '@opendraw/core'
import {
  boundTextOf,
  findElementAt,
  hitThreshold,
  isTextContainer,
  newTextElement,
  outermostGroupId,
  selectableTarget,
  textContainerAt,
} from '@opendraw/core'

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
  const style = ctx.appState
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
  ctx.finishToolUse()
  ctx.setEditing(element.id)
}

/**
 * Edits the label inside a shape — Excalidraw's container text. An
 * existing label re-opens; otherwise an empty centered label is created
 * directly above the shape in z-order. The shape stays the selection.
 */
export function editContainerText(rt: CanvasRuntime, container: TextContainer): void {
  const { ctx } = rt
  const existing = boundTextOf(ctx.elements, container.id)
  ctx.doc.beginStep()
  ctx.select(container.id)
  if (existing) {
    ctx.setEditing(existing.id)
    return
  }
  const { style, textStyle } = ctx.appState
  const label = newTextElement({
    x: container.x,
    y: container.y,
    text: '',
    containerId: container.id,
    verticalAlign: 'middle',
    style,
    textStyle: { ...textStyle, textAlign: 'center' },
  })
  ctx.doc.addElement(label, { after: container.id })
  ctx.setEditing(label.id)
}

/**
 * Starts text editing on whatever `target` is: a text element re-opens,
 * a container edits its label. Returns false for anything else.
 */
export function editTextOf(rt: CanvasRuntime, target: OpenDrawElement): boolean {
  if (target.type === 'text') {
    editTextElement(rt, target.id)
    return true
  }
  if (isTextContainer(target) && !target.locked) {
    editContainerText(rt, target)
    return true
  }
  return false
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
  if (ctx.activeTool !== 'selection') {
    return
  }
  // A pointerdown may have opened a "moving" step; discard it — the click
  // was really a double-click.
  if (rt.interaction.value.kind === 'moving') {
    ctx.doc.cancelStep()
    rt.interaction.value = { kind: 'none' }
  }
  const scenePoint = rt.toScene(event)
  const raw = findElementAt(ctx.elements, scenePoint, hitThreshold(ctx.viewport.zoom))
  const hit = raw ? selectableTarget(raw, ctx.elements) : null
  // Double-clicking a selected group enters it: the hit becomes the
  // selection (or its next inner group) — Excalidraw's editingGroupId.
  const groupId = hit ? outermostGroupId(hit, ctx.editingGroupId) : null
  if (hit && groupId && ctx.selectedGroupIds.includes(groupId)) {
    ctx.setEditingGroup(groupId)
    ctx.selectGrouped([hit.id])
    return
  }
  // A text element re-opens; a shape edits (or gains) its label.
  if (hit && editTextOf(rt, hit)) {
    return
  }
  // Inside an unfilled shape the press hits nothing, yet the shape still
  // takes the text — the area counts, not just the stroke.
  const container = textContainerAt(ctx.elements, scenePoint)
  if (container) {
    editContainerText(rt, container)
    return
  }
  if (!hit) {
    createTextAt(rt, scenePoint)
  }
}
