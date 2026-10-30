import { describe, expect, it } from 'vitest'

import {
  DEFAULT_APP_STATE,
  newLinearElement,
  newRectangleElement,
  newTextElement,
  type OpenDrawArrowElement,
  type OpenDrawRectangleElement,
} from '@opendrawjs/core'

import {
  DEFAULT_SCENE_STORAGE_KEY,
  PERSISTED_SCENE_TYPE,
  buildPersistedScene,
  parsePersistedScene,
} from '../src/persistence/persistedScene.js'

function sceneFixture() {
  const rect: OpenDrawRectangleElement = newRectangleElement({ x: 10, y: 20, width: 120, height: 80 })
  const arrow = newLinearElement('arrow', { x: 0, y: 0 }) as OpenDrawArrowElement
  arrow.startBinding = null
  arrow.endBinding = { elementId: rect.id, fixedPoint: [0.5001, 0.5001], mode: 'orbit' }
  const text = newTextElement({ x: 5, y: 5, text: 'hello' })
  return { rect, arrow, text }
}

describe('buildPersistedScene', () => {
  it('wraps the core file format with theme, viewport and grid', () => {
    const { rect, arrow, text } = sceneFixture()
    const scene = buildPersistedScene([rect, arrow, text], {
      ...DEFAULT_APP_STATE,
      theme: 'dark',
      viewBackgroundColor: '#123456',
      viewport: { scrollX: -40, scrollY: 12.5, zoom: 2 },
      gridSize: 20,
    })

    expect(scene.type).toBe(PERSISTED_SCENE_TYPE)
    expect(scene.file.type).toBe('opendraw')
    expect(scene.file.elements).toHaveLength(3)
    expect(scene.file.appState.viewBackgroundColor).toBe('#123456')
    expect(scene.appState).toEqual({
      theme: 'dark',
      viewport: { scrollX: -40, scrollY: 12.5, zoom: 2 },
      gridSize: 20,
    })
  })
})

describe('parsePersistedScene', () => {
  it('round-trips a built scene through JSON', () => {
    const { rect, arrow, text } = sceneFixture()
    const scene = buildPersistedScene([rect, arrow, text], {
      ...DEFAULT_APP_STATE,
      theme: 'dark',
      viewport: { scrollX: -40, scrollY: 12.5, zoom: 2 },
      gridSize: 20,
    })

    const parsed = parsePersistedScene(JSON.parse(JSON.stringify(scene)))

    expect(parsed).not.toBeNull()
    expect(parsed!.file.elements).toHaveLength(3)
    // Bindings and text content survive the trip.
    const arrowBack = parsed!.file.elements.find((el) => el.id === arrow.id)!
    expect(arrowBack).toEqual(arrow)
    const textBack = parsed!.file.elements.find((el) => el.id === text.id)!
    expect(textBack).toEqual(text)
    expect(parsed!.appState).toEqual(scene.appState)
  })

  it('uses the stable default storage key', () => {
    expect(DEFAULT_SCENE_STORAGE_KEY).toBe('opendraw:scene')
  })

  it('still reads a scene saved before the opendraw rename', () => {
    const { rect } = sceneFixture()
    const scene = buildPersistedScene([rect], { ...DEFAULT_APP_STATE })
    const legacy = JSON.parse(JSON.stringify(scene))
    legacy.type = 'vuedraw-scene'
    legacy.file.type = 'vuedraw'
    const parsed = parsePersistedScene(legacy)
    expect(parsed?.file.elements.map((el) => el.id)).toEqual([rect.id])
    expect(parsed?.file.type).toBe('opendraw')
  })

  it('rejects foreign payloads without throwing', () => {
    expect(parsePersistedScene(null)).toBeNull()
    expect(parsePersistedScene('opendraw')).toBeNull()
    expect(parsePersistedScene({ type: 'excalidraw', version: 1 })).toBeNull()
    expect(parsePersistedScene({ type: PERSISTED_SCENE_TYPE, version: 99 })).toBeNull()
  })

  it('degrades to null when the inner file is not a opendraw file', () => {
    expect(
      parsePersistedScene({ type: PERSISTED_SCENE_TYPE, version: 1, file: { type: 'nope' } }),
    ).toBeNull()
    expect(
      parsePersistedScene({ type: PERSISTED_SCENE_TYPE, version: 1, file: 42 }),
    ).toBeNull()
  })

  it('drops malformed elements but keeps the salvageable ones', () => {
    const { rect } = sceneFixture()
    const scene = buildPersistedScene([rect], DEFAULT_APP_STATE)
    const corrupted = {
      ...JSON.parse(JSON.stringify(scene)),
      file: {
        ...JSON.parse(JSON.stringify(scene.file)),
        elements: [rect, { id: 'bad', type: 'nonsense' }, 'garbage'],
      },
    }

    const parsed = parsePersistedScene(corrupted)

    expect(parsed).not.toBeNull()
    expect(parsed!.file.elements).toHaveLength(1)
    expect(parsed!.file.elements[0]!.id).toBe(rect.id)
  })

  it('coerces invalid app state to safe defaults', () => {
    const parsed = parsePersistedScene({
      type: PERSISTED_SCENE_TYPE,
      version: 1,
      file: { type: 'opendraw', elements: [] },
      appState: {
        theme: 'sepia',
        viewport: { scrollX: 'x', scrollY: Number.NaN, zoom: 9999 },
        gridSize: -3,
      },
    })

    expect(parsed!.appState).toEqual({
      theme: 'light',
      viewport: { scrollX: 0, scrollY: 0, zoom: expect.any(Number) },
      gridSize: null,
    })
    // Zoom is clamped to the core range, never trusted blindly.
    expect(parsed!.appState.viewport.zoom).toBeLessThanOrEqual(32)
  })
})
