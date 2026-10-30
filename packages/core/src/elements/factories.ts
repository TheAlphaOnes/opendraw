/**
 * Element factories, the only sanctioned way to create elements.
 *
 * Mirrors Excalidraw's `_newElementBase` pattern: one base spread, per-type
 * extras, deterministic seeds for rough.js, and `version: 1` at birth.
 */

import { layoutText, type TextLayout } from '../geometry/text.js'
import type {
  Arrowhead,
  ElementOf,
  ElementStyle,
  Point,
  Roundness,
  StylePayload,
  TextStyle,
  VerticalAlign,
  OpenDrawElement,
  OpenDrawElementBase,
  OpenDrawFreedrawElement,
  OpenDrawFrameElement,
  OpenDrawImageElement,
  OpenDrawLinearElement,
  OpenDrawTextElement,
} from '../types.js'
import type { OpenDrawArrowElement, OpenDrawLineElement } from '../types.js'
import { DEFAULT_ELEMENT_STYLE, DEFAULT_TEXT_STYLE, TRANSPARENT } from './defaults.js'
import { newId, newNonce, randomSeed } from '../utils/rng.js'
import { DEFAULT_STICKY_NOTE_BG, DEFAULT_STICKY_NOTE_STROKE, stickyNoteColor } from './stickyNote.js'

/** Runtime element type guards need a value-level list too. */
export const ELEMENT_TYPES = [
  'rectangle',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'freedraw',
  'text',
  'image',
  'frame',
  'stickynote',
] as const

export type OpenDrawElementType = (typeof ELEMENT_TYPES)[number]

export function isElementType(value: string): value is OpenDrawElementType {
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
  groupIds?: readonly string[]
  frameId?: string | null
  /** Corner treatment, consumed by the rectangle and diamond factories. */
  roundness?: Roundness | null
}

export interface NewLinearElementOptions extends NewElementOptions {
  points?: Point[]
  /** Defaults: arrows get an end `arrow` head, lines none (Excalidraw). */
  startArrowhead?: Arrowhead | null
  endArrowhead?: Arrowhead | null
  /** An elbow arrow (arrows only): routed orthogonally, never rounded. */
  elbowed?: boolean
}

export interface NewFreedrawOptions extends NewElementOptions {
  points?: number[][]
  simulatePressure?: boolean
}

export interface NewTextOptions extends NewElementOptions {
  text: string
  /** Binds the text inside this container shape. */
  containerId?: string | null
  verticalAlign?: VerticalAlign
  textStyle?: Partial<TextStyle>
  /** Optional layout override, pass your own measurement context. */
  layout?: TextLayout
}

export interface NewImageOptions extends NewElementOptions {
  /** Self-contained `data:image/...;base64,` payload. */
  dataUrl: string
  /** Intrinsic pixel size, required, images are never born with zero extent. */
  width: number
  height: number
}

export interface NewFrameOptions extends NewElementOptions {
  /** Label rendered above the frame's top-left corner. */
  name?: string
}

/** The base fields every element carries, with the literal type plugged in. */
type ElementBaseInit<T extends OpenDrawElementType> = Omit<OpenDrawElementBase, 'type'> & { type: T }

// ---------------------------------------------------------------------------
// Base construction
// ---------------------------------------------------------------------------

function baseElement<T extends OpenDrawElementType>(
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
    groupIds: opts.groupIds ?? [],
    frameId: opts.frameId ?? null,
  }
}

// ---------------------------------------------------------------------------
// Per-type factories
// ---------------------------------------------------------------------------

export function newRectangleElement(opts: NewElementOptions): ElementOf<'rectangle'> {
  return {
    ...baseElement('rectangle', opts),
    roundness: opts.roundness ?? null,
  } as ElementOf<'rectangle'>
}

export function newDiamondElement(opts: NewElementOptions): ElementOf<'diamond'> {
  return {
    ...baseElement('diamond', opts),
    roundness: opts.roundness ?? null,
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
    // Lines and arrows bind alike (Excalidraw's LinearElement).
    startBinding: null,
    endBinding: null,
    roundness: opts.elbowed ? null : (opts.roundness ?? null),
    startArrowhead: opts.startArrowhead ?? null,
    endArrowhead: opts.endArrowhead === undefined ? (type === 'arrow' ? 'arrow' : null) : opts.endArrowhead,
    ...(type === 'arrow' && opts.elbowed ? { elbowed: true } : {}),
  } as OpenDrawLineElement | OpenDrawArrowElement
}

export function newFreedrawElement(opts: NewFreedrawOptions): OpenDrawFreedrawElement {
  return {
    ...baseElement('freedraw', opts),
    points: opts.points ?? [],
    simulatePressure: opts.simulatePressure ?? true,
  }
}

export function newTextElement(opts: NewTextOptions): OpenDrawTextElement {
  const textStyle = { ...DEFAULT_TEXT_STYLE, ...opts.textStyle }
  const layout = opts.layout ?? layoutText(opts.text, textStyle.fontFamily, textStyle.fontSize)
  return {
    ...baseElement('text', opts),
    text: opts.text,
    originalText: opts.text,
    containerId: opts.containerId ?? null,
    fontSize: textStyle.fontSize,
    fontFamily: textStyle.fontFamily,
    textAlign: textStyle.textAlign,
    verticalAlign: opts.verticalAlign ?? 'top',
    lineHeight: 1.25,
    width: opts.width ?? layout.width,
    height: opts.height ?? layout.height,
  }
}

