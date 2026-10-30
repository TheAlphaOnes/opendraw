import { computed, inject, provide, shallowRef, type ComputedRef, type InjectionKey, type ShallowRef } from 'vue'

import {
  DEFAULT_APP_STATE,
  OpenDrawDocument,
  duplicateElements,
  fitViewportToBounds,
  isBoundText,
  withBoundTexts,
  selectedGroupIds,
  stylePayloadOf,
  type Alignment,
  type Arrowhead,
  type FlipAxis,
  type StylePayload,
  exportToDataURL,
  exportToSvg,
  getCommonBounds,
  screenToScene,
  type ElementPatch,
  type ElementStyle,
  type ReorderAction,
  type Roundness,
  type TextLayout,
  type TextStyle,
  type ThemeName,
  type ToolId,
  type Viewport,
  type OpenDrawAppState,
  type OpenDrawElement,
  type OpenDrawFile,
  type OpenDrawState,
  layoutText,
  zoomViewport,
  DEFAULT_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  screenToSceneLength,
  type Point,
} from '@opendraw/core'

import { isTextElement } from '@opendraw/core'

import { downloadText, downloadURL, pickFiles } from '../services/file.service.js'
import {
  imageElementFromPrepared,
  imageResolver,
  isImageFile,
  prepareImageFile,
} from '../services/image.service.js'

/**
 * OpenDrawContext — the reactive wrapper around a OpenDrawDocument.
 *
 * Every component in the editor (canvas, toolbar, panels, menus) consumes
 * this one context through provide/inject. It is also the public
 * extension point: embed <OpenDrawCanvas ui="none" /> and build your own
 * chrome from useOpenDraw().
 */

export interface OpenDrawChangeDetail {
  elements: readonly OpenDrawElement[]
  appState: Readonly<OpenDrawAppState>
}

/** The reactive editor context shared by all opendraw components. */
export interface OpenDrawContext {
  /** The raw document — escape hatch for advanced use. */
  doc: OpenDrawDocument

  /** Reactive mirror of the document state (shallow: element objects are immutable). */
  state: ShallowRef<OpenDrawState>
  elements: ComputedRef<readonly OpenDrawElement[]>
  appState: ComputedRef<Readonly<OpenDrawAppState>>
  selectedElements: ComputedRef<readonly OpenDrawElement[]>

  // tools & theme
  activeTool: ComputedRef<ToolId>
  setActiveTool: (tool: ToolId) => void
  /** Q — a locked tool stays armed after each use (Excalidraw's tool lock). */
  toolLocked: ComputedRef<boolean>
  toggleToolLock: () => void
  /**
   * Called when a tool finishes one use: reverts to selection unless the
   * tool is locked. Freedraw never calls it — the pen stays armed.
   */
  finishToolUse: () => void
  theme: ComputedRef<ThemeName>
  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void

  // selection
  select: (ids: string | readonly string[] | null, mode?: 'replace' | 'toggle') => void
  /** Group-aware select: each id pulls in its whole (visible) group. */
  selectGrouped: (ids: readonly string[], mode?: 'replace' | 'toggle') => void
  selectAll: () => void
  isIdSelected: (id: string) => boolean

  // element actions
  updateElement: (id: string, patch: ElementPatch | ((el: OpenDrawElement) => ElementPatch)) => void
  deleteSelection: () => void
  duplicateSelection: () => void
  reorderSelection: (action: ReorderAction) => void
  toggleSelectionLock: () => void
  copySelection: () => void
  cutSelection: () => void
  paste: (at?: Point) => void
  clipboardSize: ComputedRef<number>

  // style
  changeStyle: (style: Partial<ElementStyle>) => void
  changeTextStyle: (style: Partial<TextStyle>) => void
  /** Corner treatment for the selected rectangles/diamonds, else new-shape default. */
  changeRoundness: (roundness: Roundness | null) => void
  /** Sets one end's head on the selected arrows (or the next arrow's). */
  changeArrowhead: (position: 'start' | 'end', arrowhead: Arrowhead | null) => void
  /** Mod+Shift+> / Mod+Shift+< — steps selected text 10% bigger/smaller. */
  stepFontSize: (direction: 1 | -1) => void
  /** Mod+Alt+C — remembers the first selected element's style. */
  copyStyles: () => void
  /** Mod+Alt+V — applies the remembered style to the selection. */
  pasteStyles: () => void
  hasCopiedStyles: ComputedRef<boolean>

