import { onMounted, onScopeDispose, watch } from 'vue'

import type { OpenDrawContext } from './useOpenDraw.js'

import {
  DEFAULT_SCENE_STORAGE_KEY,
  LEGACY_SCENE_STORAGE_KEY,
  buildPersistedScene,
  parsePersistedScene,
} from '../persistence/persistedScene.js'
import { resolveThemeDefault, type ThemeDefault } from '../persistence/systemTheme.js'

/**
 * Automatic scene persistence: every document change is debounced into
 * localStorage, and a persisted scene is restored on mount — so the editor
 * comes back exactly as the user left it after a reload (Excalidraw parity).
 *
 * Restore semantics:
 * - a persisted scene wins over the shell's initial elements (it is the
 *   user's latest saved work);
 * - restore goes through `loadFile`, which resets history — a freshly
 *   loaded page can never undo into an empty scene;
 * - a corrupted or foreign payload logs and degrades to a fresh scene.
 *
 * Browser-only: a no-op during SSR.
 */

export interface ScenePersistenceOptions {
  /** localStorage key; defaults to `opendraw:scene`. */
  storageKey?: string
  /** Save debounce window in ms; defaults to 300. */
  debounceMs?: number
  /**
   * Theme to apply when nothing usable is persisted (first visit, corrupted
   * payload). `'system'` follows the browser color scheme — Excalidraw's
   * first-load default. A persisted theme always wins over it.
   */
  themeDefault?: ThemeDefault
}

const DEFAULT_DEBOUNCE_MS = 300

export function useScenePersistence(
  ctx: OpenDrawContext,
  options: ScenePersistenceOptions = {},
): void {
  if (typeof window === 'undefined') {
    return
  }

  const storageKey = options.storageKey ?? DEFAULT_SCENE_STORAGE_KEY
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS

  let pending: number | null = null

  function save(): void {
    try {
      const payload = buildPersistedScene(ctx.elements.value, ctx.appState.value)
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

  // Restore after hydration: the shell's data-theme attribute must match the
  // server-rendered markup during hydration. Mount hooks run before the
  // browser can dispatch any input event, so no user change can precede
  // the restore.
  onMounted(restore)

  // Save loop: the document bumps `rev` on every mutation (scene, theme,
  // viewport, grid), so one debounced write per burst of changes suffices.
  watch(
    () => ctx.state.value.rev,
    () => {
      if (pending !== null) {
        window.clearTimeout(pending)
      }
      pending = window.setTimeout(() => {
        pending = null
        save()
      }, debounceMs)
    },
  )

  // A reload can land inside the debounce window — flush before unload and
  // when the editor unmounts so nothing drawn is ever lost.
  window.addEventListener('beforeunload', flush)
  onScopeDispose(() => {
    window.removeEventListener('beforeunload', flush)
    flush()
  })

  function restore(): void {
    let raw: string | null
    try {
      raw = window.localStorage.getItem(storageKey)
      // The default key migrates a scene saved before the opendraw rename;
      // the next save writes it under the new key.
      if (raw === null && storageKey === DEFAULT_SCENE_STORAGE_KEY) {
        raw = window.localStorage.getItem(LEGACY_SCENE_STORAGE_KEY)
      }
    } catch (error) {
      console.error(`[opendraw] scene storage is not readable (${storageKey})`, error)
      applyThemeDefault()
      return
    }
    if (raw === null) {
      applyThemeDefault()
      return
    }
    let parsed
    try {
      parsed = parsePersistedScene(JSON.parse(raw))
    } catch (error) {
      // Expected degradation on a corrupted payload, not a failed save:
      // warn and keep the fresh scene.
      console.warn(`[opendraw] ignoring a corrupted persisted scene (${storageKey})`, error)
      applyThemeDefault()
      return
    }
    if (!parsed) {
      applyThemeDefault()
      return
    }
    // loadFile replaces the scene and clears history; theme/grid/viewport
    // are app-state-only writes and record no undo entries.
    ctx.loadFile(parsed.file)
    ctx.setTheme(parsed.appState.theme)
    ctx.doc.setViewport(parsed.appState.viewport)
    ctx.setGridSize(parsed.appState.gridSize)
  }

  /**
   * First load (or an unreadable payload): no persisted theme exists, so the
   * configured default decides — `'system'` follows the browser color
   * scheme, Excalidraw's behavior on a fresh visit.
   */
  function applyThemeDefault(): void {
    if (options.themeDefault) {
      ctx.setTheme(resolveThemeDefault(options.themeDefault))
    }
  }
}
