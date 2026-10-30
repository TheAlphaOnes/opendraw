<script lang="ts">
  import { ARROW_TYPE_OPTIONS, type EditorController } from '@opendraw/editor'

  import { editorState } from './editorState.js'

  /**
   * Excalidraw's "Arrow type" — sharp, curved or elbow — shown while the
   * arrow tool is armed or arrows are selected. Picking applies to the
   * selected arrows, else to the next arrow drawn.
   */
  let { editor }: { editor: EditorController } = $props()

  const tool = $derived(editorState(editor, (e) => e.activeTool))
  const arrows = $derived(editorState(editor, (e) => e.selectedElements.filter((el) => el.type === 'arrow')))
  const fallback = $derived(editorState(editor, (e) => e.appState.arrowType))

  const current = $derived.by(() => {
    const first = arrows.current[0]
    return first ? (first.elbowed ? 'elbow' : first.roundness === 'round' ? 'round' : 'sharp') : fallback.current
  })
</script>

{#if tool.current === 'arrow' || arrows.current.length > 0}
  <div class="opendraw__island opendraw__panel" role="group" aria-label="Arrow type">
    <span class="opendraw__panel-label">Arrow type</span>
    <div class="opendraw__options" role="radiogroup" aria-label="Arrow type">
      {#each ARROW_TYPE_OPTIONS as option (option.type)}
        <button
          type="button"
          role="radio"
          class="opendraw__option"
          aria-checked={current === option.type}
          aria-label={option.label}
          title={option.label}
          onclick={() => editor.changeArrowType(option.type)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            {#each option.paths as d (d)}
              <path {d} />
            {/each}
          </svg>
        </button>
      {/each}
    </div>
  </div>
{/if}
