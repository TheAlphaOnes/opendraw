/**
 * The drawing-files index: which drawings exist, what they are called and
 * where each one's scene lives. The index is small metadata only — every
 * scene is a separate persisted-scene envelope under its own storage key,
 * written by the same scene persistence that saves a single-scene editor.
 *
 * Parsing is defensive, like the scene envelope: a corrupted or foreign
 * index yields `null` (the library then starts fresh), and malformed
 * entries are dropped rather than trusted.
 */

import type { OpenDrawElement } from '@opendraw/core'

export const FILE_INDEX_TYPE = 'opendraw-files'
export const FILE_INDEX_VERSION = 1

/** Where the index lives by default. */
export const DEFAULT_FILE_INDEX_KEY = 'opendraw:files'
/** Prefix of each drawing's scene key (`opendraw:file:<id>`). */
export const FILE_SCENE_KEY_PREFIX = 'opendraw:file:'
/** Prefix of each drawing's cached preview (`opendraw:thumb:<id>`). */
export const FILE_THUMBNAIL_KEY_PREFIX = 'opendraw:thumb:'

export const UNTITLED_FILE_NAME = 'Untitled drawing'
export const MAX_FILE_NAME_LENGTH = 80

/** One drawing's metadata. */
export interface DrawingFile {
  id: string
  name: string
  /** The scene's storage key (an existing single-scene save keeps its own). */
  storageKey: string
  createdAt: number
  /** Last content change — opening or panning a drawing never bumps it. */
  updatedAt: number
  /** Live (not deleted) elements, for the list's caption. */
  elementCount: number
  /** Content fingerprint; a change bumps `updatedAt` (see sceneSignature). */
  signature: string
  /** When the preview was last rendered; null when there is none. */
  thumbnailAt: number | null
}

export interface DrawingFileIndex {
  type: typeof FILE_INDEX_TYPE
  version: typeof FILE_INDEX_VERSION
  /** The drawing a reload reopens. */
  activeId: string | null
  files: DrawingFile[]
}

/**
 * A cheap content fingerprint: every edit bumps an element's `version`, so
 * count + version sum changes exactly when the content does — and reloading
 * the same scene reproduces it, so merely opening a drawing never reads as
 * an edit.
 */
export function sceneSignature(elements: readonly OpenDrawElement[]): string {
  let versions = 0
  for (const element of elements) {
    versions += element.version
  }
  return `${elements.length}:${versions}`
}

/** Trimmed, single-spaced and capped; empty when nothing usable is left. */
export function normalizeFileName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_FILE_NAME_LENGTH)
}

/** `base`, or `base 2`, `base 3`, … — the first one not already taken. */
export function uniqueFileName(base: string, taken: Iterable<string>): string {
  const names = new Set(taken)
  if (!names.has(base)) {
    return base
  }
  let n = 2
  while (names.has(`${base} ${n}`)) {
    n++
  }
  return `${base} ${n}`
}

// ---------------------------------------------------------------------------
// Defensive parsing
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

function parseFileEntry(input: unknown): DrawingFile | null {
  if (!isRecord(input) || typeof input.id !== 'string' || input.id === '' || typeof input.storageKey !== 'string' || input.storageKey === '') {
    return null
  }
  const createdAt = isTime(input.createdAt) ? input.createdAt : 0
  return {
    id: input.id,
    name: (typeof input.name === 'string' && normalizeFileName(input.name)) || UNTITLED_FILE_NAME,
    storageKey: input.storageKey,
    createdAt,
    updatedAt: isTime(input.updatedAt) ? input.updatedAt : createdAt,
    elementCount: isTime(input.elementCount) ? Math.floor(input.elementCount) : 0,
    signature: typeof input.signature === 'string' ? input.signature : '',
    thumbnailAt: isTime(input.thumbnailAt) ? input.thumbnailAt : null,
  }
}

/**
 * Coerces unknown input into an index, or null when it is not ours. Entries
 * that cannot be salvaged — and repeats of an id or a storage key, which
 * would make two drawings share one scene — are dropped.
 */
export function parseFileIndex(input: unknown): DrawingFileIndex | null {
  if (!isRecord(input) || input.type !== FILE_INDEX_TYPE || input.version !== FILE_INDEX_VERSION || !Array.isArray(input.files)) {
    return null
  }
  const ids = new Set<string>()
  const keys = new Set<string>()
  const files: DrawingFile[] = []
  for (const raw of input.files) {
    const file = parseFileEntry(raw)
    if (file && !ids.has(file.id) && !keys.has(file.storageKey)) {
      ids.add(file.id)
      keys.add(file.storageKey)
      files.push(file)
    }
  }
  const activeId = typeof input.activeId === 'string' && ids.has(input.activeId) ? input.activeId : null
  return { type: FILE_INDEX_TYPE, version: FILE_INDEX_VERSION, activeId, files }
}
