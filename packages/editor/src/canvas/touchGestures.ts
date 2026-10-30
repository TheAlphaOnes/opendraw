import type { Point } from '@opendrawjs/core'

import { clearFrameHighlights } from './frameGestures.js'
import type { LaserTrail } from './laserTrail.js'
import { finishLinearDraft } from './linearDraft.js'
import type { CanvasRuntime } from './runtime.js'

/**
 * Two-finger pinch and pan on touch screens, and Safari's trackpad pinch,
 * Excalidraw's multi-touch gesture (App.updateGestureOnPointerDown /
 * updateMultiTouchGesture, and onGestureChange).
 *
 * Touch pointers are tracked by id. A second finger turns the press into a
 * viewport gesture: whatever the first finger started a moment earlier (a
 * shape being drawn, a marquee, a move) is rolled back, then the distance
 * between the fingers zooms and their midpoint pans, both anchored where
 * the fingers are. Until every finger lifts, no new drawing gesture starts.
 *
 * Desktop Safari reports a trackpad pinch as WebKit `gesture*` events
 * rather than ctrl+wheel; those zoom around the pointer. On iOS the same
 * events also fire during a touch pinch, which the pointer path already
 * handles, so they are ignored while fingers are down.
 */

export interface TouchGestures {
  /** True when the event belongs to a multi-touch gesture (skip the normal press). */
  down: (event: PointerEvent) => boolean
  /** True when the move was consumed by the pinch. */
  move: (event: PointerEvent) => boolean
  /** True when the release ended (or followed) a pinch. */
  up: (event: PointerEvent) => boolean
  dispose: () => void
}

/** WebKit's non-standard GestureEvent (Safari only). */
interface WebKitGestureEvent extends UIEvent {
  scale: number
  clientX: number
  clientY: number
}

const center = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

export function createTouchGestures(rt: CanvasRuntime, laser: LaserTrail): TouchGestures {
  const { ctx, host } = rt
  /** Touch points currently down, in client coordinates. */
  const touches = new Map<number, Point>()
  /** Fingers that took part in a pinch: their releases never reach the press handlers. */
  const pinchFingers = new Set<number>()
  let lastCenter: Point | null = null
  let startDistance = 0
  let startZoom = 1

  /**
   * Undoes what the first finger began before the second landed: its open
   * step rolls back to where it started. A text edit owns its own step and
   * is left alone; a multi-click line draft keeps the points placed so far.
   */
  function abortSingleTouchGesture(): void {
    const current = rt.interaction.value
    switch (current.kind) {
      case 'none':
      case 'panning':
      case 'pinching':
        break
      case 'laser':
        laser.end()
        break
      case 'draftingLinear':
        finishLinearDraft(rt)
        break
      default:
        if (!ctx.editingId) {
          ctx.doc.cancelStep()
        }
    }
    rt.marquee.value = null
    rt.suggestedBinding.value = null
    clearFrameHighlights(rt)
  }

  function startPinch(): void {
    const [a, b] = [...touches.values()]
    abortSingleTouchGesture()
    rt.interaction.value = { kind: 'pinching' }
    lastCenter = center(a!, b!)
    startDistance = distance(a!, b!)
    startZoom = ctx.viewport.zoom
    for (const id of touches.keys()) {
      pinchFingers.add(id)
    }
  }

  function applyPinch(): void {
    const [a, b] = [...touches.values()]
    if (!a || !b || !lastCenter || startDistance === 0) {
      return
    }
    const next = center(a, b)
    // Zoom around the fingers' midpoint, then follow its movement 1:1, so
    // the content under the fingers stays under the fingers.
    ctx.zoomAt(rt.toHost({ clientX: next.x, clientY: next.y }), startZoom * (distance(a, b) / startDistance))
    ctx.panBy(next.x - lastCenter.x, next.y - lastCenter.y)
    lastCenter = next
  }

  // --- Safari trackpad pinch -------------------------------------------------

  let gestureStartZoom = 1
  const onGestureStart = (event: Event): void => {
    event.preventDefault()
    gestureStartZoom = ctx.viewport.zoom
  }
  const onGestureChange = (event: Event): void => {
    event.preventDefault()
    if (touches.size > 0) {
      return
    }
    const gesture = event as WebKitGestureEvent
    ctx.zoomAt(rt.toHost(gesture), gestureStartZoom * gesture.scale)
  }
  host.addEventListener('gesturestart', onGestureStart)
  host.addEventListener('gesturechange', onGestureChange)

  return {
    down(event) {
      if (event.pointerType !== 'touch') {
        return false
      }
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touches.size === 2) {
        startPinch()
        return true
      }
      // A third finger, or a finger landing while a pinch is winding down.
      return touches.size > 2 || rt.interaction.value.kind === 'pinching' || pinchFingers.size > 0
    },

    move(event) {
      if (!touches.has(event.pointerId)) {
        return false
      }
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (rt.interaction.value.kind !== 'pinching') {
        // A lone finger left over from a pinch does nothing until it lifts.
        return pinchFingers.has(event.pointerId)
      }
      if (touches.size === 2) {
        applyPinch()
      }
      return true
    },

    up(event) {
      if (!touches.delete(event.pointerId)) {
        return false
      }
      const wasPinchFinger = pinchFingers.delete(event.pointerId)
      if (rt.interaction.value.kind === 'pinching' && touches.size < 2) {
        rt.interaction.value = { kind: 'none' }
        lastCenter = null
      }
      return wasPinchFinger
    },

    dispose() {
      host.removeEventListener('gesturestart', onGestureStart)
      host.removeEventListener('gesturechange', onGestureChange)
    },
  }
}
