/**
 * Copy-on-write element mutation.
 *
 * Elements are frozen data: every mutation returns a new object with a
 * bumped `version` and fresh `versionNonce`, or the SAME reference when the
 * patch is a no-op (Excalidraw's `newElementWith` discipline).
 */

import type { OpenDrawElement } from '../types.js'
import { newNonce } from '../utils/rng.js'

/**
 * A partial element patch. `id` and `version` are managed by the mutation
 * itself and never patchable. Distributes over the element union so
 * text-specific patches (fontSize, fontFamily, …) typecheck on text
 * elements.
 */
export type ElementPatch<T extends OpenDrawElement = OpenDrawElement> = T extends OpenDrawElement
  ? Partial<Omit<T, 'id' | 'version' | 'versionNonce'>>
  : never

/** True when every key in `patch` is shallow-equal to the element. */
function isNoOp<T extends OpenDrawElement>(element: T, patch: ElementPatch<T>): boolean {
  for (const key of Object.keys(patch)) {
    const current = (element as unknown as Record<string, unknown>)[key]
    const next = (patch as unknown as Record<string, unknown>)[key]
    if (current !== next) {
      return false
    }
  }
  return true
}

/**
 * Applies a patch copy-on-write. Returns the same reference when nothing
 * actually changed — callers (history, Vue reactivity) rely on that.
 */
export function patchElement<T extends OpenDrawElement>(element: T, patch: ElementPatch<T>): T {
  if (isNoOp(element, patch)) {
    return element
  }
  return {
    ...element,
    ...patch,
    version: element.version + 1,
    versionNonce: newNonce(),
  }
}

/**
 * Applies a patch regardless of no-op detection — for interactive drags
 * where the patch function recomputes fresh geometry each move anyway.
 */
export function forcePatchElement<T extends OpenDrawElement>(
  element: T,
  patch: ElementPatch<T>,
): T {
  return {
    ...element,
    ...patch,
    version: element.version + 1,
    versionNonce: newNonce(),
  }
}
