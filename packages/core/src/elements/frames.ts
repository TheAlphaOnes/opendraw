/**
 * Frame membership, a port of Excalidraw's element/src/frame.ts:
 *  - a new element joins the top-layer frame under the pointer, and is
 *     inserted among that frame's children (just below the frame);
 *  - a new frame adopts the elements completely inside it (a group only
 *     joins whole, `omitPartialGroups`);
 *  - dragged elements join the frame they are dropped over, or leave
 *     their frame once they no longer overlap the frame they end up in;
 *  - a resized frame re-adopts what it now covers;
 *  - children move with their frame and render clipped to it;
 *  - deleting a frame deletes its children.
 *
 * Frames never nest, groups containing a frame never join one, and bound
 * text always shares its container's frame.
 *
 * "Overlap" is measured on bounding boxes where Excalidraw intersects the
 * outlines' segments, the cases that differ (a shape's empty bbox corner
 * grazing the frame) cannot be told apart by the user mid-drag.
 */

import { boundsContain, boundsIntersect, getCommonBounds, getElementBounds, pointInBounds } from '../geometry/bounds.js'
import { measureTextWidth } from '../geometry/text.js'
import type { Bounds, Point, OpenDrawElement, OpenDrawFrameElement } from '../types.js'
import { isBoundText } from './boundText.js'
import { isFrameElement } from './factories.js'
import { elementsInGroup } from './groups.js'

/** Excalidraw's PRECISION: a frame snapped to an element's edge still contains it. */
const PRECISION = 10e-5

function frameInnerBounds(frame: OpenDrawFrameElement): Bounds {
  const b = getElementBounds(frame)
  return { x1: b.x1 - PRECISION, y1: b.y1 - PRECISION, x2: b.x2 + PRECISION, y2: b.y2 + PRECISION }
}

/** The elements currently belonging to the frame. */
export function frameChildren(elements: readonly OpenDrawElement[], frameId: string): OpenDrawElement[] {
  return elements.filter((el) => el.frameId === frameId)
}

/** True when the elements' common box lies inside the frame. */
export function elementsAreInFrameBounds(
  elements: readonly OpenDrawElement[],
  frame: OpenDrawFrameElement,
): boolean {
  return elements.length > 0 && boundsContain(frameInnerBounds(frame), getCommonBounds(elements))
}

/** Inside the frame, crossing its edge, or covering it whole. */
export function elementOverlapsFrame(element: OpenDrawElement, frame: OpenDrawFrameElement): boolean {
  return boundsIntersect(getElementBounds(element), frameInnerBounds(frame))
}

/** Drops elements whose outermost group holds a frame anywhere. */
function omitGroupsContainingFrames(
  all: readonly OpenDrawElement[],
  subset: readonly OpenDrawElement[],
): OpenDrawElement[] {
  const rejected = new Set<string>()
  for (const el of subset) {
    const outermost = el.groupIds[el.groupIds.length - 1]
    if (outermost && !rejected.has(outermost) && elementsInGroup(all, outermost).some(isFrameElement)) {
      rejected.add(outermost)
    }
  }
  return subset.filter((el) => !rejected.has(el.groupIds[el.groupIds.length - 1] ?? ''))
}

/**
 * Elements lying completely inside the frame that may belong to it: not
 * frames, not children of another frame. Labels follow their containers.
 */
export function elementsCompletelyInFrame(
  elements: readonly OpenDrawElement[],
  frame: OpenDrawFrameElement,
): OpenDrawElement[] {
  const box = frameInnerBounds(frame)
  const inside = elements.filter(
    (el) =>
      !isBoundText(el) &&
      ((!isFrameElement(el) && el.frameId === null) || el.frameId === frame.id) &&
      boundsContain(box, getElementBounds(el)),
  )
  return omitGroupsContainingFrames(elements, inside)
}

/** Keeps a grouped element only when its whole group fits in the frame. */
function omitPartialGroups(
  elements: readonly OpenDrawElement[],
  candidates: readonly OpenDrawElement[],
  frame: OpenDrawFrameElement,
): OpenDrawElement[] {
  const checked = new Map<string, boolean>()
  return candidates.filter((el) => {
    if (el.groupIds.length === 0) {
      return true
    }
    let omit: boolean
    if (el.groupIds.some((gid) => checked.get(gid))) {
      omit = true
    } else {
      const members = new Set(el.groupIds.flatMap((gid) => elementsInGroup(elements, gid)))
      omit = !elementsAreInFrameBounds([...members], frame)
    }
    for (const gid of el.groupIds) {
      checked.set(gid, omit)
    }
    return !omit
  })
}

