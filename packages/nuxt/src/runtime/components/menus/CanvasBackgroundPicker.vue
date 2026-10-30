<script setup lang="ts">
import { computed } from 'vue'

import { CANVAS_BACKGROUND } from '@opendrawjs/core'

import { useOpenDraw } from '../../composables/useOpenDraw.js'

/**
 * The main menu's "Canvas background" row — Excalidraw's
 * DEFAULT_CANVAS_BACKGROUND_PICKS (white, radix slate2, blue2, yellow2,
 * bronze2), with the dark default in the dark theme. The background is
 * user data: it is painted as picked, never dark-filtered.
 */
const ctx = useOpenDraw()

const LIGHT_PICKS = ['#ffffff', '#f8f9fa', '#f5faff', '#fffce8', '#fdf8f6'] as const
const DARK_PICKS = [CANVAS_BACKGROUND.dark, '#161718', '#13171c', '#181605', '#1b1615'] as const

const picks = computed(() => (ctx.theme.value === 'dark' ? DARK_PICKS : LIGHT_PICKS))
const current = computed(() => ctx.viewBackgroundColor.value.toLowerCase())
</script>

<template>
  <div class="canvas-bg" role="group" aria-label="Canvas background">
    <span class="canvas-bg__label">Canvas background</span>
    <div class="canvas-bg__swatches" role="radiogroup" aria-label="Canvas background">
      <button
        v-for="color in picks"
        :key="color"
        type="button"
        role="radio"
        class="canvas-bg__swatch"
        :style="{ background: color }"
        :aria-checked="current === color"
        :aria-label="color"
        :title="color"
        @click="ctx.setViewBackgroundColor(color)"
      />
    </div>
  </div>
</template>

<style scoped>
.canvas-bg {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 8px 4px;
}

.canvas-bg__label {
  font-size: 12px;
  color: var(--od-ink);
}

.canvas-bg__swatches {
  display: flex;
  gap: 6px;
}

.canvas-bg__swatch {
  position: relative;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--od-divider);
  cursor: pointer;
  transition: transform 90ms var(--od-ease);
}

.canvas-bg__swatch:active {
  transform: scale(0.92);
}

.canvas-bg__swatch:hover {
  box-shadow: 0 0 0 1px var(--od-accent);
}

.canvas-bg__swatch[aria-checked='true'] {
  box-shadow:
    0 0 0 1px var(--od-surface),
    0 0 0 2px var(--od-accent);
}

.canvas-bg__swatch:focus-visible {
  outline: 2px solid var(--od-accent);
  outline-offset: 2px;
}
</style>
