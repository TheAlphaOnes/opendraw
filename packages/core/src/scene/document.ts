/**
 * OpenDrawDocument — the single source of truth for a drawing.
 *
 * Framework-agnostic: a plain observable store with a copy-on-write element
 * array and immutable app state. The Vue layer subscribes and mirrors state
 * into shallowRefs; nothing DOM or framework specific lives here.
 *
 * Mutation discipline (Excalidraw's funnel pattern):
 * - every write funnels through `replaceElements` / `commitAppState`
 * - a write inside an open step (drag, text edit) is coalesced into that
 *   step's single history entry; outside a step each element write is its
 *   own entry — appState-only writes record nothing (parity law)
 * - no-op patches keep the same element reference and record nothing
 */

import { isTextElement } from '../elements/factories.js'
import { duplicateElements } from '../elements/duplicate.js'
import { isBoundText, syncBoundTexts, withBoundTexts } from '../elements/boundText.js'
import { reorderElements as reorderElementsInScene } from '../elements/zindex.js'
import { frameMembershipPatches, withFrameChildren } from '../elements/frames.js'
import { bindingFollowPatches, orphanBindingPatches } from '../elements/binding.js'
import {
  type Alignment,
  alignUnits,
  distributeUnits,
  type ElementPatchEntry,
  type FlipAxis,
  flipElements,
  selectionUnits,
} from '../elements/arrange.js'
import {
  elementsInGroup,
  expandIdsToGroups,
  groupElements,
  ungroupElements,
} from '../elements/groups.js'
import type { ElementPatch } from '../elements/mutate.js'
import { forcePatchElement, patchElement } from '../elements/mutate.js'
import { DEFAULT_ELEMENT_STYLE, DEFAULT_TEXT_STYLE } from '../elements/defaults.js'
import type {
  Arrowhead,
  ElementStyle,
  ReorderAction,
  StylePayload,
  Roundness,
  TextStyle,
  OpenDrawAppState,
  OpenDrawElement,
  OpenDrawFile,
  OpenDrawLinearElement,
  OpenDrawState,
  OpenDrawStateListener,
} from '../types.js'
import { layoutText, type TextLayout } from '../geometry/text.js'
import { normalizeElement, parseFile } from '../export/serialize.js'
import type { Point, Viewport } from '../types.js'
import { type HistorySnapshot, SceneHistory } from './history.js'

export interface OpenDrawDocumentOptions {
  elements?: readonly OpenDrawElement[]
  appState?: Partial<OpenDrawAppState>
}

/** Excalidraw's FONT_SIZE_RELATIVE_INCREASE_STEP. */
const FONT_SIZE_STEP = 0.1
/** Smallest font a keyboard step can reach (matches file coercion). */
const MIN_FONT_SIZE = 8

export const DEFAULT_APP_STATE: OpenDrawAppState = {
  activeTool: 'selection',
  theme: 'light',
  viewBackgroundColor: '#ffffff',
  viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
  selectedIds: {},
  editingId: null,
  editingGroupId: null,
  gridSize: null,
  style: { ...DEFAULT_ELEMENT_STYLE },
  textStyle: { ...DEFAULT_TEXT_STYLE },
  shapeRoundness: 'round',
  arrowheads: { start: null, end: 'arrow' },
  // Excalidraw's defaults: rounded shapes and lines, round arrows.
  arrowType: 'round',
}

export class OpenDrawDocument {
  private elements: OpenDrawElement[]
  private elementsMap: Map<string, OpenDrawElement>
  private appState: OpenDrawAppState
  private rev = 0
  private listeners = new Set<OpenDrawStateListener>()
  private history = new SceneHistory()
  /** Snapshot captured at `beginStep`, while a transaction is open. */
  private openStep: HistorySnapshot | null = null

