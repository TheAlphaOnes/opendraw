import { createSubscriber } from 'svelte/reactivity'

import type { EditorController } from '@opendraw/editor'

/**
 * Svelte bindings for the framework-free editor. The controller owns all
 * behavior; `subscribe()` fires on every document or editor-state change
 * and the getters are memoized per change, so reading `.current` inside a
 * template or $derived re-runs exactly when the editor changes.
 *
 *   const tool = editorState(editor, (e) => e.activeTool)
 *   {tool.current}
 */
export class EditorState<T> {
  readonly #track: () => void

  constructor(
    private readonly editor: EditorController,
    private readonly read: (editor: EditorController) => T,
  ) {
    this.#track = createSubscriber((update) => editor.subscribe(update))
  }

  get current(): T {
    this.#track()
    return this.read(this.editor)
  }
}

export function editorState<T>(editor: EditorController, read: (editor: EditorController) => T): EditorState<T> {
  return new EditorState(editor, read)
}
