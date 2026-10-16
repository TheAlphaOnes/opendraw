/**
 * Snapshot-based undo/redo with structural sharing.
 *
 * Excalidraw moved from snapshot-per-entry to inverse deltas because their
 * scenes are huge and shared with collaborators. We keep snapshots: our
 * elements are immutable copy-on-write records, so a snapshot is just two
 * cheap references, and correctness is trivial to reason about.
 *
 * One Excalidraw nuance is kept: an appState-only change (selection,
 * background color) does NOT clear the redo stack — only element changes do.
 */

import type { VueDrawAppState, VueDrawElement } from '../types.js'

export interface HistorySnapshot {
  elements: readonly VueDrawElement[]
  appState: Readonly<VueDrawAppState>
}

export interface HistoryEntry {
  before: HistorySnapshot
  after: HistorySnapshot
}

const MAX_HISTORY = 100

export class SceneHistory {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * Records a completed change. `affectsElements` controls whether the
   * redo stack is cleared (element changes) or preserved (appState-only).
   */
  push(entry: HistoryEntry, affectsElements: boolean): void {
    if (entry.before === entry.after) {
      return
    }
    this.undoStack.push(entry)
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift()
    }
    if (affectsElements) {
      this.redoStack.length = 0
    }
  }

  /** Pops the last entry for undo — the entry moves to the redo stack. */
  popForUndo(): HistoryEntry | null {
    const entry = this.undoStack.pop()
    if (!entry) {
      return null
    }
    this.redoStack.push(entry)
    return entry
  }

  /** Pops the redo entry — moves back onto the undo stack. */
  popForRedo(): HistoryEntry | null {
    const entry = this.redoStack.pop()
    if (!entry) {
      return null
    }
    this.undoStack.push(entry)
    return entry
  }

  clear(): void {
    this.undoStack.length = 0
    this.redoStack.length = 0
  }
}
