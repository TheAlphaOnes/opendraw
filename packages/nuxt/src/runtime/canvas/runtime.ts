import { shallowRef, ref, type Ref, type ShallowRef } from 'vue'

import type {
  Bounds,
  HandleDirection,
  Point,
  SelectionFrame,
  VueDrawBindableShape,
  VueDrawElement,
} from '@vuedraw/core'
import { screenToScene } from '@vuedraw/core'

import type { VueDrawContext } from '../composables/useVueDraw.js'

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
      originals: readonly VueDrawElement[]
      /** Element to narrow the selection to on a no-drag pointerup, or null. */
      hitId: string | null
      didDrag: boolean
      /** Alt-drag already swapped the drag onto fresh duplicates. */
      duplicated: boolean
    }
  | { kind: 'resizing'; handle: HandleDirection; originals: readonly VueDrawElement[] }
  | {
      kind: 'rotating'
      originals: readonly VueDrawElement[]
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

/** Keyboard modifiers sampled on every pointer and key event. */
export interface CanvasModifiers {
  shift: boolean
  alt: boolean
}

/**
 * Everything the canvas gesture modules share: the editor context, the
 * host element, the live gesture and the transient overlay inputs. None
 * of this is document state — it lives and dies with the mounted canvas.
 */
export interface CanvasRuntime {
  ctx: VueDrawContext
  hostRef: Ref<HTMLDivElement | null>
  interaction: ShallowRef<Interaction>
  modifiers: ShallowRef<CanvasModifiers>
  /** Marquee rect while drag-selecting, in scene coords. */
  marquee: ShallowRef<Bounds | null>
  /** Shapes the live line/arrow probes would dock onto — outlined on the overlay. */
  bindingCandidates: ShallowRef<readonly VueDrawBindableShape[]>
  /** Scene point under an idle pointer — drives the hover cursor + probes. */
  hoverScene: ShallowRef<Point | null>
  /** Space bar held → temporary pan mode. */
  spaceDown: Ref<boolean>
  /** Client-space event position → scene coordinates. */
  toScene: (event: { clientX: number; clientY: number }) => Point
  /** Client-space event position → host-local screen coordinates. */
  toHost: (event: { clientX: number; clientY: number }) => Point
  /** Repaints both canvases on the next frame — installed by the surface. */
  scheduleRender: () => void
}

export function createCanvasRuntime(ctx: VueDrawContext): CanvasRuntime {
  const hostRef = ref<HTMLDivElement | null>(null)
  const toHost = (event: { clientX: number; clientY: number }): Point => {
    const rect = hostRef.value!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  return {
    ctx,
    hostRef,
    interaction: shallowRef<Interaction>({ kind: 'none' }),
    modifiers: shallowRef<CanvasModifiers>({ shift: false, alt: false }),
    marquee: shallowRef<Bounds | null>(null),
    bindingCandidates: shallowRef<readonly VueDrawBindableShape[]>([]),
    hoverScene: shallowRef<Point | null>(null),
    spaceDown: ref(false),
    toHost,
    toScene: (event) => screenToScene(toHost(event), ctx.viewport.value),
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