  // groups
  groupSelection: () => void
  ungroupSelection: () => void
  /** Groups currently selected as a unit (derived from the selection). */
  selectedGroupIds: ComputedRef<readonly string[]>
  editingGroupId: ComputedRef<string | null>
  setEditingGroup: (groupId: string | null) => void

  // arrange
  alignSelection: (alignment: Alignment) => void
  distributeSelection: (axis: 'x' | 'y') => void
  flipSelection: (axis: FlipAxis) => void

  // history
  undo: () => boolean
  redo: () => boolean
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>

  // viewport
  zoomAt: (screenPoint: Point, zoom: number) => void
  zoomIn: (screenPoint: Point) => void
  zoomOut: (screenPoint: Point) => void
  resetZoom: () => void
  /** Shift+1 — fits every element, never zooming past 100%. */
  zoomToFitAll: () => void
  /**
   * Fits the selection: `scale-down` (Shift+2) caps at 100%, `contain`
   * (Shift+3) fills the canvas.
   */
  zoomToFitSelection: (fit?: 'scale-down' | 'contain') => void
  panBy: (dxScreen: number, dyScreen: number) => void
  viewport: ComputedRef<{ scrollX: number; scrollY: number; zoom: number }>

  // files & export
  serialize: () => OpenDrawFile
  toJSON: () => string
  loadFile: (file: OpenDrawFile) => void
  loadJSON: (text: string) => void
  exportPNG: (filename?: string) => void
  exportSVG: (filename?: string) => void
  exportDataURL: () => string

  // editing (text)
  setEditing: (id: string | null) => void
  editingId: ComputedRef<string | null>

  // images
  /** Inserts image files at a scene point (viewport center by default). */
  insertImageFiles: (files: readonly File[] | FileList, at?: Point) => void
  /** Opens the toolbar file picker (the image tool's only entry gesture). */
  openImagePicker: () => void

  // files
  /** Mod+S — downloads the scene as a .json file. */
  saveToFile: (filename?: string) => void
  /** Mod+O — opens a .json scene file, replacing the current scene. */
  openFile: () => Promise<void>
  /** Deletes every element (one undo step). */
  clearCanvas: () => void

  // grid
  gridSize: ComputedRef<number | null>
  setGridSize: (size: number | null) => void

  // canvas
  /** CSS-pixel size of the mounted canvas (zero before it mounts). */
  viewportSize: ShallowRef<ViewportSize>
  setViewportSize: (size: ViewportSize) => void
}

export interface ViewportSize {
  width: number
  height: number
}

export interface CreateOpenDrawOptions {
  elements?: readonly OpenDrawElement[]
  appState?: Partial<OpenDrawAppState>
}

export const OPENDRAW_INJECTION_KEY: InjectionKey<OpenDrawContext> = Symbol('opendraw')

const ZOOM_STEP = 1.25

