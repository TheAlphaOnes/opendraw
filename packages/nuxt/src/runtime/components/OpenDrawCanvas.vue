<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { mountCanvas, type CanvasContextMenuRequest, type CanvasSession } from '@opendrawjs/editor'

import { useOpenDraw } from '../composables/useOpenDraw.js'

/**
 * OpenDrawCanvas — the headless editor core for Vue.
 *
 * Renders the host and its two stacked canvases (static scene + interactive
 * chrome) and mounts the framework-free editor onto them: every gesture,
 * shortcut, render and the text editor live in @opendrawjs/editor. No UI
 * chrome lives here; <OpenDraw> composes this with the toolbar/panels.
 */

const emit = defineEmits<{
  (e: 'contextmenu', payload: CanvasContextMenuRequest): void
}>()

const ctx = useOpenDraw()
const hostRef = ref<HTMLDivElement | null>(null)
const staticRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLCanvasElement | null>(null)
let session: CanvasSession | null = null

onMounted(() => {
  session = mountCanvas(ctx.editor, {
    host: hostRef.value!,
    staticCanvas: staticRef.value!,
    overlayCanvas: overlayRef.value!,
    onContextMenu: (request) => emit('contextmenu', request),
  })
})

onBeforeUnmount(() => {
  session?.dispose()
  session = null
})
</script>

<template>
  <div ref="hostRef" class="opendraw-canvas" tabindex="0">
    <canvas ref="staticRef" class="opendraw-canvas__static" />
    <canvas ref="overlayRef" class="opendraw-canvas__overlay" />
  </div>
</template>

<style scoped>
.opendraw-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  outline: none;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.opendraw-canvas__static,
.opendraw-canvas__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.opendraw-canvas.opendraw-canvas--panning {
  cursor: grabbing !important;
}
</style>
