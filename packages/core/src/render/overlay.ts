/**
 * Overlay rendering: in-progress previews and selection chrome, drawn in
 * scene coordinates on a transparent canvas layered above the scene.
 *
 * All sizes are screen pixels divided by zoom so the chrome stays
 * finger-constant at any zoom level. Layout math (which handles exist and
 * where) belongs to `../interaction/handles.js`; this module only paints.
 */

import type { VueDrawBindableShape } from '../elements/binding.js'
import { isLinearElement } from '../elements/factories.js'
import { clamp } from '../geometry/points.js'
import type { HandleBox, LinearHandle, PointerKind, SelectionFrame } from '../interaction/handles.js'
import {
  getHandleLayout,
  linearMidpointHandle,
  linearPointHandles,
  POINT_HANDLE_RADIUS,
  selectionFrameOf,
} from '../interaction/handles.js'
import type { Bounds, VueDrawAppState, VueDrawElement, VueDrawLinearElement } from '../types.js'
import { applyViewportTransform } from '../viewport.js'
import type { CanvasSize } from './renderScene.js'
import { PROPORTIONAL_RADIUS, renderElementShape } from './renderScene.js'
import { UI } from './theme.js'

export interface OverlayRenderInput {
  /** The committed selection. Empty when nothing is selected. */
  selectedElements: readonly VueDrawElement[]
  appState: Readonly<Pick<VueDrawAppState, 'theme' | 'viewport'>> & {
    editingId: string | null
  }
  pointer: PointerKind
  /** Marquee (drag-select) rect in scene coords, or null. */
  marquee: Bounds | null
  /** Elements being created/dragged right now, drawn before the chrome. */
  previewElements: readonly VueDrawElement[]
  /**
   * Shapes the live line/arrow probes would dock onto right now — the tip
   * being dragged, the shape the drag started on, or the shape under an
   * idle hover. Empty when nothing probes.
   */
  bindingCandidates: readonly VueDrawBindableShape[]
  canvasSize: CanvasSize
  dpr: number
}

/** Handle fill per theme — dark chrome sits on a dark canvas. */
const HANDLE_FILL_LIGHT = '#ffffff'
const HANDLE_FILL_DARK = '#121212'

/** Rounded-corner radius of resize handles, in screen px. */
const HANDLE_RADIUS_PX = 2

/** Marquee fill opacity — a whisper, not a wash. */
const MARQUEE_FILL_ALPHA = 0.06

