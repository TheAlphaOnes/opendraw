/**
 * Pointer transform math: creating, moving, resizing, rotating.
 *
 * Every function here is pure: callers pass the immutable ORIGINAL element
 * snapshots captured at pointerdown plus the current scene pointer, and get
 * patches back. Reading originals (not live elements) is what makes drags
 * stable — accumulated floating point never compounds mid-drag.
 */

import { rotatePoint } from '../geometry/points.js'
import type {
  HandleDirection,
  Point,
  VueDrawElement,
} from '../types.js'
import type { ElementPatch } from '../elements/mutate.js'
import type { SelectionFrame } from './handles.js'
import { boundsCenter } from '../geometry/bounds.js'

export interface PointerModifiers {
  /** Keep aspect ratio (corners) / axis-lock (lines). */
  shift: boolean
}

// ---------------------------------------------------------------------------
// Creation drafting
// ---------------------------------------------------------------------------

/**
 * Rectangle-family creation drag: the start point anchors one corner,
 * shift forces a perfect square.
 */
export function draftShapeRect(
  start: Point,
  current: Point,
  modifiers: PointerModifiers,
): { x: number; y: number; width: number; height: number } {
  let width = current.x - start.x
  let height = current.y - start.y
  if (modifiers.shift) {
    const size = Math.max(Math.abs(width), Math.abs(height))
    width = Math.sign(width || 1) * size
    height = Math.sign(height || 1) * size
  }
  return {
    x: Math.min(start.x, start.x + width),
    y: Math.min(start.y, start.y + height),
    width: Math.abs(width),
    height: Math.abs(height),
  }
}

const SHIFT_LOCK_ANGLE = Math.PI / 12 // 15°

/** Line/arrow creation drag: two local points, shift snaps the angle. */
export function draftLinePoints(
  start: Point,
  current: Point,
  modifiers: PointerModifiers,
): Point[] {
  let dx = current.x - start.x
  let dy = current.y - start.y
  if (modifiers.shift) {
    const angle = Math.atan2(dy, dx)
    const snapped = Math.round(angle / SHIFT_LOCK_ANGLE) * SHIFT_LOCK_ANGLE
    const length = Math.hypot(dx, dy)
    dx = Math.cos(snapped) * length
    dy = Math.sin(snapped) * length
  }
  return [
    { x: 0, y: 0 },
    { x: dx, y: dy },
  ]
}

/** Freedraw uses raw points; kept for symmetry in the interaction layer. */
export function freedrawPoint(current: Point, origin: Point, pressure: number): number[] {
  return [current.x - origin.x, current.y - origin.y, pressure]
}

// ---------------------------------------------------------------------------
// Moving
// ---------------------------------------------------------------------------

/**
 * Move a set of originals by a scene delta. With a grid, the delta is
 * rounded so the selection's top-left lands on the grid.
 */
export function moveElements(
  originals: readonly VueDrawElement[],
  delta: Point,
  gridSize: number | null = null,
): Array<{ id: string; patch: ElementPatch }> {
  if (originals.length === 0) {
    return []
  }
  let dx = delta.x
  let dy = delta.y
  if (gridSize && gridSize > 0) {
    const minX = Math.min(...originals.map((el) => el.x))
    const minY = Math.min(...originals.map((el) => el.y))
    dx = Math.round((minX + delta.x) / gridSize) * gridSize - minX
    dy = Math.round((minY + delta.y) / gridSize) * gridSize - minY
  }
  return originals.map((element) => ({
    id: element.id,
    patch: { x: element.x + dx, y: element.y + dy },
  }))
}

// ---------------------------------------------------------------------------
// Single-element resize
// ---------------------------------------------------------------------------

const MIN_SIZE = 1

/**
 * Text-only no-flip policy: its size clamps to a positive minimum. Every
 * other element flips through zero, keeping the drag's sign — Excalidraw's
 * `flipFactorX/Y = nextWidth < 0 ? -1 : 1` semantics.
 */
function withMinSize(size: number): number {
  return Math.max(size, MIN_SIZE)
}

/**
 * Resize a single (possibly rotated) element by dragging `handle`.
 *
 * Derivation (Excalidraw's approach): un-rotate the pointer into the
 * element's original local frame about the ORIGINAL center, compute the new
 * local rect with the opposite corner/edge anchored, then rotate the new
 * center back into scene space. Linear/freedraw points rescale to match.
 *
 * Sizes keep the drag's sign, so dragging a handle past the opposite edge
 * flips the element through zero (Excalidraw's `flipFactorX/Y`); the patch
 * normalizes the result back into the always-positive data model, mirroring
 * linear/freedraw points by the same flip. Text alone clamps to a minimum.
 */
