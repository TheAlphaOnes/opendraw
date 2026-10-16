import { describe, expect, it } from 'vitest'

import { newRectangleElement, newTextElement, newLinearElement, isTextElement } from '../src/elements/factories.js'
import { VueDrawDocument } from '../src/scene/document.js'
import { buildFile, parseFile } from '../src/export/serialize.js'

function rect(x = 0, y = 0, w = 10, h = 10) {
  return newRectangleElement({ x, y, width: w, height: h })
}

describe('VueDrawDocument — basics', () => {
  it('starts empty with default app state', () => {
    const doc = new VueDrawDocument()
    expect(doc.getElements()).toHaveLength(0)
    expect(doc.getAppState().activeTool).toBe('selection')
    expect(doc.getAppState().viewport.zoom).toBe(1)
  })

  it('adds and selects elements', () => {
    const doc = new VueDrawDocument()
    const el = rect()
    doc.addElement(el, { select: true })
    expect(doc.getElements()).toHaveLength(1)
    expect(doc.getElement(el.id)).toBe(el)
    expect(doc.getSelectedElements()).toEqual([el])
    expect(doc.isIdSelected(el.id)).toBe(true)
  })

  it('updates elements copy-on-write and bumps versions', () => {
    const doc = new VueDrawDocument()
    const el = rect()
    doc.addElement(el)
    doc.updateElement(el.id, { x: 42 })
    const updated = doc.getElement(el.id)!
    expect(updated.x).toBe(42)
    expect(updated.version).toBe(2)
    expect(doc.getElements()[0]).toBe(updated)
  })

  it('treats a no-op update as a non-change', () => {
    const doc = new VueDrawDocument()
    const el = rect(5, 5)
    doc.addElement(el)
    const before = doc.getElements()[0]
    doc.updateElement(el.id, { x: 5 })
    expect(doc.getElements()[0]).toBe(before)
  })

  it('deletes elements and cleans the selection', () => {
    const doc = new VueDrawDocument()
    const el = rect()
    doc.addElement(el, { select: true })
    doc.deleteElements([el.id])
    expect(doc.getElements()).toHaveLength(0)
    expect(doc.getElement(el.id)).toBeUndefined()
    expect(doc.getSelectedElements()).toHaveLength(0)
  })

  it('replaces selection instead of accumulating by default', () => {
    const doc = new VueDrawDocument()
    const a = rect()
    const b = rect(30, 30)
    doc.addElements([a, b])
    doc.select(a.id)
    doc.select(b.id)
    expect(doc.getSelectedElements()).toEqual([b])
    doc.select([a.id, b.id])
    expect(doc.getSelectedElements()).toHaveLength(2)
    doc.select(null)
    expect(doc.getSelectedElements()).toHaveLength(0)
  })

  it('toggles selection members', () => {
    const doc = new VueDrawDocument()
    const a = rect()
    const b = rect(30, 30)
    doc.addElements([a, b])
    doc.select([a.id, b.id])
    doc.select(b.id, 'toggle')
    expect(doc.getSelectedElements()).toEqual([a])
  })
})

describe('VueDrawDocument — history', () => {
  it('undoes and redoes an addition', () => {
    const doc = new VueDrawDocument()
    const el = rect()
    doc.addElement(el)
    expect(doc.getElements()).toHaveLength(1)

    expect(doc.undo()).toBe(true)
    expect(doc.getElements()).toHaveLength(0)
    expect(doc.canRedo).toBe(true)

    expect(doc.redo()).toBe(true)
    expect(doc.getElements()).toHaveLength(1)
    expect(doc.canRedo).toBe(false)
  })

  it('coalesces a step into one undo entry', () => {
    const doc = new VueDrawDocument()
    const el = rect()
    doc.addElement(el)

    doc.beginStep()
    doc.updateElement(el.id, { x: 10 })
    doc.updateElement(el.id, { x: 20 })
    doc.updateElement(el.id, { x: 30 })
    doc.endStep()

    expect(doc.getElement(el.id)!.x).toBe(30)
    expect(doc.undo()).toBe(true)
    expect(doc.getElement(el.id)!.x).toBe(0) // one entry: back to pre-step
  })

  it('cancelStep restores the state the step started from', () => {
    const doc = new VueDrawDocument()
    const el = rect()
    doc.addElement(el)
    doc.beginStep()
    doc.updateElement(el.id, { x: 99 })
    doc.cancelStep()
    expect(doc.getElement(el.id)!.x).toBe(0)
  })

  it('never records appState-only changes as undo entries', () => {
    const doc = new VueDrawDocument()
    const el = rect()
    doc.addElement(el, { select: true })

    // Intent, not history: selection and tool changes record nothing.
    doc.select(null)
    doc.select(el.id)
    doc.setAppState({ activeTool: 'rectangle' })

    // One undo press reverts exactly the scene change: the shape itself.
    expect(doc.undo()).toBe(true)
    expect(doc.getElements()).toHaveLength(0)
    expect(doc.canUndo).toBe(false)
  })

  it('does not record tool switches on a fresh scene', () => {
    const doc = new VueDrawDocument()
    doc.setAppState({ activeTool: 'rectangle' })
    doc.setAppState({ activeTool: 'arrow' })
    expect(doc.canUndo).toBe(false)
  })

  it('clears redo only on element changes, not selection changes', () => {
    const doc = new VueDrawDocument()
    const a = rect()
    const b = rect(30, 30)
    doc.addElements([a, b])
    doc.undo() // elements now empty, redo available
    expect(doc.canRedo).toBe(true)

    doc.select(b.id) // appState-only change
    expect(doc.canRedo).toBe(true)

    doc.addElement(rect(100, 100)) // element change
    expect(doc.canRedo).toBe(false)
  })

  it('restores selection and background color but not the tool', () => {
    const doc = new VueDrawDocument()
    const el = rect()
    doc.addElement(el, { select: true })
    doc.setAppState({ activeTool: 'rectangle', viewBackgroundColor: '#f8f9fa' })
    doc.deleteSelectedElements()

    doc.undo()
    expect(doc.getElements()).toHaveLength(1)
    expect(doc.isIdSelected(el.id)).toBe(true)
    expect(doc.getAppState().viewBackgroundColor).toBe('#f8f9fa') // pre-delete value
    expect(doc.getAppState().activeTool).toBe('rectangle') // current intent kept
  })

  it('does not record viewport changes', () => {
    const doc = new VueDrawDocument()
    doc.setViewport({ scrollX: 100, scrollY: 50, zoom: 2 })
    expect(doc.canUndo).toBe(false)
  })
})

