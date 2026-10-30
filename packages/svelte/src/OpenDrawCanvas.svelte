<script lang="ts">
  import { mountCanvas, type CanvasContextMenuRequest, type EditorController } from '@opendrawjs/editor'

  /**
   * The canvas on its own: a focusable host with the scene and overlay
   * canvases, mounted onto the editor, every gesture, shortcut, the text
   * editor and rendering come from @opendrawjs/editor. No chrome.
   */
  interface Props {
    editor: EditorController
    /** A right-click asked for a context menu (the target is already selected). */
    oncontextmenu?: (request: CanvasContextMenuRequest) => void
    class?: string
  }

  let { editor, oncontextmenu, class: className = '' }: Props = $props()

  let host: HTMLDivElement
  let scene: HTMLCanvasElement
  let overlay: HTMLCanvasElement

  $effect(() => {
    const session = mountCanvas(editor, {
      host,
      staticCanvas: scene,
      overlayCanvas: overlay,
      onContextMenu: (request) => oncontextmenu?.(request),
    })
    return () => session.dispose()
  })
</script>

<!-- The host takes focus so the editor's keyboard shortcuts reach it. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div bind:this={host} class="opendraw__host {className}" tabindex="0" role="application" aria-label="Drawing canvas">
  <canvas bind:this={scene} class="opendraw__static"></canvas>
  <canvas bind:this={overlay} class="opendraw__overlay"></canvas>
</div>