/** Generic dispatcher, the Vue layer stores the active tool, not a factory. */
export function newElement<T extends OpenDrawElementType>(
  type: T,
  opts: NewElementOptions & { text?: string; dataUrl?: string },
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
    case 'image':
      if (opts.dataUrl === undefined || opts.width === undefined || opts.height === undefined) {
        throw new Error('newElement("image") requires opts.dataUrl, opts.width and opts.height')
      }
      return newImageElement({
        ...opts,
        dataUrl: opts.dataUrl,
        width: opts.width,
        height: opts.height,
      }) as ElementOf<T>
    case 'frame':
      return newFrameElement(opts) as ElementOf<T>
    case 'stickynote':
      return newStickyNoteElement(opts) as ElementOf<T>
  }
  // Unreachable for the closed OpenDrawElementType union; the guard keeps the
  // generic dispatcher total without lying about its return type.
  throw new Error(`unsupported element type: ${String(type)}`)
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/**
 * Images carry their bitmap inline as a data URL (single-document model) and
 * behave box-like for all geometry. Decoding is deliberately NOT done here,
 * core stays environment-agnostic; the host injects a bitmap resolver at
 * render/export time.
 */
export function newImageElement(opts: NewImageOptions): ElementOf<'image'> {
  if (!opts.dataUrl.startsWith('data:image/')) {
    throw new Error('newImageElement requires a data: image URL')
  }
  if (opts.width <= 0 || opts.height <= 0) {
    throw new Error('newImageElement requires positive intrinsic dimensions')
  }
  return {
    ...baseElement('image', opts),
    dataUrl: opts.dataUrl,
  } as ElementOf<'image'>
}

/** Frames render a dashed, named outline; membership is visual, not stored. */
/**
 * Excalidraw's FRAME_STYLE: a frame never takes the current drawing style,
 * it is a transparent, crisp container whatever the style panel says.
 */
export const FRAME_ELEMENT_STYLE: Partial<ElementStyle> = {
  strokeColor: '#bbbbbb',
  strokeWidth: 2,
  strokeStyle: 'solid',
  fillStyle: 'solid',
  roughness: 0,
  backgroundColor: TRANSPARENT,
}

export function newFrameElement(opts: NewFrameOptions): ElementOf<'frame'> {
  return {
    ...baseElement('frame', { ...opts, style: FRAME_ELEMENT_STYLE }),
    name: opts.name ?? 'Frame',
  } as ElementOf<'frame'>
}

/**
 * A sticky note: always filled solid with never-transparent ink and paper
 * (Excalidraw's normalizeStickyNoteStyle). Like every tool, the creation
 * draft starts at its true size; the editor applies the click default and
 * the minimum on release.
 */
export function newStickyNoteElement(
  opts: NewElementOptions & { baseHeight?: number; created?: number | null },
): ElementOf<'stickynote'> {
  const base = baseElement('stickynote', opts)
  return {
    ...base,
    strokeColor: stickyNoteColor('strokeColor', opts.style?.strokeColor ?? DEFAULT_STICKY_NOTE_STROKE),
    backgroundColor: stickyNoteColor('backgroundColor', opts.style?.backgroundColor ?? DEFAULT_STICKY_NOTE_BG),
    fillStyle: 'solid',
    roundness: opts.roundness ?? 'round',
    baseHeight: opts.baseHeight ?? base.height,
    created: opts.created === undefined ? Date.now() : opts.created,
  } as ElementOf<'stickynote'>
}

/** The style payload a selection panel reads back from an element. */
export function elementStyleOf(element: OpenDrawElement): ElementStyle {
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

/** Everything Mod+Alt+C copies from an element. */
export function stylePayloadOf(element: OpenDrawElement): StylePayload {
  const payload: StylePayload = { style: elementStyleOf(element) }
  if (element.type === 'text') {
    payload.textStyle = textStyleOf(element)
  }
  if (element.type === 'rectangle' || element.type === 'diamond' || element.type === 'line' || element.type === 'stickynote') {
    payload.roundness = element.roundness ?? null
  }
  return payload
}

export function textStyleOf(element: OpenDrawTextElement): TextStyle {
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
export function duplicateElement<T extends OpenDrawElement>(
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
  element: OpenDrawElement,
): element is OpenDrawLineElement | OpenDrawArrowElement {
  return element.type === 'line' || element.type === 'arrow'
}

export function isFreedrawElement(
  element: OpenDrawElement,
): element is OpenDrawFreedrawElement {
  return element.type === 'freedraw'
}

export function isTextElement(element: OpenDrawElement): element is OpenDrawTextElement {
  return element.type === 'text'
}

export function isImageElement(element: OpenDrawElement): element is OpenDrawImageElement {
  return element.type === 'image'
}

export function isFrameElement(element: OpenDrawElement): element is OpenDrawFrameElement {
  return element.type === 'frame'
}

/**
 * Narrow to the arrow element, the only linear type that carries
 * `startBinding`/`endBinding` (binding logic relies on this).
 */
export function isArrowElement(element: OpenDrawElement): element is OpenDrawArrowElement {
  return element.type === 'arrow'
}
