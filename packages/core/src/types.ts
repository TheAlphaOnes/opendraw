/**
 * @vuedraw/core — public type surface.
 *
 * The element model follows Excalidraw's proven shape (x/y anchored to the
 * un-rotated top-left, `angle` rotating around the center, style props on
 * every element) adapted to a smaller, fully typed surface.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export interface Point {
  x: number
  y: number
}

/** Axis-aligned bounding box in scene coordinates. */
export interface Bounds {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type Size = { width: number; height: number }

// ---------------------------------------------------------------------------
// Element style enums
// ---------------------------------------------------------------------------

export type ElementType =
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'image'
  | 'frame'

export type FillStyle = 'hachure' | 'cross-hatch' | 'solid'

export type StrokeStyle = 'solid' | 'dashed' | 'dotted'

export type StrokeWidth = 1 | 2 | 4

export type Roughness = 0 | 1 | 2

/** 0 (invisible) .. 100 (opaque), matching Excalidraw's UI scale. */
export type Opacity = number

export type FontFamily = 'hand' | 'normal' | 'code'

export type TextAlign = 'left' | 'center' | 'right'

export type VerticalAlign = 'top' | 'middle' | 'bottom'

/** Corner treatment for rectangles and diamonds. */
export type Roundness = 'round'

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

/**
 * Base of every element. Elements are immutable: every mutation produces a
 * new object (copy-on-write) so history snapshots and Vue consumers can rely
 * on reference identity.
 */
export interface VueDrawElementBase {
  id: string
  type: ElementType
  /** Un-rotated top-left corner in scene coordinates. */
  x: number
  y: number
  width: number
  height: number
  /** Radians, rotating around the element center. */
  angle: number
  strokeColor: string
  backgroundColor: string
  fillStyle: FillStyle
  strokeWidth: StrokeWidth
  strokeStyle: StrokeStyle
  roughness: Roughness
  opacity: Opacity
  /** Deterministic seed for rough.js — keeps hand-drawn strokes stable. */
  seed: number
  version: number
  /** Regenerated whenever a mutation is applied (last writer wins marker). */
  versionNonce: string
  locked: boolean
  /**
   * Groups this element belongs to, innermost first (Excalidraw's
   * `groupIds`). A group exists while two or more elements share an id.
   */
  groupIds: readonly string[]
}

/** Elements whose geometry is a polyline in local element space. */
export interface VueDrawLinearElement extends VueDrawElementBase {
  type: 'line' | 'arrow'
  points: Point[]
  /** Shape the start tip is docked to, or null when loose. */
  startBinding: VueDrawBinding | null
  /** Shape the end tip is docked to, or null when loose. */
  endBinding: VueDrawBinding | null
}

/**
 * A bound linear tip: the tip docks onto the shape's edge and follows the
 * shape around (Excalidraw's `startBinding`/`endBinding` — lines and arrows
 * both bind).
 */
export interface VueDrawBinding {
  /** Id of the shape the tip is docked to. */
  elementId: string
}

export interface VueDrawLineElement extends VueDrawLinearElement {
  type: 'line'
}

export interface VueDrawArrowElement extends VueDrawLinearElement {
  type: 'arrow'
}

/** Freedraw strokes store `[x, y, pressure]` triples in local space. */
export interface VueDrawFreedrawElement extends VueDrawElementBase {
  type: 'freedraw'
  points: number[][]
  /** True when the input device had no pressure channel (mouse). */
  simulatePressure: boolean
}

export interface VueDrawTextElement extends VueDrawElementBase {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: FontFamily
  textAlign: TextAlign
  verticalAlign: VerticalAlign
  lineHeight: number
}

export interface VueDrawRectangleElement extends VueDrawElementBase {
  type: 'rectangle'
  /** 'round' renders curved corners; null (or absent) keeps them sharp. */
  roundness?: Roundness | null
}

export interface VueDrawDiamondElement extends VueDrawElementBase {
  type: 'diamond'
  /** 'round' renders curved corners; null (or absent) keeps them sharp. */
  roundness?: Roundness | null
}

export interface VueDrawEllipseElement extends VueDrawElementBase {
  type: 'ellipse'
}

/**
 * An image, carried inline as a data URL (Excalidraw keeps bitmaps in a
 * separate file store keyed by `fileId`; vuedraw's single-document model
 * embeds the data on the element instead, so scenes stay one payload).
 * Geometry is box-like: bounds, hit testing, resize and rotation treat it
 * exactly like a rectangle.
 */
export interface VueDrawImageElement extends VueDrawElementBase {
  type: 'image'
  /** Self-contained `data:image/...;base64,` payload — survives export as-is. */
  dataUrl: string
}

/**
 * A frame: a named, dashed outline that visually groups its contents.
 * Box-like geometry; the name renders above the top-left corner.
 */
export interface VueDrawFrameElement extends VueDrawElementBase {
  type: 'frame'
  name: string
}

export type VueDrawElement =
  | VueDrawRectangleElement
  | VueDrawDiamondElement
  | VueDrawEllipseElement
  | VueDrawArrowElement
  | VueDrawLineElement
  | VueDrawFreedrawElement
  | VueDrawTextElement
  | VueDrawImageElement
  | VueDrawFrameElement

export type ElementOf<T extends ElementType> = Extract<VueDrawElement, { type: T }>

// ---------------------------------------------------------------------------
// Style payload — the subset of props style panels mutate on a selection
// ---------------------------------------------------------------------------

export interface ElementStyle {
  strokeColor: string
  backgroundColor: string
  fillStyle: FillStyle
  strokeWidth: StrokeWidth
  strokeStyle: StrokeStyle
  roughness: Roughness
  opacity: Opacity
}

/** Style props relevant only to text elements. */
export interface TextStyle {
  fontSize: number
  fontFamily: FontFamily
  textAlign: TextAlign
}

// ---------------------------------------------------------------------------
// Tools & app state
// ---------------------------------------------------------------------------

export type ToolId =
  | 'selection'
  | 'hand'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'image'
  | 'eraser'
  | 'frame'
  | 'laser'

export type ThemeName = 'light' | 'dark'

export interface Viewport {
  scrollX: number
  scrollY: number
  zoom: number
}

export interface VueDrawAppState {
  activeTool: ToolId
  theme: ThemeName
  viewBackgroundColor: string
  viewport: Viewport
  /** Selection as an id set — record form makes add/remove O(1) and JSON friendly. */
  selectedIds: Readonly<Record<string, true>>
  /** The element currently being text-edited, if any. */
  editingId: string | null
  /**
   * The group the user double-clicked into: inside it, clicks select the
   * next group level (or single members) instead of the whole group.
   */
  editingGroupId: string | null
  /** Scene grid size in px, or null when disabled. */
  gridSize: number | null
  /** Style applied to newly created elements. */
  style: ElementStyle
  textStyle: TextStyle
  /** Corner style applied to newly created rectangles and diamonds. */
  shapeRoundness: Roundness | null
}

// ---------------------------------------------------------------------------
// Document state snapshot
// ---------------------------------------------------------------------------

export interface VueDrawState {
  /** Ordered back-to-front. */
  elements: readonly VueDrawElement[]
  appState: Readonly<VueDrawAppState>
  /** Monotonic revision counter — bumped on every committed change. */
  rev: number
}

export type VueDrawStateListener = (state: VueDrawState) => void

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

export type HandleDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type ResizeHandle = HandleDirection | 'rotation'

export type ReorderAction = 'front' | 'back' | 'forward' | 'backward'

/** A single pointer action, reported through `onChange` after it commits. */
export type ChangeReason =
  | 'add'
  | 'update'
  | 'delete'
  | 'reorder'
  | 'select'
  | 'style'
  | 'viewport'
  | 'app-state'
  | 'load'

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export interface VueDrawFile {
  type: 'vuedraw'
  version: 1
  elements: VueDrawElement[]
  appState: {
    viewBackgroundColor: string
  }
}