export function createOpenDrawContext(options: CreateOpenDrawOptions = {}): OpenDrawContext {
  const doc = new OpenDrawDocument({
    elements: options.elements,
    appState: options.appState,
  })

  /** In-app clipboard: plain element copies; ids are regenerated on paste. */
  let clipboard: OpenDrawElement[] = []
  /** Style remembered by copyStyles — editor intent, never document state. */
  const copiedStyle = shallowRef<StylePayload | null>(null)

  function selectionWithLabels(): OpenDrawElement[] {
    return withBoundTexts(doc.getElements(), doc.getSelectedElements().map((el) => el.id))
  }

  function fitTo(elementsToFit: readonly OpenDrawElement[], fit: 'scale-down' | 'contain'): void {
    if (elementsToFit.length === 0) {
      return
    }
    doc.setViewport(
      fitViewportToBounds(appState.value.viewport, getCommonBounds(elementsToFit), {
        size: viewportSize.value,
        fit,
      }),
    )
  }

  const state = shallowRef<OpenDrawState>(doc.getState())
  const viewportSize = shallowRef<ViewportSize>({ width: 0, height: 0 })
  /** Tool lock is editor intent, never document state (not persisted). */
  const toolLocked = shallowRef(false)

  doc.subscribe((next) => {
    state.value = next
  })

  const appState = computed(() => state.value.appState)
  const elements = computed(() => state.value.elements)

  /**
   * Excalidraw parity: switching themes swaps the DEFAULT canvas background
   * with it (light keeps #ffffff, dark gets #121212). The dark theme
   * dark-filters element strokes, so a dark theme left over the white
   * default renders near-white strokes on a white canvas — invisible. A
   * background the user customized is kept untouched.
   */
  function themeBackgroundPatch(theme: 'light' | 'dark'): { theme: 'light' | 'dark'; viewBackgroundColor?: string } {
    const current = appState.value.viewBackgroundColor.toLowerCase()
    const isThemeDefault = current === '#ffffff' || current === '#121212'
    if (!isThemeDefault) {
      return { theme }
    }
    return {
      theme,
      viewBackgroundColor: theme === 'dark' ? '#121212' : '#ffffff',
    }
  }

  const context: OpenDrawContext = {
    doc,
    state,
    elements,
    appState,

    activeTool: computed(() => appState.value.activeTool),
    setActiveTool: (tool) => doc.setAppState({ activeTool: tool }),
    toolLocked: computed(() => toolLocked.value),
    toggleToolLock: () => {
      toolLocked.value = !toolLocked.value
    },
    finishToolUse: () => {
      if (!toolLocked.value) {
        doc.setAppState({ activeTool: 'selection' })
      }
    },

    theme: computed(() => appState.value.theme),

    setTheme: (theme) => doc.setAppState(themeBackgroundPatch(theme)),
    toggleTheme: () => {
      const next = appState.value.theme === 'dark' ? 'light' : 'dark'
      doc.setAppState(themeBackgroundPatch(next))
    },

    select: (ids, mode) => doc.select(ids, mode),
    selectGrouped: (ids, mode) => doc.selectGrouped(ids, mode),
    selectAll: () => doc.selectAll(),
    isIdSelected: (id) => doc.isIdSelected(id),

    // Derive from the reactive state — the document's own fields are plain
    // JS, so reading them directly inside a computed would never invalidate.
    selectedElements: computed(() => {
      const { elements, appState } = state.value
      const selected = appState.selectedIds
      if (!selected || Object.keys(selected).length === 0) {
        return []
      }
      return elements.filter((el) => selected[el.id] === true)
    }),

    updateElement: (id, patch) => {
      doc.updateElement(id, (el) => {
        const resolved = typeof patch === 'function' ? patch(el) : patch
        // text geometry follows content/style automatically
        if (isTextElement(el) && touchesText(resolved, el)) {
          return withTextMetrics(resolved, el)
        }
        return resolved
      })
    },

    deleteSelection: () => {
      doc.deleteSelectedElements()
    },
    duplicateSelection: () => doc.duplicateSelection(),
    reorderSelection: (action) => doc.reorderSelection(action),
    toggleSelectionLock: () => {
      const selected = doc.getSelectedElements()
      if (selected.length === 0) {
        return
      }
      const lock = !selected.every((el) => el.locked)
      doc.updateElements(
        selected.map((el) => el.id),
        { locked: lock },
      )
    },

    // The clipboard takes labels along with their shapes.
    copySelection: () => {
      clipboard = selectionWithLabels().map((el) => ({ ...el }))
    },
    cutSelection: () => {
      const copied = selectionWithLabels()
      if (copied.length === 0) {
        return
      }
      clipboard = copied.map((el) => ({ ...el }))
      doc.deleteSelectedElements()
    },
    paste: (at) => {
      if (clipboard.length === 0) {
        return
      }
      const offset = at ? centerOffsetFor(clipboard, at) : { x: 10, y: 10 }
      // Pasted groups are new groups, and the paste lands selected
      // (Excalidraw's actionPaste) — outside any group being edited.
      const copies = duplicateElements(clipboard, { offset })
      doc.beginStep()
      doc.setEditingGroup(null)
      doc.addElements(copies)
      doc.select(copies.filter((el) => !isBoundText(el)).map((el) => el.id))
      doc.endStep()
    },
    clipboardSize: computed(() => {
      void state.value.rev
      return clipboard.length
    }),

    changeStyle: (style) => doc.changeStyle(style),
    changeTextStyle: (style) => doc.changeTextStyle(style),
    changeRoundness: (roundness) => doc.changeRoundness(roundness),
    stepFontSize: (direction) => doc.stepFontSize(direction),
    changeArrowhead: (position, arrowhead) => doc.changeArrowhead(position, arrowhead),
    copyStyles: () => {
      const first = doc.getSelectedElements()[0]
      if (first) {
        copiedStyle.value = stylePayloadOf(first)
      }
    },
    pasteStyles: () => {
      if (copiedStyle.value) {
        doc.pasteStyle(copiedStyle.value)
      }
    },
    hasCopiedStyles: computed(() => copiedStyle.value !== null),

    groupSelection: () => doc.groupSelection(),
    ungroupSelection: () => doc.ungroupSelection(),
    selectedGroupIds: computed(() => {
      const { elements, appState } = state.value
      return selectedGroupIds(elements, appState.selectedIds, appState.editingGroupId)
    }),
    editingGroupId: computed(() => appState.value.editingGroupId),
    setEditingGroup: (groupId) => doc.setEditingGroup(groupId),

    alignSelection: (alignment) => doc.alignSelection(alignment),
    distributeSelection: (axis) => doc.distributeSelection(axis),
    flipSelection: (axis) => doc.flipSelection(axis),

    undo: () => doc.undo(),
    redo: () => doc.redo(),
    // Tie to the reactive revision so these flags refresh after every change.
    canUndo: computed(() => {
      void state.value.rev
      return doc.canUndo
    }),
    canRedo: computed(() => {
      void state.value.rev
      return doc.canRedo
    }),

    viewport: computed(() => appState.value.viewport),
    zoomAt: (screenPoint, zoom) => {
      doc.setViewport(zoomViewport(appState.value.viewport, { at: screenPoint, zoom }))
    },
    zoomIn: (screenPoint) => {
      context.zoomAt(screenPoint, appState.value.viewport.zoom * ZOOM_STEP)
    },
    zoomOut: (screenPoint) => {
      context.zoomAt(screenPoint, appState.value.viewport.zoom / ZOOM_STEP)
    },
    resetZoom: () => doc.setViewport({ ...DEFAULT_VIEWPORT }),
    zoomToFitAll: () => fitTo(state.value.elements, 'scale-down'),
    zoomToFitSelection: (fit = 'scale-down') => fitTo(context.selectedElements.value, fit),
    panBy: (dx, dy) => {
      const vp = appState.value.viewport
      doc.setViewport({
        ...vp,
        scrollX: vp.scrollX + screenToSceneLength(dx, vp.zoom),
        scrollY: vp.scrollY + screenToSceneLength(dy, vp.zoom),
      })
    },

    serialize: () => doc.serialize(),
    toJSON: () => JSON.stringify(doc.serialize(), null, 2),
    loadFile: (file) => doc.loadFile(file),
    loadJSON: (text) => doc.loadFile(JSON.parse(text)),
    exportPNG: (filename = 'opendraw') => {
      const url = exportToDataURL(doc.getElements(), appState.value.viewBackgroundColor, {
        theme: appState.value.theme,
        // Composite decoded bitmaps; undecoded ones fall back to the placeholder.
        resolveImage: imageResolver,
      })
      downloadURL(url, `${filename}.png`)
    },
    exportSVG: (filename = 'opendraw') => {
      if (typeof document === 'undefined') {
        return
      }
      const svg = exportToSvg(doc.getElements(), appState.value.viewBackgroundColor, {
        theme: appState.value.theme,
      })
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      downloadURL(url, `${filename}.svg`)
      URL.revokeObjectURL(url)
    },
    exportDataURL: () =>
      exportToDataURL(doc.getElements(), appState.value.viewBackgroundColor, {
        theme: appState.value.theme,
        resolveImage: imageResolver,
      }),

    setEditing: (id) => doc.setAppState({ editingId: id }),
    editingId: computed(() => appState.value.editingId),

    insertImageFiles: (files, at) => {
      const list = Array.from(files).filter(isImageFile)
      if (list.length === 0) {
        return
      }
      const center: Point = at ?? centerOfViewport(appState.value.viewport, viewportSize.value)
      doc.beginStep()
      void (async () => {
        let lastId: string | null = null
        for (const file of list) {
          const prepared = await prepareImageFile(file)
          const element = imageElementFromPrepared(prepared, center)
          doc.addElement(element)
          lastId = element.id
        }
        doc.endStep()
        if (lastId) {
          context.select(lastId)
        }
        context.finishToolUse()
      })().catch((error: unknown) => {
        // A read failure must not strand the open step or crash the editor.
        doc.cancelStep()
        console.error('[opendraw] failed to insert image', error)
      })
    },
    openImagePicker: () => {
      void pickFiles('image/*', true).then((files) => {
        if (files.length > 0) {
          context.insertImageFiles(files)
        }
      })
    },

    saveToFile: (filename = 'opendraw') => {
      downloadText(context.toJSON(), `${filename}.json`, 'application/json')
    },
    openFile: async () => {
      const [file] = await pickFiles('application/json,.json')
      if (!file) {
        return
      }
      try {
        context.loadJSON(await file.text())
      } catch (error) {
        // A malformed file must not break the editor; the scene is untouched.
        console.error('[opendraw] failed to open file', error)
      }
    },
    clearCanvas: () => {
      doc.deleteElements(state.value.elements.map((el) => el.id))
    },

    gridSize: computed(() => appState.value.gridSize),
    setGridSize: (size) => doc.setAppState({ gridSize: size }),

    viewportSize,
    setViewportSize: (size) => {
      const current = viewportSize.value
      if (current.width !== size.width || current.height !== size.height) {
        viewportSize.value = size
      }
    },
  }

  return context
}

