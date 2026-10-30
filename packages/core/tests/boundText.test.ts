import { describe, expect, it } from 'vitest'

import {
  BOUND_TEXT_PADDING,
  boundTextMaxWidth,
  boundTextOf,
  containerSizeForText,
  layoutBoundText,
  selectableTarget,
} from '../src/elements/boundText.js'
import { newEllipseElement, newRectangleElement, newTextElement } from '../src/elements/factories.js'
import { wrapText } from '../src/geometry/text.js'
import { VueDrawDocument } from '../src/scene/document.js'
import type { VueDrawTextElement } from '../src/types.js'

/** Node has no canvas: the measurer estimates 8px per character. */
const CHAR = 8

function boxWithLabel(text: string, width = 200, height = 100) {
  const box = newRectangleElement({ x: 100, y: 100, width, height })
  const label = newTextElement({
    x: 0,
    y: 0,
    text,
    containerId: box.id,
    verticalAlign: 'middle',
    textStyle: { textAlign: 'center' },
  })
  return { box, label }
}

function label(doc: VueDrawDocument, id: string): VueDrawTextElement {
  return doc.getElement(id) as VueDrawTextElement
}

describe('wrapText', () => {
  it('wraps at word boundaries and keeps explicit breaks', () => {
    expect(wrapText('aaa bbb ccc', 'hand', 20, 7 * CHAR)).toBe('aaa bbb\nccc')
    expect(wrapText('one\ntwo', 'hand', 20, 100 * CHAR)).toBe('one\ntwo')
  })

  it('breaks a word longer than the line between characters', () => {
    expect(wrapText('abcdefgh', 'hand', 20, 3 * CHAR)).toBe('abc\ndef\ngh')
  })
})

describe('bound text — container math (Excalidraw textElement.ts)', () => {
  it('inscribes the text area in ellipses and diamonds', () => {
    const ellipse = newEllipseElement({ x: 0, y: 0, width: 200, height: 100 })
    expect(boundTextMaxWidth(ellipse)).toBe(Math.round(100 * Math.SQRT2) - BOUND_TEXT_PADDING * 2)
    expect(containerSizeForText(40, 'rectangle')).toBe(50)
    expect(containerSizeForText(40, 'diamond')).toBe(100)
  })

  it('centers the label and grows the container to fit tall text', () => {
    const { box, label: text } = boxWithLabel('hi', 200, 30)
    const tall = { ...text, originalText: 'a\nb\nc' }
    const layout = layoutBoundText(tall, box)
    expect(layout.container).toEqual({ height: containerSizeForText(3 * 25, 'rectangle') })
    expect(layout.text.x! + layout.text.width! / 2).toBeCloseTo(box.x + box.width / 2)
  })
})

describe('bound text — document invariants', () => {
  it('lays the label out when added and follows the container as it moves', () => {
    const { box, label: text } = boxWithLabel('hello')
    const doc = new VueDrawDocument({ elements: [box] })
    doc.addElement(text, { after: box.id })
    const placed = label(doc, text.id)
    expect(placed.x + placed.width / 2).toBeCloseTo(200)
    expect(placed.y + placed.height / 2).toBeCloseTo(150)

    doc.updateElement(box.id, { x: 300 })
    const moved = label(doc, text.id)
    expect(moved.x + moved.width / 2).toBeCloseTo(400)
  })

  it('re-wraps when the container narrows and when the text changes', () => {
    const { box, label: text } = boxWithLabel('aaa bbb')
    const doc = new VueDrawDocument({ elements: [box, text] })
    doc.updateElement(box.id, { x: box.x })
    doc.updateElement(box.id, { width: 4 * CHAR + BOUND_TEXT_PADDING * 2 })
    expect(label(doc, text.id).text).toBe('aaa\nbbb')
    doc.updateElement<VueDrawTextElement>(text.id, { originalText: 'zz' })
    expect(label(doc, text.id).text).toBe('zz')
  })

  it('rotates the label with its container', () => {
    const { box, label: text } = boxWithLabel('x')
    const doc = new VueDrawDocument({ elements: [box, text] })
    doc.updateElement(box.id, { angle: 1 })
    expect(label(doc, text.id).angle).toBe(1)
  })

  it('deletes, duplicates and reorders the label with its container', () => {
    const { box, label: text } = boxWithLabel('x')
    const other = newRectangleElement({ x: 0, y: 0, width: 10, height: 10 })
    const doc = new VueDrawDocument({ elements: [box, text, other] })
    doc.select(box.id)
    doc.reorderSelection('front')
    expect(doc.getElements().map((el) => el.id)).toEqual([other.id, box.id, text.id])

    doc.duplicateSelection()
    const [copy] = doc.getSelectedElements()
    expect(copy!.id).not.toBe(box.id)
    expect(boundTextOf(doc.getElements(), copy!.id)).toBeDefined()

    doc.deleteElements([box.id])
    expect(doc.getElement(text.id)).toBeUndefined()
    doc.undo()
    expect(doc.getElement(text.id)).toBeDefined()
  })

  it('resolves a click on the label to its container and keeps it out of select-all', () => {
    const { box, label: text } = boxWithLabel('x')
    const doc = new VueDrawDocument({ elements: [box, text] })
    expect(selectableTarget(text, doc.getElements()).id).toBe(box.id)
    doc.selectAll()
    expect(Object.keys(doc.getAppState().selectedIds)).toEqual([box.id])
  })
})
