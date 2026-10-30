import {
  DEFAULT_VIEWPORT,
  OpenDrawDocument,
  duplicateElements,
  exportToDataURL,
  exportToSvg,
  fitViewportToBounds,
  getCommonBounds,
  isBoundText,
  isTextElement,
  layoutText,
  screenToScene,
  screenToSceneLength,
  selectedGroupIds,
  stylePayloadOf,
  withBoundTexts,
  zoomViewport,
  type Alignment,
  type Arrowhead,
  type ArrowType,
  type ElementPatch,
  type ElementStyle,
  type FlipAxis,
  type OpenDrawAppState,
  type OpenDrawElement,
  type OpenDrawFile,
  type OpenDrawState,
  type Point,
  type ReorderAction,
  type Roundness,
  type StylePayload,
  type TextStyle,
  type ThemeName,
  type ToolId,
  type Viewport,
} from '@opendrawjs/core'

import { downloadText, downloadURL, pickFiles } from './services/file.service.js'
import {
  imageElementFromPrepared,
  imageResolver,
  isImageFile,
  prepareImageFile,
} from './services/image.service.js'

/**
 * EditorController — the framework-free editor.
 *
 * Wraps one OpenDrawDocument with the editor-only state the document does
 * not own (clipboard, copied style, tool lock, canvas size) and exposes the
 * full command surface every UI calls. Reads are plain getters, memoized
 * per change; `subscribe` announces every change of either the document or
 * the editor state, which is all a framework adapter needs to mirror it
 * into its own reactivity (Vue refs, Svelte stores, React's
 * useSyncExternalStore…).
 */

export interface ViewportSize {
  width: number
  height: number
}

export interface CreateEditorOptions {
  elements?: readonly OpenDrawElement[]
  appState?: Partial<OpenDrawAppState>
}

export type EditorListener = (editor: EditorController) => void

/** Zoom-button step (multiplicative). */
const ZOOM_STEP = 1.25

/** The theme defaults — the canvas background swaps with the theme. */
export const THEME_BACKGROUNDS = { light: '#ffffff', dark: '#121212' } as const satisfies Record<ThemeName, string>

export class EditorController {
  /** The raw document — escape hatch for advanced use. */
  readonly doc: OpenDrawDocument

  private snapshot: OpenDrawState
  private listeners = new Set<EditorListener>()
  /** Bumped on every change; memoized getters key on it. */
  private version = 0
  private memo = new Map<string, { version: number; value: unknown }>()

  /** In-app clipboard: plain element copies; ids are regenerated on paste. */
  private clipboard: OpenDrawElement[] = []
  /** Style remembered by copyStyles — editor intent, never document state. */
  private copiedStyle: StylePayload | null = null
  /** Tool lock is editor intent, never document state (not persisted). */
  private locked = false
  private size: ViewportSize = { width: 0, height: 0 }

  constructor(options: CreateEditorOptions = {}) {
    this.doc = new OpenDrawDocument({ elements: options.elements, appState: options.appState })
    this.snapshot = this.doc.getState()
    this.doc.subscribe((state) => {
      this.snapshot = state
      this.changed()
    })
  }

  // -------------------------------------------------------------------------
  // Change notification
  // -------------------------------------------------------------------------

