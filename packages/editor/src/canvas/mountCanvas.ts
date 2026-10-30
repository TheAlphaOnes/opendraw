import type { EditorController } from '../controller.js'
import { detectKeyPlatform } from '../actions/keys.js'
import { resolveCursor } from './cursor.js'
import { attachKeyboard } from './keyboard.js'
import { createLaserTrail } from './laserTrail.js'
import { onCanvasPointerMove } from './pointerDrag.js'
import { onCanvasPointerDown } from './pointerPress.js'
import { onCanvasPointerLeave, onCanvasPointerUp } from './pointerRelease.js'
import { createCanvasRuntime } from './runtime.js'
import { createCanvasSurface } from './surface.js'
import { onCanvasDoubleClick } from './textEntry.js'
import { attachSceneFonts } from './sceneFonts.js'
import { attachTextEditing } from './textEditor.js'
import { createTouchGestures } from './touchGestures.js'
import {
  onCanvasDrop,
  onCanvasWheel,
  onWindowPaste,
  resolveContextMenu,
  type CanvasContextMenuRequest,
} from './viewportGestures.js'

/**
 * Mounting the editor onto the DOM — the whole canvas behavior with no
 * framework underneath. An adapter renders three elements (a host and two
 * stacked canvases inside it) and hands them over; everything else —
 * pointer gestures, keyboard, wheel, drop/paste, rendering, the cursor,
 * the laser and text editing — is wired here, and `dispose()` unwires it.
 */

export interface MountCanvasOptions {
  /** The positioned host the canvases fill; receives pointer events and focus. */
  host: HTMLElement
  /** Static scene canvas. */
  staticCanvas: HTMLCanvasElement
  /** Interactive chrome canvas, stacked above the static one. */
  overlayCanvas: HTMLCanvasElement
  /**
   * Element whose keydown events drive shortcuts — the adapter's editor
   * shell, so shortcuts survive focus moving onto its toolbar. Defaults to
   * the nearest `[data-opendraw-root]` ancestor, else the host.
   */
  keyboardRoot?: HTMLElement
  /** A right-click asked for a context menu (the target is already selected). */
  onContextMenu?: (request: CanvasContextMenuRequest) => void
}

export interface CanvasSession {
  dispose: () => void
}

export function mountCanvas(editor: EditorController, options: MountCanvasOptions): CanvasSession {
  const { host, staticCanvas, overlayCanvas } = options
  const rt = createCanvasRuntime(editor, host)
  const surface = createCanvasSurface(rt, staticCanvas, overlayCanvas)
  const laser = createLaserTrail(rt)
  surface.setOverlayPainter(laser.draw)
  // Multi-touch runs ahead of the press handlers: a second finger turns
  // the gesture into a pinch, and pinch fingers never draw.
  const touch = createTouchGestures(rt, laser)
  const keyRoot = options.keyboardRoot ?? host.closest<HTMLElement>('[data-opendraw-root]') ?? host
  const detachKeyboard = attachKeyboard(rt, keyRoot)
  const detachTextEditing = attachTextEditing(editor, host)
  const detachFonts = attachSceneFonts(rt)

  // The cursor advertises what a press would do: recomputed on every input
  // that can change it and written straight to the host's style.
  function applyCursor(): void {
    const cursor = resolveCursor(rt)
    if (host.style.cursor !== cursor) {
      host.style.cursor = cursor
    }
    host.classList.toggle('opendraw-canvas--panning', rt.interaction.value.kind === 'panning')
  }

  /**
   * Suppress the mousedown default (focus move) for presses on the host
   * itself. Focus is managed explicitly on pointerdown, and the default
   * steals focus from a text editor mounted mid-press: pointerdown creates
   * the element, the editor mounts and focuses on the next microtask, and
   * the trailing mousedown would then blur it — committing the empty draft
   * and rolling the whole step back. Presses on child elements (the text
   * editor's textarea) keep their native behavior.
   */
  const onMouseDown = (event: MouseEvent): void => {
    if (event.target === host) {
      event.preventDefault()
    }
  }
  const onPointerDown = (event: PointerEvent): void => {
    if (!touch.down(event)) {
      onCanvasPointerDown(rt, laser, event)
    }
  }
  const onPointerMove = (event: PointerEvent): void => {
    if (!touch.move(event)) {
      onCanvasPointerMove(rt, laser, event)
    }
  }
  const onPointerUp = (event: PointerEvent): void => {
    if (!touch.up(event)) {
      onCanvasPointerUp(rt, laser, event)
    }
  }
  const onPointerLeave = (): void => onCanvasPointerLeave(rt)
  const onDoubleClick = (event: MouseEvent): void => onCanvasDoubleClick(rt, event)
  const onWheel = (event: WheelEvent): void => onCanvasWheel(rt, event)
  const onDragOver = (event: DragEvent): void => event.preventDefault()
  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    onCanvasDrop(rt, event)
  }
  const onPaste = (event: ClipboardEvent): void => onWindowPaste(rt, event)
  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
    options.onContextMenu?.(resolveContextMenu(rt, event))
  }

  const listeners: Array<[EventTarget, string, EventListener, AddEventListenerOptions?]> = [
    [host, 'pointerdown', onPointerDown as EventListener],
    [host, 'pointermove', onPointerMove as EventListener],
    [host, 'pointerup', onPointerUp as EventListener],
    [host, 'pointercancel', onPointerUp as EventListener],
    [host, 'pointerleave', onPointerLeave],
    [host, 'mousedown', onMouseDown as EventListener],
    // Non-passive: the wheel handler prevents page scroll/zoom.
    [host, 'wheel', onWheel as EventListener, { passive: false }],
    [host, 'dblclick', onDoubleClick as EventListener],
    [host, 'contextmenu', onContextMenu as EventListener],
    [host, 'dragover', onDragOver as EventListener],
    [host, 'drop', onDrop as EventListener],
    [window, 'paste', onPaste as EventListener],
  ]
  for (const [target, type, listener, opts] of listeners) {
    target.addEventListener(type, listener, opts)
  }

  const unsubscribers = [
    editor.subscribe(applyCursor),
    rt.interaction.subscribe(applyCursor),
    rt.hoverScene.subscribe(applyCursor),
    rt.spaceDown.subscribe(applyCursor),
  ]
  applyCursor()
  // Shortcut hints switch to ⌘/⌥ glyphs only once mounted (hydration-safe).
  detectKeyPlatform()

  return {
    dispose() {
      for (const [target, type, listener, opts] of listeners) {
        target.removeEventListener(type, listener, opts)
      }
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
      touch.dispose()
      detachFonts()
      detachTextEditing()
      detachKeyboard()
      laser.dispose()
      surface.dispose()
    },
  }
}
