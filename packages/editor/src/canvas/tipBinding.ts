import type { ElementPatch, OpenDrawLinearElement, Point } from '@opendraw/core'
import {
  boundTipsPatch,
  isLinearElement,
  localPointOf,
  pointsPatch,
  resolveTipBinding,
} from '@opendraw/core'

import type { CanvasRuntime } from './runtime.js'

/**
 * Binding a dragged line/arrow tip as it moves — Excalidraw's
 * bindOrUnbindBindingElement during a point drag:
 *   — Ctrl/⌘ held skips binding altogether (the tip stays loose);
 *   — Alt binds inside at the exact point;
 *   — otherwise the "simple" strategy decides (see resolveTipBinding);
 * then every bound tip snaps where its binding says, live, and the shape
 * being bound to becomes the suggested binding the overlay highlights.
 */

export interface TipModifiers {
  /** Ctrl/⌘ — skip binding (Excalidraw's bindMode "skip"). */
  skip: boolean
  /** Alt — bind inside at the exact point. */
  inside: boolean
}

export function tipModifiers(event: { ctrlKey: boolean; metaKey: boolean; altKey: boolean }): TipModifiers {
  return { skip: event.ctrlKey || event.metaKey, inside: event.altKey }
}

/**
 * Moves tip `end` of linear element `id` to `tip` and (re)binds it. The
 * other tip of a two-point element re-aims with it. Writes are forced:
 * this runs per pointer move inside the gesture's open step.
 */
export function dragTipTo(
  rt: CanvasRuntime,
  id: string,
  end: 'start' | 'end',
  tip: Point,
  modifiers: TipModifiers,
): void {
  const { ctx } = rt
  const current = ctx.doc.getElement(id)
  if (!current || !isLinearElement(current)) {
    return
  }
  const points = current.points.map((p) => ({ ...p }))
  // A fresh draft holds only its start: give the end tip a point of its own.
  if (points.length < 2) {
    points.push({ ...points[0]! })
  }
  points[end === 'start' ? 0 : points.length - 1] = localPointOf(current, tip)
  const moved = { ...current, ...pointsPatch(current, points) } as OpenDrawLinearElement

  const resolved = modifiers.skip
    ? { binding: null, shape: null }
    : resolveTipBinding(moved, end, tip, ctx.elements, ctx.viewport.zoom, { inside: modifiers.inside })
  const bindings: Pick<OpenDrawLinearElement, 'startBinding' | 'endBinding'> = {
    startBinding: end === 'start' ? resolved.binding : moved.startBinding,
    endBinding: end === 'end' ? resolved.binding : moved.endBinding,
  }
  if (resolved.other !== undefined) {
    bindings[end === 'start' ? 'endBinding' : 'startBinding'] = resolved.other
  }
  const bound = { ...moved, ...bindings }
  const snapped = boundTipsPatch(bound, ctx.elements, { dragging: true })
  const patch: ElementPatch<OpenDrawLinearElement> = { ...pointsPatch(current, points), ...bindings, ...(snapped ?? {}) }
  ctx.doc.forceUpdateElement(id, patch)
  rt.suggestedBinding.value = resolved.shape ? { shape: resolved.shape, pointer: tip } : null
}