  /** Calls `listener` after every document or editor-state change. */
  subscribe(listener: EditorListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private changed(): void {
    this.version++
    for (const listener of this.listeners) {
      listener(this)
    }
  }

  private memoized<T>(key: string, compute: () => T): T {
    const hit = this.memo.get(key)
    if (hit && hit.version === this.version) {
      return hit.value as T
    }
    const value = compute()
    this.memo.set(key, { version: this.version, value })
    return value
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  get state(): OpenDrawState {
    return this.snapshot
  }

  get elements(): readonly OpenDrawElement[] {
    return this.snapshot.elements
  }

  get appState(): Readonly<OpenDrawAppState> {
    return this.snapshot.appState
  }

  get selectedElements(): readonly OpenDrawElement[] {
    return this.memoized('selectedElements', () => {
      const { elements, appState } = this.snapshot
      const selected = appState.selectedIds
      return Object.keys(selected).length === 0 ? [] : elements.filter((el) => selected[el.id] === true)
    })
  }

  /** Groups currently selected as a unit (derived from the selection). */
  get selectedGroupIds(): readonly string[] {
    return this.memoized('selectedGroupIds', () => {
      const { elements, appState } = this.snapshot
      return selectedGroupIds(elements, appState.selectedIds, appState.editingGroupId)
    })
  }

  get activeTool(): ToolId {
    return this.snapshot.appState.activeTool
  }

  get theme(): ThemeName {
    return this.snapshot.appState.theme
  }

  get viewport(): Viewport {
    return this.snapshot.appState.viewport
  }

  get gridSize(): number | null {
    return this.snapshot.appState.gridSize
  }

  get viewBackgroundColor(): string {
    return this.snapshot.appState.viewBackgroundColor
  }

  get editingId(): string | null {
    return this.snapshot.appState.editingId
  }

  get editingGroupId(): string | null {
    return this.snapshot.appState.editingGroupId
  }

  get canUndo(): boolean {
    return this.doc.canUndo
  }

  get canRedo(): boolean {
    return this.doc.canRedo
  }

  /** Q — a locked tool stays armed after each use (Excalidraw's tool lock). */
  get toolLocked(): boolean {
    return this.locked
  }

  get clipboardSize(): number {
    return this.clipboard.length
  }

  get hasCopiedStyles(): boolean {
    return this.copiedStyle !== null
  }

  /** CSS-pixel size of the mounted canvas (zero before it mounts). */
  get viewportSize(): ViewportSize {
    return this.size
  }

  isIdSelected(id: string): boolean {
    return this.doc.isIdSelected(id)
  }

  // -------------------------------------------------------------------------
  // Tools & theme
  // -------------------------------------------------------------------------

  /**
   * Excalidraw parity (App.setActiveTool): arming any tool but selection
   * drops the selection, so the properties panel shows the new tool's
   * defaults rather than the last shape's.
   */
  setActiveTool(tool: ToolId): void {
    this.doc.setAppState(tool === 'selection' ? { activeTool: tool } : { activeTool: tool, selectedIds: {}, editingGroupId: null })
  }

  toggleToolLock(): void {
    this.locked = !this.locked
    this.changed()
  }

  /**
   * Called when a tool finishes one use: reverts to selection unless the
   * tool is locked. Freedraw never calls it — the pen stays armed.
   */
  finishToolUse(): void {
    if (!this.locked) {
      this.doc.setAppState({ activeTool: 'selection' })
    }
  }

  /**
   * Excalidraw parity: switching themes swaps the DEFAULT canvas background
   * with it (light keeps #ffffff, dark gets #121212). The dark theme
   * dark-filters element strokes, so a dark theme left over the white
   * default renders near-white strokes on a white canvas — invisible. A
   * background the user customized is kept untouched.
   */
  setTheme(theme: ThemeName): void {
    const current = this.appState.viewBackgroundColor.toLowerCase()
    const isThemeDefault = current === THEME_BACKGROUNDS.light || current === THEME_BACKGROUNDS.dark
    this.doc.setAppState(
      isThemeDefault
        ? { theme, viewBackgroundColor: THEME_BACKGROUNDS[theme] }
        : { theme },
    )
  }

  toggleTheme(): void {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
  }

  setGridSize(size: number | null): void {
    this.doc.setAppState({ gridSize: size })
  }

  /** The canvas background — user data, never dark-filtered (main menu picks). */
  setViewBackgroundColor(color: string): void {
    this.doc.setAppState({ viewBackgroundColor: color })
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  select(ids: string | readonly string[] | null, mode?: 'replace' | 'toggle'): void {
    this.doc.select(ids, mode)
  }

  /** Group-aware select: each id pulls in its whole (visible) group. */
  selectGrouped(ids: readonly string[], mode?: 'replace' | 'toggle'): void {
    this.doc.selectGrouped(ids, mode)
  }

  selectAll(): void {
    this.doc.selectAll()
  }

  setEditingGroup(groupId: string | null): void {
    this.doc.setEditingGroup(groupId)
  }

  setEditing(id: string | null): void {
    this.doc.setAppState({ editingId: id })
  }

  // -------------------------------------------------------------------------
  // Elements
  // -------------------------------------------------------------------------

  /** Patches one element; text geometry follows content/style automatically. */
  updateElement(id: string, patch: ElementPatch | ((el: OpenDrawElement) => ElementPatch)): void {
    this.doc.updateElement(id, (el) => {
      const resolved = typeof patch === 'function' ? patch(el) : patch
      return isTextElement(el) && touchesText(resolved) ? withTextMetrics(resolved, el) : resolved
    })
  }

  deleteSelection(): void {
    this.doc.deleteSelectedElements()
  }

  duplicateSelection(): void {
    this.doc.duplicateSelection()
  }

  reorderSelection(action: ReorderAction): void {
    this.doc.reorderSelection(action)
  }

  toggleSelectionLock(): void {
    const selected = this.doc.getSelectedElements()
    if (selected.length === 0) {
      return
    }
    const lock = !selected.every((el) => el.locked)
    this.doc.updateElements(
      selected.map((el) => el.id),
      { locked: lock },
    )
  }

  /** Deletes every element (one undo step). */
  clearCanvas(): void {
    this.doc.deleteElements(this.elements.map((el) => el.id))
  }

  // -------------------------------------------------------------------------
  // Clipboard — labels travel with their shapes
  // -------------------------------------------------------------------------

  private selectionWithLabels(): OpenDrawElement[] {
    return withBoundTexts(this.doc.getElements(), this.doc.getSelectedElements().map((el) => el.id))
  }

  copySelection(): void {
    this.clipboard = this.selectionWithLabels().map((el) => ({ ...el }))
    this.changed()
  }

  cutSelection(): void {
    const copied = this.selectionWithLabels()
    if (copied.length === 0) {
      return
    }
    this.clipboard = copied.map((el) => ({ ...el }))
    this.doc.deleteSelectedElements()
  }

  /**
   * Pastes the clipboard (centered on `at`, else offset a little). Pasted
   * groups are new groups, and the paste lands selected (Excalidraw's
   * actionPaste) — outside any group being edited.
   */
  paste(at?: Point): void {
    if (this.clipboard.length === 0) {
      return
    }
    const offset = at ? centerOffsetFor(this.clipboard, at) : { x: 10, y: 10 }
    const copies = duplicateElements(this.clipboard, { offset })
    this.doc.beginStep()
    this.doc.setEditingGroup(null)
    this.doc.addElements(copies)
    this.doc.select(copies.filter((el) => !isBoundText(el)).map((el) => el.id))
    this.doc.endStep()
  }

  // -------------------------------------------------------------------------
  // Style
  // -------------------------------------------------------------------------

  changeStyle(style: Partial<ElementStyle>): void {
    this.doc.changeStyle(style)
  }

  changeTextStyle(style: Partial<TextStyle>): void {
    this.doc.changeTextStyle(style)
  }

  /** Corner treatment for the selected rectangles/diamonds, else new-shape default. */
  changeRoundness(roundness: Roundness | null): void {
    this.doc.changeRoundness(roundness)
  }

  /** Curved or straight arrows — the selected ones, else the next arrow. */
  /** Sharp, round or elbow — the selected arrows, or the next arrow's type. */
  changeArrowType(type: ArrowType): void {
    this.doc.changeArrowType(type)
  }

  /** The type the next arrow is drawn with, leaving the selection alone. */
  setArrowTypeDefault(type: ArrowType): void {
    this.doc.setAppState({ arrowType: type })
  }

  /** Sets one end's head on the selected arrows (or the next arrow's). */
  changeArrowhead(position: 'start' | 'end', arrowhead: Arrowhead | null): void {
    this.doc.changeArrowhead(position, arrowhead)
  }

  /** Mod+Shift+> / Mod+Shift+< — steps selected text 10% bigger/smaller. */
  stepFontSize(direction: 1 | -1): void {
    this.doc.stepFontSize(direction)
  }

  /** Mod+Alt+C — remembers the first selected element's style. */
  copyStyles(): void {
    const first = this.doc.getSelectedElements()[0]
    if (first) {
      this.copiedStyle = stylePayloadOf(first)
      this.changed()
    }
  }

  /** Mod+Alt+V — applies the remembered style to the selection. */
  pasteStyles(): void {
    if (this.copiedStyle) {
      this.doc.pasteStyle(this.copiedStyle)
    }
  }

  // -------------------------------------------------------------------------
  // Groups & arrange
  // -------------------------------------------------------------------------

  groupSelection(): void {
    this.doc.groupSelection()
  }

  ungroupSelection(): void {
    this.doc.ungroupSelection()
  }

  alignSelection(alignment: Alignment): void {
    this.doc.alignSelection(alignment)
  }

  distributeSelection(axis: 'x' | 'y'): void {
    this.doc.distributeSelection(axis)
  }

  flipSelection(axis: FlipAxis): void {
    this.doc.flipSelection(axis)
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  undo(): boolean {
    return this.doc.undo()
  }

  redo(): boolean {
    return this.doc.redo()
  }

  // -------------------------------------------------------------------------
  // Viewport
  // -------------------------------------------------------------------------

  setViewportSize(size: ViewportSize): void {
    if (this.size.width !== size.width || this.size.height !== size.height) {
      this.size = size
      this.changed()
    }
  }

  zoomAt(screenPoint: Point, zoom: number): void {
    this.doc.setViewport(zoomViewport(this.viewport, { at: screenPoint, zoom }))
  }

  zoomIn(screenPoint: Point): void {
    this.zoomAt(screenPoint, this.viewport.zoom * ZOOM_STEP)
  }

  zoomOut(screenPoint: Point): void {
    this.zoomAt(screenPoint, this.viewport.zoom / ZOOM_STEP)
  }

  resetZoom(): void {
    this.doc.setViewport({ ...DEFAULT_VIEWPORT })
  }

  /** Shift+1 — fits every element, never zooming past 100%. */
  zoomToFitAll(): void {
    this.fitTo(this.elements, 'scale-down')
  }

  /** Fits the selection: `scale-down` (Shift+2) caps at 100%, `contain` (Shift+3) fills. */
  zoomToFitSelection(fit: 'scale-down' | 'contain' = 'scale-down'): void {
    this.fitTo(this.selectedElements, fit)
  }

  private fitTo(elements: readonly OpenDrawElement[], fit: 'scale-down' | 'contain'): void {
    if (elements.length > 0) {
      this.doc.setViewport(fitViewportToBounds(this.viewport, getCommonBounds(elements), { size: this.size, fit }))
    }
  }

  panBy(dxScreen: number, dyScreen: number): void {
    const vp = this.viewport
    this.doc.setViewport({
      ...vp,
      scrollX: vp.scrollX + screenToSceneLength(dxScreen, vp.zoom),
      scrollY: vp.scrollY + screenToSceneLength(dyScreen, vp.zoom),
    })
  }

  // -------------------------------------------------------------------------
  // Files & export
  // -------------------------------------------------------------------------

  serialize(): OpenDrawFile {
    return this.doc.serialize()
  }

  toJSON(): string {
    return JSON.stringify(this.doc.serialize(), null, 2)
  }

  loadFile(file: OpenDrawFile): void {
    this.doc.loadFile(file)
  }

  loadJSON(text: string): void {
    this.doc.loadFile(JSON.parse(text) as OpenDrawFile)
  }

  exportDataURL(): string {
    return exportToDataURL(this.doc.getElements(), this.appState.viewBackgroundColor, {
      theme: this.theme,
      // Composite decoded bitmaps; undecoded ones fall back to the placeholder.
      resolveImage: imageResolver,
    })
  }

  exportPNG(filename = 'opendraw'): void {
    downloadURL(this.exportDataURL(), `${filename}.png`)
  }

  exportSVG(filename = 'opendraw'): void {
    const svg = exportToSvg(this.doc.getElements(), this.appState.viewBackgroundColor, { theme: this.theme })
    downloadText(svg, `${filename}.svg`, 'image/svg+xml')
  }

  /** Mod+S — downloads the scene as a .json file. */
  saveToFile(filename = 'opendraw'): void {
    downloadText(this.toJSON(), `${filename}.json`, 'application/json')
  }

  /** Mod+O — opens a .json scene file, replacing the current scene. */
  async openFile(): Promise<void> {
    const [file] = await pickFiles('application/json,.json')
    if (!file) {
      return
    }
    try {
      this.loadJSON(await file.text())
    } catch (error) {
      // A malformed file must not break the editor; the scene is untouched.
      console.error('[opendraw] failed to open file', error)
    }
  }

  // -------------------------------------------------------------------------
  // Images
  // -------------------------------------------------------------------------

  /** Inserts image files at a scene point (viewport center by default) in one step. */
  insertImageFiles(files: readonly File[] | FileList, at?: Point): void {
    const list = Array.from(files).filter(isImageFile)
    if (list.length === 0) {
      return
    }
    const center = at ?? centerOfViewport(this.viewport, this.size)
    this.doc.beginStep()
    void (async () => {
      let lastId: string | null = null
      for (const file of list) {
        const element = imageElementFromPrepared(await prepareImageFile(file), center)
        this.doc.addElement(element)
        lastId = element.id
      }
      this.doc.endStep()
      if (lastId) {
        this.select(lastId)
      }
      this.finishToolUse()
    })().catch((error: unknown) => {
      // A read failure must not strand the open step or crash the editor.
      this.doc.cancelStep()
      console.error('[opendraw] failed to insert image', error)
    })
  }

  /** Opens the file picker (the image tool's only entry gesture). */
  openImagePicker(): void {
    void pickFiles('image/*', true).then((files) => {
      if (files.length > 0) {
        this.insertImageFiles(files)
      }
    })
  }
}

export function createEditor(options: CreateEditorOptions = {}): EditorController {
  return new EditorController(options)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function touchesText(patch: ElementPatch): boolean {
  return Object.keys(patch).some((key) => key === 'text' || key === 'fontSize' || key === 'fontFamily')
}

function withTextMetrics(patch: ElementPatch, element: OpenDrawElement): ElementPatch {
  if (!isTextElement(element)) {
    return patch
  }
  const next = { ...element, ...(patch as Partial<typeof element>) }
  const layout = layoutText(next.text, next.fontFamily, next.fontSize)
  return { ...patch, width: layout.width, height: layout.height }
}

/** Offset that centers the clipboard content's bounds at the target point. */
function centerOffsetFor(clipboard: readonly OpenDrawElement[], at: Point): Point {
  const bounds = getCommonBounds(clipboard)
  return { x: at.x - (bounds.x1 + bounds.x2) / 2, y: at.y - (bounds.y1 + bounds.y2) / 2 }
}

/**
 * Scene point at the center of the visible canvas — where insertions with
 * no pointer position (picker, clipboard) land.
 */
function centerOfViewport(viewport: Viewport, size: ViewportSize): Point {
  // Before the canvas mounts there is no size; a typical viewport stands in.
  return screenToScene({ x: (size.width || 800) / 2, y: (size.height || 600) / 2 }, viewport)
}
