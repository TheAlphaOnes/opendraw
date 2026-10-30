/**
 * Drawing files, several drawings in one browser, Excalidraw+-style: a
 * small index of named drawings, each scene under its own storage key.
 *
 * The library owns the index and the previews; it never touches a scene's
 * content except to copy (duplicate) or delete it. Scenes are written by
 * the editor's own scene persistence, pointed at the active drawing's
 * `storageKey`: so switching drawings is switching that key.
 *
 *   const files = createDrawingFiles()
 *   attachScenePersistence(editor, { storageKey: files.active.storageKey })
 *   editor.subscribe(() => files.recordScene(files.active.id, { ...scene }))
 *
 * Framework-free: adapters mirror `snapshot` (immutable, replaced on every
 * change) through `subscribe`.
 */

import { parsePersistedScene, DEFAULT_SCENE_STORAGE_KEY } from '../persistence/persistedScene.js'
import {
  DEFAULT_FILE_INDEX_KEY,
  FILE_INDEX_TYPE,
  FILE_INDEX_VERSION,
  FILE_SCENE_KEY_PREFIX,
  FILE_THUMBNAIL_KEY_PREFIX,
  UNTITLED_FILE_NAME,
  normalizeFileName,
  parseFileIndex,
  sceneSignature,
  uniqueFileName,
  type DrawingFile,
  type DrawingFileIndex,
} from './fileIndex.js'
import { renderThumbnail, type ThumbnailScene } from './thumbnail.js'

export interface DrawingFilesOptions {
  /** Defaults to `window.localStorage`; in-memory without a browser. */
  storage?: Storage
  /** Where the index lives; defaults to `opendraw:files`. */
  indexKey?: string
  /**
   * The scene key the first drawing adopts, so a scene saved before files
   * existed becomes the first drawing. Defaults to the editor's default key.
   */
  initialSceneKey?: string
  /** Debounce for metadata writes and preview renders, in ms (default 600). */
  debounceMs?: number
  now?: () => number
  createId?: () => string
}

export interface DrawingFilesSnapshot {
  /** Most recently edited first. */
  readonly files: readonly DrawingFile[]
  readonly activeId: string
}

export interface DrawingFiles {
  readonly snapshot: DrawingFilesSnapshot
  /** The open drawing. */
  readonly active: DrawingFile
  subscribe: (listener: (snapshot: DrawingFilesSnapshot) => void) => () => void
  /** Adds an empty drawing and opens it. */
  create: (name?: string) => DrawingFile
  open: (id: string) => void
  rename: (id: string, name: string) => void
  /**
   * Copies a drawing (scene and preview) under a new name. The scene is
   * read from storage, so flush pending scene saves first.
   */
  duplicate: (id: string) => DrawingFile | null
  /** Deletes a drawing; deleting the open one opens the next (or a new one). */
  remove: (id: string) => void
  /**
   * Reports a drawing's live content. A real change (not a reload, not a
   * pan) bumps its edit time and schedules a fresh preview.
   */
  recordScene: (id: string, scene: ThumbnailScene) => void
  /** The cached preview, as a data URL. */
  thumbnail: (id: string) => string | null
  /** Writes pending metadata now. */
  flush: () => void
  dispose: () => void
}

const DEFAULT_DEBOUNCE_MS = 600

function defaultStorage(): Storage {
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage
    } catch (error) {
      // Blocked storage (privacy settings): degrade to a working session.
      console.error('[opendraw] localStorage is unavailable; drawings will not survive a reload', error)
    }
  }
  return memoryStorage()
}

/** A Storage over a Map, the fallback without a browser, and for tests. */
export function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  }
}

function defaultId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const byRecentEdit = (a: DrawingFile, b: DrawingFile): number => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt

