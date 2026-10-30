import { computed, inject, provide, shallowRef, type ComputedRef, type InjectionKey, type ShallowRef } from 'vue'

import {
  DEFAULT_APP_STATE,
  MAX_ZOOM,
  MIN_ZOOM,
  type Alignment,
  type Arrowhead,
  type ElementPatch,
  type ElementStyle,
  type FlipAxis,
  type OpenDrawAppState,
  type OpenDrawDocument,
  type OpenDrawElement,
  type OpenDrawFile,
  type OpenDrawState,
  type Point,
  type ReorderAction,
  type Roundness,
  type TextStyle,
  type ThemeName,
  type ToolId,
  type Viewport,
} from '@opendraw/core'
import {
  EditorController,
  createEditor,
  type CreateEditorOptions,
  type ViewportSize,
} from '@opendraw/editor'

/**
 * OpenDrawContext — the Vue face of the framework-free EditorController.
 *
 * Every component in the editor (canvas, toolbar, panels, menus) consumes
 * this one context through provide/inject. It is also the public
 * extension point: embed <OpenDrawCanvas /> and build your own chrome from
 * useOpenDraw().
 *
 * The controller owns all behavior; this layer only mirrors it into Vue:
 * one revision ref bumps on every controller change, and each read below
 * is a computed over the controller's memoized getter.
 */

export interface OpenDrawChangeDetail {
  elements: readonly OpenDrawElement[]
  appState: Readonly<OpenDrawAppState>
}

export type { ViewportSize }

/** The reactive editor context shared by all opendraw components. */
export interface OpenDrawContext {
  /** The framework-free controller this context mirrors. */
  editor: EditorController
  /** The raw document — escape hatch for advanced use. */
  doc: OpenDrawDocument
  /** Bumps on every document or editor-state change. */
  revision: Readonly<ShallowRef<number>>

  /** Reactive mirror of the document state (shallow: element objects are immutable). */
  state: Readonly<ShallowRef<OpenDrawState>>
  elements: ComputedRef<readonly OpenDrawElement[]>
  appState: ComputedRef<Readonly<OpenDrawAppState>>
  selectedElements: ComputedRef<readonly OpenDrawElement[]>

  // tools & theme
  activeTool: ComputedRef<ToolId>
  setActiveTool: (tool: ToolId) => void
  /** Q — a locked tool stays armed after each use (Excalidraw's tool lock). */
  toolLocked: ComputedRef<boolean>
  toggleToolLock: () => void
  /** Reverts to selection after one use unless the tool is locked. */
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
  changeRoundness: (roundness: Roundness | null) => void
  changeArrowhead: (position: 'start' | 'end', arrowhead: Arrowhead | null) => void
  stepFontSize: (direction: 1 | -1) => void
  copyStyles: () => void
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
  zoomToFitAll: () => void
  zoomToFitSelection: (fit?: 'scale-down' | 'contain') => void
  panBy: (dxScreen: number, dyScreen: number) => void
  viewport: ComputedRef<Viewport>
  /** CSS-pixel size of the mounted canvas (zero before it mounts). */
  viewportSize: ComputedRef<ViewportSize>

  // files & export
  serialize: () => OpenDrawFile
  toJSON: () => string
  loadFile: (file: OpenDrawFile) => void
  loadJSON: (text: string) => void
  exportPNG: (filename?: string) => void
  exportSVG: (filename?: string) => void
  exportDataURL: () => string
  saveToFile: (filename?: string) => void
  openFile: () => Promise<void>
  clearCanvas: () => void

  // editing (text)
  setEditing: (id: string | null) => void
  editingId: ComputedRef<string | null>

  // images
  insertImageFiles: (files: readonly File[] | FileList, at?: Point) => void
  openImagePicker: () => void

  // grid
  gridSize: ComputedRef<number | null>
  setGridSize: (size: number | null) => void
}

export type CreateOpenDrawOptions = CreateEditorOptions

export const OPENDRAW_INJECTION_KEY: InjectionKey<OpenDrawContext> = Symbol('opendraw')

