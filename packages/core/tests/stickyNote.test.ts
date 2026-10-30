import { describe, expect, it } from 'vitest'

import { layoutBoundText } from '../src/elements/boundText.js'
import { newStickyNoteElement, newTextElement } from '../src/elements/factories.js'
import {
  STICKY_NOTE_BODY_INSET_Y,
  STICKY_NOTE_MIN_FONT_SIZE,
  stickyNoteColor,
  stickyNoteCreationRect,
  stickyNoteDateLabel,
  stickyNoteFooter,
  stickyNotePathCommands,
} from '../src/elements/stickyNote.js'
import { parseFile } from '../src/export/serialize.js'
import { exportToSvg } from '../src/export/svg.js'
import { OpenDrawDocument } from '../src/scene/document.js'
import type { OpenDrawStickyNoteElement, OpenDrawTextElement } from '../src/types.js'

const note = (patch: Partial<OpenDrawStickyNoteElement> = {}) =>
  ({ ...newStickyNoteElement({ x: 0, y: 0, width: 250, height: 250, baseHeight: 250 }), ...patch }) as OpenDrawStickyNoteElement
const label = (container: OpenDrawStickyNoteElement, text: string, fontSize = 36) =>
  ({
    ...newTextElement({ x: 0, y: 0, text, textStyle: { fontSize, fontFamily: 'normal', textAlign: 'center' } }),
    containerId: container.id,
    verticalAlign: 'middle',
    baseFontSize: fontSize,
  }) as OpenDrawTextElement

describe('sticky notes (Excalidraw stickyNote.ts)', () => {
  it('are always filled paper with ink, never transparent', () => {
    const fresh = newStickyNoteElement({ x: 0, y: 0, style: { backgroundColor: 'transparent', strokeColor: 'transparent' } })
    expect(fresh.backgroundColor).toBe('#ffdf6b')
    expect(fresh.strokeColor).toBe('#1e1e1e')
    expect(fresh.fillStyle).toBe('solid')
    expect(stickyNoteColor('backgroundColor', '#a5d8ff')).toBe('#a5d8ff')
  })

  it('keeps a short label at its font ceiling, centered', () => {
    const n = note()
    const layout = layoutBoundText(label(n, 'Hi'), n)
    expect(layout.text.fontSize).toBe(36)
    expect(layout.container).toBeNull()
  })

  it('shrinks the font before growing the note, then grows past base height', () => {
    const n = note()
    const long = 'word '.repeat(60)
    const shrunk = layoutBoundText(label(n, 'word '.repeat(30)), n)
    expect(shrunk.text.fontSize!).toBeLessThan(36)
    expect(shrunk.container).toBeNull()
    const grown = layoutBoundText(label(n, long.repeat(4)), n)
    expect(grown.text.fontSize).toBe(STICKY_NOTE_MIN_FONT_SIZE)
    expect(grown.container?.height).toBeGreaterThan(250)
    expect(grown.container!.height!).toBeCloseTo(grown.text.height! + STICKY_NOTE_BODY_INSET_Y)
  })

  it('a click makes the default square, a drag keeps its size above the minimum', () => {
    const minSize = { width: 75, height: 90 }
    expect(stickyNoteCreationRect({ x: 100, y: 100, width: 1, height: 1 }, { x: 100, y: 100 }, { isClick: true, minSize, keepSquare: true }))
      .toEqual({ x: -25, y: -25, width: 250, height: 250 })
    expect(stickyNoteCreationRect({ x: 0, y: 0, width: 120, height: 40 }, { x: 0, y: 0 }, { isClick: false, minSize, keepSquare: true }))
      .toEqual({ x: 0, y: 0, width: 120, height: 120 })
  })

  it('shows its creation date in the footer', () => {
    const now = new Date(2026, 9, 30).getTime()
    expect(stickyNoteDateLabel(new Date(2026, 8, 7).getTime(), { now })).toBe('7 Sep')
    expect(stickyNoteDateLabel(new Date(2025, 8, 7).getTime(), { now })).toBe('7 Sep 2025')
    expect(stickyNoteFooter(note({ created: now }), now)?.x).toBe(234)
    expect(stickyNoteFooter(note({ created: null }))).toBeNull()
  })

  it('lifts a corner at cartoonist sloppiness', () => {
    expect(stickyNotePathCommands(note({ roughness: 0, roundness: null }))).toHaveLength(4)
    const quads = (roughness: 0 | 1 | 2) =>
      stickyNotePathCommands(note({ roughness })).filter((c) => c.type === 'quadratic').length
    // Four rounded corners; the lifted one bends in three curves instead of one.
    expect(quads(1)).toBe(4)
    expect(quads(2)).toBe(6)
  })

  it('round-trips through files and grows in the document as text is typed', () => {
    const n = note()
    const file = parseFile({ type: 'opendraw', version: 1, elements: [{ ...n }] })
    expect(file.elements[0]).toMatchObject({ type: 'stickynote', baseHeight: 250, created: n.created })
    const doc = new OpenDrawDocument({ elements: [n] })
    const text = label(n, 'x')
    doc.addElement(text, { after: n.id })
    doc.updateElement(text.id, { originalText: 'word '.repeat(400) })
    expect(doc.getElement(n.id)!.height).toBeGreaterThan(250)
    expect(exportToSvg(doc.getElements(), '#fff')).toContain('fill="#ffdf6b"')
  })
})
