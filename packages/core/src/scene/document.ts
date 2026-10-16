/**
 * VueDrawDocument — the single source of truth for a drawing.
 *
 * Framework-agnostic: a plain observable store with a copy-on-write element
 * array and immutable app state. The Vue layer subscribes and mirrors state
 * into shallowRefs; nothing DOM or framework specific lives here.
 *
 * Mutation discipline (Excalidraw's funnel pattern):
 * - every write funnels through `replaceElements` / `commitAppState`
 * - a write inside an open step (drag, text edit) is coalesced into that
 *   step's single history entry; outside a step each write is its own entry
 * - no-op patches keep the same element reference and record nothing
 */

import { duplicateElement, isTextElement } from '../elements/factories.js'
import type { ElementPatch } from '../elements/mutate.js'
import { forcePatchElement, patchElement } from '../elements/mutate.js'
import { DEFAULT_ELEMENT_STYLE, DEFAULT_TEXT_STYLE } from '../elements/defaults.js'
import type {
  ElementStyle,
  ReorderAction,
  TextStyle,
  VueDrawAppState,
  VueDrawElement,
  VueDrawFile,
  VueDrawState,
  VueDrawStateListener,
} from '../types.js'
import { layoutText, type TextLayout } from '../geometry/text.js'
import type { Point, Viewport } from '../types.js'
import { type HistorySnapshot, SceneHistory } from './history.js'

export interface VueDrawDocumentOptions {
  elements?: readonly VueDrawElement[]
  appState?: Partial<VueDrawAppState>
}

export const DEFAULT_APP_STATE: VueDrawAppState = {
  activeTool: 'selection',
  theme: 'light',
  viewBackgroundColor: '#ffffff',
  viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
  selectedIds: {},
  editingId: null,
  gridSize: null,
  style: { ...DEFAULT_ELEMENT_STYLE },
  textStyle: { ...DEFAULT_TEXT_STYLE },
}

export class VueDrawDocument {
  private elements: VueDrawElement[]
  private elementsMap: Map<string, VueDrawElement>
  private appState: VueDrawAppState
  private rev = 0
  private listeners = new Set<VueDrawStateListener>()
  private history = new SceneHistory()
  /** Snapshot captured at `beginStep`, while a transaction is open. */
  private openStep: HistorySnapshot | null = null

