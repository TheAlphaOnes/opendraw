/**
 * Bound text — text that lives inside a shape (Excalidraw's text
 * containers, element/src/textElement.ts).
 *
 * A text element with a `containerId` is laid out by its container: its
 * typed `originalText` wraps to the container's inner width, it sits
 * centered (or aligned) inside the inscribed rectangle, rotates with the
 * container, and the container grows when the text would overflow it.
 *
 * `syncBoundTexts` enforces all of that as an invariant of the document's
 * write funnel, so moving, resizing, rotating, aligning, flipping and
 * restyling a container never need bound-text code of their own.
 */

import { rotatePoint } from '../geometry/points.js'
import { layoutText, wrapText } from '../geometry/text.js'
import type { Point, VueDrawElement, VueDrawTextElement } from '../types.js'
import { isPointInsideElement } from './hitTest.js'
import type { ElementPatch } from './mutate.js'

/** Excalidraw's BOUND_TEXT_PADDING. */
export const BOUND_TEXT_PADDING = 5

export type TextContainer = Extract<VueDrawElement, { type: 'rectangle' | 'diamond' | 'ellipse' }>

/** Shapes that can hold text. */
export function isTextContainer(element: VueDrawElement): element is TextContainer {
  return element.type === 'rectangle' || element.type === 'diamond' || element.type === 'ellipse'
}

export function isBoundText(element: VueDrawElement): element is VueDrawTextElement & { containerId: string } {
  return element.type === 'text' && element.containerId !== null
}

/** Width of the largest padded rectangle inscribed in the container. */
export function boundTextMaxWidth(container: TextContainer): number {
  const { width } = container
  if (container.type === 'ellipse') {
    return Math.round((width / 2) * Math.SQRT2) - BOUND_TEXT_PADDING * 2
  }
  if (container.type === 'diamond') {
    return Math.round(width / 2) - BOUND_TEXT_PADDING * 2
  }
  return width - BOUND_TEXT_PADDING * 2
}

/** Height of the largest padded rectangle inscribed in the container. */
export function boundTextMaxHeight(container: TextContainer): number {
  const { height } = container
  if (container.type === 'ellipse') {
    return Math.round((height / 2) * Math.SQRT2) - BOUND_TEXT_PADDING * 2
  }
  if (container.type === 'diamond') {
    return Math.round(height / 2) - BOUND_TEXT_PADDING * 2
  }
  return height - BOUND_TEXT_PADDING * 2
}

/** The container size whose inner area fits `dimension` of text. */
export function containerSizeForText(dimension: number, type: TextContainer['type']): number {
  const size = Math.ceil(dimension)
  const padding = BOUND_TEXT_PADDING * 2
  if (type === 'ellipse') {
    return Math.round(((size + padding) / Math.SQRT2) * 2)
  }
  if (type === 'diamond') {
    return 2 * (size + padding)
  }
  return size + padding
}

/** Top-left of the container's inner text area (unrotated). */
export function containerTextOrigin(container: TextContainer): Point {
  let offsetX = BOUND_TEXT_PADDING
  let offsetY = BOUND_TEXT_PADDING
  if (container.type === 'ellipse') {
    offsetX += (container.width / 2) * (1 - Math.SQRT2 / 2)
    offsetY += (container.height / 2) * (1 - Math.SQRT2 / 2)
  } else if (container.type === 'diamond') {
    offsetX += container.width / 4
    offsetY += container.height / 4
  }
  return { x: container.x + offsetX, y: container.y + offsetY }
}

/**
 * The topmost unlocked shape whose AREA contains the point, filled or not
 * — where a double-click writes text (Excalidraw's
 * getTextBindableContainerAtPosition).
 */
export function textContainerAt(
  elements: readonly VueDrawElement[],
  point: Point,
): TextContainer | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]!
    if (isTextContainer(element) && !element.locked && isPointInsideElement(element, point)) {
      return element
    }
  }
  return null
}

/** The text bound inside `containerId`, if any. */
export function boundTextOf(
  elements: readonly VueDrawElement[],
  containerId: string,
): VueDrawTextElement | undefined {
  return elements.find(
    (el): el is VueDrawTextElement => el.type === 'text' && el.containerId === containerId,
  )
}

/**
 * What a pointer on `element` acts on: bound text resolves to its
 * container — in Excalidraw the label is part of the shape, never picked
 * on its own.
 */