/** What a freshly drawn frame adopts (Excalidraw's getElementsInNewFrame). */
export function elementsInNewFrame(
  elements: readonly OpenDrawElement[],
  frame: OpenDrawFrameElement,
): OpenDrawElement[] {
  return omitPartialGroups(elements, elementsCompletelyInFrame(elements, frame), frame)
}

/**
 * A resized frame's children (Excalidraw's getElementsInResizingFrame):
 * children it still overlaps stay, a grouped child keeps its whole group,
 * and whatever now lies completely inside joins, groups only whole.
 */
export function elementsInResizingFrame(
  elements: readonly OpenDrawElement[],
  frame: OpenDrawFrameElement,
): OpenDrawElement[] {
  const previous = frameChildren(elements, frame.id).filter((el) => !isBoundText(el))
  const next = new Set(previous)
  const frameBox = getElementBounds(frame)
  const completely = new Set([
    ...elementsCompletelyInFrame(elements, frame),
    ...previous.filter((el) => boundsContain(getElementBounds(el), frameBox)),
  ])
  const notCompletely = previous.filter((el) => !completely.has(el))
  const groupsToKeep = new Set([...completely].flatMap((el) => el.groupIds))

  for (const el of notCompletely) {
    if (!elementOverlapsFrame(el, frame)) {
      if (el.groupIds.length === 0) {
        next.delete(el)
      }
    } else {
      for (const gid of el.groupIds) {
        groupsToKeep.add(gid)
      }
    }
  }
  for (const el of notCompletely) {
    if (el.groupIds.length > 0 && !el.groupIds.some((gid) => groupsToKeep.has(gid))) {
      next.delete(el)
    }
  }
  for (const el of completely) {
    if (el.groupIds.length === 0) {
      next.add(el)
    }
  }
  const newGroups = new Set(
    [...completely].filter((el) => el.groupIds.length > 0).map((el) => el.groupIds[el.groupIds.length - 1]!),
  )
  for (const gid of newGroups) {
    const members = elementsInGroup(elements, gid)
    if (elementsAreInFrameBounds(members, frame)) {
      for (const member of members) {
        next.add(member)
      }
    }
  }
  return [...next].filter((el) => !isFrameElement(el) && !isBoundText(el))
}

/**
 * The ids plus every child of the frames among them, in scene order, what
 * move, nudge, duplicate and delete carry along with a frame.
 */
export function withFrameChildren(
  elements: readonly OpenDrawElement[],
  ids: Iterable<string>,
): OpenDrawElement[] {
  const wanted = new Set(ids)
  const frames = new Set(
    elements.filter((el) => wanted.has(el.id) && isFrameElement(el)).map((el) => el.id),
  )
  return elements.filter((el) => wanted.has(el.id) || (el.frameId !== null && frames.has(el.frameId)))
}

/**
 * Where a new child of the frame goes in z-order: just above the frame's
 * topmost child, or just below the frame (Excalidraw's
 * getFrameChildrenInsertionIndex). Null when the frame is not in the list.
 */
export function frameChildrenInsertionIndex(
  elements: readonly OpenDrawElement[],
  frameId: string,
): number | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!
    if (el.id === frameId) {
      return i
    }
    if (el.frameId === frameId) {
      return i + 1
    }
  }
  return null
}

/**
 * The frame assignments that put `members` into `frameId` (or out of any
 * frame with null). Bound labels follow their containers; frames never
 * nest, so frames themselves are skipped. Only real changes are returned.
 */