export function createDrawingFiles(options: DrawingFilesOptions = {}): DrawingFiles {
  const storage = options.storage ?? defaultStorage()
  const indexKey = options.indexKey ?? DEFAULT_FILE_INDEX_KEY
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const now = options.now ?? Date.now
  const createId = options.createId ?? defaultId
  const listeners = new Set<(snapshot: DrawingFilesSnapshot) => void>()
  const thumbnails = new Map<string, string | null>()
  const pendingScenes = new Map<string, ThumbnailScene>()
  let indexTimer: ReturnType<typeof setTimeout> | null = null
  let previewTimer: ReturnType<typeof setTimeout> | null = null

  // --- storage, never throwing: a failed write logs and the session goes on

  function read(key: string): string | null {
    try {
      return storage.getItem(key)
    } catch (error) {
      console.error(`[opendraw] failed to read "${key}"`, error)
      return null
    }
  }

  function write(key: string, value: string): boolean {
    try {
      storage.setItem(key, value)
      return true
    } catch (error) {
      console.error(`[opendraw] failed to write "${key}" (storage full?)`, error)
      return false
    }
  }

  function erase(key: string): void {
    try {
      storage.removeItem(key)
    } catch (error) {
      console.error(`[opendraw] failed to remove "${key}"`, error)
    }
  }

  // --- the index

  function newFile(name: string, storageKey?: string): DrawingFile {
    const id = createId()
    const time = now()
    return {
      id,
      name,
      storageKey: storageKey ?? `${FILE_SCENE_KEY_PREFIX}${id}`,
      createdAt: time,
      updatedAt: time,
      elementCount: 0,
      signature: '',
      thumbnailAt: null,
    }
  }

  /** Element count and fingerprint of a stored scene (empty when unreadable). */
  function describeScene(file: DrawingFile): DrawingFile {
    const raw = read(file.storageKey)
    if (raw === null) {
      return file
    }
    try {
      const elements = parsePersistedScene(JSON.parse(raw))?.file.elements ?? []
      return { ...file, elementCount: elements.length, signature: sceneSignature(elements) }
    } catch {
      // An unreadable scene is the editor's to report when it restores.
      return file
    }
  }

  /**
   * Without a readable index, the drawings are rebuilt from the scenes
   * still in storage, a lost index must never lose a drawing. The scene
   * saved before files existed becomes the first one.
   */
  function recoverFiles(): DrawingFile[] {
    const keys: string[] = []
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key?.startsWith(FILE_SCENE_KEY_PREFIX)) {
          keys.push(key)
        }
      }
    } catch (error) {
      console.error('[opendraw] failed to scan storage for drawings', error)
    }
    const names: string[] = []
    const files = [options.initialSceneKey ?? DEFAULT_SCENE_STORAGE_KEY, ...keys.sort()].map((key) => {
      const name = uniqueFileName(UNTITLED_FILE_NAME, names)
      names.push(name)
      return describeScene(newFile(name, key))
    })
    // Recovered scenes are only worth listing when they hold something.
    const kept = files.filter((file, i) => i === 0 || file.elementCount > 0)
    for (const file of files) {
      if (!kept.includes(file)) {
        erase(file.storageKey)
      }
    }
    return kept
  }

  function loadIndex(): { index: DrawingFileIndex; recovered: boolean } {
    const raw = read(indexKey)
    let index: DrawingFileIndex | null = null
    if (raw !== null) {
      try {
        index = parseFileIndex(JSON.parse(raw))
      } catch (error) {
        console.warn(`[opendraw] ignoring a corrupted drawing index (${indexKey})`, error)
      }
    }
    if (!index || index.files.length === 0) {
      const recovered = recoverFiles()
      return { index: { type: FILE_INDEX_TYPE, version: FILE_INDEX_VERSION, activeId: recovered[0]!.id, files: recovered }, recovered: true }
    }
    return { index, recovered: false }
  }

  const initial = loadIndex()
  let files: DrawingFile[] = initial.index.files
  let snapshot: DrawingFilesSnapshot = {
    files: [...files].sort(byRecentEdit),
    activeId: initial.index.activeId ?? [...files].sort(byRecentEdit)[0]!.id,
  }

  function writeIndex(): void {
    if (indexTimer !== null) {
      clearTimeout(indexTimer)
      indexTimer = null
    }
    const index: DrawingFileIndex = { type: FILE_INDEX_TYPE, version: FILE_INDEX_VERSION, activeId: snapshot.activeId, files }
    write(indexKey, JSON.stringify(index))
  }

  function scheduleIndexWrite(): void {
    if (indexTimer === null) {
      indexTimer = setTimeout(writeIndex, debounceMs)
    }
  }

  function commit(next: DrawingFile[], activeId: string, persist: 'now' | 'later'): void {
    files = next
    snapshot = { files: [...next].sort(byRecentEdit), activeId }
    if (persist === 'now') {
      writeIndex()
    } else {
      scheduleIndexWrite()
    }
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  const find = (id: string): DrawingFile | undefined => files.find((file) => file.id === id)
  const patch = (id: string, change: Partial<DrawingFile>): DrawingFile[] =>
    files.map((file) => (file.id === id ? { ...file, ...change } : file))

  // Scene keys and previews a healthy index does not list, left behind by
  // a tab that closed mid-delete, are reclaimed on start. (Recovery lists
  // every scene instead, so this never runs on a rebuilt index.)
  function collectOrphans(): void {
    const owned = new Set(files.flatMap((file) => [file.storageKey, `${FILE_THUMBNAIL_KEY_PREFIX}${file.id}`]))
    const orphans: string[] = []
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key && (key.startsWith(FILE_SCENE_KEY_PREFIX) || key.startsWith(FILE_THUMBNAIL_KEY_PREFIX)) && !owned.has(key)) {
          orphans.push(key)
        }
      }
    } catch (error) {
      console.error('[opendraw] failed to scan storage for orphaned drawings', error)
    }
    orphans.forEach(erase)
  }

  if (initial.recovered || initial.index.activeId !== snapshot.activeId) {
    writeIndex()
  } else {
    collectOrphans()
  }

  // --- previews: rendered after the edits settle, in idle time

  function renderPreviews(): void {
    previewTimer = null
    const jobs = [...pendingScenes]
    pendingScenes.clear()
    let next = files
    for (const [id, scene] of jobs) {
      if (!find(id)) {
        continue
      }
      const key = `${FILE_THUMBNAIL_KEY_PREFIX}${id}`
      let url: string | null = null
      try {
        url = renderThumbnail(scene)
      } catch (error) {
        console.error('[opendraw] failed to render a drawing preview', error)
        continue
      }
      if (url === null) {
        erase(key)
      } else if (!write(key, url)) {
        continue
      }
      thumbnails.set(id, url)
      next = next.map((file) => (file.id === id ? { ...file, thumbnailAt: url === null ? null : now() } : file))
    }
    if (next !== files) {
      commit(next, snapshot.activeId, 'later')
    }
  }

  function schedulePreviews(): void {
    if (previewTimer !== null) {
      clearTimeout(previewTimer)
    }
    previewTimer = setTimeout(() => {
      const idle = (globalThis as { requestIdleCallback?: (run: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
      if (idle) {
        idle(renderPreviews, { timeout: 2000 })
      } else {
        renderPreviews()
      }
    }, debounceMs)
  }

  // --- other tabs: follow their index writes, keep this tab's open drawing

  function onStorage(event: StorageEvent): void {
    if (event.key !== indexKey || event.storageArea !== storage || event.newValue === null) {
      return
    }
    let index: DrawingFileIndex | null = null
    try {
      index = parseFileIndex(JSON.parse(event.newValue))
    } catch {
      return
    }
    if (!index || index.files.length === 0) {
      return
    }
    files = index.files
    thumbnails.clear()
    const sorted = [...files].sort(byRecentEdit)
    snapshot = { files: sorted, activeId: find(snapshot.activeId) ? snapshot.activeId : sorted[0]!.id }
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  const hasWindow = typeof window !== 'undefined'
  if (hasWindow) {
    window.addEventListener('storage', onStorage)
    window.addEventListener('beforeunload', flush)
  }

  function flush(): void {
    if (indexTimer !== null) {
      writeIndex()
    }
  }

  function thumbnail(id: string): string | null {
    if (!thumbnails.has(id)) {
      thumbnails.set(id, read(`${FILE_THUMBNAIL_KEY_PREFIX}${id}`))
    }
    return thumbnails.get(id) ?? null
  }

  // --- commands

  return {
    get snapshot() {
      return snapshot
    },
    get active() {
      return find(snapshot.activeId)!
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    create(name) {
      const base = (name && normalizeFileName(name)) || UNTITLED_FILE_NAME
      const file = newFile(uniqueFileName(base, files.map((f) => f.name)))
      commit([...files, file], file.id, 'now')
      return file
    },

    open(id) {
      if (id !== snapshot.activeId && find(id)) {
        commit(files, id, 'now')
      }
    },

    rename(id, name) {
      const file = find(id)
      const next = normalizeFileName(name)
      if (file && next !== '' && next !== file.name) {
        commit(patch(id, { name: next }), snapshot.activeId, 'now')
      }
    },

    duplicate(id) {
      const source = find(id)
      if (!source) {
        return null
      }
      const copy = {
        ...newFile(uniqueFileName(`${source.name} copy`, files.map((f) => f.name))),
        elementCount: source.elementCount,
        signature: source.signature,
      }
      const scene = read(source.storageKey)
      if (scene !== null && !write(copy.storageKey, scene)) {
        return null
      }
      const preview = thumbnail(id)
      if (preview !== null && write(`${FILE_THUMBNAIL_KEY_PREFIX}${copy.id}`, preview)) {
        thumbnails.set(copy.id, preview)
        copy.thumbnailAt = now()
      }
      commit([...files, copy], snapshot.activeId, 'now')
      return copy
    },

    remove(id) {
      const file = find(id)
      if (!file) {
        return
      }
      erase(file.storageKey)
      erase(`${FILE_THUMBNAIL_KEY_PREFIX}${id}`)
      thumbnails.delete(id)
      pendingScenes.delete(id)
      const rest = files.filter((f) => f.id !== id)
      if (rest.length === 0) {
        const fresh = newFile(UNTITLED_FILE_NAME)
        commit([fresh], fresh.id, 'now')
        return
      }
      const activeId = id === snapshot.activeId ? [...rest].sort(byRecentEdit)[0]!.id : snapshot.activeId
      commit(rest, activeId, 'now')
    },

    recordScene(id, scene) {
      const file = find(id)
      if (!file) {
        return
      }
      const signature = sceneSignature(scene.elements)
      if (signature !== file.signature) {
        commit(patch(id, { signature, elementCount: scene.elements.length, updatedAt: now() }), snapshot.activeId, 'later')
      } else if (file.thumbnailAt !== null || scene.elements.length === 0 || pendingScenes.has(id)) {
        // Unchanged, and the preview is current (or there is nothing to show).
        return
      }
      // Changed, or a drawing with content but no preview yet (one adopted
      // from a single-scene save): render it once the edits settle.
      pendingScenes.set(id, scene)
      schedulePreviews()
    },

    thumbnail,

    flush,

    dispose() {
      if (hasWindow) {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('beforeunload', flush)
      }
      if (previewTimer !== null) {
        clearTimeout(previewTimer)
      }
      flush()
      listeners.clear()
    },
  }
}
