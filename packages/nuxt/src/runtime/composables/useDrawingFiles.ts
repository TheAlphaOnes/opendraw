import { computed, inject, onMounted, onScopeDispose, provide, ref, shallowRef, type ComputedRef, type InjectionKey, type Ref } from 'vue'

import {
  DEFAULT_SCENE_STORAGE_KEY,
  createDrawingFiles,
  type DrawingFile,
  type DrawingFiles,
  type DrawingFilesOptions,
  type DrawingFilesSnapshot,
  type ThumbnailScene,
} from '@opendraw/editor'

export type { DrawingFile }

/**
 * The drawing-files library (@opendraw/editor's createDrawingFiles) as Vue
 * state, for <OpenDrawApp>'s files sidebar.
 *
 * Hydration: the server has no storage, so the list and names stay empty
 * until mount — the server-rendered markup and the hydration render agree,
 * then the real drawings appear. Only the scene key is read before mount:
 * persistence needs it to restore, and it is never rendered.
 */
export interface DrawingFilesContext {
  /** Most recently edited first; empty until mounted. */
  files: ComputedRef<readonly DrawingFile[]>
  /** The open drawing; null until mounted. */
  active: ComputedRef<DrawingFile | null>
  /** Where the open drawing's scene is saved. */
  storageKey: ComputedRef<string>
  create: () => void
  open: (id: string) => void
  rename: (id: string, name: string) => void
  duplicate: (id: string) => void
  remove: (id: string) => void
  thumbnail: (id: string) => string | null
  /** Reports the open drawing's live content (edit time, preview). */
  record: (scene: ThumbnailScene) => void
  /** Whether the drawings sidebar is showing (opened by the button or the main menu). */
  sidebarOpen: Ref<boolean>
}

export interface DrawingFilesContextOptions extends DrawingFilesOptions {
  /** Writes the open scene's pending autosave, so a copy reads it whole. */
  flushScene?: () => void
}

const KEY: InjectionKey<DrawingFilesContext> = Symbol('opendraw-drawing-files')

export function createDrawingFilesContext(options: DrawingFilesContextOptions = {}): DrawingFilesContext {
  const library: DrawingFiles | null = typeof window === 'undefined' ? null : createDrawingFiles(options)
  const snapshot = shallowRef<DrawingFilesSnapshot | null>(null)

  if (library) {
    const unsubscribe = library.subscribe((next) => {
      snapshot.value = next
    })
    onMounted(() => {
      snapshot.value = library.snapshot
    })
    onScopeDispose(() => {
      unsubscribe()
      library.dispose()
    })
  }

  const files = computed(() => snapshot.value?.files ?? [])
  const active = computed(() => files.value.find((file) => file.id === snapshot.value?.activeId) ?? null)

  return {
    files,
    active,
    // Before mount the snapshot is withheld from the template, but the
    // library already knows the key — persistence restores from it.
    storageKey: computed(() => active.value?.storageKey ?? library?.active.storageKey ?? DEFAULT_SCENE_STORAGE_KEY),
    create: () => void library?.create(),
    open: (id) => library?.open(id),
    rename: (id, name) => library?.rename(id, name),
    duplicate: (id) => {
      if (library && id === library.active.id) {
        options.flushScene?.()
      }
      library?.duplicate(id)
    },
    remove: (id) => library?.remove(id),
    thumbnail: (id) => library?.thumbnail(id) ?? null,
    record: (scene) => {
      if (library) {
        library.recordScene(library.active.id, scene)
      }
    },
    sidebarOpen: ref(false),
  }
}

export function provideDrawingFiles(context: DrawingFilesContext): void {
  provide(KEY, context)
}

export function useDrawingFiles(): DrawingFilesContext {
  const context = inject(KEY, null)
  if (!context) {
    throw new Error('[opendraw] useDrawingFiles() needs <OpenDrawApp> with `files` enabled')
  }
  return context
}