export function renderOverlay(ctx: CanvasRenderingContext2D, input: OverlayRenderInput): void {
  const { selectedElements, appState, pointer, marquee, previewElements, bindingCandidates } = input
  const { theme, viewport, editingId } = appState
  const zoom = viewport.zoom
  const dark = theme === 'dark'

  // The overlay is transparent by design and nothing else wipes it, so each
  // frame starts by clearing the whole bitmap — under the identity transform,
  // in device pixels. Without this, moving chrome (selection borders, handles,
  // the marquee) trails behind the pointer and a deselect leaves its last
  // paint on the canvas forever.
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()

  ctx.save()
  applyViewportTransform(ctx, viewport, input.dpr)
  // No background fill: the overlay canvas is transparent by design.

  for (const element of previewElements) {
    renderElementShape(ctx, element, dark)
  }

  // Connect feedback: outline every shape the live line/arrow probes would
  // dock onto, before the selection chrome (a highlight never reads as a
  // selection). A drag from shape A to shape B outlines both at once.
  for (const candidate of bindingCandidates) {
    drawBindingHighlight(ctx, candidate, UI.selection, zoom)
  }

  // While a text element is being edited the DOM editor draws its own
  // affordances — any chrome here would only double it.
  const isEditingText =
    selectedElements.length === 1 && selectedElements[0]!.id === editingId

  if (selectedElements.length > 0 && !isEditingText) {
    const frame = selectionFrameOf(selectedElements)
    if (frame) {
      // Chrome colors are theme-stable by design: they are not element user
      // data, so they skip the dark filter (which would sink a light green
      // into the dark canvas).
      const accent =
        selectedElements.length === 1 && selectedElements[0]!.locked
          ? UI.locked
          : UI.selection
      if (selectedElements.length === 1) {
        drawSingleBorder(ctx, frame, accent, zoom)
      } else {
        drawGroupBorder(ctx, frame, accent, zoom)
      }
      drawHandles(ctx, getHandleLayout(frame, { zoom, pointer }), accent, zoom, dark)
      // A lone selected line/arrow also shows its point handles: filled
      // endpoint circles that drag tips, plus the hollow midpoint that
      // inserts a point — Excalidraw's selected-linear affordance.
      const only = selectedElements.length === 1 ? selectedElements[0]! : null
      if (only && isLinearElement(only)) {
        drawLinearPointHandles(ctx, only, accent, zoom, dark)
      }
    }
  }

  if (marquee) {
    drawMarquee(ctx, marquee, UI.selection, zoom)
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Selection borders
// ---------------------------------------------------------------------------

/** Solid border hugging the element, rotated with it. */
function drawSingleBorder(
  ctx: CanvasRenderingContext2D,
  frame: SelectionFrame,
  color: string,
  zoom: number,
): void {
  ctx.save()
  ctx.translate(frame.x + frame.width / 2, frame.y + frame.height / 2)
  ctx.rotate(frame.angle)
  ctx.strokeStyle = color
  ctx.lineWidth = 1 / zoom
  ctx.setLineDash([])
  ctx.strokeRect(-frame.width / 2, -frame.height / 2, frame.width, frame.height)
  ctx.restore()
}

/** Dashed axis-aligned box around a multi-selection. */
function drawGroupBorder(
  ctx: CanvasRenderingContext2D,
  frame: SelectionFrame,
  color: string,
  zoom: number,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1 / zoom
  ctx.setLineDash([2 / zoom])
  ctx.strokeRect(frame.x, frame.y, frame.width, frame.height)
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Transform handles
// ---------------------------------------------------------------------------

/**
 * Resize handles are filled rounded rects; the rotation handle is a circle
 * of the same footprint. `arcTo` builds the rounded rect so we don't depend
 * on the (still not universal) `ctx.roundRect`.
 */
function drawHandles(
  ctx: CanvasRenderingContext2D,
  layout: readonly HandleBox[],
  color: string,
  zoom: number,
  dark: boolean,
): void {
  for (const box of layout) {
    const { x1, y1, x2, y2 } = box.bounds
    const width = x2 - x1
    const height = y2 - y1
    ctx.save()
    ctx.fillStyle = dark ? HANDLE_FILL_DARK : HANDLE_FILL_LIGHT
    ctx.strokeStyle = color
    ctx.lineWidth = 1 / zoom
    ctx.setLineDash([])
    ctx.beginPath()
    if (box.handle === 'rotation') {
      ctx.arc((x1 + x2) / 2, (y1 + y2) / 2, width / 2, 0, Math.PI * 2)
    } else {
      appendRoundRect(ctx, x1, y1, width, height, HANDLE_RADIUS_PX / zoom)
    }
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

function appendRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

// ---------------------------------------------------------------------------
// Linear point handles
// ---------------------------------------------------------------------------

/**
 * The point circles of a selected linear element, drawn over the box
 * chrome: a filled dot at every point and, for a two-point line, the
 * hollow segment midpoint — Excalidraw's `renderLinearPointHandles` at
 * POINT_HANDLE_SIZE / 2 while the point editor is closed.
 */
function drawLinearPointHandles(
  ctx: CanvasRenderingContext2D,
  element: VueDrawLinearElement,
  color: string,
  zoom: number,
  dark: boolean,
): void {
  const radius = POINT_HANDLE_RADIUS / zoom
  for (const handle of linearPointHandles(element)) {
    drawPointDot(ctx, handle, radius, color, zoom, dark)
  }
  const mid = linearMidpointHandle(element)
  if (mid) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(mid.at.x, mid.at.y, (POINT_HANDLE_RADIUS - 1) / zoom, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5 / zoom
    ctx.setLineDash([])
    ctx.stroke()
    ctx.restore()
  }
}

function drawPointDot(
  ctx: CanvasRenderingContext2D,
  handle: LinearHandle,
  radius: number,
  color: string,
  zoom: number,
  dark: boolean,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(handle.at.x, handle.at.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = dark ? HANDLE_FILL_DARK : HANDLE_FILL_LIGHT
  ctx.strokeStyle = color
  ctx.lineWidth = 1 / zoom
  ctx.setLineDash([])
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Marquee
// ---------------------------------------------------------------------------

function drawMarquee(
  ctx: CanvasRenderingContext2D,
  marquee: Bounds,
  color: string,
  zoom: number,
): void {
  const x1 = Math.min(marquee.x1, marquee.x2)
  const y1 = Math.min(marquee.y1, marquee.y2)
  const x2 = Math.max(marquee.x1, marquee.x2)
  const y2 = Math.max(marquee.y1, marquee.y2)
  ctx.save()
  ctx.globalAlpha = MARQUEE_FILL_ALPHA
  ctx.fillStyle = color
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
  ctx.globalAlpha = 1
  ctx.strokeStyle = color
  ctx.lineWidth = 1 / zoom
  ctx.setLineDash([6 / zoom, 4 / zoom])
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Binding highlight
// ---------------------------------------------------------------------------

/**
 * A clean (non-rough) outline over the shape an in-flight line/arrow tip
 * would dock onto, tracing its own geometry — rounded corners included —
 * and rotating with it. The stroke clamps against the shape's own width so
 * thin outlines stay readable, mirroring Excalidraw's
 * `renderBindingHighlightForBindableElement`.
 */
function drawBindingHighlight(
  ctx: CanvasRenderingContext2D,
  shape: VueDrawBindableShape,
  color: string,
  zoom: number,
): void {
  const { width, height } = shape
  ctx.save()
  ctx.translate(shape.x, shape.y)
  if (shape.angle !== 0) {
    const cx = width / 2
    const cy = height / 2
    ctx.translate(cx, cy)
    ctx.rotate(shape.angle)
    ctx.translate(-cx, -cy)
  }
  ctx.lineWidth = clamp(1.75, shape.strokeWidth, 4) / Math.max(0.25, zoom)
  ctx.strokeStyle = color
  ctx.setLineDash([])
  ctx.beginPath()
  if (shape.type === 'ellipse') {
    ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
  } else if (shape.type === 'diamond') {
    if (shape.roundness === 'round') {
      // Same cubic corners the renderer's rounded diamond draws.
      const vr = (width / 2) * PROPORTIONAL_RADIUS
      const hr = (height / 2) * PROPORTIONAL_RADIUS
      const topX = width / 2
      const rightY = height / 2
      ctx.moveTo(topX + vr, hr)
      ctx.lineTo(width - vr, rightY - hr)
      ctx.bezierCurveTo(width, rightY, width, rightY, width - vr, rightY + hr)
      ctx.lineTo(topX + vr, height - hr)
      ctx.bezierCurveTo(topX, height, topX, height, topX - vr, height - hr)
      ctx.lineTo(vr, rightY + hr)
      ctx.bezierCurveTo(0, rightY, 0, rightY, vr, rightY - hr)
      ctx.lineTo(topX - vr, hr)
      ctx.bezierCurveTo(topX, 0, topX, 0, topX + vr, hr)
    } else {
      ctx.moveTo(width / 2, 0)
      ctx.lineTo(width, height / 2)
      ctx.lineTo(width / 2, height)
      ctx.lineTo(0, height / 2)
      ctx.closePath()
    }
  } else if (shape.type === 'rectangle' && shape.roundness === 'round') {
    appendRoundRect(ctx, 0, 0, width, height, Math.min(width, height) * PROPORTIONAL_RADIUS)
  } else {
    // Sharp rectangle, or the text element's frame box.
    ctx.rect(0, 0, width, height)
  }
  ctx.stroke()
  ctx.restore()
}
