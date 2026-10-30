/**
 * Batch duplication — the one path for duplicate (Mod+D), paste and
 * alt-drag, mirroring Excalidraw's `duplicateElements`:
 *   — every copy gets a fresh id (same seed, so it looks identical);
 *   — groups wholly copied become new groups (`remapGroupIdsForCopies`);
 *   — a line/arrow binding to a shape copied alongside it follows the
 *     copy; a binding to a shape left behind is dropped, so a copy never
 *     drags someone else's tip around;
 *   — bound text copied with its container binds to the copy.
 */

import type { Point, OpenDrawBinding, OpenDrawElement } from '../types.js'
import { duplicateElement, isLinearElement } from './factories.js'
import { remapGroupIdsForCopies } from './groups.js'

export interface DuplicateOptions {
  /** Scene offset applied to every copy. */
  offset?: Point
  /** Copies made inside an edited group stay members of it. */
  editingGroupId?: string | null
}

export function duplicateElements(
  originals: readonly OpenDrawElement[],
  options: DuplicateOptions = {},
): OpenDrawElement[] {
  const offset = options.offset ?? { x: 0, y: 0 }
  const idMap = new Map<string, string>()
  const copies = originals.map((el) => {
    const copy = duplicateElement(el, { x: el.x + offset.x, y: el.y + offset.y })
    idMap.set(el.id, copy.id)
    return copy
  })
  const remapBinding = (binding: OpenDrawBinding | null): OpenDrawBinding | null => {
    const target = binding ? idMap.get(binding.elementId) : undefined
    return target ? { elementId: target } : null
  }
  const rebound = copies.map((copy): OpenDrawElement => {
    if (isLinearElement(copy)) {
      return { ...copy, startBinding: remapBinding(copy.startBinding), endBinding: remapBinding(copy.endBinding) }
    }
    if (copy.type === 'text' && copy.containerId !== null) {
      // A label copied with its container moves into the copy; copied
      // without it, it becomes free text.
      return { ...copy, containerId: idMap.get(copy.containerId) ?? null }
    }
    return copy
  })
  return remapGroupIdsForCopies(rebound, options.editingGroupId ?? null)
}
