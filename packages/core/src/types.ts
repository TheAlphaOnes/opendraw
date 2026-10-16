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

export type FillStyle = 'hachure' | 'cross-hatch' | 'solid'

export type StrokeStyle = 'solid' | 'dashed' | 'dotted'

export type StrokeWidth = 1 | 2 | 4

export type Roughness = 0 | 1 | 2

/** 0 (invisible) .. 100 (opaque), matching Excalidraw's UI scale. */
export type Opacity = number

export type FontFamily = 'hand' | 'normal' | 'code'

export type TextAlign = 'left' | 'center' | 'right'

export type VerticalAlign = 'top' | 'middle' | 'bottom'

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
}

/** Elements whose geometry is a polyline in local element space. */
export interface VueDrawLinearElement extends VueDrawElementBase {
  type: 'line' | 'arrow'
  points: Point[]
}

/**
 * A bound arrow tip: the tip docks onto the shape's edge and follows the
 * shape around (Excalidraw's `startBinding`/`endBinding`).
 */
export interface VueDrawArrowBinding {
  /** Id of the shape the tip is docked to. */
  elementId: string
}

export interface VueDrawLineElement extends VueDrawLinearElement {
  type: 'line'
}

export interface VueDrawArrowElement extends VueDrawLinearElement {
  type: 'arrow'
  /** Shape the start tip is docked to, or null when loose. */
  startBinding: VueDrawArrowBinding | null
  /** Shape the end tip is docked to, or null when loose. */
  endBinding: VueDrawArrowBinding | null
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
}

export interface VueDrawDiamondElement extends VueDrawElementBase {
  type: 'diamond'
}

export interface VueDrawEllipseElement extends VueDrawElementBase {
  type: 'ellipse'
}

export type VueDrawElement =
  | VueDrawRectangleElement
  | VueDrawDiamondElement
  | VueDrawEllipseElement
  | VueDrawArrowElement
  | VueDrawLineElement
  | VueDrawFreedrawElement
  | VueDrawTextElement

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
  | 'eraser'

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
  /** Scene grid size in px, or null when disabled. */
  gridSize: number | null
  /** Style applied to newly created elements. */
  style: ElementStyle
  textStyle: TextStyle
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
