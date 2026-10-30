import { DEFAULT_APP_STATE, buildFile } from '@opendrawjs/core'

import { THEME_BACKGROUNDS, type EditorController } from '../controller.js'
import {
  DEFAULT_SCENE_STORAGE_KEY,
  LEGACY_SCENE_STORAGE_KEY,
  buildPersistedScene,
  parsePersistedScene,
  type PersistedScene,
} from './persistedScene.js'
import { resolveThemeDefault, type ThemeDefault } from './systemTheme.js'

/**
 * Automatic scene persistence: every change is debounced into localStorage,
 * and a persisted scene is restored on demand, so the editor comes back
 * exactly as the user left it after a reload (Excalidraw parity).
 *
 * Restore semantics:
 * - a persisted scene wins over the initial elements (it is the user's
 *   latest saved work);
 * - restore goes through `loadFile`, which resets history, a freshly
 *   loaded page can never undo into an empty scene;
 * - a corrupted or foreign payload logs and degrades to a fresh scene.
 *
 * Browser-only: a no-op without `window`.
 */

export interface ScenePersistenceOptions {
  /** localStorage key; defaults to `opendraw:scene`. */
  storageKey?: string
  /** Save debounce window in ms; defaults to 300. */
  debounceMs?: number
  /**
   * Theme to apply when nothing usable is persisted (first visit, corrupted
   * payload). `'system'` follows the browser color scheme, Excalidraw's
   * first-load default. A persisted theme always wins over it.
   */
  themeDefault?: ThemeDefault
}

export interface ScenePersistence {
  /**
   * Loads the persisted scene into the editor. Adapters that render on a
   * server call it after hydration, so the restored theme cannot mismatch
   * the server-rendered markup.
   */
  restore: () => void
  /** Writes any pending save now. */
  flush: () => void
  /**
   * Points persistence at another scene key and loads that scene in place,
   * how a drawing-files host opens a drawing. Unsaved edits are written
   * to the key being left first. The theme is the user's, not the
   * drawing's: it carries over, and the opened scene's default background
   * follows it. A key with nothing saved opens an empty drawing.
   */
  switchTo: (storageKey: string) => void
  dispose: () => void
}

const DEFAULT_DEBOUNCE_MS = 300

export function attachScenePersistence(
  editor: EditorController,
  options: ScenePersistenceOptions = {},
): ScenePersistence {
  if (typeof window === 'undefined') {
    return { restore: () => {}, flush: () => {}, switchTo: () => {}, dispose: () => {} }
  }

  let storageKey = options.storageKey ?? DEFAULT_SCENE_STORAGE_KEY
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  let pending: number | null = null
  let lastRev = editor.state.rev

  function save(): void {
    try {
      const payload = buildPersistedScene(editor.elements, editor.appState)
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch (error) {
      // Persistence is a best-effort side channel (quota exceeded, private
      // mode): the editor itself must keep working, but never silently.
      console.error(`[opendraw] failed to persist the scene to "${storageKey}"`, error)
    }
  }

  function flush(): void {
    if (pending !== null) {
      window.clearTimeout(pending)
      pending = null
    }
    save()
  }

  // The document bumps `rev` on every mutation (scene, theme, viewport,
  // grid), so one debounced write per burst of changes suffices; editor-
  // only changes (clipboard, tool lock) leave `rev` alone and save nothing.
  const unsubscribe = editor.subscribe(() => {
    if (editor.state.rev === lastRev) {
      return
    }
    lastRev = editor.state.rev
    if (pending !== null) {
      window.clearTimeout(pending)
    }
    pending = window.setTimeout(() => {
      pending = null
      save()
    }, debounceMs)
  })

  // A reload can land inside the debounce window, flush before unload so
  // nothing drawn is ever lost.
  window.addEventListener('beforeunload', flush)

  /**
   * First load (or an unreadable payload): no persisted theme exists, so the
   * configured default decides, `'system'` follows the browser color
   * scheme, Excalidraw's behavior on a fresh visit.
   */
  function applyThemeDefault(): void {
    if (options.themeDefault) {
      editor.setTheme(resolveThemeDefault(options.themeDefault))
    }
  }

  /**
   * The scene saved under `key`: null when nothing is saved, 'unreadable'
   * when storage or the payload cannot be read (both logged).
   */
  function readScene(key: string): PersistedScene | null | 'unreadable' {
    let raw: string | null
    try {
      raw = window.localStorage.getItem(key)
      // The default key migrates a scene saved before the opendraw rename;
      // the next save writes it under the new key.
      if (raw === null && key === DEFAULT_SCENE_STORAGE_KEY) {
        raw = window.localStorage.getItem(LEGACY_SCENE_STORAGE_KEY)
      }
    } catch (error) {
      console.error(`[opendraw] scene storage is not readable (${key})`, error)
      return 'unreadable'
    }
    if (raw === null) {
      return null
    }
    try {
      return parsePersistedScene(JSON.parse(raw)) ?? 'unreadable'
    } catch (error) {
      // Expected degradation on a corrupted payload, not a failed save:
      // warn and keep the fresh scene.
      console.warn(`[opendraw] ignoring a corrupted persisted scene (${key})`, error)
      return 'unreadable'
    }
  }

  function restore(): void {
    const parsed = readScene(storageKey)
    if (parsed === null || parsed === 'unreadable') {
      applyThemeDefault()
      return
    }
    // loadFile replaces the scene and clears history; theme/grid/viewport
    // are app-state-only writes and record no undo entries.
    editor.loadFile(parsed.file)
    editor.setTheme(parsed.appState.theme)
    editor.doc.setViewport(parsed.appState.viewport)
    editor.setGridSize(parsed.appState.gridSize)
  }

  function switchTo(next: string): void {
    if (next === storageKey) {
      return
    }
    if (pending !== null) {
      flush()
    }
    storageKey = next
    const parsed = readScene(next)
    const theme = editor.theme
    if (parsed === null || parsed === 'unreadable') {
      editor.loadFile(buildFile([], THEME_BACKGROUNDS[theme]))
      editor.doc.setViewport({ ...DEFAULT_APP_STATE.viewport })
    } else {
      editor.loadFile(parsed.file)
      editor.doc.setViewport(parsed.appState.viewport)
      editor.setGridSize(parsed.appState.gridSize)
    }
    // Re-applying the session theme swaps a theme-default background saved
    // under the other theme, so a drawing made in dark opens readable in light.
    editor.setTheme(theme)
    // The load itself is not an edit: the save it scheduled is dropped.
    if (pending !== null) {
      window.clearTimeout(pending)
      pending = null
    }
    lastRev = editor.state.rev
  }

  return {
    restore,
    flush,
    switchTo,
    dispose() {
      unsubscribe()
      window.removeEventListener('beforeunload', flush)
      flush()
    },
  }
}
