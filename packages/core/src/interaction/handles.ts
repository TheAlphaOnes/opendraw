/**
 * Transform handles (resize + rotation) for the current selection.
 *
 * All sizes are in screen pixels and divided by zoom so handles stay
 * finger-constant at any zoom level, exactly as Excalidraw does.
 */

import { boundsCenter, getCommonBounds, getElementBounds } from '../geometry/bounds.js'
import { rotatePoint } from '../geometry/points.js'
import type { Bounds, Point, ResizeHandle, VueDrawElement } from '../types.js'

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
export function selectionFrameOf(elements: readonly VueDrawElement[]): SelectionFrame | null {
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

export interface HandleLayoutOptions {
  zoom: number
  pointer: PointerKind
  /** Hide cardinal (n/s/e/w) handles on tiny selections. */
  showSides?: boolean
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
  centers.push({
    handle: 'rotation',
    at: { x: center.x, y: frame.y - ROTATION_HANDLE_GAP / options.zoom - spacing },
  })

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
