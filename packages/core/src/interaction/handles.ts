/**
 * Transform handles (resize + rotation) for the current selection.
 *
 * All sizes are in screen pixels and divided by zoom so handles stay
 * finger-constant at any zoom level, exactly as Excalidraw does.
 */

import { scenePointOf } from '../elements/binding.js'
import { boundsCenter, getCommonBounds, getElementBounds } from '../geometry/bounds.js'
import { rotatePoint, unrotatePoint } from '../geometry/points.js'
import type {
  Bounds,
  HandleDirection,
  Point,
  ResizeHandle,
  OpenDrawElement,
  OpenDrawLinearElement,
} from '../types.js'

export type PointerKind = 'mouse' | 'pen' | 'touch'

/** Screen-space handle sizes per pointer kind (px). */
export const HANDLE_SIZES: Record<PointerKind, number> = {
  mouse: 8,
  pen: 16,
  touch: 28,
}

/** Gap between the selection border and the handle centers (screen px). */
export const HANDLE_SPACING = 2

/** Gap between the top border and the rotation handle (screen px). */
export const ROTATION_HANDLE_GAP = 16

/** An axis-aligned hitbox in scene coordinates. */
export interface HandleBox {
  handle: ResizeHandle
  bounds: Bounds
}

/** The frame handles are laid out around — an un-rotated box plus rotation. */
export interface SelectionFrame {
  x: number
  y: number
  width: number
  height: number
  angle: number
}

/**
 * The frame for a selection: a single element uses its own rotated frame,
 * multiple elements share the axis-aligned common bounds at angle 0.
 */
export function selectionFrameOf(elements: readonly OpenDrawElement[]): SelectionFrame | null {
  if (elements.length === 0) {
    return null
  }
  if (elements.length === 1) {
    const el = elements[0]!
    // Linear and freedraw geometry lives in `points` relative to (x, y), and
    // points go negative when drawn up-left — so (x, y, width, height) is the
    // drag origin plus extents, NOT the shape's box. Unrotated elements frame
    // their true AABB; rotated ones keep (x, y, width, height) because that
    // box is the rotation pivot the renderer and transforms already share.
    if (el.angle === 0) {
      const bounds = getElementBounds(el)
      return { x: bounds.x1, y: bounds.y1, width: bounds.x2 - bounds.x1, height: bounds.y2 - bounds.y1, angle: 0 }
    }
    return { x: el.x, y: el.y, width: el.width, height: el.height, angle: el.angle }
  }
  const bounds = getCommonBounds(elements)
  return { x: bounds.x1, y: bounds.y1, width: bounds.x2 - bounds.x1, height: bounds.y2 - bounds.y1, angle: 0 }
}

/**
 * Whether a selection shows its box and transform handles — Excalidraw's
 * hasBoundingBox: always for several elements, never for a lone line or
 * arrow of two points (only its point handles show), and for longer
 * polylines yes.
 */
export function hasBoundingBox(elements: readonly OpenDrawElement[]): boolean {
  if (elements.length !== 1) {
    return elements.length > 1
  }
  const only = elements[0]!
  // An elbow arrow is edited by its tips alone — no box (Excalidraw).
  if (only.type === 'arrow' && only.elbowed) {
    return false
  }
  return !((only.type === 'line' || only.type === 'arrow') && only.points.length <= 2)
}

export interface HandleLayoutOptions {
  zoom: number
  pointer: PointerKind
  /** Hide cardinal (n/s/e/w) handles on tiny selections. */
  showSides?: boolean
  /** False drops the rotation handle — frames never rotate (Excalidraw). */
  showRotation?: boolean
}

