/**
 * Arrange, align, distribute and flip a selection.
 *
 * Pure geometry over the selection's "units": a group selected as a whole
 * moves as one rigid block, everything else moves alone. Ports of
 * Excalidraw's element/src/align.ts, element/src/distribute.ts and
 * actions/actionFlip.ts; callers apply the returned patches inside one
 * history step and re-dock bound lines afterwards.
 */

import { getCommonBounds } from '../geometry/bounds.js'
import type { Bounds, OpenDrawElement } from '../types.js'
import type { ElementPatch } from './mutate.js'
import { normalizeAngle } from '../interaction/transform.js'
import { selectedGroupIds } from './groups.js'

export interface Alignment {
  position: 'start' | 'center' | 'end'
  axis: 'x' | 'y'
}

export type FlipAxis = 'horizontal' | 'vertical'

export interface ElementPatchEntry {
  id: string
  patch: ElementPatch
}

/**
 * Buckets the selection into move units, Excalidraw's
 * `getSelectedElementsByGroup`. When the selection is exactly one group,
 * its inner level decides the units, so aligning inside a lone group still
 * does something useful.
 */
export function selectionUnits(
  elements: readonly OpenDrawElement[],
  selected: readonly OpenDrawElement[],
  editingGroupId: string | null,
): OpenDrawElement[][] {
  const selectedIds: Record<string, true> = {}
  for (const el of selected) {
    selectedIds[el.id] = true
  }
  const groups = selectedGroupIds(elements, selectedIds, editingGroupId)
  const groupSet = new Set(groups)
  const single =
    groups.length === 1 && selected.every((el) => el.groupIds.includes(groups[0]!))
  const buckets = new Map<string, OpenDrawElement[]>()
  for (const el of selected) {
    const groupId = el.groupIds.find((id) => groupSet.has(id))
    let key = `${el.id}:element`
    if (groupId) {
      const index = single ? el.groupIds.indexOf(groupId) - 1 : el.groupIds.indexOf(groupId)
      if (index >= 0) {
        key = `${el.groupIds[index]!}:group`
      }
    }
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(el)
    } else {
      buckets.set(key, [el])
    }
  }
  return [...buckets.values()]
}

function translateUnit(unit: readonly OpenDrawElement[], dx: number, dy: number): ElementPatchEntry[] {
  if (dx === 0 && dy === 0) {
    return []
  }
  return unit.map((el) => ({ id: el.id, patch: { x: el.x + dx, y: el.y + dy } }))
}

function axisRange(bounds: Bounds, axis: 'x' | 'y'): [number, number] {
  return axis === 'x' ? [bounds.x1, bounds.x2] : [bounds.y1, bounds.y2]
}

/** Aligns every unit to the selection's common box. Needs two units. */
export function alignUnits(
  units: readonly OpenDrawElement[][],
  alignment: Alignment,
): ElementPatchEntry[] {
  if (units.length < 2) {
    return []
  }
  const [min, max] = axisRange(getCommonBounds(units.flat()), alignment.axis)
  return units.flatMap((unit) => {
    const [unitMin, unitMax] = axisRange(getCommonBounds(unit), alignment.axis)
    const delta =
      alignment.position === 'start'
        ? min - unitMin
        : alignment.position === 'end'
          ? max - unitMax
          : (min + max) / 2 - (unitMin + unitMax) / 2
    return alignment.axis === 'x' ? translateUnit(unit, delta, 0) : translateUnit(unit, 0, delta)
  })
}

/**
 * Spreads units so the gaps between them are equal; the outermost units
 * stay put. Overlapping units (negative gap) distribute by their centers
 * instead, as Excalidraw does. Needs three units to do anything.
 */
export function distributeUnits(
  units: readonly OpenDrawElement[][],
  axis: 'x' | 'y',
): ElementPatchEntry[] {
  if (units.length < 3) {
    return []
  }
  const [min, max] = axisRange(getCommonBounds(units.flat()), axis)
  const boxed = units
    .map((unit) => {
      const [start, end] = axisRange(getCommonBounds(unit), axis)
      return { unit, start, end, mid: (start + end) / 2, extent: end - start }
    })
    .sort((a, b) => a.mid - b.mid)
  const span = boxed.reduce((sum, box) => sum + box.extent, 0)
  const gap = (max - min - span) / (boxed.length - 1)
  const move = (unit: readonly OpenDrawElement[], delta: number): ElementPatchEntry[] =>
    axis === 'x' ? translateUnit(unit, delta, 0) : translateUnit(unit, 0, delta)

  if (gap < 0) {
    const first = boxed.findIndex((box) => box.start === min)
    const last = boxed.findIndex((box) => box.end === max)
    const step = (boxed[last]!.mid - boxed[first]!.mid) / (boxed.length - 1)
    let pos = boxed[first]!.mid
    return boxed.flatMap((box, index) => {
      if (index === first || index === last) {
        return []
      }
      pos += step
      return move(box.unit, pos - box.mid)
    })
  }
  let pos = min
  return boxed.flatMap((box) => {
    const delta = pos - box.start
    pos += box.extent + gap
    return move(box.unit, delta)
  })
}

/**
 * Mirrors the selection across its common box center. Every element maps
 * exactly: its pivot mirrors, local points reflect about the pivot line
 * (`p → width - p`) and the angle negates. Text and images keep their
 * glyphs and pixels readable; only their placement mirrors.
 */
export function flipElements(
  selected: readonly OpenDrawElement[],
  axis: FlipAxis,
): ElementPatchEntry[] {
  if (selected.length === 0) {
    return []
  }
  const bounds = getCommonBounds(selected)
  const horizontal = axis === 'horizontal'
  const center = horizontal ? (bounds.x1 + bounds.x2) / 2 : (bounds.y1 + bounds.y2) / 2
  return selected.map((el) => {
    const patch: Record<string, unknown> = horizontal
      ? { x: 2 * center - el.x - el.width }
      : { y: 2 * center - el.y - el.height }
    // A mirrored rotation is the opposite rotation.
    if (el.angle !== 0) {
      patch.angle = normalizeAngle(-el.angle)
    }
    if (el.type === 'line' || el.type === 'arrow') {
      patch.points = el.points.map((p) =>
        horizontal ? { x: el.width - p.x, y: p.y } : { x: p.x, y: el.height - p.y },
      )
      // A flipped line's tips swap sides of its shapes; dock data stays
      // valid (same shapes) and the follow pass re-docks the geometry.
    } else if (el.type === 'freedraw') {
      patch.points = el.points.map((p) =>
        horizontal ? [el.width - p[0]!, p[1]!, p[2]!] : [p[0]!, el.height - p[1]!, p[2]!],
      )
    }
    return { id: el.id, patch: patch as ElementPatch }
  })
}
