/**
 * Scene persistence payload (de)serialization.
 *
 * The persisted envelope wraps the core file format: core's `OpenDrawFile`
 * carries the elements and the canvas background, and the nuxt side adds the
 * editor chrome state (theme, viewport, grid) that core deliberately does
 * not model in its file format. All parsing is defensive — a corrupted or
 * foreign payload yields `null`, never a throw, so the editor always
 * degrades to a fresh scene.
 */

import {
  MAX_ZOOM,
  MIN_ZOOM,
  buildFile,
  parseFile,
  type ThemeName,
  type OpenDrawAppState,
  type OpenDrawElement,
  type OpenDrawFile,
} from '@opendrawjs/core'

/** Discriminant + version of the localStorage envelope. */
export const PERSISTED_SCENE_TYPE = 'opendraw-scene'
export const PERSISTED_SCENE_VERSION = 1

/** The default localStorage key; override per-instance via options. */
export const DEFAULT_SCENE_STORAGE_KEY = 'opendraw:scene'

/**
 * Key and envelope type used before the project was renamed to opendraw.
 * Read once as a fallback so no saved drawing is lost across the rename.
 */
export const LEGACY_SCENE_STORAGE_KEY = 'vuedraw:scene'
const LEGACY_SCENE_TYPE = 'vuedraw-scene'

/** The viewport subset that survives a reload (pan + zoom). */
export interface PersistedViewport {
  scrollX: number
  scrollY: number
  zoom: number
}

/** Editor chrome state that persists alongside the scene. */
export interface PersistedAppState {
  theme: ThemeName
  viewport: PersistedViewport
  gridSize: number | null
}

/** The localStorage envelope: core file + chrome state. */
export interface PersistedScene {
  type: typeof PERSISTED_SCENE_TYPE
  version: typeof PERSISTED_SCENE_VERSION
  file: OpenDrawFile
  appState: PersistedAppState
}

/** Builds a persistable envelope from live document state. */
export function buildPersistedScene(
  elements: readonly OpenDrawElement[],
  appState: Readonly<OpenDrawAppState>,
): PersistedScene {
  return {
    type: PERSISTED_SCENE_TYPE,
    version: PERSISTED_SCENE_VERSION,
    file: buildFile(elements, appState.viewBackgroundColor),
    appState: {
      theme: appState.theme,
      viewport: { ...appState.viewport },
      gridSize: appState.gridSize,
    },
  }
}

// ---------------------------------------------------------------------------
// Defensive parsing
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function theme(value: unknown): ThemeName {
  return value === 'dark' ? 'dark' : 'light'
}

function viewport(value: unknown): PersistedViewport {
  const raw = isRecord(value) ? value : {}
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, num(raw.zoom, 1)))
  return {
    scrollX: num(raw.scrollX, 0),
    scrollY: num(raw.scrollY, 0),
    zoom,
  }
}

function gridSize(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

/**
 * Coerces unknown input into a persistable envelope, or null when it is
 * not ours (wrong type/version) or its scene payload cannot be salvaged.
 * Never throws: the caller degrades to a fresh scene on null.
 */
export function parsePersistedScene(input: unknown): PersistedScene | null {
  if (
    !isRecord(input)
    || (input.type !== PERSISTED_SCENE_TYPE && input.type !== LEGACY_SCENE_TYPE)
    || input.version !== PERSISTED_SCENE_VERSION
  ) {
    return null
  }
  // Reuse core's defensive file parsing: malformed elements are dropped,
    // only a payload that is not a opendraw file at all throws.
  let file: OpenDrawFile
  try {
    file = parseFile(input.file)
  } catch {
    return null
  }
  const rawAppState = isRecord(input.appState) ? input.appState : {}
  return {
    type: PERSISTED_SCENE_TYPE,
    version: PERSISTED_SCENE_VERSION,
    file,
    appState: {
      theme: theme(rawAppState.theme),
      viewport: viewport(rawAppState.viewport),
      gridSize: gridSize(rawAppState.gridSize),
    },
  }
}
