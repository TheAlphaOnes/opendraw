import type {
  Bounds,
  HandleDirection,
  Point,
  SelectionFrame,
  OpenDrawBindableShape,
  OpenDrawElement,
} from '@opendraw/core'
import { screenToScene } from '@opendraw/core'

import { Cell } from '../cell.js'
import type { EditorController } from '../controller.js'

/**
 * The canvas's pointer state machine, one variant per live gesture.
 * Gesture handlers (press, drag, release) are split across modules and
 * share this single source of truth through {@link CanvasRuntime}.
 */
export type Interaction =
  | { kind: 'none' }
  | { kind: 'panning'; lastScreen: Point }
  | { kind: 'marquee'; originScene: Point; baseIds: string[] }
  | { kind: 'creating'; elementId: string; originScene: Point }
  | { kind: 'freedrawing'; elementId: string }
  | {
      kind: 'moving'
      originScene: Point
      originals: readonly OpenDrawElement[]
      /** Element to narrow the selection to on a no-drag pointerup, or null. */
      hitId: string | null
      didDrag: boolean
      /** Alt-drag already swapped the drag onto fresh duplicates. */
      duplicated: boolean
    }
  | { kind: 'resizing'; handle: HandleDirection; originals: readonly OpenDrawElement[] }
  | {
      kind: 'rotating'
      originals: readonly OpenDrawElement[]
      frame: SelectionFrame
      startAngle: number
    }
  | { kind: 'erasing'; lastScene: Point }
  | { kind: 'laser' }
  | {
      kind: 'movingPoint'
      elementId: string
      index: number
      /** Which tip the moved point is — start, end — or a midpoint (null). */
      end: 'start' | 'end' | null
    }
  | {
      kind: 'draftingLinear'
      elementId: string
      /** Points committed so far; a trailing temp point may follow beyond it. */
      committedCount: number
    }

export interface SuggestedBinding {
  shape: OpenDrawBindableShape
  pointer: Point
}

/** Keyboard modifiers sampled on every pointer and key event. */
export interface CanvasModifiers {
  shift: boolean
  alt: boolean
}

/**
 * Everything the canvas gesture modules share: the editor, the host
 * element, the live gesture and the transient overlay inputs. None of this
 * is document state — it lives and dies with the mounted canvas. The
 * transient values are cells so the surface (repaint) and the cursor can
 * react to them.
 */
export interface CanvasRuntime {
  ctx: EditorController
  host: HTMLElement
  interaction: Cell<Interaction>
  modifiers: Cell<CanvasModifiers>
  /** Marquee rect while drag-selecting, in scene coords. */
  marquee: Cell<Bounds | null>
  /**
   * The shape a dragged line/arrow tip would bind to and the pointer over
   * it — Excalidraw's suggestedBinding, highlighted on the overlay with its
   * side-midpoint snap dots.
   */
  suggestedBinding: Cell<SuggestedBinding | null>
  /** Scene point under an idle pointer — drives the hover cursor + probes. */
  hoverScene: Cell<Point | null>
  /** Space bar held → temporary pan mode. */
  spaceDown: Cell<boolean>
  /** Client-space event position → scene coordinates. */
  toScene: (event: { clientX: number; clientY: number }) => Point
  /** Client-space event position → host-local screen coordinates. */
  toHost: (event: { clientX: number; clientY: number }) => Point
  /** Repaints both canvases on the next frame — installed by the surface. */
  scheduleRender: () => void
}

export function createCanvasRuntime(ctx: EditorController, host: HTMLElement): CanvasRuntime {
  const toHost = (event: { clientX: number; clientY: number }): Point => {
    const rect = host.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  return {
    ctx,
    host,
    interaction: new Cell<Interaction>({ kind: 'none' }),
    modifiers: new Cell<CanvasModifiers>({ shift: false, alt: false }),
    marquee: new Cell<Bounds | null>(null),
    suggestedBinding: new Cell<SuggestedBinding | null>(null),
    hoverScene: new Cell<Point | null>(null),
    spaceDown: new Cell(false),
    toHost,
    toScene: (event) => screenToScene(toHost(event), ctx.viewport),
    scheduleRender: () => {},
  }
}

export function setModifiers(
  rt: CanvasRuntime,
  event: { shiftKey: boolean; altKey: boolean },
): void {
  const current = rt.modifiers.value
  if (current.shift !== event.shiftKey || current.alt !== event.altKey) {
    rt.modifiers.value = { shift: event.shiftKey, alt: event.altKey }
  }
}
