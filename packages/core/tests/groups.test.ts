import { describe, expect, it } from 'vitest'

import { newRectangleElement } from '../src/elements/factories.js'
import {
  expandIdsToGroups,
  outermostGroupId,
  parentEditingGroupId,
  remapGroupIdsForCopies,
  selectedGroupIds,
} from '../src/elements/groups.js'
import { parseFile } from '../src/export/serialize.js'
import { OpenDrawDocument } from '../src/scene/document.js'

function rect(x = 0, groupIds: string[] = []) {
  return newRectangleElement({ x, y: 0, width: 10, height: 10, groupIds })
}

function ids(record: Readonly<Record<string, true>>): string[] {
  return Object.keys(record).sort()
}

describe('groups — pure helpers', () => {
  it('resolves the outermost group visible from the editing group', () => {
    const el = rect(0, ['inner', 'outer'])
    expect(outermostGroupId(el)).toBe('outer')
    expect(outermostGroupId(el, 'outer')).toBe('inner')
    expect(outermostGroupId(el, 'inner')).toBeNull()
    expect(outermostGroupId(rect())).toBeNull()
  })

  it('expands ids to whole groups, keeping z-order', () => {
    const a = rect(0, ['g'])
    const b = rect(20, ['g'])
    const c = rect(40)
    expect(expandIdsToGroups([a, b, c], [b.id])).toEqual([a.id, b.id])
    expect(expandIdsToGroups([a, b, c], [c.id])).toEqual([c.id])
    // Inside the group, members select alone.
    expect(expandIdsToGroups([a, b, c], [b.id], 'g')).toEqual([b.id])
  })

  it('derives selected groups only when every member is selected', () => {
    const a = rect(0, ['g'])
    const b = rect(20, ['g'])
    expect(selectedGroupIds([a, b], { [a.id]: true, [b.id]: true })).toEqual(['g'])
    expect(selectedGroupIds([a, b], { [a.id]: true })).toEqual([])
  })

  it('gives duplicated groups fresh, consistent ids but keeps the editing group', () => {
    const a = rect(0, ['inner', 'outer'])
    const b = rect(20, ['inner', 'outer'])
    const [ca, cb] = remapGroupIdsForCopies([a, b], 'outer')
    expect(ca!.groupIds[0]).not.toBe('inner')
    expect(ca!.groupIds[0]).toBe(cb!.groupIds[0])
    expect(ca!.groupIds[1]).toBe('outer')
  })

  it('finds the parent editing group one level up', () => {
    const a = rect(0, ['inner', 'outer'])
    expect(parentEditingGroupId([a], 'inner')).toBe('outer')
    expect(parentEditingGroupId([a], 'outer')).toBeNull()
  })
})

