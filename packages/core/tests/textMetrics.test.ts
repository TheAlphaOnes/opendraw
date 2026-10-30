import { describe, expect, it } from 'vitest'

import { newTextElement } from '../src/elements/factories.js'
import { layoutText } from '../src/geometry/text.js'
import { OpenDrawDocument } from '../src/scene/document.js'

describe('refreshTextMetrics', () => {
  it('re-measures text sized with a fallback font, without an undo entry', () => {
    const text = newTextElement({ x: 100, y: 50, text: 'Hello there' })
    const measured = layoutText(text.text, text.fontFamily, text.fontSize)
    // As if measured while the web font was still loading: too narrow.
    const doc = new OpenDrawDocument({ elements: [{ ...text, width: measured.width - 30, textAlign: 'center' }] })

    doc.refreshTextMetrics()

    const after = doc.getElement(text.id)!
    expect(after.width).toBeCloseTo(measured.width)
    // Centered text grows from its middle: the left edge moves left by half.
    expect(after.x).toBeCloseTo(100 - 15)
    expect(doc.undo()).toBe(false)
  })

  it('changes nothing (and announces nothing) when every text already fits', () => {
    const doc = new OpenDrawDocument({ elements: [newTextElement({ x: 0, y: 0, text: 'Fine' })] })
    const before = doc.getElements()
    let events = 0
    doc.subscribe(() => events++)
    doc.refreshTextMetrics()
    expect(doc.getElements()).toBe(before)
    expect(events).toBe(0)
  })
})