export function selectableTarget(
  element: VueDrawElement,
  elements: readonly VueDrawElement[],
): VueDrawElement {
  if (!isBoundText(element)) {
    return element
  }
  return elements.find((el) => el.id === element.containerId) ?? element
}

/**
 * The ids plus every text bound inside them, in scene order — what
 * delete, duplicate, copy and z-order act on for a selection.
 */
export function withBoundTexts(
  elements: readonly VueDrawElement[],
  ids: Iterable<string>,
): VueDrawElement[] {
  const wanted = new Set(ids)
  return elements.filter((el) => wanted.has(el.id) || (isBoundText(el) && wanted.has(el.containerId)))
}

export interface BoundTextLayout {
  text: ElementPatch<VueDrawTextElement>
  /** Present when the container must grow to fit the text. */
  container: ElementPatch<TextContainer> | null
}

/**
 * Lays one bound text out inside its container: wrap, measure, grow the
 * container if needed, then align in the inscribed area and rotate the
 * text's center about the container's (Excalidraw's
 * redrawTextBoundingBox + computeBoundTextPosition).
 */
export function layoutBoundText(text: VueDrawTextElement, container: TextContainer): BoundTextLayout {
  const wrapped = wrapText(text.originalText, text.fontFamily, text.fontSize, boundTextMaxWidth(container))
  const metrics = layoutText(wrapped, text.fontFamily, text.fontSize)

  let containerPatch: ElementPatch<TextContainer> | null = null
  let fitted: TextContainer = container
  if (metrics.height > boundTextMaxHeight(container)) {
    const height = containerSizeForText(metrics.height, container.type)
    containerPatch = { height }
    fitted = { ...container, height }
  }

  const origin = containerTextOrigin(fitted)
  const maxWidth = boundTextMaxWidth(fitted)
  const maxHeight = boundTextMaxHeight(fitted)
  const x =
    text.textAlign === 'left'
      ? origin.x
      : text.textAlign === 'right'
        ? origin.x + maxWidth - metrics.width
        : origin.x + (maxWidth - metrics.width) / 2
  const y =
    text.verticalAlign === 'top'
      ? origin.y
      : text.verticalAlign === 'bottom'
        ? origin.y + maxHeight - metrics.height
        : origin.y + (maxHeight - metrics.height) / 2

  let position: Point = { x, y }
  if (fitted.angle !== 0) {
    // The text rotates about its own center, so place that center where
    // the container's rotation carries it.
    const containerCenter = { x: fitted.x + fitted.width / 2, y: fitted.y + fitted.height / 2 }
    const textCenter = rotatePoint(
      { x: x + metrics.width / 2, y: y + metrics.height / 2 },
      containerCenter,
      fitted.angle,
    )
    position = { x: textCenter.x - metrics.width / 2, y: textCenter.y - metrics.height / 2 }
  }

  return {
    text: {
      text: wrapped,
      width: metrics.width,
      height: metrics.height,
      x: position.x,
      y: position.y,
      angle: fitted.angle,
    },
    container: containerPatch,
  }
}

/**
 * Re-lays out every bound text whose own record or container changed
 * between `previous` and `next`. Returns `next` itself when nothing needed
 * fixing. `patch` is the caller's copy-on-write patcher (no-ops keep
 * their reference).
 */
export function syncBoundTexts(
  previous: readonly VueDrawElement[],
  next: VueDrawElement[],
  patch: <T extends VueDrawElement>(element: T, update: ElementPatch<T>) => T,
): VueDrawElement[] {
  if (!next.some(isBoundText)) {
    return next
  }
  const before = new Map(previous.map((el) => [el.id, el]))
  const index = new Map(next.map((el, i) => [el.id, i]))
  let result: VueDrawElement[] | null = null
  for (let i = 0; i < next.length; i++) {
    const text = (result ?? next)[i]!
    if (!isBoundText(text)) {
      continue
    }
    const containerIndex = index.get(text.containerId)
    if (containerIndex === undefined) {
      continue
    }
    const container = (result ?? next)[containerIndex]!
    if (!isTextContainer(container)) {
      continue
    }
    if (before.get(text.id) === text && before.get(container.id) === container) {
      continue
    }
    const layout = layoutBoundText(text, container)
    const nextText = patch(text, layout.text)
    const nextContainer = layout.container ? patch(container, layout.container) : container
    if (nextText !== text || nextContainer !== container) {
      result ??= [...next]
      result[i] = nextText
      result[containerIndex] = nextContainer
    }
  }
  return result ?? next
}
