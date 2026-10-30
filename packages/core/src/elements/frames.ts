/**
 * Frame membership — Excalidraw's element/src/frame.ts, reduced to the
 * rules users feel:
 *   — a new frame adopts the elements completely inside it (a group only
 *     joins whole — `omitPartialGroups`);
 *   — a new element joins the topmost frame under the pointer;
 *   — elements dropped after a drag join the frame under the pointer, or
 *     leave their frame when dropped outside every frame;
 *   — children move with their frame and render clipped to it;
 *   — deleting a frame deletes its children.
 *
 * Frames never nest, and bound text always shares its container's frame.
 */

import { boundsContain, getElementBounds, pointInBounds } from '../geometry/bounds.js'
import type { Point, VueDrawElement, VueDrawFrameElement } from '../types.js'
import { isBoundText } from './boundText.js'
import { isFrameElement } from './factories.js'

/** The topmost unlocked frame whose box contains the point, or null. */
export function frameAt(
  elements: readonly VueDrawElement[],
  point: Point,
  excludeIds: ReadonlySet<string> = new Set(),
): VueDrawFrameElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]!
    if (
      isFrameElement(element) &&
      !element.locked &&
      !excludeIds.has(element.id) &&
      pointInBounds(point, getElementBounds(element))
    ) {
      return element
    }
  }
  return null
}

/** The elements currently belonging to the frame. */
export function frameChildren(elements: readonly VueDrawElement[], frameId: string): VueDrawElement[] {
  return elements.filter((el) => el.frameId === frameId)
}

/**
 * Non-frame elements lying completely inside the frame's box, keeping
 * groups whole: a group joins only when every member is inside.
 */
export function elementsCompletelyInFrame(
  elements: readonly VueDrawElement[],
  frame: VueDrawFrameElement,
): VueDrawElement[] {
  const box = getElementBounds(frame)
  const inside = new Set(
    elements
      .filter((el) => !isFrameElement(el) && !isBoundText(el) && boundsContain(box, getElementBounds(el)))
      .map((el) => el.id),
  )
  return elements.filter((el) => {
    if (!inside.has(el.id)) {
      return false
    }
    const outermost = el.groupIds[el.groupIds.length - 1]
    return !outermost || elements.every((other) => !other.groupIds.includes(outermost) || inside.has(other.id))
  })
}

/**
 * The ids plus every child of the frames among them, in scene order — what
 * move, nudge, duplicate and delete carry along with a frame.
 */
export function withFrameChildren(
  elements: readonly VueDrawElement[],
  ids: Iterable<string>,
): VueDrawElement[] {
  const wanted = new Set(ids)
  const frames = new Set(
    elements.filter((el) => wanted.has(el.id) && isFrameElement(el)).map((el) => el.id),
  )
  return elements.filter((el) => wanted.has(el.id) || (el.frameId !== null && frames.has(el.frameId)))
}

/**
 * The frame assignments that put `members` into `frameId` (or out of any
 * frame with null). Bound labels follow their containers; frames never
 * nest, so frames themselves are skipped. Only real changes are returned.
 */
export function frameMembershipPatches(
  elements: readonly VueDrawElement[],
  members: readonly VueDrawElement[],
  frameId: string | null,
): Map<string, string | null> {
  const ids = new Set(members.filter((el) => !isFrameElement(el)).map((el) => el.id))
  const patches = new Map<string, string | null>()
  for (const el of elements) {
    const target = ids.has(el.id) || (isBoundText(el) && ids.has(el.containerId))
    if (target && el.frameId !== frameId) {
      patches.set(el.id, frameId)
    }
  }
  return patches
}
