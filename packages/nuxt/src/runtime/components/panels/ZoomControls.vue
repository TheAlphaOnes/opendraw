<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Point } from '@opendraw/core'
import { useKeyDisplay } from '../../composables/useKeyDisplay.js'
import { useOpenDraw } from '../../composables/useOpenDraw.js'
import ActionButton from './ActionButton.vue'
import UiIconButton from '../ui/UiIconButton.vue'

/**
 * The bottom-left footer — Excalidraw's zoom island (zoom out, the live
 * percentage that resets on click, zoom in) and, beside it, the undo/redo
 * island. Button zoom anchors at the canvas center.
 */
const ctx = useOpenDraw()
const keys = useKeyDisplay()

const percent = computed(() => `${Math.round(ctx.viewport.value.zoom * 100)}%`)
const rootEl = ref<HTMLElement | null>(null)

function zoomAnchor(): Point {
  const canvas = rootEl.value?.closest('.opendraw-root')?.querySelector('.opendraw-canvas')
  const rect = canvas?.getBoundingClientRect()
  return rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 }
}
</script>

<template>
  <div ref="rootEl" class="footer-left">
    <div class="footer-left__island zoom-controls" role="group" aria-label="Zoom">
      <UiIconButton size="lg" icon="zoomOut" :label="`Zoom out (${keys.text(['Mod', '-'])})`" @click="ctx.zoomOut(zoomAnchor())" />
      <button
        type="button"
        class="footer-left__zoom"
        :aria-label="`Reset zoom (currently ${percent})`"
        title="Reset zoom"
        @click="ctx.resetZoom()"
      >
        {{ percent }}
      </button>
      <UiIconButton size="lg" icon="zoomIn" :label="`Zoom in (${keys.text(['Mod', '+'])})`" @click="ctx.zoomIn(zoomAnchor())" />
    </div>
    <div class="footer-left__island" role="group" aria-label="History">
      <ActionButton action="undo" size="lg" />
      <ActionButton action="redo" size="lg" />
    </div>
  </div>
</template>

<style scoped>
.footer-left {
  position: absolute;
  z-index: 10;
  left: var(--od-gutter);
  bottom: var(--od-gutter);
  display: flex;
  gap: 8px;
}

/* Excalidraw's .zoom-actions / .undo-redo-buttons: buttons flush in an island. */
.footer-left__island {
  display: flex;
  align-items: center;
  background: var(--od-surface);
  border-radius: var(--od-radius-l);
  box-shadow: var(--od-shadow-1), var(--od-shadow-2);
  animation: footer-in 240ms var(--od-ease) both;
}

.footer-left__island + .footer-left__island {
  animation-delay: 40ms;
  animation-duration: 300ms;
}

@keyframes footer-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

/* Phones: pinch zooms, so the zoom island goes; undo/redo move up beside
   the main menu, clear of the bottom toolbar. */
@media (max-width: 640px) {
  .footer-left {
    top: var(--od-gutter);
    bottom: auto;
    left: calc(var(--od-gutter) + var(--od-button-lg) + 8px);
  }

  .zoom-controls {
    display: none;
  }
}

.footer-left__zoom {
  height: var(--od-button-lg);
  min-width: 60px;
  padding: 0 4px;
  border: none;
  border-radius: var(--od-radius-l);
  background: transparent;
  color: var(--od-ink);
  font: inherit;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color var(--od-fast) ease-out;
}

.footer-left__zoom:hover {
  background: var(--od-hover);
}

.footer-left__zoom:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--od-accent);
}
</style>