describe('groups — document', () => {
  it('groups the selection in one undo step and makes members z-contiguous', () => {
    const a = rect(0)
    const between = rect(10)
    const b = rect(20)
    const doc = new OpenDrawDocument({ elements: [a, between, b] })
    doc.select([a.id, b.id])
    doc.groupSelection()
    const [first, second, third] = doc.getElements()
    expect(first!.id).toBe(between.id)
    expect(second!.groupIds).toHaveLength(1)
    expect(second!.groupIds).toEqual(third!.groupIds)
    expect(ids(doc.getAppState().selectedIds)).toEqual([a.id, b.id].sort())
    doc.undo()
    expect(doc.getElements().map((el) => el.id)).toEqual([a.id, between.id, b.id])
    expect(doc.getElements().every((el) => el.groupIds.length === 0)).toBe(true)
  })

  it('refuses to group a lone element or an existing single group', () => {
    const a = rect(0)
    const doc = new OpenDrawDocument({ elements: [a] })
    doc.select(a.id)
    doc.groupSelection()
    expect(doc.canUndo).toBe(false)

    const b = rect(0, ['g'])
    const c = rect(20, ['g'])
    const grouped = new OpenDrawDocument({ elements: [b, c] })
    grouped.select([b.id, c.id])
    grouped.groupSelection()
    expect(grouped.canUndo).toBe(false)
  })

  it('ungroups a selected group', () => {
    const a = rect(0, ['g'])
    const b = rect(20, ['g'])
    const doc = new OpenDrawDocument({ elements: [a, b] })
    doc.select([a.id, b.id])
    doc.ungroupSelection()
    expect(doc.getElements().every((el) => el.groupIds.length === 0)).toBe(true)
  })

  it('selectGrouped selects and toggles whole groups', () => {
    const a = rect(0, ['g'])
    const b = rect(20, ['g'])
    const c = rect(40)
    const doc = new OpenDrawDocument({ elements: [a, b, c] })
    doc.selectGrouped([a.id])
    expect(ids(doc.getAppState().selectedIds)).toEqual([a.id, b.id].sort())
    doc.selectGrouped([c.id], 'toggle')
    expect(ids(doc.getAppState().selectedIds)).toHaveLength(3)
    doc.selectGrouped([b.id], 'toggle')
    expect(ids(doc.getAppState().selectedIds)).toEqual([c.id])
  })

  it('duplicating a group yields a new, separate group', () => {
    const a = rect(0, ['g'])
    const b = rect(20, ['g'])
    const doc = new OpenDrawDocument({ elements: [a, b] })
    doc.select([a.id, b.id])
    doc.duplicateSelection()
    const copies = doc.getSelectedElements()
    expect(copies).toHaveLength(2)
    expect(copies[0]!.groupIds[0]).not.toBe('g')
    expect(copies[0]!.groupIds).toEqual(copies[1]!.groupIds)
  })

  it('select all skips locked elements and leaves the edited group', () => {
    const a = rect(0, ['g'])
    const b = { ...rect(20, ['g']), locked: true }
    const doc = new OpenDrawDocument({ elements: [a, b] })
    doc.setEditingGroup('g')
    doc.selectAll()
    expect(ids(doc.getAppState().selectedIds)).toEqual([a.id])
    expect(doc.getAppState().editingGroupId).toBeNull()
  })

  it('clears the editing group once deletion leaves it under two members', () => {
    const a = rect(0, ['g'])
    const b = rect(20, ['g'])
    const doc = new OpenDrawDocument({ elements: [a, b] })
    doc.setEditingGroup('g')
    doc.deleteElements([a.id])
    expect(doc.getAppState().editingGroupId).toBeNull()
  })

  it('round-trips groupIds through file parsing and defaults them when absent', () => {
    const a = rect(0, ['g'])
    const file = parseFile({ type: 'opendraw', version: 1, elements: [a, { ...rect(5), groupIds: undefined }] })
    expect(file.elements[0]!.groupIds).toEqual(['g'])
    expect(file.elements[1]!.groupIds).toEqual([])
  })
})

describe('duplicateElements', async () => {
  const { duplicateElements } = await import('../src/elements/duplicate.js')
  const { newLinearElement } = await import('../src/elements/factories.js')
  it('remaps bindings inside the copied set and drops the rest', () => {
    const shape = rect(0)
    const other = rect(100)
    const line = {
      ...newLinearElement('arrow', { x: 0, y: 0, points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] }),
      startBinding: { elementId: shape.id, fixedPoint: [0.25, 0.5] as const, mode: 'orbit' as const },
      endBinding: { elementId: other.id, fixedPoint: [0.5001, 0.5001] as const, mode: 'orbit' as const },
    }
    const [shapeCopy, lineCopy] = duplicateElements([shape, line], { offset: { x: 5, y: 5 } })
    expect(shapeCopy!.x).toBe(5)
    expect(lineCopy!.type).toBe('arrow')
    if (lineCopy!.type === 'arrow') {
      expect(lineCopy!.startBinding).toEqual({ elementId: shapeCopy!.id, fixedPoint: [0.25, 0.5], mode: 'orbit' })
      expect(lineCopy!.endBinding).toBeNull()
    }
  })
})

describe('frames — document behaviors', async () => {
  const { newFrameElement } = await import('../src/elements/factories.js')
  it('deletes, moves and duplicates children with their frame', () => {
    const frame = newFrameElement({ x: 0, y: 0, width: 100, height: 100 })
    const child = newRectangleElement({ x: 10, y: 10, width: 10, height: 10, frameId: frame.id })
    const doc = new OpenDrawDocument({ elements: [frame, child] })
    doc.select(frame.id)
    doc.alignSelection({ axis: 'x', position: 'start' })
    doc.duplicateSelection()
    const copies = doc.getElements().slice(2)
    expect(copies).toHaveLength(2)
    expect(copies[1]!.frameId).toBe(copies[0]!.id)
    doc.deleteElements([frame.id])
    expect(doc.getElement(child.id)).toBeUndefined()
  })
})