/** Injects the enclosing editor's context, creating one when standalone. */
export function useOpenDraw(options: CreateOpenDrawOptions = {}): OpenDrawContext {
  const existing = inject(OPENDRAW_INJECTION_KEY, null)
  if (existing && !options.elements && !options.appState) {
    return existing
  }
  const context = existing ?? createOpenDrawContext(options)
  provide(OPENDRAW_INJECTION_KEY, context)
  return context
}

/** Provides a context for child components (used by the shell). */
export function provideOpenDraw(context: OpenDrawContext): void {
  provide(OPENDRAW_INJECTION_KEY, context)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function touchesText(patch: ElementPatch, element: OpenDrawElement): boolean {
  const keys = Object.keys(patch)
  if (keys.length === 0) {
    return false
  }
  const textKeys = ['text', 'fontSize', 'fontFamily']
  const relevant = keys.some((key) => textKeys.includes(key))
  return relevant && isTextElement(element)
}

function withTextMetrics(patch: ElementPatch, element: OpenDrawElement): ElementPatch {
  if (!isTextElement(element)) {
    return patch
  }
  const next = {
    ...element,
    ...(patch as Partial<typeof element>),
  }
  const layout: TextLayout = layoutText(next.text, next.fontFamily, next.fontSize)
  return { ...patch, width: layout.width, height: layout.height }
}


/** Offset that centers the clipboard content's bounds at the target point. */
function centerOffsetFor(clipboard: readonly OpenDrawElement[], at: Point): { x: number; y: number } {
  const bounds = getCommonBounds(clipboard)
  const cx = (bounds.x1 + bounds.x2) / 2
  const cy = (bounds.y1 + bounds.y2) / 2
  return { x: at.x - cx, y: at.y - cy }
}

/**
 * Scene point at the center of the visible viewport — the default drop
 * position for image insertions that have no pointer position (picker,
 * clipboard).
 */
function centerOfViewport(viewport: Viewport, size: ViewportSize): Point {
  // Before the canvas mounts there is no size; a typical viewport stands in.
  const width = size.width || 800
  const height = size.height || 600
  return screenToScene({ x: width / 2, y: height / 2 }, viewport)
}

export { DEFAULT_APP_STATE, MIN_ZOOM, MAX_ZOOM }
