/**
 * Overlay rendering: in-progress previews and selection chrome, drawn in
 * scene coordinates on a transparent canvas layered above the scene.
 *
 * All sizes are screen pixels divided by zoom so the chrome stays
 * finger-constant at any zoom level. Layout math (which handles exist and
 * where) belongs to `../interaction/handles.js`; this module only paints.
 */

import type { HandleBox, PointerKind, SelectionFrame } from '../interaction/handles.js'
import { getHandleLayout, selectionFrameOf } from '../interaction/handles.js'
import type { Bounds, VueDrawAppState, VueDrawElement } from '../types.js'
import { applyViewportTransform } from '../viewport.js'
import type { CanvasSize } from './renderScene.js'
import { renderElementShape } from './renderScene.js'
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
  const { selectedElements, appState, pointer, marquee, previewElements } = input
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