  constructor(options: VueDrawDocumentOptions = {}) {
    this.elements = [...(options.elements ?? [])]
    this.elementsMap = new Map(this.elements.map((el) => [el.id, el]))
    this.appState = { ...DEFAULT_APP_STATE, ...options.appState }
    if (options.appState?.viewport) {
      this.appState.viewport = { ...options.appState.viewport }
    }
    if (options.appState?.style) {
      this.appState.style = { ...options.appState.style }
    }
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  getState(): VueDrawState {
    return { elements: this.elements, appState: this.appState, rev: this.rev }
  }

  getElements(): readonly VueDrawElement[] {
    return this.elements
  }

  getElement(id: string): VueDrawElement | undefined {
    return this.elementsMap.get(id)
  }

  getAppState(): Readonly<VueDrawAppState> {
    return this.appState
  }

  getSelectedElements(): readonly VueDrawElement[] {
    const { selectedIds } = this.appState
    if (!selectedIds || Object.keys(selectedIds).length === 0) {
      return []
    }
    return this.elements.filter((el) => selectedIds[el.id] === true)
  }

  isIdSelected(id: string): boolean {
    return this.appState.selectedIds[id] === true
  }

  get canUndo(): boolean {
    return this.history.canUndo
  }

  get canRedo(): boolean {
    return this.history.canRedo
  }

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  subscribe(listener: VueDrawStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    this.rev++
    const state = this.getState()
    for (const listener of this.listeners) {
      listener(state)
    }
  }

  // -------------------------------------------------------------------------
  // History — steps group a burst of writes into one undo entry
  // -------------------------------------------------------------------------

  beginStep(): void {
    if (!this.openStep) {
      this.openStep = {
        elements: this.elements,
        appState: this.appState,
      }
    }
  }

  endStep(): void {
    const step = this.openStep
    this.openStep = null
    if (!step) {
      return
    }
    const after: HistorySnapshot = { elements: this.elements, appState: this.appState }
    this.record(step, after)
  }

  /** Aborts an open step, restoring the state it started from. */
  cancelStep(): void {
    const step = this.openStep
    this.openStep = null
    if (!step) {
      return
    }
    this.elements = [...step.elements]
    this.rebuildMap()
    this.appState = step.appState
    this.emit()
  }

  private record(before: HistorySnapshot, after: HistorySnapshot): void {
    if (before.elements === after.elements && before.appState === after.appState) {
      return
    }
    const affectsElements = before.elements !== after.elements
    this.history.push({ before, after }, affectsElements)
  }

  undo(): boolean {
    if (this.openStep) {
      this.openStep = null
    }
    const entry = this.history.popForUndo()
    if (!entry) {
      return false
    }
    this.restore(entry.before)
    return true
  }

  redo(): boolean {
    if (this.openStep) {
      this.openStep = null
    }
    const entry = this.history.popForRedo()
    if (!entry) {
      return false
    }
    this.restore(entry.after)
    return true
  }

  /**
   * Restores a snapshot: elements come back wholesale; from appState only the
   * document-semantic parts return — tool, theme and viewport stay as the
   * user's current intent (you can't undo yourself into another tool).
   */
  private restore(snapshot: HistorySnapshot): void {
    this.elements = [...snapshot.elements]
    this.rebuildMap()
    const restored = snapshot.appState
    this.appState = {
      ...this.appState,
      selectedIds: restored.selectedIds,
      viewBackgroundColor: restored.viewBackgroundColor,
      gridSize: restored.gridSize,
    }
    this.emit()
  }

  private rebuildMap(): void {
    this.elementsMap = new Map(this.elements.map((el) => [el.id, el]))
  }

  // -------------------------------------------------------------------------
  // Single write funnel
  // -------------------------------------------------------------------------

  private replaceElements(next: VueDrawElement[]): void {
    if (next === this.elements) {
      return
    }
    this.elements = next
    this.rebuildMap()
    this.emit()
  }

  private commitAppState(next: VueDrawAppState): void {
    if (next === this.appState) {
      return
    }
    const before: HistorySnapshot | null = this.captureBefore()
    this.appState = next
    this.emit()
    if (!this.openStep && before) {
      this.record(before, { elements: this.elements, appState: next })
    }
  }

  /** The `before` side of a history entry: the open step's snapshot, or the
   *  current state when no step is open (entry pushed immediately). */
  private captureBefore(): HistorySnapshot {
    return this.openStep ?? { elements: this.elements, appState: this.appState }
  }

  /**
   * Runs a mutation that produces a new element array. Inside an open step
   * the before-snapshot is deferred to `endStep`; outside, the entry is
   * recorded immediately.
   */
  private mutate(fn: (elements: readonly VueDrawElement[]) => VueDrawElement[] | null): void {
    const before = this.captureBefore()
    const beforeElements = this.elements
    const next = fn(this.elements)
    if (next === null || next === beforeElements) {
      return // no-op
    }
    this.elements = next
    this.rebuildMap()
    this.emit()
    if (!this.openStep) {
      this.record(before, { elements: next, appState: this.appState })
    }
  }

  // -------------------------------------------------------------------------
  // Element mutations
  // -------------------------------------------------------------------------

  addElement(element: VueDrawElement, options: { select?: boolean } = {}): void {
    this.addElements([element], options)
  }

  addElements(elements: readonly VueDrawElement[], options: { select?: boolean } = {}): void {
    if (elements.length === 0) {
      return
    }
    // One undo entry for the add (+ optional selection), like Excalidraw's
    // create action.
    const topLevel = this.openStep === null
    if (topLevel) {
      this.beginStep()
    }
    this.mutate((current) => [...current, ...elements])
    if (options.select) {
      this.select(elements.map((el) => el.id))
    }
    if (topLevel) {
      this.endStep()
    }
  }

  updateElement(id: string, patch: ElementPatch | ((element: VueDrawElement) => ElementPatch)): void {
    this.updateElements([id], patch)
  }

  updateElements(
    ids: readonly string[],
    patch: ElementPatch | ((element: VueDrawElement) => ElementPatch),
  ): void {
    const idSet = new Set(ids)
    this.mutate((current) => {
      let changed = false
      const next = current.map((element) => {
        if (!idSet.has(element.id)) {
          return element
        }
        const resolved = typeof patch === 'function' ? patch(element) : patch
        const patched = patchElement(element, resolved)
        if (patched !== element) {
          changed = true
        }
        return patched
      })
      return changed ? next : null
    })
  }

  /** Forces an update bypassing no-op detection (live drag geometry). */
  forceUpdateElement(id: string, patch: ElementPatch): void {
    const idSet = new Set([id])
    this.mutate((current) => {
      let changed = false
      const next = current.map((element) => {
        if (!idSet.has(element.id)) {
          return element
        }
        changed = true
        return forcePatchElement(element, patch)
      })
      return changed ? next : null
    })
  }

  deleteElements(ids: readonly string[]): void {
    if (ids.length === 0) {
      return
    }
    const idSet = new Set(ids)
    // Deleting an element and cleaning its selection is ONE undo step —
    // undo must resurrect the element with its selection intact.
    const topLevel = this.openStep === null
    if (topLevel) {
      this.beginStep()
    }
    this.mutate((current) => {
      const next = current.filter((el) => !idSet.has(el.id))
      return next.length === current.length ? null : next
    })
    // Drop dangling selection.
    const selected = this.appState.selectedIds
    const dangling = Object.keys(selected).filter((id) => idSet.has(id))
    if (dangling.length > 0) {
      const nextSelected = { ...selected }
      for (const id of dangling) {
        delete nextSelected[id]
      }
      this.commitAppState({ ...this.appState, selectedIds: nextSelected })
    }
    if (topLevel) {
      this.endStep()
    }
  }

  deleteSelectedElements(): void {
    this.deleteElements(this.getSelectedElements().map((el) => el.id))
  }

  duplicateSelection(offset: Point = { x: 10, y: 10 }): void {
    const selected = this.getSelectedElements()
    if (selected.length === 0) {
      return
    }
    this.beginStep()
    const clones = selected.map((el) =>
      duplicateElement(el, { x: el.x + offset.x, y: el.y + offset.y }),
    )
    this.addElements(clones)
    this.select(clones.map((el) => el.id))
    this.endStep()
  }

  // -------------------------------------------------------------------------
  // Z-order
  // -------------------------------------------------------------------------

  reorderElements(action: ReorderAction, ids: readonly string[]): void {
    if (ids.length === 0) {
      return
    }
    const idSet = new Set(ids)
    this.mutate((current) => {
      switch (action) {
        case 'front': {
          const selected: VueDrawElement[] = []
          const rest: VueDrawElement[] = []
          for (const el of current) {
            ;(idSet.has(el.id) ? selected : rest).push(el)
          }
          return [...rest, ...selected]
        }
        case 'back': {
          const selected: VueDrawElement[] = []
          const rest: VueDrawElement[] = []
          for (const el of current) {
            ;(idSet.has(el.id) ? selected : rest).push(el)
          }
          return [...selected, ...rest]
        }
        case 'forward':
          return shiftByOne(current, idSet, +1)
        case 'backward':
          return shiftByOne(current, idSet, -1)
      }
    })
  }

  reorderSelection(action: ReorderAction): void {
    this.reorderElements(action, this.getSelectedElements().map((el) => el.id))
  }

  // -------------------------------------------------------------------------
  // App state & selection
  // -------------------------------------------------------------------------

  setAppState(patch: Partial<VueDrawAppState>): void {
    this.commitAppState({ ...this.appState, ...patch })
  }

  setViewport(viewport: Viewport): void {
    // Viewport is transient navigation — no history entry.
    this.appState = { ...this.appState, viewport }
    this.emit()
  }

  select(ids: string | readonly string[] | null, mode: 'replace' | 'toggle' = 'replace'): void {
    const current = this.appState.selectedIds
    let next: Record<string, true>
    if (ids === null) {
      next = {}
    } else if (mode === 'toggle') {
      next = { ...current }
      const list = Array.isArray(ids) ? ids : [ids]
      for (const id of list) {
        if (next[id]) {
          delete next[id]
        } else {
          next[id] = true
        }
      }
    } else {
      next = {}
      const list = Array.isArray(ids) ? ids : [ids]
      for (const id of list) {
        next[id] = true
      }
    }
    if (shallowEqualKeys(next, current)) {
      return
    }
    this.commitAppState({ ...this.appState, selectedIds: next })
  }

  selectAll(): void {
    this.select(this.elements.map((el) => el.id))
  }

  /** Style of new elements — set when nothing is selected. */
  setStyle(style: Partial<ElementStyle>): void {
    this.commitAppState({
      ...this.appState,
      style: { ...this.appState.style, ...style },
    })
  }

  setTextStyle(style: Partial<TextStyle>): void {
    this.commitAppState({
      ...this.appState,
      textStyle: { ...this.appState.textStyle, ...style },
    })
  }

  /**
   * Applies a style patch to the selection. When the selection is empty it
   * becomes the default style for future elements instead.
   */
  changeStyle(style: Partial<ElementStyle>): void {
    const selected = this.getSelectedElements()
    if (selected.length === 0) {
      this.setStyle(style)
      return
    }
    const ids = selected.map((el) => el.id)
    this.mutate((current) => {
      const idSet = new Set(ids)
      const next = current.map((el) =>
        idSet.has(el.id) ? patchElement(el, style) : el,
      )
      return next.some((el, i) => el !== current[i]) ? next : null
    })
  }

  changeTextStyle(style: Partial<TextStyle>): void {
    const selected = this.getSelectedElements()
    if (selected.length === 0) {
      this.setTextStyle(style)
      return
    }
    const ids = selected.filter(isTextElement).map((el) => el.id)
    if (ids.length === 0) {
      this.setTextStyle(style)
      return
    }
    this.beginStep()
    this.updateElements(ids, (el): ElementPatch => {
      if (!isTextElement(el)) {
        return {}
      }
      const next = {
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        textAlign: el.textAlign,
        ...style,
      }
      const layout: TextLayout = layoutText(el.text, next.fontFamily, next.fontSize)
      return {
        ...next,
        width: layout.width,
        height: layout.height,
      }
    })
    this.endStep()
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  serialize(): VueDrawFile {
    return {
      type: 'vuedraw',
      version: 1,
      elements: this.elements.map((el) => ({ ...el })),
      appState: { viewBackgroundColor: this.appState.viewBackgroundColor },
    }
  }

  /**
   * Replaces the scene wholesale. Resets history — a loaded scene is a new
   * timeline (Excalidraw behaves the same on scene load).
   */
  loadFile(file: VueDrawFile): void {
    if (file.type !== 'vuedraw') {
      throw new Error('not a vuedraw file')
    }
    this.elements = file.elements.map((el) => ({ ...el }))
    this.rebuildMap()
    this.appState = {
      ...this.appState,
      selectedIds: {},
      editingId: null,
      viewBackgroundColor: file.appState?.viewBackgroundColor ?? this.appState.viewBackgroundColor,
    }
    this.history.clear()
    this.emit()
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shallowEqualKeys(a: Record<string, true>, b: Record<string, true>): boolean {
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) {
    return false
  }
  for (const key of aKeys) {
    if (!b[key]) {
      return false
    }
  }
  return true
}

/**
 * Moves each maximal contiguous run of selected elements one slot in
 * `direction` when the slot is occupied by an unselected element.
 */
function shiftByOne(
  elements: readonly VueDrawElement[],
  idSet: Set<string>,
  direction: 1 | -1,
): VueDrawElement[] | null {
  const arr = [...elements]
  let moved = false
  if (direction === 1) {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (idSet.has(arr[i]!.id) && i + 1 < arr.length && !idSet.has(arr[i + 1]!.id)) {
        ;[arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!]
        moved = true
      }
    }
  } else {
    for (let i = 0; i < arr.length; i++) {
      if (idSet.has(arr[i]!.id) && i - 1 >= 0 && !idSet.has(arr[i - 1]!.id)) {
        ;[arr[i], arr[i - 1]] = [arr[i - 1]!, arr[i]!]
        moved = true
      }
    }
  }
  return moved ? arr : null
}
