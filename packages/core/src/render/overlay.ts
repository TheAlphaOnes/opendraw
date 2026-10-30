/**
 * Overlay rendering: in-progress previews and selection chrome, drawn in
 * scene coordinates on a transparent canvas layered above the scene.
 *
 * All sizes are screen pixels divided by zoom so the chrome stays
 * finger-constant at any zoom level. Layout math (which handles exist and
 * where) belongs to `../interaction/handles.js`; this module only paints.
 */

import type { OpenDrawBindableShape } from '../elements/binding.js'
import {
  FOCUS_POINT_SIZE,
  focusPointOf,
  isBindableShape,
  midpointSnapDistance,
  scenePointOf,
  shapeMidpoints,
  snappedMidpoint,
} from '../elements/binding.js'
import { isPointInsideElement } from '../elements/hitTest.js'
import { isLinearElement } from '../elements/factories.js'
import type { GroupSelectionChrome } from '../elements/groups.js'
import { clamp } from '../geometry/points.js'
import type { HandleBox, PointerKind, SelectionFrame } from '../interaction/handles.js'
import {
  getHandleLayout,
  hasBoundingBox,
  linearMidpointHandle,
  linearPointHandles,
  POINT_HANDLE_RADIUS,
  selectionFrameOf,
} from '../interaction/handles.js'
import type { Bounds, OpenDrawAppState, OpenDrawElement, OpenDrawFrameElement, OpenDrawLinearElement, Point } from '../types.js'
import { applyViewportTransform } from '../viewport.js'
import type { CanvasSize } from './renderScene.js'
import { cornerRadius, renderElementShape } from './renderScene.js'
import { themeColor, UI } from './theme.js'

export interface OverlayRenderInput {
  /** The committed selection. Empty when nothing is selected. */
  selectedElements: readonly OpenDrawElement[]
  appState: Readonly<Pick<OpenDrawAppState, 'theme' | 'viewport'>> & {
    editingId: string | null
  }
  pointer: PointerKind
  /** Marquee (drag-select) rect in scene coords, or null. */
  marquee: Bounds | null
  /** Elements being created/dragged right now, drawn before the chrome. */
  previewElements: readonly OpenDrawElement[]
  /**
   * The shape a dragged (or hovering) line/arrow tip would bind to, and the
   * pointer over it — Excalidraw's suggestedBinding. Null when none.
   */
  suggestedBinding?: { shape: OpenDrawBindableShape; pointer: Point } | null
  /** Every element — the focus-point indicator looks bound shapes up here. */
  elements?: readonly OpenDrawElement[]
  /**
   * Group-aware chrome (see `groupSelectionChrome`): per-element outlines
   * inside a multi-selection, dashed boxes for selected groups and the
   * edited group. Omitted, a multi-selection draws only its common frame.
   */
  groupChrome?: GroupSelectionChrome
  /** The frame a drag would drop into (Excalidraw's frameToHighlight). */
  frameToHighlight?: OpenDrawFrameElement | null
  /** What a frame being resized would hold (Excalidraw's elementsToHighlight). */
  elementsToHighlight?: readonly OpenDrawElement[] | null
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
  const { selectedElements, appState, pointer, marquee, previewElements, suggestedBinding, groupChrome } = input
  const { theme, viewport, editingId } = appState
  const zoom = viewport.zoom
  const dark = theme === 'dark'
  const selectionColor = dark ? UI.selection.dark : UI.selection.light

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
  if (suggestedBinding) {
    const highlight = dark ? BINDING_HIGHLIGHT.dark : BINDING_HIGHLIGHT.light
    drawBindingHighlight(ctx, suggestedBinding.shape, highlight, zoom)
    drawMidpointIndicators(ctx, suggestedBinding.shape, suggestedBinding.pointer, highlight, dark, zoom)
  }

  if (input.frameToHighlight) {
    drawFrameHighlight(ctx, input.frameToHighlight, dark, zoom)
  }
  if (input.elementsToHighlight && input.elementsToHighlight.length > 0) {
    drawElementsBoxHighlight(ctx, input.elementsToHighlight, dark, zoom)
  }

  // While text is being edited — free text, or a label inside its selected
  // shape — the DOM editor draws its own affordances; chrome would only
  // double it.
  const isEditingText = editingId !== null

  // The edited group keeps its dashed box even with nothing selected, so
  // the user always sees which group they are inside.
  if (groupChrome?.editingBounds && !isEditingText) {
    drawDashedBounds(ctx, groupChrome.editingBounds, selectionColor, zoom)
  }

