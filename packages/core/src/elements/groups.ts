/**
 * Groups — Excalidraw's `groupIds` model.
 *
 * Every element carries `groupIds`, ordered innermost → outermost. A group
 * has no record of its own: it exists while two or more elements share its
 * id. `editingGroupId` names the group the user has double-clicked into;
 * inside it, selection resolves to the next group level below it (or to
 * single elements), exactly like `selectGroupsForSelectedElements`
 * (packages/excalidraw/components/App.selection.ts).
 *
 * opendraw derives the "selected groups" from the selection instead of
 * storing Excalidraw's parallel `selectedGroupIds` map: a group is
 * selected iff it is some selected element's outermost visible group and
 * every one of its members is selected. One source of truth, no drift.
 */

import { getCommonBounds } from '../geometry/bounds.js'
import type { Bounds, OpenDrawElement } from '../types.js'
import { newId } from '../utils/rng.js'

export type GroupId = string

/**
 * The group levels visible from outside `editingGroupId`: the element's
 * groupIds below (inner to) the editing group, or all of them when the
 * element is not inside the editing group.
 */
function visibleGroupIds(element: OpenDrawElement, editingGroupId: GroupId | null): readonly GroupId[] {
  if (!editingGroupId) {
    return element.groupIds
  }
  const index = element.groupIds.indexOf(editingGroupId)
  return index === -1 ? element.groupIds : element.groupIds.slice(0, index)
}

/**
 * The group a click on `element` selects: its outermost group that is
 * still below the editing group, or null when it selects alone.
 */
export function outermostGroupId(
  element: OpenDrawElement,
  editingGroupId: GroupId | null = null,
): GroupId | null {
  const visible = visibleGroupIds(element, editingGroupId)
  return visible.length > 0 ? visible[visible.length - 1]! : null
}

export function isElementInGroup(element: OpenDrawElement, groupId: GroupId): boolean {
  return element.groupIds.includes(groupId)
}

export function elementsInGroup(
  elements: readonly OpenDrawElement[],
  groupId: GroupId,
): OpenDrawElement[] {
  return elements.filter((element) => isElementInGroup(element, groupId))
}

/**
 * Expands element ids to whole groups: every id pulls in all members of
 * its outermost visible group. Order follows the scene (z-order).
 */
export function expandIdsToGroups(
  elements: readonly OpenDrawElement[],
  ids: Iterable<string>,
  editingGroupId: GroupId | null = null,
): string[] {
  const wanted = new Set(ids)
  const groups = new Set<GroupId>()
  for (const element of elements) {
    if (!wanted.has(element.id)) {
      continue
    }
    const groupId = outermostGroupId(element, editingGroupId)
    if (groupId) {
      groups.add(groupId)
    }
  }
  if (groups.size === 0) {
    return elements.filter((el) => wanted.has(el.id)).map((el) => el.id)
  }
  return elements
    .filter((el) => {
      if (wanted.has(el.id)) {
        return true
      }
      const groupId = outermostGroupId(el, editingGroupId)
      return groupId !== null && groups.has(groupId)
    })
    .map((el) => el.id)
}

/**
 * Groups currently selected as a unit (derived — see the module note).
 * A one-member "group" never counts, matching `selectGroup`'s `< 2` guard.
 */
export function selectedGroupIds(
  elements: readonly OpenDrawElement[],
  selectedIds: Readonly<Record<string, true>>,
  editingGroupId: GroupId | null = null,
): GroupId[] {
  const candidates = new Set<GroupId>()
  for (const element of elements) {
    if (selectedIds[element.id]) {
      const groupId = outermostGroupId(element, editingGroupId)
      if (groupId) {
        candidates.add(groupId)
      }
    }
  }
  const result: GroupId[] = []
  for (const groupId of candidates) {
    const members = elementsInGroup(elements, groupId)
    if (members.length >= 2 && members.every((el) => selectedIds[el.id])) {
      result.push(groupId)
    }
  }
  return result
}

/**
 * True when every element already shares one visible group — grouping
 * them again would add nothing (Excalidraw's `allElementsInSameGroup`).
 */
export function allInSameGroup(
  elements: readonly OpenDrawElement[],
  editingGroupId: GroupId | null = null,
): boolean {
  if (elements.length < 2) {
    return false
  }
  const first = visibleGroupIds(elements[0]!, editingGroupId)
  return first.some((groupId) => elements.every((el) => isElementInGroup(el, groupId)))
}

/**
 * Inserts `groupId` just below the editing group (or as the new outermost
 * level) — Excalidraw's `addToGroup`.
 */
export function addToGroup(
  groupIds: readonly GroupId[],
  groupId: GroupId,
  editingGroupId: GroupId | null,
): GroupId[] {
  const next = [...groupIds]
  const editingIndex = editingGroupId ? next.indexOf(editingGroupId) : -1
  next.splice(editingIndex > -1 ? editingIndex : next.length, 0, groupId)
  return next
}

export interface GroupResult {
  /** The full scene with the members re-tagged and made z-contiguous. */
  elements: OpenDrawElement[]
  /** Ids of the grouped members (the selection to keep). */
  memberIds: string[]
}

/**
 * Groups the `ids` elements under a fresh group id. Members become
 * contiguous in z-order at the position of the topmost one, keeping their
 * relative order — Excalidraw's actionGroup reorder. `retag` produces the
 * new element (callers pass their copy-on-write patcher).
 */
