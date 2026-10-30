<script lang="ts">
  import { TOOLS, toolKeyHint, toolLabel, type EditorController, type ToolDefinition } from '@opendraw/editor'

  import Icon from './Icon.svelte'
  import { editorState } from './editorState.js'

  /** The top-center toolbar: tool lock, then every tool with its key hint. */
  let { editor }: { editor: EditorController } = $props()

  const active = $derived(editorState(editor, (e) => e.activeTool))
  const locked = $derived(editorState(editor, (e) => e.toolLocked))

  function activate(def: ToolDefinition): void {
    if (def.opensPicker) {
      editor.openImagePicker()
    } else {
      editor.setActiveTool(def.tool)
    }
  }
</script>

<div class="opendraw__island opendraw__toolbar" role="toolbar" aria-label="Drawing tools">
  <button
    type="button"
    class="opendraw__button"
    aria-label="Keep selected tool active after drawing (Q)"
    title="Keep selected tool active after drawing (Q)"
    aria-pressed={locked.current}
    onclick={() => editor.toggleToolLock()}
  >
    <Icon name={locked.current ? 'lock' : 'unlock'} />
  </button>
  <span class="opendraw__divider" aria-hidden="true"></span>
  {#each TOOLS as def (def.tool)}
    <button
      type="button"
      class="opendraw__button"
      aria-label={toolLabel(def)}
      title={toolLabel(def)}
      aria-pressed={!def.opensPicker && active.current === def.tool}
      onclick={() => activate(def)}
    >
      <Icon name={def.icon} />
      <span class="opendraw__key" aria-hidden="true">{toolKeyHint(def)}</span>
    </button>
  {/each}
</div>