  if (selectedElements.length > 0 && !isEditingText) {
    const frame = selectionFrameOf(selectedElements)
    if (frame) {
      // Chrome colors are theme-stable by design: they are not element user
      // data, so they skip the dark filter (which would sink a light green
      // into the dark canvas).
      const accent =
        selectedElements.length === 1 && selectedElements[0]!.locked
          ? UI.locked
          : selectionColor
      const boxed = hasBoundingBox(selectedElements)
      if (!boxed) {
        // A lone two-point line or arrow: no box, no transform handles —
        // only its point handles below (Excalidraw's hasBoundingBox).
      } else if (selectedElements.length === 1) {
        drawSingleBorder(ctx, frame, accent, zoom)
      } else {
        // Excalidraw's multi-selection: every element selected on its own
        // keeps a thin outline, every selected group a dashed box, and the
        // whole selection one dashed frame carrying the handles.
        for (const element of selectedElements) {
          if (groupChrome?.individualIds.has(element.id)) {
            const own = selectionFrameOf([element])
            if (own) {
              drawSingleBorder(ctx, own, element.locked ? UI.locked : selectionColor, zoom)
            }
          }
        }
        for (const bounds of groupChrome?.groupBounds ?? []) {
          // A lone selected group IS the frame; its box would only double it.
          if (!boundsMatchFrame(bounds, frame)) {
            drawDashedBounds(ctx, bounds, accent, zoom)
          }
        }
        drawGroupBorder(ctx, frame, accent, zoom)
      }
      if (boxed) {
        const showRotation = !selectedElements.some((el) => el.type === 'frame')
        drawHandles(ctx, getHandleLayout(frame, { zoom, pointer, showRotation }), accent, zoom, dark)
      }
      // A lone selected line/arrow also shows its point handles: filled
      // endpoint circles that drag tips, plus the hollow midpoint that
      // inserts a point — Excalidraw's selected-linear affordance.
      const only = selectedElements.length === 1 ? selectedElements[0]! : null
      if (only && isLinearElement(only) && input.elements && !only.locked) {
        drawFocusPointIndicators(ctx, only, input.elements, zoom, dark)
      }
      if (only && isLinearElement(only)) {
        drawLinearPointHandles(ctx, only, zoom, dark)
      }
    }
  }

