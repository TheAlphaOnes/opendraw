<script lang="ts">
  import type { EditorController } from '@opendrawjs/editor'

  import Icon from './Icon.svelte'
  import { editorState } from './editorState.js'

  /** Bottom-left zoom and history islands, and the top-right theme toggle. */
  let { editor }: { editor: EditorController } = $props()

  const zoom = $derived(editorState(editor, (e) => e.viewport.zoom))
  const canUndo = $derived(editorState(editor, (e) => e.canUndo))
  const canRedo = $derived(editorState(editor, (e) => e.canRedo))
  const dark = $derived(editorState(editor, (e) => e.theme === 'dark'))

  const percent = $derived(`${Math.round(zoom.current * 100)}%`)
  const center = () => ({ x: editor.viewportSize.width / 2, y: editor.viewportSize.height / 2 })
</script>

<div class="opendraw__bottom-left">
  <div class="opendraw__island opendraw__zoom-island" role="group" aria-label="Zoom">
    <button type="button" class="opendraw__button" aria-label="Zoom out" title="Zoom out" onclick={() => editor.zoomOut(center())}>
      <Icon name="zoomOut" />
    </button>
    <button
      type="button"
      class="opendraw__zoom"
      aria-label={`Reset zoom (currently ${percent})`}
      title="Reset zoom"
      onclick={() => editor.resetZoom()}
    >
      {percent}
    </button>
    <button type="button" class="opendraw__button" aria-label="Zoom in" title="Zoom in" onclick={() => editor.zoomIn(center())}>
      <Icon name="zoomIn" />
    </button>
  </div>
  <div class="opendraw__island" role="group" aria-label="History">
    <button type="button" class="opendraw__button" aria-label="Undo" title="Undo" disabled={!canUndo.current} onclick={() => editor.undo()}>
      <Icon name="undo" />
    </button>
    <button type="button" class="opendraw__button" aria-label="Redo" title="Redo" disabled={!canRedo.current} onclick={() => editor.redo()}>
      <Icon name="redo" />
    </button>
  </div>
</div>
<div class="opendraw__island opendraw__corner">
  <button
    type="button"
    class="opendraw__button"
    aria-label={dark.current ? 'Light mode' : 'Dark mode'}
    title={dark.current ? 'Light mode' : 'Dark mode'}
    onclick={() => editor.toggleTheme()}
  >
    <Icon name={dark.current ? 'sun' : 'moon'} />
  </button>
</div>