describe('VueDrawDocument — z-order', () => {
  it('moves a single selection forward and backward by one', () => {
    const doc = new VueDrawDocument()
    const a = rect()
    const b = rect(30, 30)
    const c = rect(60, 60)
    doc.addElements([a, b, c])
    doc.select(b.id)

    doc.reorderSelection('forward')
    expect(doc.getElements().map((el) => el.id)).toEqual([a.id, c.id, b.id])

    doc.reorderSelection('backward')
    expect(doc.getElements().map((el) => el.id)).toEqual([a.id, b.id, c.id])
  })

  it('brings the selection to front and sends it to back', () => {
    const doc = new VueDrawDocument()
    const a = rect()
    const b = rect(30, 30)
    const c = rect(60, 60)
    doc.addElements([a, b, c])
    doc.select(b.id)

    doc.reorderSelection('front')
    expect(doc.getElements().map((el) => el.id)).toEqual([a.id, c.id, b.id])

    doc.reorderSelection('back')
    expect(doc.getElements().map((el) => el.id)).toEqual([b.id, a.id, c.id])
  })

  it('keeps relative order inside a multi selection', () => {
    const doc = new VueDrawDocument()
    const a = rect()
    const b = rect(30, 30)
    const c = rect(60, 60)
    doc.addElements([a, b, c])
    doc.select([a.id, c.id])

    doc.reorderSelection('front')
    // a and c go on top, in their original relative order.
    expect(doc.getElements().map((el) => el.id)).toEqual([b.id, a.id, c.id])
  })
})

describe('VueDrawDocument — styles & duplication', () => {
  it('styles the selection and defaults when nothing is selected', () => {
    const doc = new VueDrawDocument()
    const el = rect()
    doc.addElement(el, { select: true })

    doc.changeStyle({ strokeColor: '#e03131' })
    expect(doc.getElement(el.id)!.strokeColor).toBe('#e03131')

    doc.select(null)
    doc.changeStyle({ strokeWidth: 4 })
    expect(doc.getAppState().style.strokeWidth).toBe(4)
    expect(doc.getAppState().style.strokeColor).toBe('#1e1e1e')
  })

  it('re-measures text when its style changes', () => {
    const doc = new VueDrawDocument()
    const text = newTextElement({ x: 0, y: 0, text: 'hello' })
    doc.addElement(text, { select: true })

    doc.changeTextStyle({ fontSize: 40 })
    const updated = doc.getElement(text.id)!
    if (!isTextElement(updated)) {
      throw new Error('expected a text element')
    }
    expect(updated.fontSize).toBe(40)
    expect(updated.height).toBeCloseTo(50, 5)
  })

  it('duplicates the selection with an offset and selects the clones', () => {
    const doc = new VueDrawDocument()
    const el = rect(10, 10)
    doc.addElement(el, { select: true })

    doc.duplicateSelection({ x: 10, y: 10 })
    expect(doc.getElements()).toHaveLength(2)
    const clone = doc.getSelectedElements()[0]!
    expect(clone.id).not.toBe(el.id)
    expect(clone.x).toBe(20)
    expect(clone.y).toBe(20)
  })
})

describe('VueDrawDocument — serialization', () => {
  it('round-trips through file format', () => {
    const doc = new VueDrawDocument()
    doc.addElements([
      rect(),
      newLinearElement('arrow', { x: 5, y: 5, points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] }),
      newTextElement({ x: 2, y: 2, text: 'label' }),
    ])
    doc.setAppState({ viewBackgroundColor: '#f5faff' })

    const file = doc.serialize()
    const restored = new VueDrawDocument({ elements: parseFile(JSON.parse(JSON.stringify(file))).elements })
    expect(restored.getElements()).toHaveLength(3)
    expect(restored.serialize().appState.viewBackgroundColor).toBe('#ffffff') // not carried by ctor

    const roundTripped = parseFile(JSON.parse(JSON.stringify(file)))
    doc.loadFile(roundTripped)
    expect(doc.getElements()).toHaveLength(3)
    expect(doc.getAppState().viewBackgroundColor).toBe('#f5faff')
  })

  it('loadFile resets history to a fresh timeline', () => {
    const doc = new VueDrawDocument()
    doc.addElement(rect())
    expect(doc.canUndo).toBe(true)

    doc.loadFile(buildFile([rect(50, 50)], '#ffffff'))
    expect(doc.canUndo).toBe(false)
    expect(doc.getElements()).toHaveLength(1)
  })
})