export function groupElements(
  elements: readonly OpenDrawElement[],
  ids: ReadonlySet<string>,
  editingGroupId: GroupId | null,
  retag: (element: OpenDrawElement, groupIds: GroupId[]) => OpenDrawElement,
  groupId: GroupId = newId(),
): GroupResult | null {
  const members = elements.filter((el) => ids.has(el.id))
  if (members.length < 2 || allInSameGroup(members, editingGroupId)) {
    return null
  }
  const tagged = elements.map((el) =>
    ids.has(el.id) ? retag(el, addToGroup(el.groupIds, groupId, editingGroupId)) : el,
  )
  let lastIndex = -1
  for (let i = tagged.length - 1; i >= 0; i--) {
    if (ids.has(tagged[i]!.id)) {
      lastIndex = i
      break
    }
  }
  const group = tagged.filter((el) => ids.has(el.id))
  const before = tagged.slice(0, lastIndex).filter((el) => !ids.has(el.id))
  const after = tagged.slice(lastIndex + 1)
  return {
    elements: [...before, ...group, ...after],
    memberIds: group.map((el) => el.id),
  }
}

/**
 * Removes the selected groups from their members — Excalidraw's
 * actionUngroup. Returns null when no group is selected.
 */
export function ungroupElements(
  elements: readonly OpenDrawElement[],
  selectedIds: Readonly<Record<string, true>>,
  editingGroupId: GroupId | null,
  retag: (element: OpenDrawElement, groupIds: GroupId[]) => OpenDrawElement,
): OpenDrawElement[] | null {
  const groups = new Set(selectedGroupIds(elements, selectedIds, editingGroupId))
  if (groups.size === 0) {
    return null
  }
  return elements.map((el) => {
    if (!el.groupIds.some((groupId) => groups.has(groupId))) {
      return el
    }
    return retag(
      el,
      el.groupIds.filter((groupId) => !groups.has(groupId)),
    )
  })
}

/**
 * Fresh group ids for a batch of copies: groups wholly inside the batch get
 * one consistent new id each, so a duplicated group is a new group, while
 * the editing group (and anything outside it) is kept — a copy made inside
 * a group stays in it (Excalidraw's `getNewGroupIdsForDuplication`).
 */
export function remapGroupIdsForCopies<T extends OpenDrawElement>(
  copies: readonly T[],
  editingGroupId: GroupId | null,
): T[] {
  const mapping = new Map<GroupId, GroupId>()
  const mapped = (groupId: GroupId): GroupId => {
    let next = mapping.get(groupId)
    if (!next) {
      next = newId()
      mapping.set(groupId, next)
    }
    return next
  }
  return copies.map((copy) => {
    if (copy.groupIds.length === 0) {
      return copy
    }
    const editingIndex = editingGroupId ? copy.groupIds.indexOf(editingGroupId) : -1
    const end = editingIndex > -1 ? editingIndex : copy.groupIds.length
    const groupIds = copy.groupIds.map((groupId, index) => (index < end ? mapped(groupId) : groupId))
    return { ...copy, groupIds }
  })
}

/**
 * The editing group one level up from `editingGroupId`, judged from the
 * given elements — where Escape steps out to (actionDeselect's
 * `getParentEditingGroupId`).
 */
export function parentEditingGroupId(
  elements: readonly OpenDrawElement[],
  editingGroupId: GroupId | null,
): GroupId | null {
  if (!editingGroupId) {
    return null
  }
  for (const element of elements) {
    const index = element.groupIds.indexOf(editingGroupId)
    if (index !== -1 && element.groupIds[index + 1]) {
      return element.groupIds[index + 1]!
    }
  }
  return null
}

/**
 * The editing group to enter when `element` is double-clicked while its
 * group is selected: the visible outermost group it belongs to.
 */
export function groupToEnter(
  element: OpenDrawElement,
  editingGroupId: GroupId | null,
): GroupId | null {
  return outermostGroupId(element, editingGroupId)
}

/** What the selection chrome draws for groups (Excalidraw's interactiveScene). */
export interface GroupSelectionChrome {
  /** One dashed box per group selected as a unit. */
  groupBounds: Bounds[]
  /** Dashed box around the group being edited, or null. */
  editingBounds: Bounds | null
  /** Selected elements NOT selected via a group — each gets its own outline. */
  individualIds: ReadonlySet<string>
}

export function groupSelectionChrome(
  elements: readonly OpenDrawElement[],
  selectedIds: Readonly<Record<string, true>>,
  editingGroupId: GroupId | null,
): GroupSelectionChrome {
  const groups = selectedGroupIds(elements, selectedIds, editingGroupId)
  const groupSet = new Set(groups)
  const individualIds = new Set<string>()
  for (const element of elements) {
    if (selectedIds[element.id] && !element.groupIds.some((id) => id !== editingGroupId && groupSet.has(id))) {
      individualIds.add(element.id)
    }
  }
  const editingMembers = editingGroupId ? elementsInGroup(elements, editingGroupId) : []
  return {
    groupBounds: groups.map((groupId) => getCommonBounds(elementsInGroup(elements, groupId))),
    editingBounds: editingMembers.length > 0 ? getCommonBounds(editingMembers) : null,
    individualIds,
  }
}