  if (marquee) {
    drawMarquee(ctx, marquee, selectionColor, zoom)
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

function boundsMatchFrame(bounds: Bounds, frame: SelectionFrame): boolean {
  const epsilon = 1e-6
  return (
    Math.abs(bounds.x1 - frame.x) < epsilon &&
    Math.abs(bounds.y1 - frame.y) < epsilon &&
    Math.abs(bounds.x2 - (frame.x + frame.width)) < epsilon &&
    Math.abs(bounds.y2 - (frame.y + frame.height)) < epsilon
  )
}

/** Dashed box around a group's common bounds. */
/** Excalidraw's frame/element highlight blue, `getThemedColor("rgb(0,118,255)")`. */
const FRAME_HIGHLIGHT = { light: 'rgb(0,118,255)', dark: 'rgb(0,118,255)' } as const

/** The drop-target frame: its rounded outline, thicker and blue. */
function drawFrameHighlight(
  ctx: CanvasRenderingContext2D,
  frame: OpenDrawFrameElement,
  dark: boolean,
  zoom: number,
): void {
  ctx.save()
  ctx.translate(frame.x + frame.width / 2, frame.y + frame.height / 2)
  ctx.rotate(frame.angle)
  ctx.strokeStyle = dark ? FRAME_HIGHLIGHT.dark : FRAME_HIGHLIGHT.light
  ctx.lineWidth = 2 / zoom
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.roundRect(-frame.width / 2, -frame.height / 2, frame.width, frame.height, 8 / zoom)
  ctx.stroke()
  ctx.restore()
}

/** One blue box per element — or per outermost group — a frame would hold. */
function drawElementsBoxHighlight(
  ctx: CanvasRenderingContext2D,
  elements: readonly OpenDrawElement[],
  dark: boolean,
  zoom: number,
): void {
  const units = new Map<string, OpenDrawElement[]>()
  for (const el of elements) {
    const key = el.groupIds[el.groupIds.length - 1] ?? el.id
    units.set(key, [...(units.get(key) ?? []), el])
  }
  const color = dark ? FRAME_HIGHLIGHT.dark : FRAME_HIGHLIGHT.light
  for (const unit of units.values()) {
    const frame = selectionFrameOf(unit)
    if (frame) {
      drawSingleBorder(ctx, frame, color, zoom)
    }
  }
}

function drawDashedBounds(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds,
  color: string,
  zoom: number,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1 / zoom
  ctx.setLineDash([4 / zoom, 4 / zoom])
  ctx.strokeRect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1)
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
  element: OpenDrawLinearElement,
  zoom: number,
  dark: boolean,
): void {
  // Excalidraw's renderSingleLinearPoint: themed white dots ringed in
  // #5e5ad8; the segment midpoint is a ring-less lavender "phantom" dot.
  const radius = POINT_HANDLE_RADIUS / zoom
  for (const handle of linearPointHandles(element)) {
    drawPointDot(ctx, handle.at, radius, themeColor('rgba(255, 255, 255, 0.9)', dark), themeColor(UI.point, dark), zoom)
  }
  const mid = linearMidpointHandle(element)
  if (mid) {
    drawPointDot(ctx, mid.at, radius, themeColor(UI.phantomPoint, dark), null, zoom)
  }
}

function drawPointDot(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  radius: number,
  fill: string,
  stroke: string | null,
  zoom: number,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1 / zoom
    ctx.setLineDash([])
    ctx.stroke()
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Binding affordances (Excalidraw's interactiveScene)
// ---------------------------------------------------------------------------

/** Excalidraw's BINDING_HIGHLIGHT_RGB per theme. */
const BINDING_HIGHLIGHT = { light: 'rgb(106, 189, 252)', dark: 'rgb(104, 182, 240)' } as const
/** Excalidraw's BINDING_MIDPOINT_COLOR per theme. */
const BINDING_MIDPOINT = { light: 'rgba(65, 65, 65, 0.5)', dark: 'rgba(237, 237, 237, 0.8)' } as const
/** Midpoint dot radius, screen px. */
const MIDPOINT_RADIUS_PX = 4

/**
 * The side-midpoint snap dots: from outside the shape, the midpoint nearest
 * the pointer shows once the pointer is within twice the snap distance, in
 * the highlight color when the tip actually snaps to it.
 */
function drawMidpointIndicators(
  ctx: CanvasRenderingContext2D,
  shape: OpenDrawBindableShape,
  pointer: Point,
  highlight: string,
  dark: boolean,
  zoom: number,
): void {
  if (isPointInsideElement(shape, pointer)) {
    return
  }
  const threshold = midpointSnapDistance(shape, zoom)
  const midpoints = shapeMidpoints(shape)
  const closest = midpoints.reduce((a, b) =>
    Math.hypot(a.x - pointer.x, a.y - pointer.y) <= Math.hypot(b.x - pointer.x, b.y - pointer.y) ? a : b,
  )
  if (Math.hypot(closest.x - pointer.x, closest.y - pointer.y) > threshold * 2) {
    return
  }
  const snapped = snappedMidpoint(shape, pointer, zoom)
  const isSnapped = snapped !== null && snapped.x === closest.x && snapped.y === closest.y
  ctx.save()
  ctx.fillStyle = isSnapped ? highlight : dark ? BINDING_MIDPOINT.dark : BINDING_MIDPOINT.light
  ctx.beginPath()
  ctx.arc(closest.x, closest.y, MIDPOINT_RADIUS_PX / zoom, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Excalidraw's focus-point indicator on a selected two-point line/arrow:
 * for each bound end, a dashed connector from the tip to the point it aims
 * at, and a small ringed circle there — hidden when the two overlap.
 */
function drawFocusPointIndicators(
  ctx: CanvasRenderingContext2D,
  linear: OpenDrawLinearElement,
  elements: readonly OpenDrawElement[],
  zoom: number,
  dark: boolean,
): void {
  if (linear.points.length !== 2) {
    return
  }
  for (const end of ['start', 'end'] as const) {
    const binding = end === 'start' ? linear.startBinding : linear.endBinding
    const shape = binding && elements.find((el) => el.id === binding.elementId)
    if (!binding || !shape || !isBindableShape(shape)) {
      continue
    }
    const focus = focusPointOf(shape, binding)
    const tip = scenePointOf(linear, linear.points[end === 'start' ? 0 : 1]!)
    if (Math.hypot(focus.x - tip.x, focus.y - tip.y) < (FOCUS_POINT_SIZE * 1.5) / zoom) {
      continue
    }
    ctx.save()
    ctx.strokeStyle = themeColor(UI.focus, dark)
    ctx.lineWidth = 1 / zoom
    ctx.setLineDash([4 / zoom, 4 / zoom])
    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(focus.x, focus.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = themeColor('rgba(255, 255, 255, 0.9)', dark)
    ctx.beginPath()
    ctx.arc(focus.x, focus.y, FOCUS_POINT_SIZE / 1.5 / zoom, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
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
  shape: OpenDrawBindableShape,
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
      const vr = cornerRadius(width / 2, 'diamond')
      const hr = cornerRadius(height / 2, 'diamond')
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
    appendRoundRect(ctx, 0, 0, width, height, cornerRadius(Math.min(width, height), 'rectangle'))
  } else {
    // Sharp rectangle, or the text element's frame box.
    ctx.rect(0, 0, width, height)
  }
  ctx.stroke()
  ctx.restore()
}
