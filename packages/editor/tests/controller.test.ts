import { describe, expect, it, vi } from 'vitest'

import { newRectangleElement } from '@opendraw/core'

import { Cell } from '../src/cell.js'
import { createEditor } from '../src/controller.js'
import { dispatchActionKey, isActionEnabled } from '../src/actions/registry.js'

const rect = (x = 0) => newRectangleElement({ x, y: 0, width: 10, height: 10 })

describe('EditorController', () => {
  it('notifies on document and editor-state changes', () => {
    const editor = createEditor()
    const listener = vi.fn()
    editor.subscribe(listener)
    editor.setActiveTool('rectangle')
    editor.toggleToolLock()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('memoizes derived reads per change', () => {
    const a = rect()
    const editor = createEditor({ elements: [a] })
    editor.select(a.id)
    const first = editor.selectedElements
    expect(editor.selectedElements).toBe(first)
    editor.select(null)
    expect(editor.selectedElements).toEqual([])
  })

  it('reverts the tool after one use unless locked', () => {
    const editor = createEditor()
    editor.setActiveTool('rectangle')
    editor.finishToolUse()
    expect(editor.activeTool).toBe('selection')
    editor.setActiveTool('rectangle')
    editor.toggleToolLock()
    editor.finishToolUse()
    expect(editor.activeTool).toBe('rectangle')
  })

  it('pastes copies selected, in one undo step', () => {
    const a = rect()
    const editor = createEditor({ elements: [a] })
    editor.select(a.id)
    editor.copySelection()
    editor.paste()
    expect(editor.elements).toHaveLength(2)
    expect(editor.selectedElements[0]!.id).not.toBe(a.id)
    editor.undo()
    expect(editor.elements).toHaveLength(1)
  })

  it('drives actions from key events', () => {
    const a = rect()
    const editor = createEditor({ elements: [a] })
    expect(isActionEnabled(editor, 'duplicate')).toBe(false)
    editor.select(a.id)
    // Node has no KeyboardEvent; the dispatcher reads plain fields only.
    const event = {
      key: 'd',
      code: 'KeyD',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent
    expect(dispatchActionKey(editor, event)).toBe(true)
    expect(editor.elements).toHaveLength(2)
  })
})

describe('Cell', () => {
  it('notifies on change only', () => {
    const cell = new Cell(1)
    const listener = vi.fn()
    cell.subscribe(listener)
    cell.value = 1
    cell.value = 2
    expect(listener).toHaveBeenCalledExactlyOnceWith(2)
  })
})