  constructor(options: OpenDrawDocumentOptions = {}) {
    // Hand-built elements may predate newer fields (groups, arrowheads),
    // and their labels may not be laid out yet.
    this.elements = syncBoundTexts([], (options.elements ?? []).map(normalizeElement), patchElement)
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

  getState(): OpenDrawState {
    return { elements: this.elements, appState: this.appState, rev: this.rev }
  }

  getElements(): readonly OpenDrawElement[] {
    return this.elements
  }

  getElement(id: string): OpenDrawElement | undefined {
    return this.elementsMap.get(id)
  }

  getAppState(): Readonly<OpenDrawAppState> {
    return this.appState
  }

  getSelectedElements(): readonly OpenDrawElement[] {
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

  subscribe(listener: OpenDrawStateListener): () => void {
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

  /**
   * Records a completed change. Parity law: undo entries are scene changes
   * only — a write that touched nothing but appState (tool switch,
   * selection, style) is user intent, never history.
   */
  private record(before: HistorySnapshot, after: HistorySnapshot): void {
    if (before.elements === after.elements) {
      return
    }
    this.history.push({ before, after })
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
      editingGroupId: restored.editingGroupId,
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

  private replaceElements(next: OpenDrawElement[]): void {
    if (next === this.elements) {
      return
    }
    this.elements = next
    this.rebuildMap()
    this.emit()
  }

  /**
   * App state is intent, not history: tool, selection, style and theme
   * changes never create undo entries (parity law in .agents/rules).
   */
  private commitAppState(next: OpenDrawAppState): void {
    if (next === this.appState) {
      return
    }
    this.appState = next
    this.emit()
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
  private mutate(fn: (elements: readonly OpenDrawElement[]) => OpenDrawElement[] | null): void {
    const before = this.captureBefore()
    const beforeElements = this.elements
    const produced = fn(this.elements)
    if (produced === null || produced === beforeElements) {
      return // no-op
    }
    // Invariant: bound text always fits and follows its container.
    const next = syncBoundTexts(beforeElements, produced, patchElement)
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

  addElement(element: OpenDrawElement, options: { select?: boolean; after?: string } = {}): void {
    this.addElements([element], options)
  }

  addElements(
    elements: readonly OpenDrawElement[],
    options: { select?: boolean; after?: string } = {},
  ): void {
    if (elements.length === 0) {
      return
    }
    // One undo entry for the add (+ optional selection), like Excalidraw's
    // create action.
    const topLevel = this.openStep === null
    if (topLevel) {
      this.beginStep()
    }
    this.mutate((current) => {
      // `after` slots the new elements right above an anchor (bound text
      // directly over its container); otherwise they land on top.
      const anchor = options.after ? current.findIndex((el) => el.id === options.after) : -1
      return anchor === -1
        ? [...current, ...elements]
        : [...current.slice(0, anchor + 1), ...elements, ...current.slice(anchor + 1)]
    })
    if (options.select) {
      this.select(elements.map((el) => el.id))
    }
    if (topLevel) {
      this.endStep()
    }
  }

  updateElement<T extends OpenDrawElement>(
    id: string,
    patch: ElementPatch<T> | ((element: T) => ElementPatch<T>),
  ): void {
    this.updateElements<T>([id], patch)
  }

  updateElements<T extends OpenDrawElement>(
    ids: readonly string[],
    patch: ElementPatch<T> | ((element: T) => ElementPatch<T>),
  ): void {
    const idSet = new Set(ids)
    this.mutate((current) => {
      let changed = false
      const next = current.map((element) => {
        if (!idSet.has(element.id)) {
          return element
        }
        // Ids are trusted to name T-shaped elements — the runtime contract
        // the pre-generic signature already relied on.
        const target = element as T
        const resolved = typeof patch === 'function' ? patch(target) : patch
        const patched = patchElement(target, resolved)
        if (patched !== element) {
          changed = true
        }
        return patched
      })
      return changed ? next : null
    })
  }

  /** Forces an update bypassing no-op detection (live drag geometry). */
  forceUpdateElement<T extends OpenDrawElement>(id: string, patch: ElementPatch<T>): void {
    const idSet = new Set([id])
    this.mutate((current) => {
      let changed = false
      const next = current.map((element) => {
        if (!idSet.has(element.id)) {
          return element
        }
        changed = true
        return forcePatchElement(element as T, patch)
      })
      return changed ? next : null
    })
  }

  deleteElements(ids: readonly string[]): void {
    if (ids.length === 0) {
      return
    }
    // A container takes the text bound inside it along, and a frame its
    // children (Excalidraw: a deleted frame takes its children with it).
    const withChildren = withFrameChildren(this.elements, ids).map((el) => el.id)
    const idSet = new Set(withBoundTexts(this.elements, withChildren).map((el) => el.id))
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
    // Lines and arrows bound to deleted shapes lose those bindings — inside
    // the same undo step, so undo resurrects shape and binding together.
    for (const [id, patch] of orphanBindingPatches(idSet, this.elements)) {
      this.updateElement<OpenDrawLinearElement>(id, patch)
    }
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
    // A group with fewer than two members left is no group to edit.
    const editing = this.appState.editingGroupId
    if (editing && elementsInGroup(this.elements, editing).length < 2) {
      this.commitAppState({ ...this.appState, editingGroupId: null })
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
    // Labels ride along with their shapes, children with their frames.
    const withChildren = withFrameChildren(this.elements, selected.map((el) => el.id)).map((el) => el.id)
    const sources = withBoundTexts(this.elements, withChildren)
    const clones = duplicateElements(sources, { offset, editingGroupId: this.appState.editingGroupId })
    this.addElements(clones)
    // Only the copies of what was selected end up selected.
    const selectedIds = new Set(selected.map((el) => el.id))
    this.select(clones.filter((_, i) => selectedIds.has(sources[i]!.id)).map((el) => el.id))
    this.endStep()
  }

  // -------------------------------------------------------------------------
  // Arrange
  // -------------------------------------------------------------------------

  /** Aligns the selection's units (groups move as blocks) to its box. */
  alignSelection(alignment: Alignment): void {
    this.applyArrange(alignUnits(this.selectionUnits(), alignment))
  }

  /** Equalizes the gaps between the selection's units along an axis. */
  distributeSelection(axis: 'x' | 'y'): void {
    this.applyArrange(distributeUnits(this.selectionUnits(), axis))
  }

  /** Mirrors the selection across its center (Shift+H / Shift+V). */
  flipSelection(axis: FlipAxis): void {
    // A flipped frame mirrors its contents with it.
    const ids = this.getSelectedElements().map((el) => el.id)
    const selected = withFrameChildren(this.elements, ids).filter((el) => !el.locked)
    this.applyArrange(flipElements(selected, axis))
  }

  /**
   * Puts elements into a frame (or, with null, out of any) — labels follow
   * their shapes, frames never nest. Records nothing on its own outside a
   * step; callers fold it into the gesture that changed membership.
   */
  setFrameMembership(ids: readonly string[], frameId: string | null): void {
    const members = this.elements.filter((el) => ids.includes(el.id))
    const patches = frameMembershipPatches(this.elements, members, frameId)
    if (patches.size === 0) {
      return
    }
    this.mutate((current) =>
      current.map((el) => (patches.has(el.id) ? patchElement(el, { frameId: patches.get(el.id)! }) : el)),
    )
  }

  private selectionUnits(): OpenDrawElement[][] {
    const selected = this.getSelectedElements().filter((el) => !el.locked)
    return selectionUnits(this.elements, selected, this.appState.editingGroupId)
  }

  /**
   * Applies geometry patches as ONE undo step, then re-docks every line or
   * arrow bound to a moved element — so undo restores both together.
   */
  private applyArrange(entries: readonly ElementPatchEntry[]): void {
    if (entries.length === 0) {
      return
    }
    const byId = new Map(entries.map((entry) => [entry.id, entry.patch]))
    // A moved frame carries the children that were not moved themselves.
    for (const el of this.elements) {
      if (el.frameId === null || byId.has(el.id)) {
        continue
      }
      const frame = this.elementsMap.get(el.frameId)
      const framePatch = frame ? byId.get(frame.id) : undefined
      if (frame && framePatch) {
        const dx = (framePatch.x ?? frame.x) - frame.x
        const dy = (framePatch.y ?? frame.y) - frame.y
        if (dx !== 0 || dy !== 0) {
          byId.set(el.id, { x: el.x + dx, y: el.y + dy })
        }
      }
    }
    const topLevel = this.openStep === null
    if (topLevel) {
      this.beginStep()
    }
    this.mutate((current) => {
      let changed = false
      const next = current.map((el) => {
        const patch = byId.get(el.id)
        if (!patch) {
          return el
        }
        const patched = patchElement(el, patch)
        changed ||= patched !== el
        return patched
      })
      return changed ? next : null
    })
    for (const [id, patch] of bindingFollowPatches(new Set(byId.keys()), this.elements)) {
      this.updateElement<OpenDrawLinearElement>(id, patch)
    }
    if (topLevel) {
      this.endStep()
    }
  }

  // -------------------------------------------------------------------------
  // Z-order
  // -------------------------------------------------------------------------

  reorderElements(action: ReorderAction, ids: readonly string[]): void {
    if (ids.length === 0) {
      return
    }
    const idSet = new Set(ids)
    this.mutate((current) => reorderElementsInScene(current, idSet, action, this.appState.editingGroupId))
  }

  reorderSelection(action: ReorderAction): void {
    const ids = this.getSelectedElements().map((el) => el.id)
    this.reorderElements(action, withBoundTexts(this.elements, ids).map((el) => el.id))
  }

  // -------------------------------------------------------------------------
  // App state & selection
  // -------------------------------------------------------------------------

  setAppState(patch: Partial<OpenDrawAppState>): void {
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

  /**
   * Group-aware selection — what a click or marquee does: every id pulls in
   * the rest of its outermost visible group. In toggle mode a group that is
   * wholly selected leaves as a unit; otherwise it joins as a unit.
   */
  selectGrouped(ids: readonly string[], mode: 'replace' | 'toggle' = 'replace'): void {
    const expanded = expandIdsToGroups(this.elements, ids, this.appState.editingGroupId)
    if (mode === 'replace') {
      this.select(expanded)
      return
    }
    const selected = this.appState.selectedIds
    const allSelected = expanded.every((id) => selected[id])
    const next = { ...selected }
    for (const id of expanded) {
      if (allSelected) {
        delete next[id]
      } else {
        next[id] = true
      }
    }
    this.select(Object.keys(next))
  }

  /** Enters (or with null, leaves) a group for member-level editing. */
  setEditingGroup(groupId: string | null): void {
    if (groupId === this.appState.editingGroupId) {
      return
    }
    this.commitAppState({ ...this.appState, editingGroupId: groupId })
  }

  /**
   * Selects every unlocked element and leaves any edited group —
   * Excalidraw's actionSelectAll.
   */
  selectAll(): void {
    this.setEditingGroup(null)
    this.select(this.elements.filter((el) => !el.locked && !isBoundText(el)).map((el) => el.id))
  }

  // -------------------------------------------------------------------------
  // Groups
  // -------------------------------------------------------------------------

  /** Groups the selection (two or more elements) into one new group. */
  groupSelection(): void {
    const ids = new Set(this.getSelectedElements().map((el) => el.id))
    const result = groupElements(
      this.elements,
      ids,
      this.appState.editingGroupId,
      (el, groupIds) => patchElement(el, { groupIds }),
    )
    if (!result) {
      return
    }
    this.mutate(() => result.elements)
  }

  /** Dissolves every group selected as a unit. */
  ungroupSelection(): void {
    const next = ungroupElements(
      this.elements,
      this.appState.selectedIds,
      this.appState.editingGroupId,
      (el, groupIds) => patchElement(el, { groupIds }),
    )
    if (next) {
      this.mutate(() => next)
    }
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
    const ids = this.selectedTextIds()
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

  /**
   * Text that text-style commands act on: selected text plus the labels of
   * selected shapes (Excalidraw styles a container's label through it).
   */
  private selectedTextIds(): string[] {
    const selected = this.getSelectedElements().map((el) => el.id)
    return withBoundTexts(this.elements, selected).filter(isTextElement).map((el) => el.id)
  }

  /**
   * Steps the font size of every selected text element by Excalidraw's
   * relative step (10%, rounded — actionIncrease/DecreaseFontSize),
   * re-measuring each box. One undo step; a no-op without text selected.
   */
  stepFontSize(direction: 1 | -1): void {
    const ids = this.selectedTextIds()
    if (ids.length === 0) {
      return
    }
    this.beginStep()
    this.updateElements(ids, (el): ElementPatch => {
      if (!isTextElement(el)) {
        return {}
      }
      const scaled = direction === 1 ? el.fontSize * (1 + FONT_SIZE_STEP) : el.fontSize / (1 + FONT_SIZE_STEP)
      const fontSize = Math.max(MIN_FONT_SIZE, Math.round(scaled))
      const layout = layoutText(el.text, el.fontFamily, fontSize)
      return { fontSize, width: layout.width, height: layout.height }
    })
    this.endStep()
  }

  /**
   * Pastes a copied style onto the selection in ONE undo step — the
   * element style everywhere, text style on text (re-measured), corners
   * on rectangles and diamonds (Excalidraw's actionPasteStyles). Unlike
   * `changeStyle`, an empty selection is a no-op: pasting never rewrites
   * the defaults for new elements.
   */
  pasteStyle(payload: StylePayload): void {
    const ids = new Set(this.getSelectedElements().map((el) => el.id))
    if (ids.size === 0) {
      return
    }
    this.mutate((current) => {
      let changed = false
      const next = current.map((el) => {
        if (!ids.has(el.id)) {
          return el
        }
        let patch: ElementPatch = { ...payload.style }
        if (isTextElement(el) && payload.textStyle) {
          const layout = layoutText(el.text, payload.textStyle.fontFamily, payload.textStyle.fontSize)
          patch = { ...patch, ...payload.textStyle, width: layout.width, height: layout.height }
        }
        if ((el.type === 'rectangle' || el.type === 'diamond' || el.type === 'line') && payload.roundness !== undefined) {
          patch = { ...patch, roundness: payload.roundness }
        }
        const patched = patchElement(el, patch)
        changed ||= patched !== el
        return patched
      })
      return changed ? next : null
    })
  }

  /**
   * Sets one end's arrowhead on every selected arrow (one undo step); with
   * no arrow selected it becomes the head for the next arrow drawn.
   */
  changeArrowhead(position: 'start' | 'end', arrowhead: Arrowhead | null): void {
    const ids = this.getSelectedElements()
      .filter((el) => el.type === 'arrow')
      .map((el) => el.id)
    if (ids.length === 0) {
      this.commitAppState({
        ...this.appState,
        arrowheads: { ...this.appState.arrowheads, [position]: arrowhead },
      })
      return
    }
    const patch: ElementPatch<OpenDrawLinearElement> =
      position === 'start' ? { startArrowhead: arrowhead } : { endArrowhead: arrowhead }
    this.updateElements<OpenDrawLinearElement>(ids, patch)
  }

  /**
   * Excalidraw's "Arrow type": curves (round) or straightens (sharp) the
   * selected arrows; with none selected it sets the next arrow's type.
   */
  changeArrowType(type: 'round' | 'sharp'): void {
    const ids = this.getSelectedElements()
      .filter((el) => el.type === 'arrow')
      .map((el) => el.id)
    if (ids.length === 0) {
      this.commitAppState({ ...this.appState, arrowType: type })
      return
    }
    this.updateElements<OpenDrawLinearElement>(ids, { roundness: type === 'round' ? 'round' : null })
  }

  /**
   * Excalidraw's "Edges": rounds the selected rectangles, diamonds and
   * lines. With none selected it becomes the default for new ones.
   */
  changeRoundness(roundness: Roundness | null): void {
    const ids = this.getSelectedElements()
      .filter((el) => el.type === 'rectangle' || el.type === 'diamond' || el.type === 'line')
      .map((el) => el.id)
    if (ids.length === 0) {
      this.commitAppState({ ...this.appState, shapeRoundness: roundness })
      return
    }
    this.beginStep()
    this.updateElements(ids, (): ElementPatch => ({ roundness }))
    this.endStep()
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  serialize(): OpenDrawFile {
    return {
      type: 'opendraw',
      version: 1,
      elements: this.elements.map((el) => ({ ...el })),
      appState: { viewBackgroundColor: this.appState.viewBackgroundColor },
    }
  }

  /**
   * Replaces the scene wholesale. Resets history — a loaded scene is a new
   * timeline (Excalidraw behaves the same on scene load).
   */
  loadFile(input: OpenDrawFile): void {
    // Files come from disk, storage or a host app: coerce defensively so a
    // malformed or older element is repaired (or dropped), never trusted.
    const file = parseFile(input)
    this.elements = syncBoundTexts([], [...file.elements], patchElement)
    this.rebuildMap()
    this.appState = {
      ...this.appState,
      selectedIds: {},
      editingId: null,
      editingGroupId: null,
      // A file without its own background keeps the current one.
      viewBackgroundColor: typeof input.appState?.viewBackgroundColor === 'string'
        ? file.appState.viewBackgroundColor
        : this.appState.viewBackgroundColor,
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