/** Wraps an existing controller (or a new one) in Vue reactivity. */
export function createOpenDrawContext(
  options: CreateOpenDrawOptions | EditorController = {},
): OpenDrawContext {
  const editor = options instanceof EditorController ? options : createEditor(options)
  const revision = shallowRef(0)
  const state = shallowRef(editor.state)
  editor.subscribe(() => {
    state.value = editor.state
    revision.value++
  })
  /** A computed over a controller getter, invalidated by any change. */
  const read = <T>(get: () => T): ComputedRef<T> =>
    computed(() => {
      void revision.value
      return get()
    })

  return {
    editor,
    doc: editor.doc,
    revision,
    state,
    elements: read(() => editor.elements),
    appState: read(() => editor.appState),
    selectedElements: read(() => editor.selectedElements),

    activeTool: read(() => editor.activeTool),
    setActiveTool: (tool) => editor.setActiveTool(tool),
    toolLocked: read(() => editor.toolLocked),
    toggleToolLock: () => editor.toggleToolLock(),
    finishToolUse: () => editor.finishToolUse(),
    theme: read(() => editor.theme),
    setTheme: (theme) => editor.setTheme(theme),
    toggleTheme: () => editor.toggleTheme(),

    select: (ids, mode) => editor.select(ids, mode),
    selectGrouped: (ids, mode) => editor.selectGrouped(ids, mode),
    selectAll: () => editor.selectAll(),
    isIdSelected: (id) => editor.isIdSelected(id),

    updateElement: (id, patch) => editor.updateElement(id, patch),
    deleteSelection: () => editor.deleteSelection(),
    duplicateSelection: () => editor.duplicateSelection(),
    reorderSelection: (action) => editor.reorderSelection(action),
    toggleSelectionLock: () => editor.toggleSelectionLock(),
    copySelection: () => editor.copySelection(),
    cutSelection: () => editor.cutSelection(),
    paste: (at) => editor.paste(at),
    clipboardSize: read(() => editor.clipboardSize),

    changeStyle: (style) => editor.changeStyle(style),
    changeTextStyle: (style) => editor.changeTextStyle(style),
    changeRoundness: (roundness) => editor.changeRoundness(roundness),
    changeArrowhead: (position, arrowhead) => editor.changeArrowhead(position, arrowhead),
    stepFontSize: (direction) => editor.stepFontSize(direction),
    copyStyles: () => editor.copyStyles(),
    pasteStyles: () => editor.pasteStyles(),
    hasCopiedStyles: read(() => editor.hasCopiedStyles),

    groupSelection: () => editor.groupSelection(),
    ungroupSelection: () => editor.ungroupSelection(),
    selectedGroupIds: read(() => editor.selectedGroupIds),
    editingGroupId: read(() => editor.editingGroupId),
    setEditingGroup: (groupId) => editor.setEditingGroup(groupId),

    alignSelection: (alignment) => editor.alignSelection(alignment),
    distributeSelection: (axis) => editor.distributeSelection(axis),
    flipSelection: (axis) => editor.flipSelection(axis),

    undo: () => editor.undo(),
    redo: () => editor.redo(),
    canUndo: read(() => editor.canUndo),
    canRedo: read(() => editor.canRedo),

    zoomAt: (point, zoom) => editor.zoomAt(point, zoom),
    zoomIn: (point) => editor.zoomIn(point),
    zoomOut: (point) => editor.zoomOut(point),
    resetZoom: () => editor.resetZoom(),
    zoomToFitAll: () => editor.zoomToFitAll(),
    zoomToFitSelection: (fit) => editor.zoomToFitSelection(fit),
    panBy: (dx, dy) => editor.panBy(dx, dy),
    viewport: read(() => editor.viewport),
    viewportSize: read(() => editor.viewportSize),

    serialize: () => editor.serialize(),
    toJSON: () => editor.toJSON(),
    loadFile: (file) => editor.loadFile(file),
    loadJSON: (text) => editor.loadJSON(text),
    exportPNG: (filename) => editor.exportPNG(filename),
    exportSVG: (filename) => editor.exportSVG(filename),
    exportDataURL: () => editor.exportDataURL(),
    saveToFile: (filename) => editor.saveToFile(filename),
    openFile: () => editor.openFile(),
    clearCanvas: () => editor.clearCanvas(),

    setEditing: (id) => editor.setEditing(id),
    editingId: read(() => editor.editingId),

    insertImageFiles: (files, at) => editor.insertImageFiles(files, at),
    openImagePicker: () => editor.openImagePicker(),

    gridSize: read(() => editor.gridSize),
    setGridSize: (size) => editor.setGridSize(size),
  }
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

export { DEFAULT_APP_STATE, MIN_ZOOM, MAX_ZOOM }
