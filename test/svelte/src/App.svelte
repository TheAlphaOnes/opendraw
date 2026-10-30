<script lang="ts">
  import type { OpenDrawState } from '@opendraw/core'
  import { OpenDraw } from '@opendraw/svelte'

  /** The Svelte test app: the full editor filling the page. */
  function onchange(state: OpenDrawState): void {
    // The e2e suite reads the scene through the public change event.
    ;(window as unknown as { __opendraw: unknown }).__opendraw = {
      elements: state.elements,
      theme: state.appState.theme,
    }
  }
</script>

<main class="page">
  <OpenDraw {onchange} />
</main>
