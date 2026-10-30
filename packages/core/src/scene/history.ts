/**
 * Snapshot-based undo/redo with structural sharing.
 *
 * Excalidraw moved from snapshot-per-entry to inverse deltas because their
 * scenes are huge and shared with collaborators. We keep snapshots: our
 * elements are immutable copy-on-write records, so a snapshot is just two
 * cheap references, and correctness is trivial to reason about.
 *
 * Parity law: only scene (element) changes become entries, so every push
 * clears the redo stack. AppState-only changes (selection, tool, style)
 * are never recorded at all — the redo stack survives them trivially.
 */

import type { OpenDrawAppState, OpenDrawElement } from '../types.js'

export interface HistorySnapshot {
  elements: readonly OpenDrawElement[]
  appState: Readonly<OpenDrawAppState>
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

  /** Records a completed scene change; clears the redo stack. */
  push(entry: HistoryEntry): void {
    if (entry.before === entry.after) {
      return
    }
    this.undoStack.push(entry)
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift()
    }
    this.redoStack.length = 0
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
