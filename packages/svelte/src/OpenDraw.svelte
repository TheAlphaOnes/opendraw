<script lang="ts">
  import { untrack, type Snippet } from 'svelte'
  import type { OpenDrawElement, OpenDrawState } from '@opendraw/core'
  import {
    attachScenePersistence,
    createEditor,
    resolveThemeDefault,
    type EditorController,
    type ThemeDefault,
  } from '@opendraw/editor'

  import Footer from './Footer.svelte'
  import OpenDrawCanvas from './OpenDrawCanvas.svelte'
  import Toolbar from './Toolbar.svelte'
  import { editorState } from './editorState.js'

  /**
   * The editor, ready to drop on a page — the canvas with an
   * Excalidraw-style toolbar, zoom and history islands and a theme toggle.
   * Import the styles once: `import '@opendraw/editor/styles.css'`.
   */
  interface Props {
    /** Bring your own controller (to drive it from outside); one is created otherwise. */
    editor?: EditorController
    /** Starting theme; a persisted theme wins over it. */
    theme?: ThemeDefault
    /** Autosave: `true` (shared key), a storage key, or `false`. */
    persist?: boolean | string
    /** Elements to start with when nothing is persisted. */
    initialElements?: readonly OpenDrawElement[]
    /** `full`: toolbar, zoom, history and theme · `none`: the bare canvas. */
    ui?: 'full' | 'none'
    /** Every document or editor-state change. */
    onchange?: (state: OpenDrawState) => void
    /** Extra overlay content, rendered inside the editor root. */
    children?: Snippet
    class?: string
  }

  let {
    editor: provided,
    theme = 'system',
    persist = true,
    initialElements = [],
    ui = 'full',
    onchange,
    children,
    class: className = '',
  }: Props = $props()

  // The controller is created once and lives as long as the component; a
  // provided one wins. Later prop changes deliberately do not swap it.
  const editor = untrack(() => provided ?? createEditor({ elements: initialElements }))
  const themeAttr = editorState(editor, (e) => e.theme)

  // Autosave and restore on mount (Excalidraw parity).
  $effect(() => {
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
  })

  $effect(() => {
    if (!onchange) {
      return
    }
    return editor.subscribe((e) => onchange(e.state))
  })
</script>

<div class="opendraw {className}" data-opendraw-root data-theme={themeAttr.current}>
  <OpenDrawCanvas {editor} />
  {#if ui === 'full'}
    <Toolbar {editor} />
    <Footer {editor} />
  {/if}
  {@render children?.()}
</div>
