import { useEffect, useState, useSyncExternalStore } from 'react'

import {
  attachScenePersistence,
  createEditor,
  resolveThemeDefault,
  type CreateEditorOptions,
  type EditorController,
  type ThemeDefault,
} from '@opendrawjs/editor'

/**
 * React bindings for the framework-free editor. The controller owns all
 * behavior; React only subscribes to it — `subscribe()` fires on every
 * document or editor-state change and the getters are memoized per change,
 * which makes the controller a natural external store.
 */

/** Creates one editor for the component's lifetime. */
export function useOpenDrawEditor(options: CreateEditorOptions = {}): EditorController {
  const [editor] = useState(() => createEditor(options))
  return editor
}

/**
 * Reads a slice of editor state and re-renders when it changes:
 *
 *   const tool = useEditorState(editor, (e) => e.activeTool)
 */
export function useEditorState<T>(editor: EditorController, read: (editor: EditorController) => T): T {
  return useSyncExternalStore(
    (onChange) => editor.subscribe(onChange),
    () => read(editor),
    () => read(editor),
  )
}

export interface ScenePersistenceProps {
  /** `true` saves under the shared key, a string under that key, `false` not at all. */
  persist?: boolean | string
  /** First-load theme; a persisted theme wins over it. */
  theme?: ThemeDefault
}

/** Autosave to localStorage and restore on mount (Excalidraw parity). */
export function useScenePersistence(editor: EditorController, { persist = true, theme = 'system' }: ScenePersistenceProps): void {
  useEffect(() => {
    if (persist === false) {
      editor.setTheme(resolveThemeDefault(theme))
      return
    }
    const persistence = attachScenePersistence(editor, {
      ...(typeof persist === 'string' ? { storageKey: persist } : {}),
      themeDefault: theme,
    })
    persistence.restore()
    return () => persistence.dispose()
  }, [editor, persist, theme])
}
