import { describe, expect, it } from 'vitest'

import {
  addElementsToFrame,
  elementsInNewFrame,
  elementsInResizingFrame,
  frameChildrenInsertionIndex,
  frameMembershipAfterDrag,
  topLayerFrameAt,
} from '../src/elements/frames.js'
import { findElementAt } from '../src/elements/hitTest.js'
import { newFrameElement, newRectangleElement } from '../src/elements/factories.js'
import { OpenDrawDocument } from '../src/scene/document.js'
import type { OpenDrawElement, OpenDrawFrameElement } from '../src/types.js'

const box = (x: number, y: number, patch: Partial<OpenDrawElement> = {}) =>
  ({ ...newRectangleElement({ x, y, width: 40, height: 40 }), ...patch }) as OpenDrawElement
const frameAt = (x: number, y: number, w = 300, h = 300) =>
  newFrameElement({ x, y, width: w, height: h }) as OpenDrawFrameElement

describe('frame membership (Excalidraw frame.ts)', () => {
  it('a new frame adopts what lies completely inside, groups only whole', () => {
    const frame = frameAt(0, 0)
    const inside = box(10, 10)
    const crossing = box(280, 10)
    const groupA = box(50, 50, { groupIds: ['g'] })
    const groupB = box(400, 50, { groupIds: ['g'] })
    const adopted = elementsInNewFrame([inside, crossing, groupA, groupB, frame], frame).map((el) => el.id)
    expect(adopted).toEqual([inside.id])
  })

  it('children sit just below their frame, above earlier children', () => {
    const frame = frameAt(0, 0)
    const a = box(10, 10)
    const b = box(60, 10)
    let next = addElementsToFrame([frame, a, b], [a], frame)
    expect(next.map((el) => el.id)).toEqual([a.id, frame.id, b.id])
    next = addElementsToFrame(next, [next[2]!], frame)
    expect(next.map((el) => el.id)).toEqual([a.id, b.id, frame.id])
    expect(frameChildrenInsertionIndex(next, frame.id)).toBe(2)
  })

  it('dropping over a frame joins it; dropping outside leaves it', () => {
    const frame = frameAt(0, 0)
    const a = box(10, 10)
    const joined = frameMembershipAfterDrag([frame, a], new Set([a.id]), frame)
    expect(joined.find((el) => el.id === a.id)?.frameId).toBe(frame.id)
    const moved = joined.map((el) => (el.id === a.id ? { ...el, x: 900 } : el))
    const left = frameMembershipAfterDrag(moved, new Set([a.id]), null)
    expect(left.find((el) => el.id === a.id)?.frameId).toBeNull()
  })

  it('a child dragged together with its frame stays in it', () => {
    const frame = frameAt(0, 0)
    const a = box(10, 10, { frameId: frame.id })
    const next = frameMembershipAfterDrag([a, frame], new Set([a.id, frame.id]), null)
    expect(next.find((el) => el.id === a.id)?.frameId).toBe(frame.id)
  })

  it('a resized frame keeps what it overlaps and adopts what it now covers', () => {
    const frame = frameAt(0, 0, 100, 100)
    const kept = box(80, 10, { frameId: frame.id })
    const dropped = box(500, 500, { frameId: frame.id })
    const covered = box(30, 30)
    const ids = elementsInResizingFrame([kept, dropped, covered, frame], frame).map((el) => el.id)
    expect(ids).toContain(kept.id)
    expect(ids).toContain(covered.id)
    expect(ids).not.toContain(dropped.id)
  })

  it('picks the frame a drop lands in, unless something above covers it', () => {
    const frame = frameAt(0, 0)
    const over = box(10, 10)
    expect(topLayerFrameAt([frame], { x: 50, y: 50 })?.id).toBe(frame.id)
    expect(topLayerFrameAt([frame, over], { x: 20, y: 20 }, { hit: over })).toBeNull()
    expect(topLayerFrameAt([over, frame], { x: 20, y: 20 }, { hit: over })?.id).toBe(frame.id)
  })
})

describe('frame hit testing', () => {
  it('clicks through a frame inside, and never hits a child outside it', () => {
    const frame = frameAt(0, 0, 100, 100)
    const child = box(80, 10, { frameId: frame.id, backgroundColor: '#ffc9c9', fillStyle: 'solid' })
    const elements = [child, frame]
    expect(findElementAt(elements, { x: 50, y: 50 }, 1)).toBeNull()
    expect(findElementAt(elements, { x: 90, y: 20 }, 1)?.id).toBe(child.id)
    expect(findElementAt(elements, { x: 110, y: 20 }, 1)).toBeNull()
  })
})

describe('document frame gestures', () => {
  it('inserts a new frame child among its frame children', () => {
    const frame = frameAt(0, 0)
    const top = box(500, 500)
    const doc = new OpenDrawDocument({ elements: [frame, top] })
    const child = box(10, 10, { frameId: frame.id })
    doc.addElement(child)
    expect(doc.getElements().map((el) => el.id)).toEqual([child.id, frame.id, top.id])
  })

  it('adopts into a new frame and drops the selection out of it, each undoable', () => {
    const a = box(10, 10)
    const frame = frameAt(0, 0)
    const doc = new OpenDrawDocument({ elements: [a, frame] })
    doc.adoptIntoNewFrame(frame.id)
    expect(doc.getElement(a.id)?.frameId).toBe(frame.id)
    doc.select(a.id)
    doc.dropSelectionIntoFrame(null)
    expect(doc.getElement(a.id)?.frameId).toBeNull()
    doc.undo()
    expect(doc.getElement(a.id)?.frameId).toBe(frame.id)
    doc.undo()
    expect(doc.getElement(a.id)?.frameId).toBeNull()
  })
})
