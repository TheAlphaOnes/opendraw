import type { Point, OpenDrawElement } from '@opendrawjs/core'
import {
  elementsUnderEraser,
  findElementAt,
  handleAt,
  hasBoundingBox,
  hitThreshold,
  isTextContainer,
  linearHandleAt,
  linearMidpointHandle,
  linearPointHandles,
  localPointOf,
  isLinearElement,
  newElement,
  newFreedrawElement,
  newFrameElement,
  newStickyNoteElement,
  newLinearElement,
  pointInSelectionFrame,
  pointsPatch,
  resolveTipBinding,
  selectableTarget,
  selectionFrameOf,
  startRotationAngle,
} from '@opendrawjs/core'

import { appendDraftPoint, finishLinearDraft } from './linearDraft.js'
import { setModifiers, type CanvasRuntime } from './runtime.js'
import {
  loneSelectedLinear,
  SELECTION_GRAB_PADDING,
  selectionHandleLayout,
  sideGrabAt,
  snapshotMovingSelection,
  snapshotSelection,
} from './selectionHits.js'
import { elementAtPointer, frameForNewElement } from './frameGestures.js'
import { createTextAt, editContainerText } from './textEntry.js'
import { tipModifiers } from './tipBinding.js'
import type { LaserTrail } from './laserTrail.js'