/** Lay out the 8 resize handles + rotation handle in scene space. */
export function getHandleLayout(
  frame: SelectionFrame,
  options: HandleLayoutOptions,
): HandleBox[] {
  const size = HANDLE_SIZES[options.pointer] / options.zoom
  const spacing = (HANDLE_SPACING + size / 2) / options.zoom
  const center: Point = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
  const showSides = options.showSides ?? true

  // Handle centers in frame-local space.
  const centers: { handle: ResizeHandle; at: Point }[] = [
    { handle: 'nw', at: { x: frame.x, y: frame.y } },
    { handle: 'ne', at: { x: frame.x + frame.width, y: frame.y } },
    { handle: 'se', at: { x: frame.x + frame.width, y: frame.y + frame.height } },
    { handle: 'sw', at: { x: frame.x, y: frame.y + frame.height } },
  ]
  if (showSides && frame.width * options.zoom > size * 5) {
    centers.push({ handle: 'n', at: { x: center.x, y: frame.y } })
    centers.push({ handle: 's', at: { x: center.x, y: frame.y + frame.height } })
  }
  if (showSides && frame.height * options.zoom > size * 5) {
    centers.push({ handle: 'e', at: { x: frame.x + frame.width, y: center.y } })
    centers.push({ handle: 'w', at: { x: frame.x, y: center.y } })
  }
  // Rotation handle: above the top edge, centered.
  if (options.showRotation ?? true) {
    centers.push({
      handle: 'rotation',
      at: { x: center.x, y: frame.y - ROTATION_HANDLE_GAP / options.zoom - spacing },
    })
  }

  const boxes: HandleBox[] = []
  for (const { handle, at } of centers) {
    const scene =
      frame.angle === 0
        ? at
        : rotatePoint(at, { x: center.x, y: center.y }, frame.angle)
    const half = size / 2
    boxes.push({
      handle,
      bounds: {
        x1: scene.x - half,
        y1: scene.y - half,
        x2: scene.x + half,
        y2: scene.y + half,
      },
    })
  }
  return boxes
}

/** Which handle (if any) contains the scene point. Rotation wins first. */
export function handleAt(
  layout: readonly HandleBox[],
  point: Point,
): ResizeHandle | null {
  for (const box of layout) {
    if (
      point.x >= box.bounds.x1 &&
      point.x <= box.bounds.x2 &&
      point.y >= box.bounds.y1 &&
      point.y <= box.bounds.y2
    ) {
      return box.handle
    }
  }
  return null
}

/** Center of the rotation-handle hitbox in scene space. */
export function rotationHandleCenter(
  frame: SelectionFrame,
  zoom: number,
): Point {
  const size = HANDLE_SIZES.mouse / zoom
  const spacing = (HANDLE_SPACING + size / 2) / zoom
  const center = boundsCenter({
    x1: frame.x,
    y1: frame.y,
    x2: frame.x + frame.width,
    y2: frame.y + frame.height,
  })
  return {
    x: center.x,
    y: frame.y - ROTATION_HANDLE_GAP / zoom - spacing,
  }
}

// ---------------------------------------------------------------------------
// Border grabbing & cursors
// ---------------------------------------------------------------------------

/**
 * Screen-px distance from a selection border at which a press still counts
 * as grabbing that side for a resize (Excalidraw's SIDE_RESIZING_THRESHOLD:
 * twice the handle spacing).
 */
export const SIDE_GRAB_THRESHOLD = 4

/** Center of a selection frame. */
function frameCenter(frame: SelectionFrame): Point {
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }
}

/**
 * Whether `point` lies within the (possibly rotated) selection frame,
 * dilated by `padding` scene px. The grab and hover tests for a selection
 * live here so the cursor can advertise exactly what a press would do.
 */
export function pointInSelectionFrame(
  frame: SelectionFrame,
  point: Point,
  padding = 0,
): boolean {
  const local =
    frame.angle === 0 ? point : unrotatePoint(point, frameCenter(frame), frame.angle)
  return (
    local.x >= frame.x - padding &&
    local.x <= frame.x + frame.width + padding &&
    local.y >= frame.y - padding &&
    local.y <= frame.y + frame.height + padding
  )
}

/**
 * The side a press within {@link SIDE_GRAB_THRESHOLD} of the frame border
 * grabs for a resize, in Excalidraw's border priority (n, e, s, w) — or
 * null when the point is not near a border. Corner presses land on the
 * handle boxes before this runs, so exact corners never reach it.
 */
