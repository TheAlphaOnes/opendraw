<script setup lang="ts">
import { computed } from 'vue'

import { isTextContainer } from '@opendraw/core'

import { useKeyDisplay } from '../../composables/useKeyDisplay.js'
import { useOpenDraw } from '../../composables/useOpenDraw.js'

/**
 * The hint line under the toolbar — Excalidraw's HintViewer, with its
 * copy (locales/en.json "hints") and its key chips. Only hints for behavior
 * opendraw has are listed; a hint never advertises a gesture that does
 * nothing. With nothing selected it falls back to the canvas-panning hint.
 */
type HintPart = string | { key: string }

const ctx = useOpenDraw()
const keys = useKeyDisplay()

const hint = computed<HintPart[] | null>(() => {
  if (ctx.editingId.value !== null) {
    return ['Press ', { key: 'Escape' }, ' or ', { key: keys.text(['Mod', 'Enter']) }, ' to finish editing']
  }
  switch (ctx.activeTool.value) {
    case 'arrow':
      return ctx.appState.value.arrowType === 'elbow'
        ? ['Drag to draw an elbow arrow. Press ', { key: 'A' }, ' again to change arrow type.']
        : ['Click to start multiple points, drag for single line. Press ', { key: 'A' }, ' again to change arrow type.']
    case 'line':
      return ['Click to start multiple points, drag for single line']
    case 'freedraw':
      return ["Click and drag, release when you're finished"]
    case 'text':
      return ['Tip: you can also add text by double-clicking anywhere with the selection tool']
    case 'stickynote':
      return ['Click to place a note, or drag to size it']
  }
  const selected = ctx.selectedElements.value
  const only = selected.length === 1 ? selected[0]! : null
  if (only?.type === 'text') {
    return ['Double-click or press ', { key: 'Enter' }, ' to edit text']
  }
  if (only && isTextContainer(only) && !only.locked) {
    return ['Press ', { key: 'Enter' }, ' to add text']
  }
  if (selected.length === 0) {
    return ['To move canvas, hold ', { key: 'Scroll wheel' }, ' or ', { key: 'Space' }, ' while dragging, or use the hand tool']
  }
  return null
})

const hintKey = computed(() => (hint.value ? hint.value.map((part) => (typeof part === 'string' ? part : part.key)).join('') : ''))
</script>

<template>
  <Transition name="tool-hint" mode="out-in">
    <p v-if="hint" :key="hintKey" class="tool-hint">
      <template v-for="(part, index) in hint" :key="index">
        <kbd v-if="typeof part !== 'string'" class="tool-hint__key">{{ part.key }}</kbd>
        <template v-else>{{ part }}</template>
      </template>
    </p>
  </Transition>
</template>

<style scoped>
.tool-hint {
  margin: 0;
  padding: 0 8px;
  max-width: 100%;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
  color: var(--od-ink-soft);
  pointer-events: none;
  user-select: none;
}

/* Excalidraw's HintViewer kbd: a small outlined monospace chip. */
.tool-hint__key {
  display: inline-block;
  margin: 0 1px;
  padding: 0 4px;
  border: 1px solid var(--od-keybinding);
  border-radius: 4px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
  line-height: 1.5;
}

.tool-hint-enter-active {
  transition:
    opacity 180ms ease-out,
    transform 220ms var(--od-ease);
}

.tool-hint-leave-active {
  transition: opacity 90ms ease-in;
}

.tool-hint-enter-from {
  opacity: 0;
  transform: translateY(-2px);
}

.tool-hint-leave-to {
  opacity: 0;
}
</style>
