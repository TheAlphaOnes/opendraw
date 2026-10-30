<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'

import { detectKeyPlatform } from '../actions/keys.js'
import { onCanvasPointerDown } from '../canvas/pointerPress.js'
import { onCanvasPointerMove } from '../canvas/pointerDrag.js'
import { onCanvasPointerLeave, onCanvasPointerUp } from '../canvas/pointerRelease.js'
import { createCanvasRuntime } from '../canvas/runtime.js'
import { onCanvasDoubleClick } from '../canvas/textEntry.js'
import { useCanvasCursor } from '../canvas/useCanvasCursor.js'
import { useCanvasKeyboard } from '../canvas/useCanvasKeyboard.js'
import { useCanvasSurface } from '../canvas/useCanvasSurface.js'
import { useLaserTrail } from '../canvas/useLaserTrail.js'
import {
  onCanvasDrop,
  onCanvasWheel,
  onWindowPaste,
  resolveContextMenu,
  type CanvasContextMenuRequest,
} from '../canvas/viewportGestures.js'
import { useVueDraw } from '../composables/useVueDraw.js'
import TextEditor from './TextEditor.vue'

/**
 * VueDrawCanvas — the headless editor core.
 *
 * Owns the two-canvas renderer (static scene + interactive chrome) and the
 * pointer state machine. No UI chrome lives here; <VueDraw> composes this
 * with the toolbar/panels. Pointing this component at the same provided
 * context is how headless consumers embed just the canvas.
 *
 * The behavior lives in `../canvas/`: one module per concern (press, drag,
 * release, keyboard, cursor, surface, laser), all sharing one runtime.
 */

const emit = defineEmits<{
  (e: 'contextmenu', payload: CanvasContextMenuRequest): void
}>()

const ctx = useVueDraw()
const rt = createCanvasRuntime(ctx)
const hostRef = rt.hostRef
const { staticRef, overlayRef, setOverlayPainter } = useCanvasSurface(rt)
const laser = useLaserTrail(rt)
setOverlayPainter(laser.draw)
useCanvasKeyboard(rt)
const cursor = useCanvasCursor(rt)

/**
 * The wysiwyg editor mounts per editing session: every open gets a fresh
 * component (fresh `committed` flag, freshly registered window listeners)
 * and every close unmounts it. Mounting it permanently with an internal
 * v-if left its session lifecycle hooks dead — the textarea never received
 * focus and `committed` stayed poisoned after the first stray commit.
 */
const editingActive = computed(() => ctx.editingId.value !== null)
const panning = computed(() => rt.interaction.value.kind === 'panning')

const onPointerDown = (event: PointerEvent): void => onCanvasPointerDown(rt, laser, event)
const onPointerMove = (event: PointerEvent): void => onCanvasPointerMove(rt, laser, event)
const onPointerUp = (event: PointerEvent): void => onCanvasPointerUp(rt, event)
const onPointerLeave = (): void => onCanvasPointerLeave(rt)
const onDoubleClick = (event: MouseEvent): void => onCanvasDoubleClick(rt, event)
const onWheel = (event: WheelEvent): void => onCanvasWheel(rt, event)
const onDrop = (event: DragEvent): void => onCanvasDrop(rt, event)
const onPaste = (event: ClipboardEvent): void => onWindowPaste(rt, event)
const onContextMenu = (event: MouseEvent): void => emit('contextmenu', resolveContextMenu(rt, event))

/**
 * Suppress the mousedown default (focus move) for presses on the host
 * itself. Focus is managed explicitly on pointerdown, and the default
 * steals focus from a text editor mounted mid-press: pointerdown creates
 * the element, the editor mounts and focuses on the microtask checkpoint,
 * and the trailing mousedown would then blur it — committing the empty
 * draft and rolling the whole step back. Presses on child elements (the
 * text editor's textarea) keep their native behavior.
 */
function onMouseDown(event: MouseEvent): void {
  if (hostRef.value !== null && event.target === hostRef.value) {
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
  // Shortcut hints switch to ⌘/⌥ glyphs only after hydration.
  detectKeyPlatform()
})
onBeforeUnmount(() => window.removeEventListener('paste', onPaste))
</script>

<template>
  <div
    ref="hostRef"
    class="vuedraw-canvas"
    :class="{ 'vuedraw-canvas--panning': panning }"
    :style="{ cursor }"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerLeave"
    @mousedown="onMouseDown"
    @wheel="onWheel"
    @dblclick="onDoubleClick"
    @contextmenu.prevent="onContextMenu"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <canvas ref="staticRef" class="vuedraw-canvas__static" />
    <canvas ref="overlayRef" class="vuedraw-canvas__overlay" />
    <TextEditor v-if="editingActive" />
  </div>
</template>

<style scoped>
.vuedraw-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  outline: none;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.vuedraw-canvas__static,
.vuedraw-canvas__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.vuedraw-canvas--panning {
  cursor: grabbing !important;
}
</style>
