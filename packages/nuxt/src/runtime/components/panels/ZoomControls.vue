<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Point } from '@opendraw/core'

import { useOpenDraw } from '../../composables/useOpenDraw.js'
import UiIconButton from '../ui/UiIconButton.vue'
import UiPanel from '../ui/UiPanel.vue'

/**
 * Zoom island — Excalidraw parity. Excalidraw places its zoom controls in
 * the bottom-left of the canvas as one row: zoom out, the live zoom
 * percentage (clickable to reset), zoom in.
 */
const ctx = useOpenDraw()

const percent = computed(() => `${Math.round(ctx.viewport.value.zoom * 100)}%`)

// ---------------------------------------------------------------------------
// Button zoom anchors at the canvas center, in canvas-local screen coords —
// the space zoomAt() expects. The lookup stays inside this editor's own
// .opendraw-root subtree, so several editors on one page never cross anchors.
// ---------------------------------------------------------------------------

const rootEl = ref<HTMLElement | null>(null)

function zoomAnchor(): Point {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 }
  }
  const canvas = rootEl.value?.closest('.opendraw-root')?.querySelector('.opendraw-canvas')
  const rect = canvas?.getBoundingClientRect()
  if (rect) {
    return { x: rect.width / 2, y: rect.height / 2 }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}
</script>

<template>
  <UiPanel position="bottom-left">
    <div ref="rootEl" class="zoom-controls" role="group" aria-label="Zoom">
      <UiIconButton icon="zoomOut" label="Zoom out" @click="ctx.zoomOut(zoomAnchor())" />
      <button
        type="button"
        class="zoom-controls__reset"
        :aria-label="`Reset zoom (currently ${percent})`"
        title="Reset zoom"
        @click="ctx.resetZoom()"
      >
        <span class="zoom-controls__value">{{ percent }}</span>
      </button>
      <UiIconButton icon="zoomIn" label="Zoom in" @click="ctx.zoomIn(zoomAnchor())" />
    </div>
  </UiPanel>
</template>

<style scoped>
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Text-button sibling of UiIconButton: same 40px hit area and press
   feedback, with tabular numerals so the width never jitters while
   zooming. */
.zoom-controls__reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  min-width: 48px;
  padding: 0 10px;
  border: none;
  border-radius: var(--od-radius-m);
  background: transparent;
  color: var(--od-ink);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background-color var(--od-fast) var(--od-ease),
    transform var(--od-fast) var(--od-ease);
}

.zoom-controls__reset:hover {
  background: var(--od-hover);
}

.zoom-controls__reset:active {
  transform: scale(0.96);
}

.zoom-controls__reset:focus-visible {
  outline: 2px solid var(--od-accent);
  outline-offset: 2px;
}
</style>