/** Shape tools that draft by dragging. */
const SHAPE_TOOLS = new Set(['rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'frame', 'stickynote'])

/** Pen/touch pressure, with mice reporting a neutral constant. */
export function pressureOf(event: PointerEvent): number {
  return event.pointerType === 'mouse' ? 0.5 : Math.max(0, Math.min(1, event.pressure))
}

/** Deletes everything the eraser swept between two scene points. */
export function eraseAlong(rt: CanvasRuntime, from: Point, to: Point): void {
  const elements = rt.ctx.elements
  const hits = elementsUnderEraser(elements, from, to, rt.ctx.viewport.zoom)
  if (hits.length > 0) {
    // Erasing a label erases its shape (and the shape takes the label).
    rt.ctx.doc.deleteElements(hits.map((el) => selectableTarget(el, elements).id))
  }
}

function draftElement(rt: CanvasRuntime, tool: string, at: Point): OpenDrawElement {
  const { style, shapeRoundness, arrowheads, arrowType } = rt.ctx.appState
  // A new element joins the frame it is drawn in; frames never nest.
  const frameId = tool === 'frame' ? null : (frameForNewElement(rt, at)?.id ?? null)
  if (tool === 'line') {
    return newLinearElement(tool, { x: at.x, y: at.y, style, frameId, points: [{ x: 0, y: 0 }], roundness: shapeRoundness })
  }
  if (tool === 'arrow') {
    return newLinearElement(tool, {
      x: at.x,
      y: at.y,
      style,
      frameId,
      points: [{ x: 0, y: 0 }],
      roundness: arrowType === 'round' ? 'round' : null,
      ...(arrowType === 'elbow' ? { elbowed: true } : {}),
      startArrowhead: arrowheads.start,
      endArrowhead: arrowheads.end,
    })
  }
  if (tool === 'frame') {
    return newFrameElement({ x: at.x, y: at.y, style })
  }
  if (tool === 'stickynote') {
    // Notes keep their own ink and paper (appState.stickyNoteStyle).
    return newStickyNoteElement({
      x: at.x,
      y: at.y,
      style: { ...style, ...rt.ctx.appState.stickyNoteStyle },
      frameId,
      roundness: shapeRoundness,
    })
  }
  return newElement(tool as 'rectangle' | 'diamond' | 'ellipse', {
    x: at.x,
    y: at.y,
    style,
    frameId,
    roundness: shapeRoundness,
  })
}

/**
 * pointerdown: decides which gesture starts. Order matters — pan beats
 * every tool, a live multi-point draft beats a fresh press, and with the
 * selection tool handles outrank borders, which outrank element hits,
 * which outrank the selection box, which outranks the marquee.
 */
export function onCanvasPointerDown(rt: CanvasRuntime, laser: LaserTrail, event: PointerEvent): void {
  const { ctx } = rt
  const host = rt.host
  if (!host) {
    return
  }
  // preventScroll: a focus-induced scroll would move the host rect between
  // this call and toScene(), silently offsetting every scene coordinate by
  // the scroll delta. Bites on any page where the canvas is partly
  // offscreen — the host is focused on every gesture start.
  host.focus({ preventScroll: true })
  // Untrusted/synthetic pointer events carry no active pointer entry, so
  // capture is best-effort: an automation or test event stream must not
  // abort the interaction state machine mid-handler.
  try {
    host.setPointerCapture(event.pointerId)
  } catch {
    // No active pointer with this id — continue without capture.
  }
  setModifiers(rt, event)
  // A new gesture starts from a clean slate — a stale highlight must not
  // survive into the next interaction.
  rt.suggestedBinding.value = null

  const scenePoint = rt.toScene(event)
  const tool = ctx.activeTool

  // Panning: middle button, hand tool, or space.
  if (event.button === 1 || tool === 'hand' || rt.spaceDown.value) {
    rt.interaction.value = { kind: 'panning', lastScreen: { x: event.clientX, y: event.clientY } }
    return
  }
  if (event.button !== 0) {
    return
  }

  // A press while a multi-point draft is live continues the draft when the
  // line/arrow tool is still armed; any other gesture finishes it first.
  if (rt.interaction.value.kind === 'draftingLinear') {
    if (tool === 'line' || tool === 'arrow') {
      appendDraftPoint(rt, scenePoint)
      return
    }
    finishLinearDraft(rt)
  }

  // Text tool: Excalidraw parity — a click on an existing text element
  // re-opens ITS editor (App.textTool resolves a "text" target before
  // falling through to free creation); anywhere else creates a new one.
  if (tool === 'text') {
    const raw = findElementAt(ctx.elements, scenePoint, hitThreshold(ctx.viewport.zoom))
    const hit = raw ? selectableTarget(raw, ctx.elements) : null
    if (hit?.type === 'text') {
      // Same shape as a creation: one open step the editor commits into,
      // the element selected, and the tool reverted to selection.
      ctx.doc.beginStep()
      ctx.select(hit.id)
      ctx.finishToolUse()
      ctx.setEditing(hit.id)
      return
    }
    // Clicking a shape with the text tool writes inside it (App.textTool).
    if (hit && isTextContainer(hit) && !hit.locked) {
      ctx.finishToolUse()
      editContainerText(rt, hit)
      return
    }
    createTextAt(rt, scenePoint)
    return
  }

  if (tool === 'eraser') {
    ctx.doc.beginStep()
    rt.interaction.value = { kind: 'erasing', lastScene: scenePoint }
    eraseAlong(rt, scenePoint, scenePoint)
    return
  }

  // Image tool: a press opens the file picker (Excalidraw parity — inserting
  // is a gesture, not a persistent mode).
  if (tool === 'image') {
    ctx.openImagePicker()
    return
  }

  // Laser: pure overlay ink, no document step.
  if (tool === 'laser') {
    laser.start(scenePoint)
    rt.interaction.value = { kind: 'laser' }
    return
  }

  if (SHAPE_TOOLS.has(tool)) {
    const element = draftElement(rt, tool, scenePoint)
    ctx.doc.beginStep()
    // Starting a new element drops the current selection (Excalidraw) — its
    // chrome would otherwise sit over the binding affordances.
    ctx.setEditingGroup(null)
    ctx.select(null)
    ctx.doc.addElement(element)
    rt.interaction.value = { kind: 'creating', elementId: element.id, originScene: scenePoint }
    // The start tip binds where the drag begins (Excalidraw's initial
    // binding): inside a shape at the press point, near one in orbit. Its
    // position settles once the end tip gives it a direction.
    if (isLinearElement(element)) {
      const mods = tipModifiers(event)
      const start = mods.skip
        ? null
        : resolveTipBinding(element, 'start', scenePoint, ctx.elements, ctx.viewport.zoom, { inside: mods.inside })
      if (start?.binding) {
        ctx.doc.forceUpdateElement(element.id, { startBinding: start.binding })
      }
      rt.suggestedBinding.value = start?.shape ? { shape: start.shape, pointer: scenePoint } : null
    }
    return
  }

  if (tool === 'freedraw') {
    const element = newFreedrawElement({
      x: scenePoint.x,
      y: scenePoint.y,
      style: ctx.appState.style,
      frameId: frameForNewElement(rt, scenePoint)?.id ?? null,
      simulatePressure: event.pointerType === 'mouse',
      points: [[0, 0, pressureOf(event)]],
    })
    ctx.doc.beginStep()
    ctx.select(null)
    ctx.doc.addElement(element)
    rt.interaction.value = { kind: 'freedrawing', elementId: element.id }
    return
  }

  pressWithSelectionTool(rt, event, scenePoint)
}

function pressWithSelectionTool(rt: CanvasRuntime, event: PointerEvent, scenePoint: Point): void {
  const { ctx } = rt
  const zoom = ctx.viewport.zoom

  // Point handles of a lone selected line/arrow outrank the box chrome —
  // Excalidraw grabs endpoints by their circles, never the corner boxes.
  const loneLinear = loneSelectedLinear(rt)
  if (loneLinear) {
    const pointHit = linearHandleAt(linearPointHandles(loneLinear), scenePoint, zoom)
    if (pointHit) {
      rt.interaction.value = {
        kind: 'movingPoint',
        elementId: loneLinear.id,
        index: pointHit.index,
        end:
          pointHit.index === 0
            ? 'start'
            : pointHit.index === loneLinear.points.length - 1
              ? 'end'
              : null,
      }
      ctx.doc.beginStep()
      return
    }
    const mid = linearMidpointHandle(loneLinear)
    if (mid && linearHandleAt([mid], scenePoint, zoom)) {
      // Pressing the segment midpoint inserts a point there and drags it —
      // the two-point line grows to three.
      ctx.doc.beginStep()
      const points = loneLinear.points.map((point) => ({ ...point }))
      points.splice(mid.index, 0, localPointOf(loneLinear, mid.at))
      ctx.doc.forceUpdateElement(loneLinear.id, pointsPatch(loneLinear, points))
      rt.interaction.value = { kind: 'movingPoint', elementId: loneLinear.id, index: mid.index, end: null }
      return
    }
  }

  const handle = handleAt(selectionHandleLayout(rt), scenePoint)
  if (handle === 'rotation') {
    const originals = snapshotSelection(rt)
    const frame = selectionFrameOf(originals)!
    rt.interaction.value = {
      kind: 'rotating',
      originals,
      frame,
      startAngle: startRotationAngle(frame, scenePoint),
    }
    ctx.doc.beginStep()
    return
  }
  if (handle) {
    rt.interaction.value = { kind: 'resizing', handle, originals: snapshotSelection(rt) }
    ctx.doc.beginStep()
    return
  }

  // Border grabbing: a press within a few pixels of the selection border
  // resizes from that side, like Excalidraw's side resizing.
  const frame = selectionFrameOf(ctx.selectedElements)
  if (frame) {
    const side = sideGrabAt(rt, scenePoint, frame)
    if (side) {
      rt.interaction.value = { kind: 'resizing', handle: side, originals: snapshotSelection(rt) }
      ctx.doc.beginStep()
      return
    }
  }

  const raw = elementAtPointer(rt, scenePoint)
  const hit = raw ? selectableTarget(raw, ctx.elements) : null
  if (hit) {
    const wasSelected = ctx.isIdSelected(hit.id)
    if (event.shiftKey) {
      // Shift toggles the hit's whole (visible) group in or out — and a
      // frame and its children are never selected together: adding a child
      // drops its selected frame.
      if (!wasSelected && hit.frameId !== null && ctx.isIdSelected(hit.frameId)) {
        ctx.select(ctx.selectedElements.filter((el) => el.id !== hit.frameId).map((el) => el.id))
      }
      ctx.selectGrouped([hit.id], 'toggle')
    } else if (!wasSelected) {
      // Pressing outside the edited group leaves it (Excalidraw's
      // clearSelection keeps editing only for a hit inside the group).
      const editing = ctx.editingGroupId
      if (editing && !hit.groupIds.includes(editing)) {
        ctx.setEditingGroup(null)
      }
      ctx.selectGrouped([hit.id])
    }
    // Locked elements stay selectable but immovable.
    if (ctx.selectedElements.every((el) => el.locked)) {
      rt.interaction.value = { kind: 'none' }
      return
    }
    // Excalidraw parity: pointerdown on an element inside a multi-selection
    // keeps the group so a drag moves it together; a no-drag click narrows
    // the selection to the hit on pointerup instead.
    rt.interaction.value = {
      kind: 'moving',
      originScene: scenePoint,
      originals: snapshotMovingSelection(rt),
      hitId: !event.shiftKey && wasSelected ? hit.id : null,
      didDrag: false,
      duplicated: false,
    }
    ctx.doc.beginStep()
    return
  }

  // Pressing inside the current selection's frame grabs the whole
  // selection — Excalidraw's common-bounding-box grab, extended to lone
  // selections so an unfilled shape drags from its middle, not just its
  // outline. Shift keeps the add-to-selection gesture instead.
  if (
    frame &&
    hasBoundingBox(ctx.selectedElements) &&
    !event.shiftKey &&
    !ctx.selectedElements.every((el) => el.locked) &&
    pointInSelectionFrame(frame, scenePoint, SELECTION_GRAB_PADDING / zoom)
  ) {
    rt.interaction.value = {
      kind: 'moving',
      originScene: scenePoint,
      originals: snapshotMovingSelection(rt),
      // No element was pressed, so a no-drag click keeps the selection.
      hitId: null,
      didDrag: false,
      duplicated: false,
    }
    ctx.doc.beginStep()
    return
  }

  // Empty space: marquee. Shift keeps the existing selection as a base.
  rt.interaction.value = {
    kind: 'marquee',
    originScene: scenePoint,
    baseIds: event.shiftKey ? ctx.selectedElements.map((el) => el.id) : [],
  }
  if (!event.shiftKey) {
    // An empty-canvas press leaves the edited group with the selection.
    ctx.setEditingGroup(null)
    ctx.select(null)
  }
  rt.marquee.value = null
}
