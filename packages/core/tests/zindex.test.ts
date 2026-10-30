import { describe, expect, it } from 'vitest'

import { newRectangleElement } from '../src/elements/factories.js'
import { reorderElements } from '../src/elements/zindex.js'
import type { OpenDrawElement } from '../src/types.js'

function rect(id: string, groupIds: string[] = []): OpenDrawElement {
  return newRectangleElement({ id, x: 0, y: 0, width: 10, height: 10, groupIds })
}

const order = (els: OpenDrawElement[] | null) => els?.map((el) => el.id)

describe('z-order — excalidraw unit stepping', () => {
  it('steps forward past a whole group, never into it', () => {
    const scene = [rect('a'), rect('g1', ['g']), rect('g2', ['g']), rect('b')]
    expect(order(reorderElements(scene, new Set(['a']), 'forward'))).toEqual(['g1', 'g2', 'a', 'b'])
  })

  it('steps backward past a whole group', () => {
    const scene = [rect('g1', ['g']), rect('g2', ['g']), rect('a')]
    expect(order(reorderElements(scene, new Set(['a']), 'backward'))).toEqual(['a', 'g1', 'g2'])
  })

  it('steps one element at a time inside the edited group', () => {
    const scene = [rect('a', ['g']), rect('g1', ['g']), rect('g2', ['g'])]
    expect(order(reorderElements(scene, new Set(['a']), 'forward', 'g'))).toEqual(['g1', 'a', 'g2'])
  })

  it('moves to the front and back and reports no-ops', () => {
    const scene = [rect('a'), rect('b'), rect('c')]
    expect(order(reorderElements(scene, new Set(['a']), 'front'))).toEqual(['b', 'c', 'a'])
    expect(reorderElements(scene, new Set(['c']), 'front')).toBeNull()
    expect(reorderElements(scene, new Set(['c']), 'forward')).toBeNull()
  })
})