export function sideHandleAt(
  frame: SelectionFrame,
  point: Point,
  zoom: number,
): HandleDirection | null {
  const threshold = SIDE_GRAB_THRESHOLD / Math.max(zoom, 0.001)
  const local =
    frame.angle === 0 ? point : unrotatePoint(point, frameCenter(frame), frame.angle)
  const x1 = frame.x
  const y1 = frame.y
  const x2 = frame.x + frame.width
  const y2 = frame.y + frame.height
  // Border segments, dilated by the threshold at each end so a press just
  // past a corner still grabs the nearest side (Excalidraw dilates the
  // same way before its point-on-segment test).
  const borders: readonly { handle: HandleDirection; ax: number; ay: number; bx: number; by: number }[] = [
    { handle: 'n', ax: x1 - threshold, ay: y1, bx: x2 + threshold, by: y1 },
    { handle: 'e', ax: x2, ay: y1 - threshold, bx: x2, by: y2 + threshold },
    { handle: 's', ax: x2 + threshold, ay: y2, bx: x1 - threshold, by: y2 },
    { handle: 'w', ax: x1, ay: y2 + threshold, bx: x1, by: y1 - threshold },
  ]
  for (const border of borders) {
    const minX = Math.min(border.ax, border.bx)
    const maxX = Math.max(border.ax, border.bx)
    const minY = Math.min(border.ay, border.by)
    const maxY = Math.max(border.ay, border.by)
    const cx = Math.min(Math.max(local.x, minX), maxX)
    const cy = Math.min(Math.max(local.y, minY), maxY)
    const dx = local.x - cx
    const dy = local.y - cy
    if (dx * dx + dy * dy <= threshold * threshold) {
      return border.handle
    }
  }
  return null
}

/** Cursor bases per resize direction, in 45° rotation order (Excalidraw's RESIZE_CURSORS). */
const RESIZE_CURSOR_BASES = ['ns', 'nesw', 'ew', 'nwse'] as const

/**
 * The CSS cursor for a transform handle — Excalidraw's
 * `getCursorForResizingElement`: bidirectional resize cursors per side,
 * walked in 45° steps for rotated selections, `grab` for rotation.
 */
export function resizeCursorFor(handle: ResizeHandle, angle = 0): string {
  if (handle === 'rotation') {
    return 'grab'
  }
  const base =
    handle === 'n' || handle === 's'
      ? 'ns'
      : handle === 'e' || handle === 'w'
        ? 'ew'
        : handle === 'nw' || handle === 'se'
          ? 'nwse'
          : 'nesw'
  const shift = Math.round(angle / (Math.PI / 4))
  const index = RESIZE_CURSOR_BASES.indexOf(base)
  const rotated =
    RESIZE_CURSOR_BASES[(((index + shift) % 4) + 4) % 4] ?? base
  return `${rotated}-resize`
}

// ---------------------------------------------------------------------------
// Linear point handles
// ---------------------------------------------------------------------------

/** Visual radius of a linear point handle (screen px) — Excalidraw's
 * POINT_HANDLE_SIZE / 2. */
export const POINT_HANDLE_RADIUS = 5

/** Grab radius around a point handle (screen px) — Excalidraw's
 * POINT_HANDLE_SIZE + 1, which adds slack for the outline stroke. */
export const POINT_HANDLE_HIT_RADIUS = 11

export interface LinearHandle {
  /** Point index — for the midpoint handle, the insertion index. */
  index: number
  /** Handle center in scene space. */
  at: Point
}

/** Scene positions of a linear element's point handles, in point order. */
export function linearPointHandles(element: OpenDrawLinearElement): LinearHandle[] {
  const handles = element.points.map((point, index) => ({ index, at: scenePointOf(element, point) }))
  // An elbow arrow's bends are routed, never edited: only its tips have handles.
  return element.elbowed ? [handles[0]!, handles[handles.length - 1]!] : handles
}

/**
 * The segment-midpoint handle of a two-point linear — the small circle
 * Excalidraw renders on a selected two-point line, whose press inserts a
 * point there and drags it. Longer polylines only grow midpoints in the
 * point editor, which opendraw does not have.
 */
export function linearMidpointHandle(element: OpenDrawLinearElement): LinearHandle | null {
  if (element.points.length !== 2 || element.elbowed) {
    return null
  }
  const a = scenePointOf(element, element.points[0]!)
  const b = scenePointOf(element, element.points[1]!)
  return { index: 1, at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
}

/**
 * The handle under `point`, or null. Later handles win on overlap — they
 * render on top, matching Excalidraw's right-to-left scan in
 * `getPointIndexUnderCursor`.
 */
export function linearHandleAt(
  handles: readonly LinearHandle[],
  point: Point,
  zoom: number,
): LinearHandle | null {
  for (let i = handles.length - 1; i >= 0; i--) {
    const handle = handles[i]!
    const dx = point.x - handle.at.x
    const dy = point.y - handle.at.y
    if (Math.hypot(dx, dy) * zoom < POINT_HANDLE_HIT_RADIUS) {
      return handle
    }
  }
  return null
}
