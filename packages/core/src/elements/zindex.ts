/**
 * Z-order — Excalidraw's element/src/zindex.ts semantics on a plain array.
 *
 * Forward/backward move each contiguous run of selected elements past the
 * next UNIT in that direction: a whole group (outermost below the edited
 * group) or a shape with its label counts as one unit, so stepping never
 * threads an element into the middle of a group.
 */

import type { ReorderAction, OpenDrawElement } from '../types.js'
import { isBoundText } from './boundText.js'
import { outermostGroupId } from './groups.js'

/** The unit an element belongs to when stepping past it. */
function unitKey(element: OpenDrawElement, editingGroupId: string | null): string {
  if (isBoundText(element)) {
    return `el:${element.containerId}`
  }
  const group = outermostGroupId(element, editingGroupId)
  return group ? `group:${group}` : `el:${element.id}`
}

/**
 * Reorders `elements` so the `ids` move as `action` says. Returns null
 * when nothing moves.
 */
export function reorderElements(
  elements: readonly OpenDrawElement[],
  ids: ReadonlySet<string>,
  action: ReorderAction,
  editingGroupId: string | null = null,
): OpenDrawElement[] | null {
  if (action === 'front' || action === 'back') {
    const selected = elements.filter((el) => ids.has(el.id))
    const rest = elements.filter((el) => !ids.has(el.id))
    const next = action === 'front' ? [...rest, ...selected] : [...selected, ...rest]
    return next.some((el, i) => el !== elements[i]) ? next : null
  }
  const arr = [...elements]
  let moved = false
  const forward = action === 'forward'
  // Walk runs from the side we move toward, so a moved run never blocks
  // the next one's step.
  let i = forward ? arr.length - 1 : 0
  while (forward ? i >= 0 : i < arr.length) {
    if (!ids.has(arr[i]!.id)) {
      i += forward ? -1 : 1
      continue
    }
    // The maximal selected run containing i.
    let start = i
    let end = i
    if (forward) {
      while (start - 1 >= 0 && ids.has(arr[start - 1]!.id)) start--
    } else {
      while (end + 1 < arr.length && ids.has(arr[end + 1]!.id)) end++
    }
    const neighbor = forward ? end + 1 : start - 1
    if (neighbor >= 0 && neighbor < arr.length) {
      // Extend past every contiguous member of the neighbor's unit.
      const key = unitKey(arr[neighbor]!, editingGroupId)
      let far = neighbor
      while (
        (forward ? far + 1 < arr.length : far - 1 >= 0) &&
        !ids.has(arr[forward ? far + 1 : far - 1]!.id) &&
        unitKey(arr[forward ? far + 1 : far - 1]!, editingGroupId) === key
      ) {
        far += forward ? 1 : -1
      }
      const run = arr.slice(start, end + 1)
      if (forward) {
        const passed = arr.slice(end + 1, far + 1)
        arr.splice(start, far - start + 1, ...passed, ...run)
      } else {
        const passed = arr.slice(far, start)
        arr.splice(far, end - far + 1, ...run, ...passed)
      }
      moved = true
    }
    i = forward ? start - 1 : end + 1
  }
  return moved ? arr : null
}