export function resizeSingleElement(
  original: VueDrawElement,
  handle: HandleDirection,
  pointer: Point,
  modifiers: PointerModifiers,
): ElementPatch<typeof original> {
  const center: Point = { x: original.x + original.width / 2, y: original.y + original.height / 2 }
  const local = original.angle === 0 ? pointer : unrotate(pointer, center, original.angle)

  const right = original.x + original.width
  const bottom = original.y + original.height

  // New local rect with the opposite side anchored.
  let x = original.x
  let y = original.y
  let width = original.width
  let height = original.height

  // Text never flips through zero (Excalidraw resizes text by its font,
  // never a mirror); every other element keeps the drag's sign.
  const dim = original.type === 'text' ? withMinSize : ((size: number) => size)

  if (handle === 'nw') {
    width = dim(right - local.x)
    height = dim(bottom - local.y)
    x = right - width
    y = bottom - height
  } else if (handle === 'ne') {
    width = dim(local.x - original.x)
    height = dim(bottom - local.y)
    y = bottom - height
  } else if (handle === 'se') {
    width = dim(local.x - original.x)
    height = dim(local.y - original.y)
  } else if (handle === 'sw') {
    width = dim(right - local.x)
    height = dim(local.y - original.y)
    x = right - width
  } else if (handle === 'n') {
    height = dim(bottom - local.y)
    y = bottom - height
  } else if (handle === 's') {
    height = dim(local.y - original.y)
  } else if (handle === 'e') {
    width = dim(local.x - original.x)
  } else if (handle === 'w') {
    width = dim(right - local.x)
    x = right - width
  }

  // Shift keeps the aspect ratio — on magnitudes, so a corner dragged
  // through the opposite edge keeps its flip direction.
  if (modifiers.shift && isCorner(handle) && original.width > 0 && original.height > 0) {
    const scale = Math.max(Math.abs(width) / original.width, Math.abs(height) / original.height)
    width = (width < 0 ? -1 : 1) * original.width * scale
    height = (height < 0 ? -1 : 1) * original.height * scale
    if (handle === 'nw') {
      x = right - width
      y = bottom - height
    } else if (handle === 'ne') {
      y = bottom - height
    } else if (handle === 'sw') {
      x = right - width
    }
  }

  // New center in the ORIGINAL local frame. The signed rect's center is
  // the normalized box's center, so this holds through flips too.
  const localCenter: Point = { x: x + width / 2, y: y + height / 2 }
  const sceneCenter =
    original.angle === 0
      ? localCenter
      : rotatePoint(localCenter, center, original.angle)

  // Normalize the flip into the always-positive data model: the element
  // keeps positive width/height and (x, y) moves to the box's top-left.
  const nextWidth = Math.abs(width)
  const nextHeight = Math.abs(height)

  const patch: Record<string, unknown> = {
    x: sceneCenter.x - nextWidth / 2,
    y: sceneCenter.y - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  }

  // Polylines and strokes rescale by the SIGNED ratios around the original
  // origin, then shift by the flip offset so the anchored edge stays put —
  // mirroring Excalidraw's `rescalePointsInElement(..., true)`. Zero-extent
  // axes (a flat line) don't scale.
  const flipX = Math.max(-width, 0)
  const flipY = Math.max(-height, 0)
  if (original.type === 'line' || original.type === 'arrow') {
    const sx = original.width === 0 ? 1 : width / original.width
    const sy = original.height === 0 ? 1 : height / original.height
    if (sx !== 1 || sy !== 1 || flipX !== 0 || flipY !== 0) {
      patch.points = original.points.map((p) => ({
        x: p.x * sx + flipX,
        y: p.y * sy + flipY,
      }))
    }
  }
  if (original.type === 'freedraw') {
    const sx = original.width === 0 ? 1 : width / original.width
    const sy = original.height === 0 ? 1 : height / original.height
    if (sx !== 1 || sy !== 1 || flipX !== 0 || flipY !== 0) {
      patch.points = original.points.map((p) => [p[0]! * sx + flipX, p[1]! * sy + flipY, p[2]!])
    }
  }
  return patch as ElementPatch<typeof original>
}

function unrotate(point: Point, center: Point, angle: number): Point {
  return rotatePoint(point, center, -angle)
}

function isCorner(handle: HandleDirection): boolean {
  return handle.length === 2
}

// ---------------------------------------------------------------------------
// Multi-element resize
// ---------------------------------------------------------------------------

/**
 * Group resize against the axis-aligned common bounds (angle 0): every
 * original scales about the anchored corner/edge of the group box. Text
 * scales its fontSize instead of stretching.
 */
