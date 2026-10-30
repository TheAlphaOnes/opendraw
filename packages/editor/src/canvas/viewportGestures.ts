import {
  findElementAt,
  hitThreshold,
  pointInSelectionFrame,
  screenToScene,
  selectableTarget,
  selectionFrameOf,
} from '@opendrawjs/core'

import { imageFilesOf } from '../services/image.service.js'
import type { CanvasRuntime } from './runtime.js'

/**
 * One ctrl/cmd+wheel zoom step, in zoom units — Excalidraw's ZOOM_STEP
 * (packages/common/src/constants.ts). Wheel ticks clamp their delta to
 * this step so a single mouse notch moves one step, while a trackpad
 * pinch's small ticks land per-tick.
 */
const WHEEL_ZOOM_STEP = 0.1

/** Wheel: zoom with ctrl/cmd (and trackpad pinch), pan otherwise. */
export function onCanvasWheel(rt: CanvasRuntime, event: WheelEvent): void {
  event.preventDefault()
  if (!rt.host) {
    return
  }
  const { ctx } = rt
  if (event.ctrlKey || event.metaKey) {
    // Excalidraw parity (App.wheel.ts `zoomBy`): the delta clamps to one
    // step, the zoom moves linearly by it, and a small trackpad delta gets
    // amplified by how far past 100% the canvas already is — so a wheel
    // notch is a fixed step and a pinch accelerates smoothly. zoomAt
    // anchors the new zoom at the cursor and clamps to [MIN_ZOOM, MAX_ZOOM].
    const sign = Math.sign(event.deltaY)
    const absDelta = Math.abs(event.deltaY)
    const maxStep = WHEEL_ZOOM_STEP * 100
    const delta = absDelta > maxStep ? maxStep * sign : event.deltaY
    const zoom = ctx.viewport.zoom
    let nextZoom = zoom - delta / 100
    nextZoom += Math.log10(Math.max(1, zoom)) * -sign * Math.min(1, absDelta / 20)
    ctx.zoomAt(rt.toHost(event), nextZoom)
    return
  }
  if (event.shiftKey) {
    ctx.panBy(-event.deltaY, 0)
    return
  }
  ctx.panBy(0, -event.deltaY)
}

/** Dropped image files land under the pointer. */
export function onCanvasDrop(rt: CanvasRuntime, event: DragEvent): void {
  const images = imageFilesOf(event.dataTransfer?.files)
  if (images.length > 0) {
    rt.ctx.insertImageFiles(images, rt.toScene(event))
  }
}

/**
 * Pasted image files land at the visible canvas center — a paste has no
 * pointer position.
 */
export function onWindowPaste(rt: CanvasRuntime, event: ClipboardEvent): void {
  const { ctx } = rt
  if (ctx.editingId) {
    return
  }
  const images = imageFilesOf(event.clipboardData?.files)
  if (images.length === 0) {
    return
  }
  event.preventDefault()
  const size = ctx.viewportSize
  ctx.insertImageFiles(images, screenToScene({ x: size.width / 2, y: size.height / 2 }, ctx.viewport))
}

/** Where a context menu opened, and over what. */
export interface CanvasContextMenuRequest {
  x: number
  y: number
  /** `element` when the press landed on an element (now selected). */
  target: 'element' | 'canvas'
}

/**
 * Right-click: an element under the pointer joins the selection first (its
 * whole group, as a left click would), so the element menu acts on what
 * the user pointed at — Excalidraw's contextmenu handler.
 */
export function resolveContextMenu(rt: CanvasRuntime, event: MouseEvent): CanvasContextMenuRequest {
  const { ctx } = rt
  const scenePoint = rt.toScene(event)
  const raw = findElementAt(ctx.elements, scenePoint, hitThreshold(ctx.viewport.zoom))
  const hit = raw ? selectableTarget(raw, ctx.elements) : null
  if (hit && !ctx.isIdSelected(hit.id)) {
    const editing = ctx.editingGroupId
    if (editing && !hit.groupIds.includes(editing)) {
      ctx.setEditingGroup(null)
    }
    ctx.selectGrouped([hit.id])
  }
  // Excalidraw: a hit, or a press inside the selection's common box, opens
  // the element menu; anywhere else the canvas menu.
  const frame = selectionFrameOf(ctx.selectedElements)
  const insideSelection = frame !== null && pointInSelectionFrame(frame, scenePoint, 0)
  return { x: event.clientX, y: event.clientY, target: hit || insideSelection ? 'element' : 'canvas' }
}
