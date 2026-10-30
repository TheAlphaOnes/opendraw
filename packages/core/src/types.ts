/**
 * @opendraw/core — public type surface.
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
export interface OpenDrawElementBase {
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
  /**
   * The frame this element belongs to (Excalidraw's frameId), or null.
   * Children move with their frame and render clipped to it.
   */
  frameId: string | null
}

/** Excalidraw's arrowhead kinds (the cardinality markers aside). */
export type Arrowhead =
  | 'arrow'
  | 'bar'
  | 'circle'
  | 'circle_outline'
  | 'triangle'
  | 'triangle_outline'
  | 'diamond'
  | 'diamond_outline'

/** Elements whose geometry is a polyline in local element space. */
export interface OpenDrawLinearElement extends OpenDrawElementBase {
  type: 'line' | 'arrow'
  points: Point[]
  /**
   * 'round' draws the polyline as a smooth curve through its points
   * (Excalidraw's round lines / "round" arrow type); null keeps it sharp.
   */
  roundness: Roundness | null
  /** Head drawn at the first point, or null. Only arrows render heads. */
  startArrowhead: Arrowhead | null
  /** Head drawn at the last point, or null. */
  endArrowhead: Arrowhead | null
  /** Shape the start tip is docked to, or null when loose. */
  startBinding: OpenDrawBinding | null
  /** Shape the end tip is docked to, or null when loose. */
  endBinding: OpenDrawBinding | null
}

/**
 * Where inside a shape a bound tip aims, as ratios of the shape's
 * (unrotated) width and height — [0.5, 0.5] is the center. Survives the
 * shape moving, resizing and rotating (Excalidraw's FixedPoint).
 */
export type FixedPoint = readonly [number, number]

/**
 * `orbit`: the tip stops on the shape's outline (plus a gap), on the line
 * toward its fixed point. `inside`: the tip goes all the way to the fixed
 * point (Excalidraw's BindMode, without its transient "skip").
 */
export type BindMode = 'orbit' | 'inside'

/**
 * A bound linear tip (Excalidraw's FixedPointBinding) — lines and arrows
 * bind alike through `startBinding` / `endBinding`.
 */
export interface OpenDrawBinding {
  /** Id of the shape the tip is bound to. */
  elementId: string
  fixedPoint: FixedPoint
  mode: BindMode
}

export interface OpenDrawLineElement extends OpenDrawLinearElement {
  type: 'line'
}

export interface OpenDrawArrowElement extends OpenDrawLinearElement {
  type: 'arrow'
}

/** Freedraw strokes store `[x, y, pressure]` triples in local space. */
export interface OpenDrawFreedrawElement extends OpenDrawElementBase {
  type: 'freedraw'
  points: number[][]
  /** True when the input device had no pressure channel (mouse). */
  simulatePressure: boolean
}

export interface OpenDrawTextElement extends OpenDrawElementBase {
  type: 'text'
  /** The text as rendered — wrapped to the container when bound. */
  text: string
  /** The text as typed, before any wrapping (Excalidraw's originalText). */
  originalText: string
  /**
   * The shape this text is bound inside (Excalidraw's containerId), or
   * null for free-standing text. Bound text is laid out by its container.
   */
  containerId: string | null
  fontSize: number
  fontFamily: FontFamily
  textAlign: TextAlign
  verticalAlign: VerticalAlign
  lineHeight: number
}

export interface OpenDrawRectangleElement extends OpenDrawElementBase {
  type: 'rectangle'
  /** 'round' renders curved corners; null (or absent) keeps them sharp. */
  roundness?: Roundness | null
}

export interface OpenDrawDiamondElement extends OpenDrawElementBase {
  type: 'diamond'
  /** 'round' renders curved corners; null (or absent) keeps them sharp. */
  roundness?: Roundness | null
}

export interface OpenDrawEllipseElement extends OpenDrawElementBase {
  type: 'ellipse'
}

/**
 * An image, carried inline as a data URL (Excalidraw keeps bitmaps in a
 * separate file store keyed by `fileId`; opendraw's single-document model
 * embeds the data on the element instead, so scenes stay one payload).
 * Geometry is box-like: bounds, hit testing, resize and rotation treat it
 * exactly like a rectangle.
 */
export interface OpenDrawImageElement extends OpenDrawElementBase {
  type: 'image'
  /** Self-contained `data:image/...;base64,` payload — survives export as-is. */
  dataUrl: string
}

/**
 * A frame: a named, dashed outline that visually groups its contents.
 * Box-like geometry; the name renders above the top-left corner.
 */
export interface OpenDrawFrameElement extends OpenDrawElementBase {
  type: 'frame'
  name: string
}

export type OpenDrawElement =
  | OpenDrawRectangleElement
  | OpenDrawDiamondElement
  | OpenDrawEllipseElement
  | OpenDrawArrowElement
  | OpenDrawLineElement
  | OpenDrawFreedrawElement
  | OpenDrawTextElement
  | OpenDrawImageElement
  | OpenDrawFrameElement

export type ElementOf<T extends ElementType> = Extract<OpenDrawElement, { type: T }>

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

/**
 * A copied style (Mod+Alt+C): the element style plus the type-specific
 * parts that only apply where they make sense on paste.
 */
export interface StylePayload {
  style: ElementStyle
  /** Present when copied from a text element. */
  textStyle?: TextStyle
  /** Present when copied from a rectangle or diamond. */
  roundness?: Roundness | null
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

export interface OpenDrawAppState {
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
  /** Heads given to newly drawn arrows. */
  arrowheads: { start: Arrowhead | null; end: Arrowhead | null }
  /** Shape of newly drawn arrows: curved through their points, or sharp. */
  arrowType: 'round' | 'sharp'
}

// ---------------------------------------------------------------------------
// Document state snapshot
// ---------------------------------------------------------------------------

export interface OpenDrawState {
  /** Ordered back-to-front. */
  elements: readonly OpenDrawElement[]
  appState: Readonly<OpenDrawAppState>
  /** Monotonic revision counter — bumped on every committed change. */
  rev: number
}

export type OpenDrawStateListener = (state: OpenDrawState) => void

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

export interface OpenDrawFile {
  type: 'opendraw'
  version: 1
  elements: OpenDrawElement[]
  appState: {
    viewBackgroundColor: string
  }
}