export function resizeMultipleElements(
  originals: readonly VueDrawElement[],
  handle: HandleDirection,
  pointer: Point,
  modifiers: PointerModifiers,
): Array<{ id: string; patch: ElementPatch }> {
  if (originals.length === 0) {
    return []
  }
  let x1 = Number.POSITIVE_INFINITY
  let y1 = Number.POSITIVE_INFINITY
  let x2 = Number.NEGATIVE_INFINITY
  let y2 = Number.NEGATIVE_INFINITY
  for (const el of originals) {
    x1 = Math.min(x1, el.x)
    y1 = Math.min(y1, el.y)
    x2 = Math.max(x2, el.x + el.width)
    y2 = Math.max(y2, el.y + el.height)
  }
  const boxWidth = Math.max(x2 - x1, MIN_SIZE)
  const boxHeight = Math.max(y2 - y1, MIN_SIZE)

  // Anchor = opposite corner/edge, fixed in scene space.
  const anchorX = handle.includes('w') ? x2 : handle.includes('e') ? x1 : null
  const anchorY = handle.includes('n') ? y2 : handle.includes('s') ? y1 : null

  let nextWidth = anchorX === null ? boxWidth : Math.abs(pointer.x - anchorX)
  let nextHeight = anchorY === null ? boxHeight : Math.abs(pointer.y - anchorY)

  // Excalidraw refuses the update rather than collapse the group to zero
  // (resizeElements' `nextWidth === 0` guard); the caller keeps the last
  // good frame for that instant. Past the anchor the abs-based scale
  // regrows the group smoothly instead of jamming at a minimum size.
  if (nextWidth === 0 || nextHeight === 0) {
    return []
  }

  if (modifiers.shift && isCorner(handle)) {
    const scale = Math.max(nextWidth / boxWidth, nextHeight / boxHeight)
    nextWidth = boxWidth * scale
    nextHeight = boxHeight * scale
  }

  const scaleX = anchorX === null ? 1 : nextWidth / boxWidth
  const scaleY = anchorY === null ? 1 : nextHeight / boxHeight

  return originals.map((element) => {
    const patch: Record<string, unknown> = {}
    if (anchorX !== null) {
      patch.x = anchorX + (element.x - anchorX) * scaleX
    }
    if (anchorY !== null) {
      patch.y = anchorY + (element.y - anchorY) * scaleY
    }
    if (element.type === 'text') {
      const nextFontSize = Math.max(8, element.fontSize * scaleY)
      patch.fontSize = nextFontSize
      patch.width = element.width * (anchorX === null ? 1 : scaleX)
      patch.height = element.height * (anchorY === null ? 1 : nextFontSize / element.fontSize)
      if (element.fontSize < 8) {
        patch.fontSize = element.fontSize
        patch.width = element.width
        patch.height = element.height
      }
    } else {
      if (anchorX !== null && element.width !== 0) {
        patch.width = element.width * scaleX
      }
      if (anchorY !== null && element.height !== 0) {
        patch.height = element.height * scaleY
      }
      if ((element.type === 'line' || element.type === 'arrow') && (scaleX !== 1 || scaleY !== 1)) {
        patch.points = element.points.map((p) => ({
          x: p.x * scaleX,
          y: p.y * scaleY,
        }))
      }
      if (element.type === 'freedraw' && (scaleX !== 1 || scaleY !== 1)) {
        patch.points = element.points.map((p) => [p[0]! * scaleX, p[1]! * scaleY, p[2]!])
      }
    }
    return { id: element.id, patch: patch as ElementPatch }
  })
}

// ---------------------------------------------------------------------------
// Rotation
// ---------------------------------------------------------------------------

/**
 * Pointer angle around a frame center, measured so that angle 0 = the
 * rotation handle pointing straight up (Excalidraw's 5π/2 offset).
 */
export function pointerAngle(center: Point, pointer: Point): number {
  return (5 * Math.PI) / 2 + Math.atan2(pointer.y - center.y, pointer.x - center.x)
}

export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2
  return ((angle % twoPi) + twoPi) % twoPi
}

/**
 * Rotates a set of originals about the selection center by the delta
 * between `startAngle` (pointerdown) and the current pointer angle.
 * Each element keeps its pose relative to the group.
 */
export function rotateElements(
  originals: readonly VueDrawElement[],
  frame: SelectionFrame,
  startAngle: number,
  pointer: Point,
  modifiers: PointerModifiers,
): Array<{ id: string; patch: ElementPatch }> {
  const center = boundsCenter({
    x1: frame.x,
    y1: frame.y,
    x2: frame.x + frame.width,
    y2: frame.y + frame.height,
  })
  let currentAngle = pointerAngle(center, pointer)
  if (modifiers.shift) {
    currentAngle = Math.round(currentAngle / SHIFT_LOCK_ANGLE) * SHIFT_LOCK_ANGLE
  }
  const delta = currentAngle - startAngle

  return originals.map((element) => {
    const elementCenter: Point = { x: element.x + element.width / 2, y: element.y + element.height / 2 }
    const rotated = rotatePoint(elementCenter, center, delta)
    return {
      id: element.id,
      patch: {
        x: rotated.x - element.width / 2,
        y: rotated.y - element.height / 2,
        angle: normalizeAngle(element.angle + delta),
      },
    }
  })
}

/** The pointer angle at drag start — pass to `rotateElements` as startAngle. */
export function startRotationAngle(frame: SelectionFrame, pointer: Point): number {
  const center = boundsCenter({
    x1: frame.x,
    y1: frame.y,
    x2: frame.x + frame.width,
    y2: frame.y + frame.height,
  })
  return pointerAngle(center, pointer)
}
