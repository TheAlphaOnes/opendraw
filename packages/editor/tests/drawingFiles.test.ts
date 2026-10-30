import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_APP_STATE, newRectangleElement } from '@opendrawjs/core'

import {
  DEFAULT_FILE_INDEX_KEY,
  FILE_SCENE_KEY_PREFIX,
  FILE_THUMBNAIL_KEY_PREFIX,
  UNTITLED_FILE_NAME,
  parseFileIndex,
  sceneSignature,
  uniqueFileName,
} from '../src/files/fileIndex.js'
import { createDrawingFiles, memoryStorage, type DrawingFilesOptions } from '../src/files/drawingFiles.js'
import { DEFAULT_SCENE_STORAGE_KEY, buildPersistedScene } from '../src/persistence/persistedScene.js'

const rect = (x = 0) => newRectangleElement({ x, y: 0, width: 10, height: 10 })
const savedScene = (count: number) =>
  JSON.stringify(buildPersistedScene(Array.from({ length: count }, (_, i) => rect(i * 20)), DEFAULT_APP_STATE))
const scene = (count: number) => ({
  elements: Array.from({ length: count }, (_, i) => rect(i * 20)),
  viewBackgroundColor: '#ffffff',
  theme: 'light' as const,
})

let storage: Storage
let clock: number
let ids: number

function library(options: DrawingFilesOptions = {}) {
  return createDrawingFiles({ storage, now: () => clock, createId: () => `f${++ids}`, debounceMs: 10, ...options })
}

beforeEach(() => {
  storage = memoryStorage()
  clock = 1000
  ids = 0
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('drawing files', () => {
  it('starts with one drawing that adopts the single-scene save', () => {
    storage.setItem(DEFAULT_SCENE_STORAGE_KEY, savedScene(3))
    const files = library()
    expect(files.snapshot.files).toHaveLength(1)
    expect(files.active).toMatchObject({ name: UNTITLED_FILE_NAME, storageKey: DEFAULT_SCENE_STORAGE_KEY, elementCount: 3 })
    expect(parseFileIndex(JSON.parse(storage.getItem(DEFAULT_FILE_INDEX_KEY)!))?.activeId).toBe(files.active.id)
  })

  it('creates, opens and renames drawings, persisting the index', () => {
    const files = library()
    const second = files.create()
    expect(second.name).toBe(`${UNTITLED_FILE_NAME} 2`)
    expect(second.storageKey).toBe(`${FILE_SCENE_KEY_PREFIX}${second.id}`)
    expect(files.active.id).toBe(second.id)

    const first = files.snapshot.files.find((f) => f.id !== second.id)!
    files.open(first.id)
    files.rename(first.id, '  Roadmap   Q3 ')
    expect(files.active).toMatchObject({ id: first.id, name: 'Roadmap Q3' })

    // A blank name is ignored rather than saved.
    files.rename(first.id, '   ')
    expect(files.active.name).toBe('Roadmap Q3')

    const reopened = library()
    expect(reopened.active).toMatchObject({ id: first.id, name: 'Roadmap Q3' })
    expect(reopened.snapshot.files).toHaveLength(2)
  })

  it('bumps the edit time only when the content changes', () => {
    const files = library()
    const id = files.active.id
    clock = 2000
    files.recordScene(id, scene(2))
    expect(files.active).toMatchObject({ updatedAt: 2000, elementCount: 2 })

    // The same content again (a reload, a pan) is not an edit.
    clock = 3000
    files.recordScene(id, scene(2))
    expect(files.active.updatedAt).toBe(2000)
  })

  it('lists the most recently edited drawing first', () => {
    const files = library()
    const older = files.active.id
    clock = 2000
    const newer = files.create().id
    clock = 3000
    files.recordScene(older, scene(1))
    expect(files.snapshot.files.map((f) => f.id)).toEqual([older, newer])
  })

  it('duplicates a drawing with its scene under a new key', () => {
    const files = library()
    const source = files.active
    storage.setItem(source.storageKey, savedScene(2))
    storage.setItem(`${FILE_THUMBNAIL_KEY_PREFIX}${source.id}`, 'data:image/png;base64,AAA')
    const copy = files.duplicate(source.id)!
    expect(copy.name).toBe(`${UNTITLED_FILE_NAME} copy`)
    expect(storage.getItem(copy.storageKey)).toBe(storage.getItem(source.storageKey))
    expect(files.thumbnail(copy.id)).toBe('data:image/png;base64,AAA')
    // Duplicating does not switch away from the open drawing.
    expect(files.active.id).toBe(source.id)
  })

  it('deletes a drawing with its scene, opening the next one', () => {
    const files = library()
    const first = files.active
    clock = 2000
    const second = files.create()
    storage.setItem(second.storageKey, savedScene(1))
    files.remove(second.id)
    expect(storage.getItem(second.storageKey)).toBeNull()
    expect(files.active.id).toBe(first.id)

    // Deleting the last one leaves a fresh, empty drawing.
    files.remove(first.id)
    expect(files.snapshot.files).toHaveLength(1)
    expect(files.active.id).not.toBe(first.id)
  })

  it('rebuilds a lost index from the scenes still in storage', () => {
    storage.setItem(`${FILE_SCENE_KEY_PREFIX}old`, savedScene(4))
    storage.setItem(DEFAULT_FILE_INDEX_KEY, '{ not json')
    const files = library()
    expect(files.snapshot.files.map((f) => f.storageKey).sort()).toEqual([DEFAULT_SCENE_STORAGE_KEY, `${FILE_SCENE_KEY_PREFIX}old`].sort())
    expect(storage.getItem(`${FILE_SCENE_KEY_PREFIX}old`)).not.toBeNull()
  })

  it('reclaims scenes a healthy index does not list', () => {
    library().create()
    storage.setItem(`${FILE_SCENE_KEY_PREFIX}stray`, savedScene(1))
    library()
    expect(storage.getItem(`${FILE_SCENE_KEY_PREFIX}stray`)).toBeNull()
  })

  it('writes edit metadata after the debounce, and on flush', () => {
    const files = library()
    files.recordScene(files.active.id, scene(5))
    const stored = () => parseFileIndex(JSON.parse(storage.getItem(DEFAULT_FILE_INDEX_KEY)!))!.files[0]!.elementCount
    expect(stored()).toBe(0)
    files.flush()
    expect(stored()).toBe(5)
  })
})

describe('file index helpers', () => {
  it('numbers taken names', () => {
    expect(uniqueFileName('Sketch', [])).toBe('Sketch')
    expect(uniqueFileName('Sketch', ['Sketch', 'Sketch 2'])).toBe('Sketch 3')
  })

  it('fingerprints content by element versions', () => {
    const a = rect()
    expect(sceneSignature([a])).toBe(sceneSignature([{ ...a }]))
    expect(sceneSignature([a])).not.toBe(sceneSignature([{ ...a, version: a.version + 1 }]))
  })

  it('drops entries that would share an id or a scene key', () => {
    const entry = { id: 'a', name: 'A', storageKey: 'k', createdAt: 1, updatedAt: 1 }
    const index = parseFileIndex({ type: 'opendraw-files', version: 1, activeId: 'a', files: [entry, { ...entry, id: 'b' }, { ...entry }] })
    expect(index?.files.map((f) => f.id)).toEqual(['a'])
  })
})
