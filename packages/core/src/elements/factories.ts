/**
 * Element factories — the only sanctioned way to create elements.
 *
 * Mirrors Excalidraw's `_newElementBase` pattern: one base spread, per-type
 * extras, deterministic seeds for rough.js, and `version: 1` at birth.
 */

import { layoutText, type TextLayout } from '../geometry/text.js'
import type {
  ElementOf,
  ElementStyle,
  Point,
  TextStyle,
  VueDrawElement,
  VueDrawElementBase,
  VueDrawFreedrawElement,
  VueDrawLinearElement,
  VueDrawTextElement,
} from '../types.js'
import type { VueDrawArrowElement, VueDrawLineElement } from '../types.js'
import { DEFAULT_ELEMENT_STYLE, DEFAULT_TEXT_STYLE, TRANSPARENT } from './defaults.js'
import { newId, newNonce, randomSeed } from '../utils/rng.js'

/** Runtime element type guards need a value-level list too. */
export const ELEMENT_TYPES = [
  'rectangle',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'freedraw',
  'text',
] as const

export type VueDrawElementType = (typeof ELEMENT_TYPES)[number]

export function isElementType(value: string): value is VueDrawElementType {
  return (ELEMENT_TYPES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface NewElementOptions {
  x: number
  y: number
  width?: number
  height?: number
  /** Overrides individual style props on top of the defaults. */
  style?: Partial<ElementStyle>
  angle?: number
  id?: string
  seed?: number
  version?: number
  locked?: boolean
}

export interface NewLinearElementOptions extends NewElementOptions {
  points?: Point[]
}

export interface NewFreedrawOptions extends NewElementOptions {
  points?: number[][]
  simulatePressure?: boolean
}

export interface NewTextOptions extends NewElementOptions {
  text: string
  textStyle?: Partial<TextStyle>
  /** Optional layout override — pass your own measurement context. */
  layout?: TextLayout
}

/** The base fields every element carries, with the literal type plugged in. */
type ElementBaseInit<T extends VueDrawElementType> = Omit<VueDrawElementBase, 'type'> & { type: T }

// ---------------------------------------------------------------------------
// Base construction
// ---------------------------------------------------------------------------

function baseElement<T extends VueDrawElementType>(
  type: T,
  opts: NewElementOptions,
): ElementBaseInit<T> {
  const style = { ...DEFAULT_ELEMENT_STYLE, ...opts.style }
  return {
    id: opts.id ?? newId(),
    type,
    x: opts.x,
    y: opts.y,
    width: opts.width ?? 0,
    height: opts.height ?? 0,
    angle: opts.angle ?? 0,
    ...style,
    backgroundColor: style.backgroundColor || TRANSPARENT,
    seed: opts.seed ?? randomSeed(),
    version: opts.version ?? 1,
    versionNonce: newNonce(),
    locked: opts.locked ?? false,
  }
}

// ---------------------------------------------------------------------------
// Per-type factories
// ---------------------------------------------------------------------------

export function newRectangleElement(opts: NewElementOptions): ElementOf<'rectangle'> {
  return {
    ...baseElement('rectangle', opts),
  } as ElementOf<'rectangle'>
}

export function newDiamondElement(opts: NewElementOptions): ElementOf<'diamond'> {
  return {
    ...baseElement('diamond', opts),
  } as ElementOf<'diamond'>
}

export function newEllipseElement(opts: NewElementOptions): ElementOf<'ellipse'> {
  return {
    ...baseElement('ellipse', opts),
  } as ElementOf<'ellipse'>
}

export function newLinearElement(
  type: 'line' | 'arrow',
  opts: NewLinearElementOptions,
): ElementOf<'line'> | ElementOf<'arrow'> {
  return {
    ...baseElement(type, opts),
    points: opts.points ?? [{ x: 0, y: 0 }],
    ...(type === 'arrow' ? { startBinding: null, endBinding: null } : {}),
  } as VueDrawLineElement | VueDrawArrowElement
}

export function newFreedrawElement(opts: NewFreedrawOptions): VueDrawFreedrawElement {
  return {
    ...baseElement('freedraw', opts),
    points: opts.points ?? [],
    simulatePressure: opts.simulatePressure ?? true,
  }
}

export function newTextElement(opts: NewTextOptions): VueDrawTextElement {
  const textStyle = { ...DEFAULT_TEXT_STYLE, ...opts.textStyle }
  const layout = opts.layout ?? layoutText(opts.text, textStyle.fontFamily, textStyle.fontSize)
  return {
    ...baseElement('text', opts),
    text: opts.text,
    fontSize: textStyle.fontSize,
    fontFamily: textStyle.fontFamily,
    textAlign: textStyle.textAlign,
    verticalAlign: 'top',
    lineHeight: 1.25,
    width: opts.width ?? layout.width,
    height: opts.height ?? layout.height,
  }
}

/** Generic dispatcher — the Vue layer stores the active tool, not a factory. */
export function newElement<T extends VueDrawElementType>(
  type: T,
  opts: NewElementOptions & { text?: string },
): ElementOf<T> {
  switch (type) {
    case 'rectangle':
      return newRectangleElement(opts) as ElementOf<T>
    case 'diamond':
      return newDiamondElement(opts) as ElementOf<T>
    case 'ellipse':
      return newEllipseElement(opts) as ElementOf<T>
    case 'line':
    case 'arrow':
      return newLinearElement(type, opts as NewLinearElementOptions) as ElementOf<T>
    case 'freedraw':
      return newFreedrawElement(opts as NewFreedrawOptions) as ElementOf<T>
    case 'text':
      if (opts.text === undefined) {
        throw new Error('newElement("text") requires opts.text')
      }
      return newTextElement({ ...opts, text: opts.text }) as ElementOf<T>
  }
  // Unreachable for the closed VueDrawElementType union; the guard keeps the
  // generic dispatcher total without lying about its return type.
  throw new Error(`unsupported element type: ${String(type)}`)
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** The style payload a selection panel reads back from an element. */
export function elementStyleOf(element: VueDrawElement): ElementStyle {
  return {
    strokeColor: element.strokeColor,
    backgroundColor: element.backgroundColor,
    fillStyle: element.fillStyle,
    strokeWidth: element.strokeWidth,
    strokeStyle: element.strokeStyle,
    roughness: element.roughness,
    opacity: element.opacity,
  }
}

export function textStyleOf(element: VueDrawTextElement): TextStyle {
  return {
    fontSize: element.fontSize,
    fontFamily: element.fontFamily,
    textAlign: element.textAlign,
  }
}

/**
 * Duplicate an element: fresh identity, identical look. Keeping the seed
 * makes the copy render with the same hand-drawn jitter.
 */
export function duplicateElement<T extends VueDrawElement>(
  element: T,
  patch: Partial<NewElementOptions> = {},
): T {
  return {
    ...element,
    id: patch.id ?? newId(),
    x: patch.x ?? element.x,
    y: patch.y ?? element.y,
    version: 1,
    versionNonce: newNonce(),
  }
}

/**
 * Type predicate helpers used across the codebase.
 *
 * `isLinearElement` narrows to the CONCRETE line/arrow members, not the
 * shared base: only those stay assignable to the element union now that
 * arrows carry `startBinding`/`endBinding`.
 */
export function isLinearElement(
  element: VueDrawElement,
): element is VueDrawLineElement | VueDrawArrowElement {
  return element.type === 'line' || element.type === 'arrow'
}

export function isFreedrawElement(
  element: VueDrawElement,
): element is VueDrawFreedrawElement {
  return element.type === 'freedraw'
}

export function isTextElement(element: VueDrawElement): element is VueDrawTextElement {
  return element.type === 'text'
}

/**
 * Narrow to the arrow element — the only linear type that carries
 * `startBinding`/`endBinding` (binding logic relies on this).
 */
export function isArrowElement(element: VueDrawElement): element is VueDrawArrowElement {
  return element.type === 'arrow'
}