export function frameMembershipPatches(
  elements: readonly OpenDrawElement[],
  members: readonly OpenDrawElement[],
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

/**
 * Excalidraw's addElementsToFrame: members (and their labels) join the
 * frame and move just below it, or above its topmost child, unless they
 * all belonged to it already. Returns the next element list.
 */
export function addElementsToFrame(
  elements: readonly OpenDrawElement[],
  members: readonly OpenDrawElement[],
  frame: OpenDrawFrameElement,
): OpenDrawElement[] {
  // Frames never nest, and the children of another frame being added along
  // stay with their own frame.
  const otherFrames = new Set(members.filter((el) => isFrameElement(el) && el.id !== frame.id).map((el) => el.id))
  const eligible = omitGroupsContainingFrames(elements, members).filter(
    (el) => !isFrameElement(el) && !(el.frameId !== null && otherFrames.has(el.frameId)),
  )
  if (eligible.length === 0) {
    return [...elements]
  }
  const alreadyIn = eligible.every((el) => el.frameId === frame.id)
  const patches = frameMembershipPatches(elements, eligible, frame.id)
  const patched = elements.map((el) => (patches.has(el.id) ? { ...el, frameId: frame.id } : el))
  if (alreadyIn) {
    return patched
  }
  const moving = new Set([
    ...eligible.map((el) => el.id),
    ...patched.filter((el) => isBoundText(el) && eligible.some((m) => m.id === el.containerId)).map((el) => el.id),
  ])
  const rest = patched.filter((el) => !moving.has(el.id))
  const index = frameChildrenInsertionIndex(rest, frame.id)
  if (index === null) {
    return patched
  }
  const added = patched.filter((el) => moving.has(el.id))
  return [...rest.slice(0, index), ...added, ...rest.slice(index)]
}

/** Takes members (and their labels) out of whatever frame they are in. */
export function removeElementsFromFrame(
  elements: readonly OpenDrawElement[],
  members: readonly OpenDrawElement[],
): OpenDrawElement[] {
  const patches = frameMembershipPatches(elements, members, null)
  return elements.map((el) => (patches.has(el.id) ? { ...el, frameId: null } : el))
}

// ---------------------------------------------------------------------------
// Pointer queries
// ---------------------------------------------------------------------------

/** The topmost unlocked frame whose box contains the point, or null. */
export function frameAt(
  elements: readonly OpenDrawElement[],
  point: Point,
  excludeIds: ReadonlySet<string> = new Set(),
): OpenDrawFrameElement | null {
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

export interface TopLayerFrameOptions {
  /** Elements to look through (the dragged selection). */
  excludeIds?: ReadonlySet<string>
  /** The dragged elements' common frame, kept while they stay over it. */
  currentFrameId?: string | null
  /** Topmost element under the point, as the caller's hit test finds it. */
  hit?: OpenDrawElement | null
}

/**
 * Excalidraw's getTopLayerFrameAtSceneCoords: the frame a press or drop at
 * the point lands in. An element covering the point from above the top
 * frame (and outside it) wins unless it is that frame's child.
 */
export function topLayerFrameAt(
  elements: readonly OpenDrawElement[],
  point: Point,
  options: TopLayerFrameOptions = {},
): OpenDrawFrameElement | null {
  const under = elements.filter(
    (el): el is OpenDrawFrameElement => isFrameElement(el) && !el.locked && pointInBounds(point, getElementBounds(el)),
  )
  const top = under[under.length - 1]
  if (!top) {
    return null
  }
  const hit = options.hit && !options.excludeIds?.has(options.hit.id) ? options.hit : null
  if (!hit || isFrameElement(hit)) {
    return top
  }
  const hitIndex = elements.indexOf(hit)
  if (hitIndex !== -1 && hitIndex <= elements.indexOf(top)) {
    return top
  }
  const current = options.currentFrameId ? under.find((f) => f.id === options.currentFrameId) : undefined
  if (current) {
    return current
  }
  return hit.frameId ? (under.find((f) => f.id === hit.frameId) ?? null) : null
}

/** The frame every element shares, or null when they differ (getCommonFrameId). */
export function commonFrameId(elements: readonly OpenDrawElement[]): string | null {
  const first = elements[0]?.frameId ?? null
  return elements.every((el) => el.frameId === first) ? first : null
}

// ---------------------------------------------------------------------------
// Membership after gestures
// ---------------------------------------------------------------------------

/**
 * Excalidraw's isElementInFrame while the selection is dragged over
 * `frame`: a lone element must overlap it, a grouped one needs any member
 * of its group overlapping, and a group holding a frame never joins.
 */
function draggedElementInFrame(
  elements: readonly OpenDrawElement[],
  element: OpenDrawElement,
  frame: OpenDrawFrameElement,
): boolean {
  if (element.groupIds.length === 0) {
    return elementOverlapsFrame(element, frame)
  }
  const members = new Set(element.groupIds.flatMap((gid) => elementsInGroup(elements, gid)))
  if ([...members].some(isFrameElement)) {
    return false
  }
  return [...members].some((member) => elementOverlapsFrame(member, frame))
}

/**
 * Frame membership after the selection is dragged and dropped
 * (handleSelectionDragOnPointerUp + updateFrameMembershipOfSelectedElements):
 * dropped over an unselected frame, what overlaps it joins; any selected
 * child that no longer overlaps its target frame, the drop frame, or its
 * own when that frame was dragged along, leaves.
 */
export function frameMembershipAfterDrag(
  elements: readonly OpenDrawElement[],
  selectedIds: ReadonlySet<string>,
  dropFrame: OpenDrawFrameElement | null,
): OpenDrawElement[] {
  let next = [...elements]
  const selected = () => next.filter((el) => selectedIds.has(el.id) && !isBoundText(el))
  if (dropFrame && !selectedIds.has(dropFrame.id)) {
    next = addElementsToFrame(
      next,
      selected().filter((el) => draggedElementInFrame(next, el, dropFrame)),
      dropFrame,
    )
  }
  const leaving = selected().filter((el) => {
    if (el.frameId === null || isFrameElement(el) || selectedIds.has(el.frameId)) {
      return false
    }
    return !dropFrame || !draggedElementInFrame(next, el, dropFrame)
  })
  return leaving.length > 0 ? removeElementsFromFrame(next, leaving) : next
}

/** A resized frame swaps its children for what it now covers. */
export function frameMembershipAfterResize(
  elements: readonly OpenDrawElement[],
  frame: OpenDrawFrameElement,
): OpenDrawElement[] {
  const nextChildren = elementsInResizingFrame(elements, frame)
  const released = removeElementsFromFrame(elements, frameChildren(elements, frame.id))
  const current = released.find((el) => el.id === frame.id)
  return current && isFrameElement(current)
    ? addElementsToFrame(released, nextChildren.map((el) => released.find((r) => r.id === el.id) ?? el), current)
    : released
}

// ---------------------------------------------------------------------------
// The frame's name label (Excalidraw's FRAME_STYLE name metrics)
// ---------------------------------------------------------------------------

export const FRAME_NAME_STYLE = {
  /** Screen px, the label never scales with zoom. */
  fontSize: 14,
  lineHeight: 1.25,
  /** Screen px between the label's bottom and the frame's top edge. */
  offsetY: 3,
  fontFamily: 'Assistant, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const

/** The label a frame shows: its name, or "Frame" when unnamed. */
export function frameTitle(frame: OpenDrawFrameElement): string {
  return frame.name.trim() || 'Frame'
}

/** The label's font, as a CSS shorthand. */
export const FRAME_NAME_FONT = `${FRAME_NAME_STYLE.fontSize}px ${FRAME_NAME_STYLE.fontFamily}`

/**
 * The name label's box in scene coordinates at this zoom: anchored to the
 * frame's top-left corner, its bottom `offsetY` screen px above the frame,
 * never wider than the frame (the rest is ellipsized).
 */
export function frameNameBounds(frame: OpenDrawFrameElement, zoom: number): Bounds {
  const height = (FRAME_NAME_STYLE.fontSize * FRAME_NAME_STYLE.lineHeight) / zoom
  const width = Math.min(measureTextWidth(FRAME_NAME_FONT, frameTitle(frame)) / zoom, frame.width)
  const y2 = frame.y - FRAME_NAME_STYLE.offsetY / zoom
  return { x1: frame.x, y1: y2 - height, x2: frame.x + width, y2 }
}

/** The topmost frame whose name label is under the point, or null. */
export function frameNameAt(
  elements: readonly OpenDrawElement[],
  point: Point,
  zoom: number,
  threshold = 0,
): OpenDrawFrameElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!
    if (!isFrameElement(el)) {
      continue
    }
    const b = frameNameBounds(el, zoom)
    if (pointInBounds(point, { x1: b.x1 - threshold, y1: b.y1 - threshold, x2: b.x2 + threshold, y2: b.y2 + threshold })) {
      return el
    }
  }
  return null
}
